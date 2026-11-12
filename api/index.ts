import express from "express";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { GoogleGenAI, Type } from "@google/genai";

// Load configuration
dotenv.config();
mongoose.set("sanitizeFilter", true);

export function validateJwtSecret(rawSecret: string | undefined): string {
  const trimmed = (rawSecret || "").trim();
  const placeholders = new Set([
    "CHANGE_ME",
    "jwt-fallback-secret-key-12345",
    "YOUR_JWT_SECRET"
  ]);
  if (
    !trimmed ||
    trimmed.length < 32 ||
    placeholders.has(trimmed) ||
    trimmed.toUpperCase().startsWith("CHANGE_ME")
  ) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is missing, shorter than 32 characters, or set to a placeholder. Generate a strong secret with: openssl rand -base64 48"
    );
  }
  return trimmed;
}

const JWT_SECRET = validateJwtSecret(process.env.JWT_SECRET);

// Persistent session policy: signed-in devices keep their session for 7 days, and the
// expiry slides forward while the app is in use, so only an explicit logout ends it.
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_DURATION = "7d";
const SESSION_RENEW_AFTER_MS = 30 * 60 * 1000; // re-issue the token after 30 minutes of use
const SESSION_COOKIE_NAME = "token";

// Cookie policy for the sliding session (Secure is only set on HTTPS so http dev/preview also persists)
function sessionCookieOptions(req: express.Request) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return {
    httpOnly: true,
    secure: req.secure || forwardedProto === "https",
    sameSite: "strict" as const,
    maxAge: SESSION_DURATION_MS,
    path: "/"
  };
}

// bcryptjs Password Hashing Helpers
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return bcrypt.compare(password, hash);
  }
  if (/^[a-f0-9]{64}$/i.test(hash)) {
    // Legacy SHA256 fallback comparison using constant-time comparison
    const sha256Hash = crypto.createHash("sha256").update(password).digest("hex");
    const hashBuf = Buffer.from(hash.toLowerCase(), "utf8");
    const expectedBuf = Buffer.from(sha256Hash.toLowerCase(), "utf8");
    if (hashBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashBuf, expectedBuf);
  }
  // Legacy unhashed password fallback (from prior system reset bug) using constant-time comparison
  const hashBuf = Buffer.from(hash, "utf8");
  const inputBuf = Buffer.from(password, "utf8");
  if (hashBuf.length !== inputBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(hashBuf, inputBuf);
}

const app = express();

app.use(express.json());
app.use(cookieParser());

// Normalize Netlify Functions URL routing (maps /.netlify/functions/api/* to /api/*)
app.use((req, res, next) => {
  if (req.url.startsWith("/.netlify/functions/api")) {
    req.url = req.url.replace(/^\/\.netlify\/functions\/api/, "/api") || "/api";
  }
  next();
});

// Secure CORS policy middleware using an exact-match origin allow-list
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set<string>();
  if (process.env.APP_URL) {
    allowedOrigins.add(process.env.APP_URL.trim().replace(/\/+$/, ""));
  }
  if (process.env.URL) {
    allowedOrigins.add(process.env.URL.trim().replace(/\/+$/, ""));
  }
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://localhost:5173");
  }

  if (typeof origin === "string" && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Client IP resolution (prefers Netlify's x-nf-client-connection-ip header, then req.ip)
function getClientIp(req: express.Request): string {
  const nfHeader = req.headers["x-nf-client-connection-ip"];
  if (typeof nfHeader === "string" && nfHeader.trim()) {
    return nfHeader.split(",")[0].trim();
  }
  if (Array.isArray(nfHeader) && nfHeader.length > 0 && nfHeader[0].trim()) {
    return nfHeader[0].trim();
  }
  return req.ip || "unknown";
}

const LOGIN_ATTEMPT_TTL_SECONDS = 900; // 15 minutes
const LOGIN_ATTEMPT_WINDOW_MS = LOGIN_ATTEMPT_TTL_SECONDS * 1000;
const MAX_USER_LOGIN_FAILURES = 5;
const MAX_IP_LOGIN_FAILURES = 30;

// Role-based Authorization middleware
export const requireRole = (...roles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Access denied. Insufficient privileges for this operation." });
      return;
    }
    next();
  };
};

const authorizeAdmin = requireRole("admin");

let mongoConnected = false;
let lastConnectionError = "";

// Custom Schemas
const LocationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

const JobEditHistorySchema = new mongoose.Schema({
  editedAt: { type: String, required: true },
  reason: { type: String, required: true },
  changedFields: { type: String }
}, { _id: false });

const ServiceJobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  customerName: { type: String, required: true, index: true },
  customerPhone: { type: String, required: true, index: true },
  dateTime: { type: String, required: true, index: true },
  locationText: { type: String, required: true },
  locationCoords: { type: LocationSchema, required: true },
  deviceType: { type: String, required: true },
  deviceModel: { type: String },
  deviceIssue: { type: String, required: true },
  urgency: { type: String, required: true },
  status: { type: String, required: true, index: true },
  technicianName: { type: String },
  diagnosedProblem: { type: String },
  resolutionNotes: { type: String },
  createdAt: { type: String, required: true, index: true },
  updatedAt: { type: String, required: true },
  invoiceId: { type: String },
  remarks: { type: String },
  priorityNumber: { type: Number },
  editHistory: { type: [JobEditHistorySchema], default: [] }
});

const InvoiceItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  amount: { type: Number, required: true }
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  jobId: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  dateTime: { type: String, required: true },
  items: { type: [InvoiceItemSchema], required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  discount: { type: Number, required: true },
  total: { type: Number, required: true },
  paymentStatus: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  notes: { type: String },
  createdTime: { type: String, required: true, index: true }
});

const JobModel = mongoose.models.Job || mongoose.model("Job", ServiceJobSchema);
const InvoiceModel = mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);

const DeletedJobSchema = new mongoose.Schema({
  id: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  dateTime: { type: String, required: true },
  deletedAt: { type: String, required: true, index: true },
  deleteReason: { type: String, required: true },
  originalJobData: { type: mongoose.Schema.Types.Mixed, required: true }
});

const DeletedJobModel = mongoose.models.DeletedJob || mongoose.model("DeletedJob", DeletedJobSchema);

const ActivityLogSchema = new mongoose.Schema({
  id: { type: String, required: true },
  actionType: { type: String, required: true },
  jobId: { type: String, required: true },
  customerName: { type: String },
  deviceType: { type: String },
  username: { type: String, required: true },
  timestamp: { type: String, required: true, index: true },
  details: { type: String }
});

const ActivityLogModel = mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);

async function logActivity({ actionType, jobId, customerName, deviceType, username, details }: {
  actionType: string;
  jobId: string;
  customerName?: string;
  deviceType?: string;
  username: string;
  details?: string;
}) {
  try {
    const newLog = new ActivityLogModel({
      id: "ACT-" + crypto.randomUUID(),
      actionType,
      jobId,
      customerName: customerName || "N/A",
      deviceType: deviceType || "N/A",
      username: username || "system",
      timestamp: new Date().toISOString(),
      details: details || ""
    });
    await newLog.save();
    console.log(`[Activity Log] ${actionType} logged successfully for job: ${jobId} by user: ${username}`);
  } catch (err) {
    console.error("Warning: Failed to save activity log:", err);
  }
}

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: String },
  tokenVersion: { type: Number, default: 0 }
});

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

const LoginAttemptSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  ip: { type: String, required: true, index: true },
  username: { type: String },
  count: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: LOGIN_ATTEMPT_TTL_SECONDS }
});

const LoginAttemptModel =
  mongoose.models.LoginAttempt || mongoose.model("LoginAttempt", LoginAttemptSchema);

async function incrementLoginFailureKey(key: string, ip: string, username?: string): Promise<void> {
  const now = new Date();
  const existing = await LoginAttemptModel.findOne({ key } as any);
  if (existing) {
    const ageMs = now.getTime() - new Date(existing.createdAt).getTime();
    if (ageMs > LOGIN_ATTEMPT_WINDOW_MS) {
      existing.count = 1;
      existing.createdAt = now;
    } else {
      existing.count += 1;
    }
    await existing.save();
  } else {
    await LoginAttemptModel.create({
      key,
      ip,
      username,
      count: 1,
      createdAt: now
    });
  }
}

async function recordFailedLogin(ip: string, username: string): Promise<void> {
  const userKey = `user:${ip}:${username}`;
  const ipKey = `ip:${ip}`;
  await Promise.all([
    incrementLoginFailureKey(userKey, ip, username),
    incrementLoginFailureKey(ipKey, ip)
  ]);
}

const InventoryItemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  qty: { type: Number, required: true, default: 0 },
  date: { type: String, required: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true, index: true }
});

const InventoryItemModel = mongoose.models.InventoryItem || mongoose.model("InventoryItem", InventoryItemSchema);

const InventoryLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  itemName: { type: String, required: true },
  category: { type: String, required: true },
  actionType: { type: String, required: true }, // e.g., 'Add Item', 'Update Stock'
  qty: { type: Number, required: true },
  date: { type: String, required: true },
  username: { type: String, required: true },
  timestamp: { type: String, required: true, index: true }
});

const InventoryLogModel = mongoose.models.InventoryLog || mongoose.model("InventoryLog", InventoryLogSchema);

const INITIAL_USER_SPECS = [
  {
    id: "usr-01",
    username: "admin",
    envVar: "INITIAL_ADMIN_PASSWORD",
    name: "System Admin Ko Phyo",
    role: "admin",
    phone: "09971234567"
  },
  {
    id: "usr-02",
    username: "coordinator",
    envVar: "INITIAL_COORDINATOR_PASSWORD",
    name: "Coordinator Daw Su",
    role: "coordinator",
    phone: "09971234568"
  },
  {
    id: "usr-03",
    username: "senior",
    envVar: "INITIAL_SENIOR_TECH_PASSWORD",
    name: "Senior Tech Ko Tin",
    role: "senior_technician",
    phone: "09971234569"
  },
  {
    id: "usr-04",
    username: "tech",
    envVar: "INITIAL_TECHNICIAN_PASSWORD",
    name: "Technician Ko Sai",
    role: "technician",
    phone: "09971234570"
  }
] as const;

export function isValidSeedPassword(rawPassword: string | undefined): boolean {
  if (!rawPassword || typeof rawPassword !== "string") return false;
  const trimmed = rawPassword.trim();
  if (trimmed.length < 12) return false;
  if (trimmed === "CHANGE_ME" || trimmed.toUpperCase().startsWith("CHANGE_ME")) return false;
  return true;
}

export async function buildSeedUsers() {
  const hashedUsers: Array<{
    id: string;
    username: string;
    password: string;
    name: string;
    role: string;
    phone: string;
    tokenVersion: number;
  }> = [];

  for (const spec of INITIAL_USER_SPECS) {
    const rawPwd = process.env[spec.envVar];
    if (!isValidSeedPassword(rawPwd)) {
      console.warn(`[Seed] Skipping default user '${spec.username}': ${spec.envVar} is not set or shorter than 12 characters.`);
      continue;
    }
    const hashedPassword = await hashPassword(rawPwd!.trim());
    hashedUsers.push({
      id: spec.id,
      username: spec.username,
      password: hashedPassword,
      name: spec.name,
      role: spec.role,
      phone: spec.phone,
      tokenVersion: 0
    });
  }

  return hashedUsers;
}

const INITIAL_JOBS_FALLBACK: any[] = [];

const INITIAL_INVOICES_FALLBACK: any[] = [];

let cachedConnection: Promise<typeof mongoose> | null = null;
let databaseSeeded = false;

// Async builder helper to ensure database connectivity before making requests (ideal for serverless cold-starts)
async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) {
    mongoConnected = true;
    return;
  }

  const currentUri = (process.env.MONGO_URI || "").trim();
  let currentUriDiagnostics = "present";
  if (!currentUri) {
    currentUriDiagnostics = "missing";
  } else if (
    /<db_username>|<db_password>|your-cluster\.mongodb\.net|your-username|your-password|YOUR_|^CHANGE_ME/i.test(currentUri)
  ) {
    currentUriDiagnostics = "placeholder";
  }

  if (currentUriDiagnostics !== "present") {
    mongoConnected = false;
    if (currentUriDiagnostics === "missing") {
      lastConnectionError = "MONGO_URI environment variable is missing in setup.";
    } else {
      lastConnectionError = "MONGO_URI connection link contains unresolved placeholders (like <db_username>, <db_password>, your-cluster.mongodb.net, or CHANGE_ME).";
    }
    throw new Error(lastConnectionError);
  }

  try {
    console.log("Connecting strictly to MongoDB Atlas dynamically...");
    
    if (!cachedConnection) {
      cachedConnection = mongoose.connect(currentUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
        minPoolSize: 2,
      });
    }
    
    await cachedConnection;
    mongoConnected = true;
    console.log("SUCCESS: MongoDB Atlas connection established!");

    // Seed database on-demand if not already seeded during this runtime lifecycle
    if (!databaseSeeded) {
      try {
        const userCount = await UserModel.countDocuments();
        if (userCount === 0) {
          console.log("First connection: Database is completely fresh. Checking configured seed users...");
          const hashedUsers = await buildSeedUsers();
          if (hashedUsers.length > 0) {
            await UserModel.insertMany(hashedUsers as any[]);
          }

          const jobCount = await JobModel.countDocuments();
          if (jobCount === 0) {
            if (INITIAL_JOBS_FALLBACK.length > 0) {
              await JobModel.insertMany(INITIAL_JOBS_FALLBACK as any[]);
            }
            if (INITIAL_INVOICES_FALLBACK.length > 0) {
              await InvoiceModel.insertMany(INITIAL_INVOICES_FALLBACK as any[]);
            }
          }
        } else {
          // One-time migration for existing databases with legacy unhashed passwords from prior reset bug
          const existingUsers = await UserModel.find({} as any);
          let migratedCount = 0;
          for (const u of existingUsers) {
            const pwd = String(u.password || "");
            if (pwd && !pwd.startsWith("$2a$") && !pwd.startsWith("$2b$") && !pwd.startsWith("$2y$") && !/^[a-f0-9]{64}$/i.test(pwd)) {
              u.password = await hashPassword(pwd);
              if (typeof u.tokenVersion !== "number") {
                u.tokenVersion = 0;
              }
              await u.save();
              migratedCount++;
            }
          }
          if (migratedCount > 0) {
            await LoginAttemptModel.deleteMany({});
            console.log(`Migrated ${migratedCount} legacy user account(s) to bcrypt hashes.`);
          }
        }
        databaseSeeded = true;
      } catch (seedErr) {
        console.warn("Warning: Seeding on-demand failed or was already completed:", seedErr);
      }
    }
  } catch (err: any) {
    mongoConnected = false;
    cachedConnection = null; // reset cached connection on failure
    lastConnectionError = err.message || String(err);
    console.warn("MongoDB connection unavailable:", lastConnectionError);
    throw err;
  }
}

// A dynamic serverless-friendly database auto-resolution middleware for API requests (runs BEFORE authentication)
app.use("/api", async (req, res, next) => {
  if (req.path === "/db-status" || req.path === "/auth/logout") {
    try {
      await ensureDbConnected();
    } catch {
      // Allow /api/db-status and /api/auth/logout to proceed when DB is unreachable
    }
    return next();
  }

  // If /api/auth/me is called with no session cookie or Authorization header, let it return 401 without requiring DB
  if (
    req.path === "/auth/me" &&
    !(req.cookies && req.cookies[SESSION_COOKIE_NAME]) &&
    !req.headers["authorization"]
  ) {
    return next();
  }

  try {
    await ensureDbConnected();
    next();
  } catch (err: any) {
    console.warn("Database connection middleware warning:", err?.message || err);
    res.status(503).json({ 
      error: "MongoDB Live Database ချိတ်ဆက်မှုမအောင်မြင်ပါ။ MONGO_URI variable ကို ပြန်လည်စစ်ဆေးပါ။" 
    });
  }
});

// JWT Verification Middleware (loads live user & role from DB and verifies tokenVersion)
const authenticateToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const path = req.path;
  if (path === "/db-status" || path === "/auth/login" || path === "/auth/logout" || path === "/auth/me") {
    return next();
  }

  // 1. Try to extract token from httpOnly cookie
  let token = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;

  // 2. Fallback to Authorization header if cookie is missing
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    res.status(401).json({ error: "Access denied. Token missing." });
    return;
  }

  let decoded: { id: string; username: string; role: string; tokenVersion?: number };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string; tokenVersion?: number };
  } catch (err) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  if (!mongoConnected || mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
    return;
  }

  try {
    const dbUser: any = await UserModel.findOne({ id: decoded.id } as any).lean();
    if (!dbUser) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Account no longer exists." });
      return;
    }

    const dbTokenVersion = typeof dbUser.tokenVersion === "number" ? dbUser.tokenVersion : 0;
    const claimTokenVersion = typeof decoded.tokenVersion === "number" ? decoded.tokenVersion : 0;
    if (claimTokenVersion !== dbTokenVersion) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Session has been invalidated. Please sign in again." });
      return;
    }

    (req as any).user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      name: dbUser.name,
      tokenVersion: dbTokenVersion
    };
    next();
  } catch (err) {
    console.error("Database lookup failed during authentication:", err);
    res.status(503).json({ error: "Service temporarily unavailable while verifying session." });
  }
};

app.use("/api", authenticateToken);

// REST API Endpoints
app.get("/api/db-status", (req, res) => {
  res.json({
    connected: mongoConnected,
    isDemo: false,
    uriUsed: "Protected Connection String", // Cleared to prevent database architecture disclosure
    modeMessage: mongoConnected 
      ? "Database live service operations active." 
      : "Database connection offline. System operating on default configurations.",
    error: mongoConnected ? "" : "Database connection lost. Please contact server administration to review system logs." // Obfuscated traceback
  });
});

// LOGIN Endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const clientIp = getClientIp(req);
    const cleanUsername = username.trim().toLowerCase();
    const userKey = `user:${clientIp}:${cleanUsername}`;
    const ipKey = `ip:${clientIp}`;
    const nowMs = Date.now();

    const [userAttempt, ipAttempt] = await Promise.all([
      LoginAttemptModel.findOne({ key: userKey } as any).lean(),
      LoginAttemptModel.findOne({ key: ipKey } as any).lean()
    ]);

    if (
      ipAttempt &&
      nowMs - new Date((ipAttempt as any).createdAt).getTime() <= LOGIN_ATTEMPT_WINDOW_MS &&
      (ipAttempt as any).count >= MAX_IP_LOGIN_FAILURES
    ) {
      res.status(429).json({
        error: "Too many failed login attempts from this connection. Please try again after 15 minutes."
      });
      return;
    }

    if (
      userAttempt &&
      nowMs - new Date((userAttempt as any).createdAt).getTime() <= LOGIN_ATTEMPT_WINDOW_MS &&
      (userAttempt as any).count >= MAX_USER_LOGIN_FAILURES
    ) {
      res.status(429).json({
        error: "Too many failed login attempts for this username. Please try again after 15 minutes."
      });
      return;
    }

    const user = await UserModel.findOne({ username: cleanUsername } as any);
    if (!user) {
      await recordFailedLogin(clientIp, cleanUsername);
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const matchesHashed = await comparePassword(password, user.password);

    if (!matchesHashed) {
      await recordFailedLogin(clientIp, cleanUsername);
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    // Reset the per-(IP + username) failure counter on successful login
    await LoginAttemptModel.deleteOne({ key: userKey } as any);

    // Auto-upgrade legacy SHA256 hashes to secure bcrypt hashes on successful login
    if (!user.password.startsWith("$2a$") && !user.password.startsWith("$2b$")) {
      try {
        console.log(`Auto-upgrading legacy SHA256 hash to secure bcrypt for user: ${user.username}`);
        user.password = await hashPassword(password);
        await user.save();
      } catch (err) {
        console.error("Warning: Failed to auto-upgrade user password hash:", err);
      }
    }

    const userObj = user.toObject();
    const { password: _, ...userWithoutPassword } = userObj;
    const tokenVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 0;
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tokenVersion },
      JWT_SECRET,
      { expiresIn: SESSION_DURATION }
    );

    // Set JWT in a secure, httpOnly cookie for the full 7-day session window
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(req));

    res.json(userWithoutPassword);
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal authentication process failed." });
  }
});

// LOGOUT Endpoint
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  res.json({ success: true, message: "Logged out successfully" });
});

// SESSION REFRESH Endpoint
// Validates the saved session against the live DB record and slides its 7-day expiry forward.
app.get("/api/auth/me", async (req, res) => {
  const cookieToken = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;
  const headerToken = req.headers["authorization"]?.split(" ")[1];
  const sessionToken = cookieToken || headerToken;

  if (!sessionToken) {
    res.status(401).json({ error: "No active session. Please sign in again." });
    return;
  }

  let claims: { id: string; username: string; role: string; tokenVersion?: number; iat?: number };
  try {
    claims = jwt.verify(sessionToken, JWT_SECRET) as { id: string; username: string; role: string; tokenVersion?: number; iat?: number };
  } catch (err) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired. Please sign in again." });
    return;
  }

  if (!mongoConnected || mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
    return;
  }

  let dbUser: any;
  try {
    dbUser = await UserModel.findOne({ id: claims.id } as any).lean();
  } catch (err) {
    console.error("Session refresh failed to query user record:", err);
    res.status(503).json({ error: "Service temporarily unavailable while verifying session." });
    return;
  }

  if (!dbUser) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Account no longer exists. Please sign in again." });
    return;
  }

  const dbTokenVersion = typeof dbUser.tokenVersion === "number" ? dbUser.tokenVersion : 0;
  const claimTokenVersion = typeof claims.tokenVersion === "number" ? claims.tokenVersion : 0;
  if (claimTokenVersion !== dbTokenVersion) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session invalidated. Please sign in again." });
    return;
  }

  const { password: _pwd, __v: _v, ...userProfile } = dbUser;

  // Rotate the token once it has been in use for a while so the session never expires mid-use
  const issuedAt = (claims.iat || 0) * 1000;
  const shouldRenew = !issuedAt || Date.now() - issuedAt > SESSION_RENEW_AFTER_MS;
  if (shouldRenew) {
    const activeToken = jwt.sign(
      { id: dbUser.id, username: dbUser.username, role: dbUser.role, tokenVersion: dbTokenVersion },
      JWT_SECRET,
      { expiresIn: SESSION_DURATION }
    );
    res.cookie(SESSION_COOKIE_NAME, activeToken, sessionCookieOptions(req));
  }

  res.json(userProfile);
});

// JOB API Endpoints
app.get("/api/jobs", requireRole("admin", "coordinator", "senior_technician", "technician"), async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
    const minDateString = startOfLastMonth.toISOString();
    const maxDateString = endOfNextMonth.toISOString();

    const dbJobs = await JobModel.find({
      $or: [
        {
          createdAt: mongoose.trusted({
            $gte: minDateString,
            $lte: maxDateString
          })
        },
        { createdAt: mongoose.trusted({ $exists: false }) }
      ]
    } as any).lean();
    res.json(dbJobs);
  } catch (err: any) {
    console.error("Failed to fetch jobs:", err);
    res.status(500).json({ error: "Failed to fetch service jobs." });
  }
});

const VALID_JOB_STATUSES = new Set([
  "Created",
  "Assigned",
  "Dispatched",
  "ServiceInProgress",
  "Repairing",
  "Completed",
  "Cancelled"
]);

const VALID_URGENCY_LEVELS = new Set(["Low", "Medium", "High", "Critical"]);

const VALID_USER_ROLES = new Set([
  "admin",
  "coordinator",
  "senior_technician",
  "technician"
]);

const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;

const VALID_PAYMENT_STATUSES = new Set(["Paid", "Unpaid", "Partially Paid"]);
const VALID_PAYMENT_METHODS = new Set([
  "Cash",
  "KBZPay",
  "CBPay",
  "WavePay",
  "Bank Transfer"
]);

const ALLOWED_JOB_UPDATE_FIELDS = new Set([
  "customerName",
  "customerPhone",
  "dateTime",
  "locationText",
  "locationCoords",
  "deviceType",
  "deviceModel",
  "deviceIssue",
  "urgency",
  "status",
  "technicianName",
  "diagnosedProblem",
  "resolutionNotes",
  "invoiceId",
  "remarks",
  "priorityNumber"
]);

const TECHNICIAN_ALLOWED_JOB_FIELDS = new Set([
  "status",
  "diagnosedProblem",
  "resolutionNotes",
  "remarks"
]);

function isValidLocationCoords(coords: any): coords is { lat: number; lng: number } {
  return (
    Boolean(coords) &&
    typeof coords === "object" &&
    !Array.isArray(coords) &&
    typeof coords.lat === "number" &&
    Number.isFinite(coords.lat) &&
    typeof coords.lng === "number" &&
    Number.isFinite(coords.lng)
  );
}

app.post("/api/jobs", requireRole("admin", "coordinator"), async (req, res) => {
  try {
    const body = req.body || {};
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const {
      id,
      customerName,
      customerPhone,
      dateTime,
      locationText,
      locationCoords,
      deviceType,
      deviceModel,
      deviceIssue,
      urgency,
      status,
      technicianName,
      diagnosedProblem,
      resolutionNotes,
      invoiceId,
      remarks,
      priorityNumber
    } = body;

    if (
      typeof customerName !== "string" || !customerName.trim() ||
      typeof customerPhone !== "string" || !customerPhone.trim() ||
      typeof dateTime !== "string" || !dateTime.trim() ||
      typeof locationText !== "string" || !locationText.trim() ||
      typeof deviceType !== "string" || !deviceType.trim() ||
      typeof deviceIssue !== "string" || !deviceIssue.trim() ||
      typeof urgency !== "string"
    ) {
      res.status(400).json({ error: "Missing or invalid required job fields." });
      return;
    }

    if (!VALID_URGENCY_LEVELS.has(urgency)) {
      res.status(400).json({ error: "Invalid urgency level." });
      return;
    }

    const jobStatus = status === undefined ? "Created" : status;
    if (typeof jobStatus !== "string" || !VALID_JOB_STATUSES.has(jobStatus)) {
      res.status(400).json({ error: "Invalid job status." });
      return;
    }

    if (!isValidLocationCoords(locationCoords)) {
      res.status(400).json({ error: "locationCoords.lat and locationCoords.lng must be finite numbers." });
      return;
    }

    const optionalStrings = { id, deviceModel, technicianName, diagnosedProblem, resolutionNotes, invoiceId, remarks };
    for (const [k, v] of Object.entries(optionalStrings)) {
      if (v !== undefined && v !== null && typeof v !== "string") {
        res.status(400).json({ error: `Field '${k}' must be a string.` });
        return;
      }
    }

    if (priorityNumber !== undefined && priorityNumber !== null && (typeof priorityNumber !== "number" || !Number.isFinite(priorityNumber))) {
      res.status(400).json({ error: "priorityNumber must be a finite number." });
      return;
    }

    const nowIso = new Date().toISOString();
    const jobId = typeof id === "string" && id.trim() ? id.trim() : `JOB-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const allowedJobDoc: Record<string, any> = {
      id: jobId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      dateTime: dateTime.trim(),
      locationText: locationText.trim(),
      locationCoords: { lat: locationCoords.lat, lng: locationCoords.lng },
      deviceType: deviceType.trim(),
      deviceIssue: deviceIssue.trim(),
      urgency,
      status: jobStatus,
      createdAt: nowIso,
      updatedAt: nowIso,
      editHistory: []
    };

    if (typeof deviceModel === "string") allowedJobDoc.deviceModel = deviceModel;
    if (typeof technicianName === "string") allowedJobDoc.technicianName = technicianName;
    if (typeof diagnosedProblem === "string") allowedJobDoc.diagnosedProblem = diagnosedProblem;
    if (typeof resolutionNotes === "string") allowedJobDoc.resolutionNotes = resolutionNotes;
    if (typeof invoiceId === "string") allowedJobDoc.invoiceId = invoiceId;
    if (typeof remarks === "string") allowedJobDoc.remarks = remarks;
    if (typeof priorityNumber === "number" && Number.isFinite(priorityNumber)) {
      allowedJobDoc.priorityNumber = priorityNumber;
    }

    const newJob = new JobModel(allowedJobDoc);
    await newJob.save();

    // Log Activity
    const operator = (req as any).user.username;
    await logActivity({
      actionType: "Created",
      jobId: newJob.id,
      customerName: newJob.customerName,
      deviceType: newJob.deviceType,
      username: String(operator),
      details: `New ticket registered. Issue: ${newJob.deviceIssue}. Urgency: ${newJob.urgency}.`
    });

    res.status(201).json(newJob);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/jobs/:id", requireRole("admin", "coordinator", "senior_technician", "technician"), async (req, res) => {
  try {
    const { id } = req.params;
    const rawBody = req.body || {};
    if (typeof rawBody !== "object" || Array.isArray(rawBody)) {
      res.status(400).json({ error: "Invalid request payload." });
      return;
    }

    const { editReason, ...incomingFields } = rawBody;
    if (editReason !== undefined && typeof editReason !== "string") {
      res.status(400).json({ error: "editReason must be a string." });
      return;
    }

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const jobToEdit = await JobModel.findOne({ id } as any);
    if (!jobToEdit) {
      res.status(404).json({ error: `Job with ID ${id} is not present in database.` });
      return;
    }

    // Reject attempts to overwrite id or createdAt
    if ("id" in incomingFields && incomingFields.id !== undefined && incomingFields.id !== jobToEdit.id) {
      res.status(400).json({ error: "Cannot modify immutable field 'id'." });
      return;
    }
    if ("createdAt" in incomingFields && incomingFields.createdAt !== undefined && incomingFields.createdAt !== jobToEdit.createdAt) {
      res.status(400).json({ error: "Cannot modify immutable field 'createdAt'." });
      return;
    }

    const userRole = (req as any).user?.role;
    if (userRole === "technician") {
      if (editReason !== undefined) {
        res.status(403).json({ error: "Technicians may only update status, diagnosedProblem, resolutionNotes, and remarks." });
        return;
      }
      const existingObj: any = jobToEdit.toObject();
      for (const [key, val] of Object.entries(incomingFields)) {
        if (key === "id" || key === "_id" || key === "__v" || key === "createdAt" || key === "updatedAt" || key === "editHistory") continue;
        if (!TECHNICIAN_ALLOWED_JOB_FIELDS.has(key)) {
          if (JSON.stringify(val) !== JSON.stringify(existingObj[key])) {
            res.status(403).json({ error: `Access denied. Technicians cannot modify field '${key}'.` });
            return;
          }
        }
      }
    }

    const fieldsToUpdate: Record<string, any> = {};
    const allowedSet = userRole === "technician" ? TECHNICIAN_ALLOWED_JOB_FIELDS : ALLOWED_JOB_UPDATE_FIELDS;

    for (const [key, val] of Object.entries(incomingFields)) {
      if (!allowedSet.has(key)) continue;
      if (key === "locationCoords") {
        if (val !== undefined) {
          if (!isValidLocationCoords(val)) {
            res.status(400).json({ error: "locationCoords.lat and locationCoords.lng must be finite numbers." });
            return;
          }
          fieldsToUpdate.locationCoords = { lat: val.lat, lng: val.lng };
        }
      } else if (key === "status") {
        if (val !== undefined) {
          if (typeof val !== "string" || !VALID_JOB_STATUSES.has(val)) {
            res.status(400).json({ error: "Invalid job status." });
            return;
          }
          fieldsToUpdate.status = val;
        }
      } else if (key === "urgency") {
        if (val !== undefined) {
          if (typeof val !== "string" || !VALID_URGENCY_LEVELS.has(val)) {
            res.status(400).json({ error: "Invalid urgency level." });
            return;
          }
          fieldsToUpdate.urgency = val;
        }
      } else if (key === "priorityNumber") {
        if (val !== undefined && val !== null) {
          if (typeof val !== "number" || !Number.isFinite(val)) {
            res.status(400).json({ error: "priorityNumber must be a finite number." });
            return;
          }
          fieldsToUpdate.priorityNumber = val;
        } else if (val === null) {
          fieldsToUpdate.priorityNumber = null;
        }
      } else {
        if (val !== undefined && val !== null) {
          if (typeof val !== "string") {
            res.status(400).json({ error: `Field '${key}' must be a string.` });
            return;
          }
          fieldsToUpdate[key] = val;
        }
      }
    }

    if (fieldsToUpdate.status === "Completed") {
      fieldsToUpdate.priorityNumber = null;
    }
    
    const updateQuery: any = { $set: { ...fieldsToUpdate, updatedAt: new Date().toISOString() } };
    if (fieldsToUpdate.priorityNumber === null || (fieldsToUpdate.priorityNumber === undefined && userRole !== "technician" && "priorityNumber" in rawBody && rawBody.priorityNumber === null)) {
      if (updateQuery.$set) {
        delete updateQuery.$set.priorityNumber;
      }
      if (!updateQuery.$unset) {
        updateQuery.$unset = {};
      }
      updateQuery.$unset.priorityNumber = "";
    }
    if (fieldsToUpdate.status === "Completed") {
      if (updateQuery.$set) {
        delete updateQuery.$set.priorityNumber;
      }
      if (!updateQuery.$unset) {
        updateQuery.$unset = {};
      }
      updateQuery.$unset.priorityNumber = "";
    }
    
    if (editReason) {
      const changes: string[] = [];
      if (jobToEdit.customerName !== fieldsToUpdate.customerName && fieldsToUpdate.customerName !== undefined) changes.push("Customer Name");
      if (jobToEdit.customerPhone !== fieldsToUpdate.customerPhone && fieldsToUpdate.customerPhone !== undefined) changes.push("Phone Number");
      if (jobToEdit.dateTime !== fieldsToUpdate.dateTime && fieldsToUpdate.dateTime !== undefined) changes.push("Appointment Time");
      if (jobToEdit.locationText !== fieldsToUpdate.locationText && fieldsToUpdate.locationText !== undefined) changes.push("Address");
      if (jobToEdit.deviceType !== fieldsToUpdate.deviceType && fieldsToUpdate.deviceType !== undefined) changes.push("Device Type");
      if (jobToEdit.deviceModel !== fieldsToUpdate.deviceModel && fieldsToUpdate.deviceModel !== undefined) changes.push("Device Model");
      if (jobToEdit.deviceIssue !== fieldsToUpdate.deviceIssue && fieldsToUpdate.deviceIssue !== undefined) changes.push("Problem Description");
      if (jobToEdit.urgency !== fieldsToUpdate.urgency && fieldsToUpdate.urgency !== undefined) changes.push("Urgency Level");
      if (jobToEdit.status !== fieldsToUpdate.status && fieldsToUpdate.status !== undefined) changes.push("Ticket Status");
      if (jobToEdit.technicianName !== fieldsToUpdate.technicianName && fieldsToUpdate.technicianName !== undefined) changes.push("Technician");

      const log = {
        editedAt: new Date().toISOString(),
        reason: editReason,
        changedFields: changes.join(", ") || "General Info Update"
      };
      updateQuery.$push = { editHistory: log };
    }
    
    const updatedJob = await JobModel.findOneAndUpdate(
      { id: id } as any,
      updateQuery,
      { new: true } as any
    );

    // Log Activity
    const operator = (req as any).user.username;
    const oldStatus = jobToEdit.status;
    const newStatus = fieldsToUpdate.status;

    if (newStatus && oldStatus !== newStatus) {
      let activityType = "Updated";
      let detailString = `Status transitioned from ${oldStatus} to ${newStatus}.`;
      if (newStatus === "Completed") {
        activityType = "Completed";
        detailString = `Service Ticket completed. Resolution notes: ${fieldsToUpdate.resolutionNotes || jobToEdit.resolutionNotes || "None"}`;
      } else if (newStatus === "Cancelled" || newStatus === "Canceled") {
        activityType = "Canceled";
        detailString = `Service Ticket canceled. Remark/Reason: ${fieldsToUpdate.remarks || jobToEdit.remarks || "No reason given"}`;
      } else {
        activityType = "Updated Status";
        detailString = `Status updated to ${newStatus}. Assigned tech: ${fieldsToUpdate.technicianName || jobToEdit.technicianName || "None"}.`;
      }

      await logActivity({
        actionType: activityType,
        jobId: jobToEdit.id,
        customerName: jobToEdit.customerName,
        deviceType: jobToEdit.deviceType,
        username: String(operator),
        details: detailString
      });
    } else {
      await logActivity({
        actionType: "Updated",
        jobId: jobToEdit.id,
        customerName: jobToEdit.customerName,
        deviceType: jobToEdit.deviceType,
        username: String(operator),
        details: editReason ? `Ticket details updated. Reason: ${editReason}` : "Ticket general information modified."
      });
    }

    res.json(updatedJob);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE Job with Archived Reason
app.delete("/api/jobs/:id", requireRole("admin", "coordinator"), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (reason !== undefined && typeof reason !== "string") {
      res.status(400).json({ error: "Reason must be a string." });
      return;
    }
    const cleanReason = typeof reason === "string" && reason.trim() ? reason.trim() : "No reason provided";

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const jobToDelete = await JobModel.findOne({ id } as any);
    if (!jobToDelete) {
      res.status(404).json({ error: `Job with ID ${id} is not present in database.` });
      return;
    }
    
    const archived = new DeletedJobModel({
      id: jobToDelete.id,
      customerName: jobToDelete.customerName,
      customerPhone: jobToDelete.customerPhone,
      dateTime: jobToDelete.dateTime,
      deletedAt: new Date().toISOString(),
      deleteReason: cleanReason,
      originalJobData: jobToDelete.toObject()
    });
    await archived.save();

    // Log Activity
    const operator = (req as any).user.username;
    await logActivity({
      actionType: "Deleted",
      jobId: jobToDelete.id,
      customerName: jobToDelete.customerName,
      deviceType: jobToDelete.deviceType,
      username: String(operator),
      details: `Ticket permanently deleted. Reason/Explanations: ${cleanReason}`
    });

    await JobModel.deleteOne({ id } as any);
    res.json({ success: true, message: "Job deleted and reasons archived successfully." });
  } catch (err: any) {
    console.error("Failed to delete job:", err);
    res.status(500).json({ error: "Failed to delete service job." });
  }
});

// GET Deleted Jobs Log (Backward compatibility helper)
app.get("/api/deleted-jobs", requireRole("admin", "coordinator"), async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const dbDeleted = await DeletedJobModel.find().sort({ deletedAt: -1 }).limit(1000).lean();
    res.json(dbDeleted);
  } catch (err: any) {
    console.error("Failed to fetch deleted jobs:", err);
    res.status(500).json({ error: "Failed to fetch deleted jobs." });
  }
});

// GET Activity Logs
app.get("/api/activity-logs", requireRole("admin", "coordinator"), async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const logs = await ActivityLogModel.find().sort({ timestamp: -1 }).limit(1000).lean();
    res.json(logs);
  } catch (err: any) {
    console.error("Failed to fetch activity logs:", err);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
});

// INVOICE API Endpoints
app.get("/api/invoices", requireRole("admin", "coordinator", "senior_technician"), async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const dbInvoices = await InvoiceModel.find().sort({ createdTime: -1 }).limit(1000).lean();
    res.json(dbInvoices);
  } catch (err: any) {
    console.error("Failed to fetch invoices:", err);
    res.status(500).json({ error: "Failed to fetch invoices." });
  }
});

app.post("/api/invoices", requireRole("admin", "coordinator", "senior_technician"), async (req, res) => {
  try {
    const invoiceData = req.body || {};
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const {
      id,
      jobId,
      customerName,
      customerPhone,
      dateTime,
      items,
      subtotal,
      tax,
      discount,
      total,
      paymentStatus,
      paymentMethod,
      notes
    } = invoiceData;

    if (
      typeof jobId !== "string" || !jobId.trim() ||
      typeof customerName !== "string" || !customerName.trim() ||
      typeof customerPhone !== "string" || !customerPhone.trim() ||
      typeof dateTime !== "string" || !dateTime.trim() ||
      typeof paymentStatus !== "string" || !VALID_PAYMENT_STATUSES.has(paymentStatus) ||
      typeof paymentMethod !== "string" || !VALID_PAYMENT_METHODS.has(paymentMethod)
    ) {
      res.status(400).json({ error: "Invalid or missing required invoice fields." });
      return;
    }

    if (id !== undefined && typeof id !== "string") {
      res.status(400).json({ error: "Invoice id must be a string." });
      return;
    }
    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      res.status(400).json({ error: "Invoice notes must be a string." });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Invoice must contain at least one item." });
      return;
    }

    if (typeof tax !== "number" || !Number.isFinite(tax) || tax < 0) {
      res.status(400).json({ error: "Invoice tax must be a finite number >= 0." });
      return;
    }
    if (typeof discount !== "number" || !Number.isFinite(discount) || discount < 0) {
      res.status(400).json({ error: "Invoice discount must be a finite number >= 0." });
      return;
    }

    const sanitizedItems: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== "object") {
        res.status(400).json({ error: `Invalid item at index ${i}.` });
        return;
      }
      if (typeof item.description !== "string" || !item.description.trim()) {
        res.status(400).json({ error: `Item description at index ${i} must be a non-empty string.` });
        return;
      }
      if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0) {
        res.status(400).json({ error: `Item quantity at index ${i} must be a finite number > 0.` });
        return;
      }
      if (typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        res.status(400).json({ error: `Item unitPrice at index ${i} must be a finite number >= 0.` });
        return;
      }
      const computedAmount = item.quantity * item.unitPrice;
      if (
        item.amount !== undefined &&
        (typeof item.amount !== "number" || !Number.isFinite(item.amount) || Math.abs(item.amount - computedAmount) > 0.01)
      ) {
        res.status(400).json({ error: `Item amount mismatch at index ${i}.` });
        return;
      }
      sanitizedItems.push({
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `item-${i + 1}`,
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: computedAmount
      });
    }

    const computedSubtotal = sanitizedItems.reduce((acc, curr) => acc + curr.amount, 0);
    const computedTotal = Math.max(0, computedSubtotal + tax - discount);

    if (
      subtotal !== undefined &&
      (typeof subtotal !== "number" || !Number.isFinite(subtotal) || Math.abs(subtotal - computedSubtotal) > 0.01)
    ) {
      res.status(400).json({ error: "Invoice subtotal does not match the sum of item amounts." });
      return;
    }

    if (
      typeof total !== "number" ||
      !Number.isFinite(total) ||
      Math.abs(total - computedTotal) > 0.01
    ) {
      res.status(400).json({ error: "Invoice total does not match computed total." });
      return;
    }

    const invoiceId =
      typeof id === "string" && id.trim()
        ? id.trim()
        : `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const newInvoice = new InvoiceModel({
      id: invoiceId,
      jobId: jobId.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      dateTime: dateTime.trim(),
      items: sanitizedItems,
      subtotal: computedSubtotal,
      tax,
      discount,
      total: computedTotal,
      paymentStatus,
      paymentMethod,
      notes: typeof notes === "string" ? notes : "",
      createdTime: new Date().toISOString()
    });
    await newInvoice.save();
    res.status(201).json(newInvoice);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// User Management API endpoints
app.get("/api/users", authorizeAdmin, async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const users = await UserModel.find({} as any).lean();
    const sanitized = users.map((u: any) => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json(sanitized);
  } catch (err: any) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

app.post("/api/users", authorizeAdmin, async (req, res) => {
  try {
    const { username, name, role, phone, password } = req.body || {};
    if (
      typeof username !== "string" ||
      typeof name !== "string" ||
      typeof role !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !name.trim() ||
      !role.trim() ||
      !password
    ) {
      res.status(400).json({ error: "Username, Name, Role, and Password are required" });
      return;
    }

    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      res.status(400).json({ error: "Phone must be a string" });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(cleanUsername)) {
      res.status(400).json({
        error: "Username must be 3-32 characters and contain only lowercase letters, numbers, '.', '_', or '-'"
      });
      return;
    }

    if (!VALID_USER_ROLES.has(role)) {
      res.status(400).json({ error: "Invalid user role" });
      return;
    }

    if (password.length < 12) {
      res.status(400).json({ error: "Password must be at least 12 characters long" });
      return;
    }

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const existing = await UserModel.findOne({ username: cleanUsername } as any);
    if (existing) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }

    const newUser = {
      id: "usr-" + crypto.randomUUID(),
      username: cleanUsername,
      password: await hashPassword(password),
      name: name.trim(),
      role: role,
      phone: typeof phone === "string" ? phone.trim() : "",
      tokenVersion: 0
    };

    const mongoUser = new UserModel(newUser);
    await mongoUser.save();
    const { password: _, ...sanitized } = newUser;
    res.status(201).json(sanitized);
  } catch (err: any) {
    console.error("Failed to create user:", err);
    res.status(500).json({ error: "Failed to create user." });
  }
});

app.put("/api/users/:id", authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, role, phone, password } = req.body || {};

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    if (username !== undefined && typeof username !== "string") {
      res.status(400).json({ error: "Username must be a string" });
      return;
    }
    if (name !== undefined && typeof name !== "string") {
      res.status(400).json({ error: "Name must be a string" });
      return;
    }
    if (role !== undefined && typeof role !== "string") {
      res.status(400).json({ error: "Role must be a string" });
      return;
    }
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      res.status(400).json({ error: "Phone must be a string" });
      return;
    }
    if (password !== undefined && typeof password !== "string") {
      res.status(400).json({ error: "Password must be a string" });
      return;
    }

    const user = await UserModel.findOne({ id } as any);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    if (typeof username === "string" && username.trim()) {
      const cleanUsername = username.trim().toLowerCase();
      if (!USERNAME_REGEX.test(cleanUsername)) {
        res.status(400).json({
          error: "Username must be 3-32 characters and contain only lowercase letters, numbers, '.', '_', or '-'"
        });
        return;
      }
      if (cleanUsername !== user.username) {
        const existing = await UserModel.findOne({ username: cleanUsername } as any);
         if (existing) {
          res.status(400).json({ error: "Username already taken" });
          return;
        }
        user.username = cleanUsername;
      }
    }
    
    let shouldInvalidateTokens = false;
    if (typeof name === "string" && name.trim()) {
      user.name = name.trim();
    }
    if (typeof role === "string" && role.trim()) {
      if (!VALID_USER_ROLES.has(role)) {
        res.status(400).json({ error: "Invalid user role" });
        return;
      }
      if (role !== user.role) {
        user.role = role;
        shouldInvalidateTokens = true;
      }
    }
    if (typeof phone === "string") {
      user.phone = phone.trim();
    }
    if (typeof password === "string" && password.length > 0) {
      if (password.length < 12) {
        res.status(400).json({ error: "Password must be at least 12 characters long" });
        return;
      }
      user.password = await hashPassword(password);
      shouldInvalidateTokens = true;
    }
    if (shouldInvalidateTokens) {
      user.tokenVersion = (typeof user.tokenVersion === "number" ? user.tokenVersion : 0) + 1;
    }
    
    await user.save();
    const { password: _, ...sanitized } = user.toObject();
    res.json(sanitized);
  } catch (err: any) {
    console.error("Failed to update user:", err);
    res.status(500).json({ error: "Failed to update user." });
  }
});

app.delete("/api/users/:id", authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "usr-01") {
      res.status(400).json({ error: "Cannot delete the default root admin account" });
      return;
    }

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const deleted = await UserModel.findOneAndDelete({ id } as any);
    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err: any) {
    console.error("Failed to delete user:", err);
    res.status(500).json({ error: "Failed to delete user." });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePositiveFiniteQuantity(rawQty: unknown): number | null {
  if (typeof rawQty === "boolean" || typeof rawQty === "object" || rawQty === null || rawQty === undefined || rawQty === "") {
    return null;
  }
  const num = typeof rawQty === "number" ? rawQty : Number(rawQty);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return num;
}

// INVENTORY API ENDPOINTS
app.get("/api/inventory", requireRole("admin", "coordinator", "senior_technician", "technician"), async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const items = await InventoryItemModel.find().sort({ updatedAt: -1 }).lean();
    res.json(items);
  } catch (err: any) {
    console.error("Failed to fetch inventory items:", err);
    res.status(500).json({ error: "Failed to fetch inventory items." });
  }
});

app.post("/api/inventory", requireRole("admin", "coordinator", "senior_technician"), async (req, res) => {
  try {
    const { category, name, qty, date } = req.body || {};
    if (
      typeof category !== "string" ||
      !category.trim() ||
      typeof name !== "string" ||
      !name.trim() ||
      qty === undefined ||
      qty === null
    ) {
      res.status(400).json({ error: "Category, Item Name, and Quantity are required" });
      return;
    }

    if (date !== undefined && date !== null && typeof date !== "string") {
      res.status(400).json({ error: "Date must be a string" });
      return;
    }

    const quantity = parsePositiveFiniteQuantity(qty);
    if (quantity === null) {
      res.status(400).json({ error: "Quantity must be a finite number greater than 0" });
      return;
    }

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const cleanCategory = category.trim();
    const cleanName = name.trim();
    const escapedName = escapeRegExp(cleanName);
    const escapedCategory = escapeRegExp(cleanCategory);
    const targetDate = typeof date === "string" && date.trim() ? date.trim() : new Date().toISOString().split("T")[0];
    const operator = (req as any).user.username;
    const nowIso = new Date().toISOString();

    // Atomically increment quantity if item with exact name and category already exists
    let actionType = "Update Stock";
    let item: any = await InventoryItemModel.findOneAndUpdate(
      {
        name: mongoose.trusted({ $regex: new RegExp(`^${escapedName}$`, "i") }),
        category: mongoose.trusted({ $regex: new RegExp(`^${escapedCategory}$`, "i") })
      } as any,
      {
        $inc: { qty: quantity },
        $set: { date: targetDate, updatedAt: nowIso }
      },
      { new: true } as any
    );

    if (!item) {
      actionType = "Add Item";
      item = new InventoryItemModel({
        id: "inv-" + crypto.randomUUID(),
        name: cleanName,
        category: cleanCategory,
        qty: quantity,
        date: targetDate,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      await item.save();
    }

    // Log the transaction
    const logId = "invlog-" + crypto.randomUUID();
    const newLog = new InventoryLogModel({
      id: logId,
      itemName: item.name,
      category: item.category,
      actionType: actionType,
      qty: quantity,
      date: targetDate,
      username: String(operator),
      timestamp: nowIso
    });
    await newLog.save();

    res.status(201).json({ item, log: newLog });
  } catch (err: any) {
    console.error("Failed to add/update inventory item:", err);
    res.status(500).json({ error: "Failed to add/update inventory item." });
  }
});

app.patch("/api/inventory/:id", requireRole("admin", "coordinator", "senior_technician"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body || {};
    
    if (typeof name !== "string" || !name.trim() || typeof category !== "string" || !category.trim()) {
      res.status(400).json({ error: "Item Name and Category are required." });
      return;
    }

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const cleanName = name.trim();
    const cleanCategory = category.trim();
    const nowIso = new Date().toISOString();

    const item: any = await InventoryItemModel.findOneAndUpdate(
      { id } as any,
      { $set: { name: cleanName, category: cleanCategory, updatedAt: nowIso } },
      { new: true } as any
    );
    if (!item) {
      res.status(404).json({ error: "Item not found." });
      return;
    }

    // Log the change
    const operator = (req as any).user.username;
    const targetDate = nowIso.split("T")[0];
    const newLog = new InventoryLogModel({
      id: "log-" + crypto.randomUUID(),
      itemName: item.name,
      category: item.category,
      actionType: "Edit Item",
      qty: 0,
      date: targetDate,
      username: String(operator),
      timestamp: nowIso
    });
    await newLog.save();

    res.json({ item, log: newLog });
  } catch (err: any) {
    console.error("Failed to update inventory item:", err);
    res.status(500).json({ error: "Failed to update item." });
  }
});

app.post("/api/inventory/transaction", requireRole("admin", "coordinator", "senior_technician"), async (req, res) => {
  try {
    const { itemId, type, qty, customerName, date } = req.body || {};
    if (typeof itemId !== "string" || !itemId.trim() || typeof type !== "string" || !type.trim()) {
      res.status(400).json({ error: "Item ID, transaction type, and valid quantity are required." });
      return;
    }

    if (date !== undefined && date !== null && typeof date !== "string") {
      res.status(400).json({ error: "Date must be a string." });
      return;
    }
    if (customerName !== undefined && customerName !== null && typeof customerName !== "string") {
      res.status(400).json({ error: "customerName must be a string." });
      return;
    }

    const quantity = parsePositiveFiniteQuantity(qty);
    if (quantity === null) {
      res.status(400).json({ error: "Item ID, transaction type, and valid quantity are required." });
      return;
    }

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const cleanItemId = itemId.trim();
    const targetDate = typeof date === "string" && date.trim() ? date.trim() : new Date().toISOString().split("T")[0];
    const operator = (req as any).user.username;
    
    let actionType = "";
    let qtyImpact = 0;
    let filter: Record<string, any> = { id: cleanItemId };

    if (type === "fill") {
      actionType = "Fill Stock";
      qtyImpact = quantity;
    } else if (type === "sell") {
      if (typeof customerName !== "string" || !customerName.trim()) {
        res.status(400).json({ error: "Customer name is required for selling items." });
        return;
      }
      actionType = `Sell: ${customerName.trim()}`;
      qtyImpact = -quantity;
      filter = { id: cleanItemId, qty: mongoose.trusted({ $gte: quantity }) };
    } else if (type === "damaged") {
      if (typeof customerName !== "string" || !customerName.trim()) {
        res.status(400).json({ error: "Description is required for damaged items." });
        return;
      }
      actionType = `Damaged: ${customerName.trim()}`;
      qtyImpact = -quantity;
      filter = { id: cleanItemId, qty: mongoose.trusted({ $gte: quantity }) };
    } else {
      res.status(400).json({ error: "Invalid transaction type. Must be 'fill', 'sell', or 'damaged'." });
      return;
    }

    const nowIso = new Date().toISOString();
    const item: any = await InventoryItemModel.findOneAndUpdate(
      filter as any,
      {
        $inc: { qty: qtyImpact },
        $set: { date: targetDate, updatedAt: nowIso }
      },
      { new: true } as any
    );

    if (!item) {
      const existingItem: any = await InventoryItemModel.findOne({ id: cleanItemId } as any).lean();
      if (!existingItem) {
        res.status(404).json({ error: "Inventory item not found." });
        return;
      }
      res.status(400).json({ error: `Insufficient stock. Only ${existingItem.qty} items available.` });
      return;
    }

    // Create log
    const logId = "invlog-" + crypto.randomUUID();
    const newLog = new InventoryLogModel({
      id: logId,
      itemName: item.name,
      category: item.category,
      actionType: actionType,
      qty: qtyImpact,
      date: targetDate,
      username: String(operator),
      timestamp: nowIso
    });
    await newLog.save();

    res.json({ item, log: newLog });
  } catch (err: any) {
    console.error("Inventory transaction failed:", err);
    res.status(500).json({ error: "Inventory transaction failed." });
  }
});

app.get("/api/inventory/logs", requireRole("admin", "coordinator", "senior_technician", "technician"), async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const logs = await InventoryLogModel.find().sort({ timestamp: -1 }).lean();
    res.json(logs);
  } catch (err: any) {
    console.error("Failed to fetch inventory logs:", err);
    res.status(500).json({ error: "Failed to fetch inventory logs." });
  }
});

app.get("/api/inventory/categories", requireRole("admin", "coordinator", "senior_technician", "technician"), async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const categories = await (InventoryItemModel as any).distinct("category");
    res.json(categories);
  } catch (err: any) {
    console.error("Failed to fetch inventory categories:", err);
    res.status(500).json({ error: "Failed to fetch categories." });
  }
});

const ParseTicketRateLimitSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  count: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 600 }
});

const ParseTicketRateLimitModel =
  mongoose.models.ParseTicketRateLimit ||
  mongoose.model("ParseTicketRateLimit", ParseTicketRateLimitSchema);

const PARSE_TICKET_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const PARSE_TICKET_MAX_REQUESTS = 20;

function isValidIsoDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// AI TICKET AUTOFILL ENDPOINT WITH GEMINI
app.post(
  "/api/parse-ticket",
  requireRole("admin", "coordinator", "senior_technician", "technician"),
  async (req, res) => {
    try {
      const { rawText, referenceDate } = req.body || {};
      if (typeof rawText !== "string" || !rawText.trim()) {
        res.status(400).json({ error: "Raw text description is required" });
        return;
      }
      if (rawText.length > 2000) {
        res.status(400).json({ error: "Raw text must not exceed 2000 characters" });
        return;
      }

      let safeReferenceDate = new Date().toISOString().split("T")[0];
      if (referenceDate !== undefined && referenceDate !== null && referenceDate !== "") {
        if (!isValidIsoDateOnly(referenceDate)) {
          res.status(400).json({ error: "referenceDate must be a valid YYYY-MM-DD date" });
          return;
        }
        safeReferenceDate = referenceDate;
      }

      if (!mongoConnected) {
        res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
        return;
      }

      const userId = String((req as any).user?.id || (req as any).user?.username || "anonymous");
      const now = Date.now();
      const existingRate = await ParseTicketRateLimitModel.findOne({ userId } as any);
      if (existingRate) {
        const createdTime = existingRate.createdAt ? new Date(existingRate.createdAt).getTime() : 0;
        if (now - createdTime > PARSE_TICKET_WINDOW_MS) {
          existingRate.count = 1;
          existingRate.createdAt = new Date(now);
          await existingRate.save();
        } else if (existingRate.count >= PARSE_TICKET_MAX_REQUESTS) {
          res.status(429).json({ error: "Rate limit exceeded. Maximum 20 AI parse requests per 10 minutes." });
          return;
        } else {
          existingRate.count += 1;
          await existingRate.save();
        }
      } else {
        await ParseTicketRateLimitModel.create({
          userId,
          count: 1,
          createdAt: new Date(now)
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.includes("YourGeminiApiKeyHere")) {
        console.error("Gemini Parse Ticket Error: GEMINI_API_KEY is not configured.");
        res.status(500).json({ error: "AI ticket parsing is currently unavailable." });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = 
        "You are an expert bilingual administrative dispatcher assistant for 'YS SVC', " +
        "a top-tier computer repair and support service center in Yangon, Myanmar.\n" +
        "Your objective is to carefully extract structured information from raw, messy text requests, " +
        "which are often written in English, Burmese, or a hybrid of both, and return it in a clean " +
        "structured JSON schema.\n\n" +
        "CRITICAL RULE: DO NOT translate any Burmese text into English. If the user writes names, issues, descriptions, or addresses in Burmese, you MUST keep them exactly as-is in Burmese unicode. Absolutely no translation to English for Burmese terms or sentences.\n\n" +
        "Guidelines for extraction:\n" +
        "1. Customer Name (customerName): Cleanly extract the name. If a company and a person name are both mentioned, extract both or prioritize the name/company (e.g. 'BMN' or 'BMN Co'). Keep it in Burmese if written in Burmese.\n" +
        "2. Customer Phone (customerPhone): Extract physical phone numbers cleanly (e.g. '09 767069833' or '09767069833'). Replace spaces/hyphens with a clean sequence or keep standard format.\n" +
        "3. Device Type (deviceType): Categorize general device type (e.g. 'PC', 'Laptop', 'Printer', 'CCTV', 'AC'). Be concise. If it says 'Pc update', output 'PC' or 'Laptop'.\n" +
        "4. Device Issue (deviceIssue): Extract description, including requests like upgrading programs, SSD, hardware installations, pricing mentioned (e.g., 'Traveling 10000, Service 30000 1 Pc ပြောထားပါတယ်။ Pc update လုပ်ချင်တာပါ'). Include any specific remarks or notes. Do NOT translate from Burmese to English; preserve the Burmese text exactly as-is so technician has full context. Keep it highly detailed and comprehensive.\n" +
        "5. Location / Address (locationText): Combine building numbers, condo name, streets, township, e.g. 'Shwe Hinthar Condo B, 6 မိုင်ခွဲ, Yangon' or standard descriptive Yangon addresses. If the address is in Burmese, preserve the Burmese text exactly as-is without translating.\n" +
        "6. Date (selectedDate): Look at date indicators like relative expressions ('Monday', 'tomorrow', 'today', 'Sunday'). Utilize the referenceDate: " + safeReferenceDate + " to accurately calculate the correct date target as YYYY-MM-DD. For example, if referenceDate is 2026-06-14 (Sunday), 'Monday' corresponds to 2026-06-15. If no date is found, default to referenceDate.\n" +
        "7. Time Slot (selectedTime): Must be strictly matched to one of: '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', or 'none'. Match based on hour preferences if mentioned (e.g. '1 PM' -> '13:00', '10 AM' -> '10:00'). If unspecified, return 'none'.\n" +
        "8. Urgency (urgency): Set urgency based on keywords or high priority. Must be strictly one of: 'Low', 'Medium', 'High', 'Critical'. Default to 'Medium'.";

      const prompt = `Please extract the service ticket specifications from the following raw text and format the output strictly as a JSON object:\n---\n${rawText}\n---`;

      const modelsToTry = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash"
      ];

      let resultText = "";
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`Attempting ticket parse via Gemini with model: ${modelName}`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  customerName: { type: Type.STRING, description: "Bilingual or English customer name cleanly extracted from text. If written in Burmese, preserve the Burmese text and DO NOT translate to English. If unspecified, return empty string." },
                  customerPhone: { type: Type.STRING, description: "Bilingual phone number. Cleaned and formatted. If unspecified, return empty string." },
                  deviceType: { type: Type.STRING, description: "Device category (e.g., PC, Laptop, Printer, CCTV, AC, etc.). If unspecified, return empty string." },
                  deviceIssue: { type: Type.STRING, description: "Detailed description of the issue or upgrade request. Preserve any Burmese text EXACTLY as-is and DO NOT translate to English. If unspecified, return empty string." },
                  locationText: { type: Type.STRING, description: "Extracted Yangon, Myanmar address. Preserve any Burmese text EXACTLY as-is and DO NOT translate to English. If unspecified, return empty string." },
                  urgency: { type: Type.STRING, description: "Urgency category. Must be strictly one of: Low, Medium, High, Critical", enum: ["Low", "Medium", "High", "Critical"] },
                  selectedDate: { type: Type.STRING, description: "The calculated target service date as YYYY-MM-DD. Calculate relative dates like 'tomorrow' based on the referenceDate." },
                  selectedTime: { type: Type.STRING, description: "Preferred hour match. Strictly one of: '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', or 'none'. Default is 'none'." }
                },
                required: ["customerName", "customerPhone", "deviceType", "deviceIssue", "locationText", "urgency", "selectedDate", "selectedTime"]
              }
            }
          });

          if (response.text) {
            resultText = response.text;
            console.log(`Successfully retrieved text from model ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`Gemini model ${modelName} failed. Error: ${err.message || err}`);
          lastError = err;
        }
      }

      if (!resultText) {
        throw new Error(`Gemini parsing failed on all models. Last error: ${lastError?.message || lastError}`);
      }

      let cleaned = resultText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "");
        cleaned = cleaned.replace(/\n?```$/, "");
        cleaned = cleaned.trim();
      }

      const parsedData = JSON.parse(cleaned);
      res.json(parsedData);
    } catch (err: any) {
      console.error("Gemini Parse Ticket Error:", err);
      res.status(500).json({ error: "AI ticket parsing failed. Please try again later." });
    }
  }
);

// Clear collections endpoint (useful utility)
app.post("/api/system/reset", requireRole("admin"), async (req, res) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== "admin") {
      res.status(403).json({ error: "Access denied. Only administrators can reset system database state." });
      return;
    }

    const { confirm } = req.body || {};
    if (confirm !== "WIPE_ALL_DATA") {
      res.status(400).json({ error: "Missing or invalid confirmation to reset the database." });
      return;
    }

    if (!isValidSeedPassword(process.env.INITIAL_ADMIN_PASSWORD)) {
      res.status(400).json({
        error: "Cannot reset system: INITIAL_ADMIN_PASSWORD (minimum 12 characters) must be configured before resetting."
      });
      return;
    }

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const seedUsers = await buildSeedUsers();
    if (!seedUsers.some((u) => u.role === "admin")) {
      res.status(400).json({
        error: "Cannot reset system: INITIAL_ADMIN_PASSWORD (minimum 12 characters) must be configured before resetting."
      });
      return;
    }

    await JobModel.deleteMany({});
    await InvoiceModel.deleteMany({});
    await UserModel.deleteMany({});
    await ActivityLogModel.deleteMany({});
    await DeletedJobModel.deleteMany({});
    if (INITIAL_JOBS_FALLBACK.length > 0) {
      await JobModel.insertMany(INITIAL_JOBS_FALLBACK as any[]);
    }
    if (INITIAL_INVOICES_FALLBACK.length > 0) {
      await InvoiceModel.insertMany(INITIAL_INVOICES_FALLBACK as any[]);
    }
    await UserModel.insertMany(seedUsers as any[]);
    res.json({ message: "MongoDB data reset successfully!" });
  } catch (err: any) {
    console.error("Failed to reset system:", err);
    res.status(500).json({ error: "Failed to reset system data." });
  }
});

export default app;
