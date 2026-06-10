import express from "express";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createServer as createViteServer } from "vite";

// Load configuration
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Determine URI configuration status
const rawUri = process.env.MONGO_URI || "";
const isDemoMode = 
  !rawUri || 
  rawUri.includes("<db_username>") || 
  rawUri.includes("<db_password>") ||
  rawUri.includes("YOUR_") ||
  rawUri === "";

let uriDiagnostics = "present";
if (!rawUri || rawUri === "") {
  uriDiagnostics = "missing";
} else if (rawUri.includes("<db_username>") || rawUri.includes("<db_password>") || rawUri.includes("YOUR_")) {
  uriDiagnostics = "placeholder";
}

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

// Memory-based fallback database for Demo/Hybrid Mode
let localJobs: any[] = [...INITIAL_JOBS_FALLBACK];
let localInvoices = [...INITIAL_INVOICES_FALLBACK];
let localDeletedJobs: any[] = [];
let localUsers: any[] = [...INITIAL_USERS];

// Connect lazily or directly
if (!isDemoMode) {
  console.log("Connecting to MongoDB Atlas...");
  mongoose.connect(rawUri)
    .then(async () => {
      mongoConnected = true;
      console.log("SUCCESS: MongoDB Atlas connection established!");
      
      // Seed initial data if database is empty
      try {
        const jobCount = await JobModel.countDocuments();
        if (jobCount === 0) {
          console.log("Seeding MongoDB with initial fallback jobs...");
          await JobModel.insertMany(INITIAL_JOBS_FALLBACK as any[]);
          await InvoiceModel.insertMany(INITIAL_INVOICES_FALLBACK as any[]);
          console.log("DB seeding completed successfully!");
        }

        const userCount = await UserModel.countDocuments();
        if (userCount === 0) {
          console.log("Seeding MongoDB with initial fallback users...");
          await UserModel.insertMany(INITIAL_USERS as any[]);
          console.log("Seed users added!");
        }
      } catch (err) {
        console.error("Failed to seed initial MongoDB collections:", err);
      }
    })
    .catch((err: any) => {
      lastConnectionError = err.message || String(err);
      console.error("ERROR: MongoDB Atlas connection failed:", err.message);
      console.log("Failing back dynamically to in-memory store mode.");
    });
} else {
  console.log("Running in LOCAL HYBRID DEMO state. MongoDB Atlas connection URI contains placeholders (or missing).");
}

// REST API Endpoints
app.get("/api/db-status", (req, res) => {
  res.json({
    connected: mongoConnected,
    isDemo: isDemoMode,
    uriUsed: isDemoMode ? "Placeholder Link" : rawUri.split("@").pop(), // Hide user password details
    modeMessage: isDemoMode 
      ? "Using Local Sandbox memory state. Update your MONGO_URI variable in Settings/Secrets to connect your MongoDB Atlas Cluster."
      : (mongoConnected ? "Connected to Your MongoDB Atlas Live Cluster." : `Mongoose Error: ${lastConnectionError}`),
    error: lastConnectionError,
    uriState: uriDiagnostics
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
      const user = localUsers.find(u => u.username === cleanUsername);
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
      res.json(localJobs);
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
      localJobs.unshift(jobData);
      res.status(201).json(jobData);
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (mongoConnected) {
      const jobToEdit = await JobModel.findOne({ id } as any);
      if (!jobToEdit) {
        res.status(404).json({ error: `Job with ID ${id} is not present in database.` });
        return;
      }
      
      const { editReason, ...fieldsToUpdate } = req.body;
      if (fieldsToUpdate.status === "Completed") {
        fieldsToUpdate.priorityNumber = null;
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
      const index = localJobs.findIndex((j) => j.id === id);
      if (index === -1) {
        res.status(404).json({ error: `Job with ID ${id} is not present in database.` });
        return;
      }
      const jobToEdit = localJobs[index];
      const { editReason, ...fieldsToUpdate } = req.body;
      if (fieldsToUpdate.status === "Completed") {
        fieldsToUpdate.priorityNumber = undefined;
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
        
        if (!jobToEdit.editHistory) {
          jobToEdit.editHistory = [];
        }
        jobToEdit.editHistory.push(log);
      }
      
      localJobs[index] = { ...jobToEdit, ...fieldsToUpdate, updatedAt: new Date().toISOString() };
      res.json(localJobs[index]);
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
      const index = localJobs.findIndex((j) => j.id === id);
      if (index === -1) {
        res.status(404).json({ error: `Job with ID ${id} is not present in database.` });
        return;
      }
      const jobToDelete = localJobs[index];
      const archived = {
        id: jobToDelete.id,
        customerName: jobToDelete.customerName,
        customerPhone: jobToDelete.customerPhone,
        dateTime: jobToDelete.dateTime,
        deletedAt: new Date().toISOString(),
        deleteReason: cleanReason,
        originalJobData: jobToDelete
      };
      localDeletedJobs.unshift(archived);
      localJobs.splice(index, 1);
      res.json({ success: true, message: "Job deleted and reasons archived successfully." });
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
      res.json(localDeletedJobs);
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
      res.json(localInvoices);
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
      localInvoices.unshift(invoiceData);
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
      const sanitized = localUsers.map((u: any) => {
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
    const newUser = {
      id: "usr-" + Date.now(),
      username: cleanUsername,
      password: password,
      name: name,
      role: role,
      phone: phone || ""
    };

    if (mongoConnected) {
      const existing = await UserModel.findOne({ username: cleanUsername } as any);
      if (existing) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }
      const mongoUser = new UserModel(newUser);
      await mongoUser.save();
      const { password: _, ...sanitized } = newUser;
      res.status(201).json(sanitized);
    } else {
      const existing = localUsers.find(u => u.username === cleanUsername);
      if (existing) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }
      localUsers.push(newUser);
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
      const index = localUsers.findIndex(u => u.id === id);
      if (index === -1) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      
      const user = localUsers[index];
      if (username) {
        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername !== user.username) {
          const existing = localUsers.find(u => u.username === cleanUsername);
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
      
      localUsers[index] = user;
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
      const index = localUsers.findIndex(u => u.id === id);
      if (index === -1) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      localUsers.splice(index, 1);
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
      localJobs = [...INITIAL_JOBS_FALLBACK];
      localInvoices = [...INITIAL_INVOICES_FALLBACK];
      localUsers = [...INITIAL_USERS];
      res.json({ message: "In-memory data reset successfully!" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vite Setup on Express
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is booting on https://localhost:${PORT}`);
  });
}

startServer();
