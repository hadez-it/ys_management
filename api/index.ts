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

const ActivityLogSchema = new mongoose.Schema({
  id: { type: String, required: true },
  actionType: { type: String, required: true },
  jobId: { type: String, required: true },
  customerName: { type: String },
  deviceType: { type: String },
  username: { type: String, required: true },
  timestamp: { type: String, required: true },
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
      id: "ACT-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
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
        const userCount = await UserModel.countDocuments();
        if (userCount === 0) {
          console.log("First connection: Database is completely fresh. Seeding initial fallback users...");
          await UserModel.insertMany(INITIAL_USERS as any[]);

          const jobCount = await JobModel.countDocuments();
          if (jobCount === 0) {
            console.log("Seeding initial fallback jobs...");
            await JobModel.insertMany(INITIAL_JOBS_FALLBACK as any[]);
            await InvoiceModel.insertMany(INITIAL_INVOICES_FALLBACK as any[]);
          }
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
    res.status(503).json({ 
      error: `MongoDB Live Database ချိတ်ဆက်မှုမအောင်မြင်ပါ။ ဖြစ်နိုင်ချေရှိသော အကြောင်းရင်း - ${err.message || lastConnectionError}. MONGO_URI variable ကို ပြန်လည်စစ်ဆေးပါ။` 
    });
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

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await UserModel.findOne({ username: cleanUsername } as any).lean();
    if (!user || user.password !== password) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// JOB API Endpoints
app.get("/api/jobs", async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const dbJobs = await JobModel.find().lean();
    res.json(dbJobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/jobs", async (req, res) => {
  try {
    const jobData = req.body;
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const newJob = new JobModel(jobData);
    await newJob.save();

    // Log Activity
    const operator = req.headers["x-operator-username"] || req.query.username || "system";
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

app.put("/api/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { editReason, ...fieldsToUpdate } = req.body;
    if (fieldsToUpdate.status === "Completed") {
      fieldsToUpdate.priorityNumber = null;
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

    // Log Activity
    const operator = req.headers["x-operator-username"] || req.query.username || "system";
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
app.delete("/api/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const cleanReason = reason && reason.trim() ? reason.trim() : "No reason provided";

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
    const operator = req.headers["x-operator-username"] || req.query.username || "system";
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
    res.status(500).json({ error: err.message });
  }
});

// GET Deleted Jobs Log (Backward compatibility helper)
app.get("/api/deleted-jobs", async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const dbDeleted = await DeletedJobModel.find().sort({ deletedAt: -1 }).lean();
    res.json(dbDeleted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Activity Logs
app.get("/api/activity-logs", async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const logs = await ActivityLogModel.find().sort({ timestamp: -1 }).lean();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Manual Activity Log (for client-side or offline syncing actions)
app.post("/api/activity-logs", async (req, res) => {
  try {
    const { actionType, jobId, customerName, deviceType, username, details, timestamp } = req.body;
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    
    const newLog = new ActivityLogModel({
      id: "ACT-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      actionType: actionType || "Updated",
      jobId: jobId || "SYSTEM",
      customerName: customerName || "N/A",
      deviceType: deviceType || "N/A",
      username: username || "system",
      timestamp: timestamp || new Date().toISOString(),
      details: details || ""
    });
    
    await newLog.save();
    res.status(201).json(newLog);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// INVOICE API Endpoints
app.get("/api/invoices", async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const dbInvoices = await InvoiceModel.find().lean();
    res.json(dbInvoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/invoices", async (req, res) => {
  try {
    const invoiceData = req.body;
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    const newInvoice = new InvoiceModel(invoiceData);
    await newInvoice.save();
    res.status(201).json(newInvoice);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// User Management API endpoints
app.get("/api/users", async (req, res) => {
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
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create user: " + err.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, role, phone, password } = req.body;

    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }

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
    res.status(500).json({ error: "Failed to delete user: " + err.message });
  }
});

// Clear collections endpoint (useful utility)
app.post("/api/system/reset", async (req, res) => {
  try {
    if (!mongoConnected) {
      res.status(503).json({ error: "Database Offline: Live MongoDB connection is required." });
      return;
    }
    await JobModel.deleteMany({});
    await InvoiceModel.deleteMany({});
    await UserModel.deleteMany({});
    await ActivityLogModel.deleteMany({});
    await DeletedJobModel.deleteMany({});
    await JobModel.insertMany(INITIAL_JOBS_FALLBACK as any[]);
    await InvoiceModel.insertMany(INITIAL_INVOICES_FALLBACK as any[]);
    await UserModel.insertMany(INITIAL_USERS as any[]);
    res.json({ message: "MongoDB data reset successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
