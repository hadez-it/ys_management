import express from "express";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

// Load configuration
dotenv.config();

const app = express();

app.use(express.json());

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
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  dateTime: { type: String, required: true },
  locationText: { type: String, required: true },
  locationCoords: { type: LocationSchema, required: true },
  deviceType: { type: String, required: true },
  deviceModel: { type: String },
  deviceIssue: { type: String, required: true },
  urgency: { type: String, required: true },
  status: { type: String, required: true },
  technicianName: { type: String },
  diagnosedProblem: { type: String },
  resolutionNotes: { type: String },
  createdAt: { type: String, required: true },
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
  jobId: { type: String, required: true },
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
  createdTime: { type: String, required: true }
});

const JobModel = mongoose.models.Job || mongoose.model("Job", ServiceJobSchema);
const InvoiceModel = mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);

const DeletedJobSchema = new mongoose.Schema({
  id: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  dateTime: { type: String, required: true },
  deletedAt: { type: String, required: true },
  deleteReason: { type: String, required: true },
  originalJobData: { type: mongoose.Schema.Types.Mixed, required: true }
});

const DeletedJobModel = mongoose.models.DeletedJob || mongoose.model("DeletedJob", DeletedJobSchema);

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: String }
});

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

// Initial fallback values to populate hybrid database
const INITIAL_USERS = [
  {
    id: "usr-01",
    username: "admin",
    password: "admin",
    name: "System Admin Ko Phyo",
    role: "admin",
    phone: "09971234567"
  },
  {
    id: "usr-02",
    username: "coordinator",
    password: "coordinator",
    name: "Coordinator Daw Su",
    role: "coordinator",
    phone: "09971234568"
  },
  {
    id: "usr-03",
    username: "senior",
    password: "senior",
    name: "Senior Tech Ko Tin",
    role: "senior_technician",
    phone: "09971234569"
  },
  {
    id: "usr-04",
    username: "tech",
    password: "tech",
    name: "Technician Ko Sai",
    role: "technician",
    phone: "09971234570"
  }
];

const INITIAL_JOBS_FALLBACK = [
  {
    id: "JOB-2026-001",
    customerName: "Daw Tin Tin Aye",
    customerPhone: "09421055667",
    dateTime: "2026-06-07T10:00",
    locationText: "No. (45), Pyay Road, Sanchaung Township, Yangon",
    locationCoords: { lat: 16.8122, lng: 96.1345 },
    deviceType: "Laptop",
    deviceModel: "Dell Inspiron 15",
    deviceIssue: "Screen flickering heavily and battery drains within 10 minutes. Needs diagnostic and likely a replacement screen and battery.",
    urgency: "High",
    status: "Created",
    createdAt: "2026-06-06T09:00:00Z",
    updatedAt: "2026-06-06T09:00:00Z"
  },
  {
    id: "JOB-2026-002",
    customerName: "Ko Sai Sai",
    customerPhone: "09254332115",
    dateTime: "2026-06-06T14:30",
    locationText: "No. (12), Malikha Street, Mayangone Township, Yangon",
    locationCoords: { lat: 16.8524, lng: 96.1518 },
    deviceType: "Desktop",
    deviceModel: "Custom Built Gaming PC",
    deviceIssue: "No display when powering on. RGB lights turn on, fans run, but no signal to the monitor.",
    urgency: "Medium",
    status: "Dispatched",
    createdAt: "2026-06-05T14:00:00Z",
    updatedAt: "2026-06-06T10:30:00Z"
  },
  {
    id: "JOB-2026-003",
    customerName: "Ma Hnin Nu",
    customerPhone: "09786543210",
    dateTime: "2026-06-05T09:30",
    locationText: "Apartment 4B, Pearl Condo, Bahan Township, Yangon",
    locationCoords: { lat: 16.8208, lng: 96.1554 },
    deviceType: "Laptop",
    deviceModel: "MacBook Air M1 2020",
    deviceIssue: "Spilled coffee over keyboard. Refuses to power on.",
    urgency: "Critical",
    status: "Completed",
    diagnosedProblem: "Liquid damage on power management (PMIC).",
    resolutionNotes: "Ultrasonic cleaned and replaced PPBUS shorted logic capacitors.",
    createdAt: "2026-06-04T10:00:00Z",
    updatedAt: "2026-06-05T12:00:00Z",
    invoiceId: "INV-2026-101"
  }
];

const INITIAL_INVOICES_FALLBACK = [
  {
    id: "INV-2026-101",
    jobId: "JOB-2026-003",
    customerName: "Ma Hnin Nu",
    customerPhone: "09786543210",
    dateTime: "2026-06-05T12:30",
    items: [
      {
        id: "item-1",
        description: "Motherboard Logic Board Circuit Repair (Coffee damage)",
        quantity: 1,
        unitPrice: 180000,
        amount: 180000
      },
      {
        id: "item-2",
        description: "On-site diagnostic and component sourcing",
        quantity: 1,
        unitPrice: 20000,
        amount: 20000
      }
    ],
    subtotal: 200000,
    tax: 10000,
    discount: 5000,
    total: 205000,
    paymentStatus: "Paid",
    paymentMethod: "KBZPay",
    notes: "Completed by head workshop engineer. Standard 3 months warranty.",
    createdTime: "2026-06-05T12:35:00Z"
  }
];

let cachedConnection: Promise<typeof mongoose> | null = null;
let databaseSeeded = false;
let lastConnectAttemptTime = 0;
const CONNECT_COOLDOWN_MS = 25000; // 25 seconds cooldown to prevent log spamming and API blocking

// Global Server-side In-Memory Fallback Databases
let MEMORY_JOBS = JSON.parse(JSON.stringify(INITIAL_JOBS_FALLBACK));
let MEMORY_INVOICES = JSON.parse(JSON.stringify(INITIAL_INVOICES_FALLBACK));
let MEMORY_DELETED_JOBS: any[] = [];
let MEMORY_USERS = JSON.parse(JSON.stringify(INITIAL_USERS));

// Async builder helper to ensure database connectivity before making requests (ideal for serverless cold-starts)
async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) {
    mongoConnected = true;
    return;
  }

  const now = Date.now();
  if (!mongoConnected && lastConnectionError && (now - lastConnectAttemptTime < CONNECT_COOLDOWN_MS)) {
    const remainSecs = Math.ceil((CONNECT_COOLDOWN_MS - (now - lastConnectAttemptTime)) / 1000);
    throw new Error(`${lastConnectionError} (ချိတ်ဆက်ရန် နောက်ထပ် ${remainSecs} စက္ကန့် စောင့်ဆိုင်းနေပါသည် - Fallback Engine အသုံးပြုနေသည်)`);
  }

  lastConnectAttemptTime = now;

  const currentUri = process.env.MONGO_URI || "";
  let currentUriDiagnostics = "present";
  if (!currentUri || currentUri === "") {
    currentUriDiagnostics = "missing";
  } else if (currentUri.includes("<db_username>") || currentUri.includes("<db_password>") || currentUri.includes("YOUR_")) {
    currentUriDiagnostics = "placeholder";
  }

  if (currentUriDiagnostics !== "present") {
    mongoConnected = false;
    if (currentUriDiagnostics === "missing") {
      lastConnectionError = "MONGO_URI environment variable is missing in setup.";
    } else {
      lastConnectionError = "MONGO_URI connection link contains unresolved placeholders (like <db_username>, <db_password> or YOUR_).";
    }
    throw new Error(lastConnectionError);
  }

  try {
    console.log("Connecting strictly to MongoDB Atlas dynamically...");
    
    if (!cachedConnection) {
      cachedConnection = mongoose.connect(currentUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
    }
    
    await cachedConnection;
    mongoConnected = true;
    console.log("SUCCESS: MongoDB Atlas connection established!");

    // Seed database on-demand if not already seeded during this runtime lifecycle
    if (!databaseSeeded) {
      try {
        const jobCount = await JobModel.countDocuments();
        if (jobCount === 0) {
          console.log("First connection: Seeding initial fallback jobs...");
          await JobModel.insertMany(INITIAL_JOBS_FALLBACK as any[]);
          await InvoiceModel.insertMany(INITIAL_INVOICES_FALLBACK as any[]);
        }

        const userCount = await UserModel.countDocuments();
        if (userCount === 0) {
          console.log("First connection: Seeding initial fallback users...");
          await UserModel.insertMany(INITIAL_USERS as any[]);
        }
        databaseSeeded = true;
      } catch (seedErr) {
        console.error("Warning: Seeding on-demand failed or was already completed:", seedErr);
      }
    }
  } catch (err: any) {
    mongoConnected = false;
    cachedConnection = null; // reset cached connection on failure
    lastConnectionError = err.message || String(err);
    console.error("ERROR: MongoDB connections failing dynamically:", lastConnectionError);
    throw err;
  }
}

// A dynamic serverless-friendly database auto-resolution middleware for API requests
app.use("/api", async (req, res, next) => {
  // If it's just checking status, try resolving lazily but proceed to normal handler so status returns diagnostic logs properly
  if (req.path === "/db-status") {
    try {
      await ensureDbConnected();
    } catch {
      // Intentionally bypassed to let /api/db-status API return detailed error text rather than crashing
    }
    return next();
  }

  try {
    await ensureDbConnected();
    next();
  } catch (err: any) {
    // In-Memory fallback option so that the app NEVER crashes even when Mongo connection is bad (e.g. Bad auth/Bad URI)
    console.log("WARN: Using local Server Memory Fallback Mode because Live MongoDB is offline:", err.message || lastConnectionError);
    next();
  }
});

// REST API Endpoints
app.get("/api/db-status", (req, res) => {
  const currentUri = process.env.MONGO_URI || "";
  let currentUriDiagnostics = "present";
  if (!currentUri || currentUri === "") {
    currentUriDiagnostics = "missing";
  } else if (currentUri.includes("<db_username>") || currentUri.includes("<db_password>") || currentUri.includes("YOUR_")) {
    currentUriDiagnostics = "placeholder";
  }

  res.json({
    connected: mongoConnected,
    isDemo: false,
    uriUsed: (currentUri && currentUriDiagnostics === "present") ? currentUri.split("@").pop() : "No Valid Link",
    modeMessage: mongoConnected 
      ? "Connected to Your MongoDB Atlas Live Cluster." 
      : `Database Connection Offline: ${lastConnectionError || "Please check your MONGO_URI connection settings."}`,
    error: lastConnectionError,
    uriState: currentUriDiagnostics
  });
});

// LOGIN Endpoint
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    if (mongoConnected) {
      const user = await UserModel.findOne({ username: cleanUsername } as any).lean();
      if (!user || user.password !== password) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      // In-Memory Fallback Authentication
      const user = MEMORY_USERS.find((u: any) => u.username === cleanUsername);
      if (!user || user.password !== password) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// JOB API Endpoints
app.get("/api/jobs", async (req, res) => {
  try {
    if (mongoConnected) {
      const dbJobs = await JobModel.find().lean();
      res.json(dbJobs);
    } else {
      res.json(MEMORY_JOBS);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs", async (req, res) => {
  try {
    const jobData = req.body;
    if (mongoConnected) {
      const newJob = new JobModel(jobData);
      await newJob.save();
      res.status(201).json(newJob);
    } else {
      MEMORY_JOBS.push(jobData);
      res.status(201).json(jobData);
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { editReason, ...fieldsToUpdate } = req.body;
    if (fieldsToUpdate.status === "Completed") {
      fieldsToUpdate.priorityNumber = null;
    }

    if (mongoConnected) {
      const jobToEdit = await JobModel.findOne({ id } as any);
      if (!jobToEdit) {
        res.status(404).json({ error: `Job with ID ${id} is not present in database.` });
        return;
      }
      
      const updateQuery: any = { $set: { ...fieldsToUpdate, updatedAt: new Date().toISOString() } };
      if (fieldsToUpdate.status === "Completed") {
        updateQuery.$unset = { priorityNumber: "" };
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
      res.json(updatedJob);
    } else {
      // In-Memory Fallback Job Update
      const jobIdx = MEMORY_JOBS.findIndex((j: any) => j.id === id);
      if (jobIdx === -1) {
        res.status(404).json({ error: `Job with ID ${id} is not found in memory.` });
        return;
      }

      const jobToEdit = MEMORY_JOBS[jobIdx];
      const changes: string[] = [];
      if (editReason) {
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
      }

      const updatedJob = {
        ...jobToEdit,
        ...fieldsToUpdate,
        updatedAt: new Date().toISOString(),
        editHistory: [
          ...(jobToEdit.editHistory || []),
          ...(editReason ? [{
            editedAt: new Date().toISOString(),
            reason: editReason,
            changedFields: changes.join(", ") || "General Info Update"
          }] : [])
        ]
      };

      if (fieldsToUpdate.status === "Completed") {
        delete updatedJob.priorityNumber;
      }

      MEMORY_JOBS[jobIdx] = updatedJob;
      res.json(updatedJob);
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE Job with Archived Reason
app.delete("/api/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const cleanReason = reason && reason.trim() ? reason.trim() : "No reason provided";

    if (mongoConnected) {
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
      await JobModel.deleteOne({ id } as any);
      res.json({ success: true, message: "Job deleted and reasons archived successfully." });
    } else {
      // In-Memory Fallback Job Deletion / Archiving
      const jobIdx = MEMORY_JOBS.findIndex((j: any) => j.id === id);
      if (jobIdx === -1) {
        res.status(404).json({ error: `Job with ID ${id} is not found in memory.` });
        return;
      }

      const jobToDelete = MEMORY_JOBS[jobIdx];
      const archived = {
        id: jobToDelete.id,
        customerName: jobToDelete.customerName,
        customerPhone: jobToDelete.customerPhone,
        dateTime: jobToDelete.dateTime,
        deletedAt: new Date().toISOString(),
        deleteReason: cleanReason,
        originalJobData: jobToDelete
      };

      MEMORY_DELETED_JOBS.unshift(archived);
      MEMORY_JOBS.splice(jobIdx, 1);
      res.json({ success: true, message: "Job deleted and reasons archived successfully (Memory)." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Deleted Jobs Log
app.get("/api/deleted-jobs", async (req, res) => {
  try {
    if (mongoConnected) {
      const dbDeleted = await DeletedJobModel.find().sort({ deletedAt: -1 }).lean();
      res.json(dbDeleted);
    } else {
      res.json(MEMORY_DELETED_JOBS);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// INVOICE API Endpoints
app.get("/api/invoices", async (req, res) => {
  try {
    if (mongoConnected) {
      const dbInvoices = await InvoiceModel.find().lean();
      res.json(dbInvoices);
    } else {
      res.json(MEMORY_INVOICES);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/invoices", async (req, res) => {
  try {
    const invoiceData = req.body;
    if (mongoConnected) {
      const newInvoice = new InvoiceModel(invoiceData);
      await newInvoice.save();
      res.status(201).json(newInvoice);
    } else {
      MEMORY_INVOICES.push(invoiceData);
      res.status(201).json(invoiceData);
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// User Management API endpoints
app.get("/api/users", async (req, res) => {
  try {
    if (mongoConnected) {
      const users = await UserModel.find({} as any).lean();
      const sanitized = users.map((u: any) => {
        const { password, ...rest } = u;
        return rest;
      });
      res.json(sanitized);
    } else {
      const sanitized = MEMORY_USERS.map((u: any) => {
        const { password, ...rest } = u;
        return rest;
      });
      res.json(sanitized);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch users: " + err.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { username, name, role, phone, password } = req.body;
    if (!username || !name || !role || !password) {
      res.status(400).json({ error: "Username, Name, Role, and Password are required" });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();

    if (mongoConnected) {
      const existing = await UserModel.findOne({ username: cleanUsername } as any);
      if (existing) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }

      const newUser = {
        id: "usr-" + Date.now(),
        username: cleanUsername,
        password: password,
        name: name,
        role: role,
        phone: phone || ""
      };

      const mongoUser = new UserModel(newUser);
      await mongoUser.save();
      const { password: _, ...sanitized } = newUser;
      res.status(201).json(sanitized);
    } else {
      const existing = MEMORY_USERS.find((u: any) => u.username === cleanUsername);
      if (existing) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }

      const newUser = {
        id: "usr-" + Date.now(),
        username: cleanUsername,
        password: password,
        name: name,
        role: role,
        phone: phone || ""
      };

      MEMORY_USERS.push(newUser);
      const { password: _, ...sanitized } = newUser;
      res.status(201).json(sanitized);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create user: " + err.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, role, phone, password } = req.body;

    if (mongoConnected) {
      const user = await UserModel.findOne({ id } as any);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      if (username) {
        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername !== user.username) {
          const existing = await UserModel.findOne({ username: cleanUsername } as any);
           if (existing) {
            res.status(400).json({ error: "Username already taken" });
            return;
          }
          user.username = cleanUsername;
        }
      }
      
      if (name) user.name = name;
      if (role) user.role = role;
      if (phone !== undefined) user.phone = phone;
      if (password) user.password = password;
      
      await user.save();
      const { password: _, ...sanitized } = user.toObject();
      res.json(sanitized);
    } else {
      const userIdx = MEMORY_USERS.findIndex((u: any) => u.id === id);
      if (userIdx === -1) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const user = MEMORY_USERS[userIdx];
      if (username) {
        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername !== user.username) {
          const existing = MEMORY_USERS.find((u: any) => u.username === cleanUsername);
          if (existing) {
            res.status(400).json({ error: "Username already taken" });
            return;
          }
          user.username = cleanUsername;
        }
      }

      if (name) user.name = name;
      if (role) user.role = role;
      if (phone !== undefined) user.phone = phone;
      if (password) user.password = password;

      MEMORY_USERS[userIdx] = user;
      const { password: _, ...sanitized } = user;
      res.json(sanitized);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update user: " + err.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "usr-01") {
      res.status(400).json({ error: "Cannot delete the default root admin account" });
      return;
    }

    if (mongoConnected) {
      const deleted = await UserModel.findOneAndDelete({ id } as any);
      if (!deleted) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ success: true, message: "User deleted successfully" });
    } else {
      const userIdx = MEMORY_USERS.findIndex((u: any) => u.id === id);
      if (userIdx === -1) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      MEMORY_USERS.splice(userIdx, 1);
      res.json({ success: true, message: "User deleted successfully" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete user: " + err.message });
  }
});

// Clear collections endpoint (useful utility)
app.post("/api/system/reset", async (req, res) => {
  try {
    if (mongoConnected) {
      await JobModel.deleteMany({});
      await InvoiceModel.deleteMany({});
      await UserModel.deleteMany({});
      await JobModel.insertMany(INITIAL_JOBS_FALLBACK as any[]);
      await InvoiceModel.insertMany(INITIAL_INVOICES_FALLBACK as any[]);
      await UserModel.insertMany(INITIAL_USERS as any[]);
      res.json({ message: "MongoDB data reset successfully!" });
    } else {
      MEMORY_JOBS = JSON.parse(JSON.stringify(INITIAL_JOBS_FALLBACK));
      MEMORY_INVOICES = JSON.parse(JSON.stringify(INITIAL_INVOICES_FALLBACK));
      MEMORY_USERS = JSON.parse(JSON.stringify(INITIAL_USERS));
      MEMORY_DELETED_JOBS = [];
      res.json({ message: "In-Memory database reset successfully!" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
