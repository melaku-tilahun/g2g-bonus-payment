const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const driverRoutes = require("./src/routes/drivers");
const bonusRoutes = require("./src/routes/bonuses");
const uploadRoutes = require("./src/routes/uploads");
const paymentRoutes = require("./src/routes/payments");
const dashboardRoutes = require("./src/routes/dashboard");
const debtRoutes = require("./src/routes/debts");

// Admin Feature Routes
const analyticsRoutes = require("./src/routes/analytics");
const reportsRoutes = require("./src/routes/reports");
const notificationsRoutes = require("./src/routes/notifications");
const exportRoutes = require("./src/routes/export");
const auditRoutes = require("./src/routes/audit");
const searchRoutes = require("./src/routes/search");
const systemHealthRoutes = require("./src/routes/system-health");
const batchRoutes = require("./src/routes/batches");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/bonuses", bonusRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/debts", debtRoutes);

// Admin Feature Routes
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/system-health", systemHealthRoutes);
app.use("/api/batches", batchRoutes);

// Serve Frontend - Catch-all middleware
app.use((req, res) => {
  // Basic route to check if server is running
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Initialize Scheduler Service
const SchedulerService = require("./src/services/schedulerService");

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Initialize scheduled reports
  SchedulerService.init();
});
