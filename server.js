const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const driverRoutes = require("./src/routes/drivers");
const bonusRoutes = require("./src/routes/bonuses");
const importRoutes = require("./src/routes/imports");
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

const RequestContext = require("./src/utils/requestContext");

const logger = require("./src/utils/logger");
const pinoHttp = require("pino-http")({ logger });

// Middleware
app.use(pinoHttp);
app.use(
  helmet({
    contentSecurityPolicy: false,
    xDownloadOptions: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(RequestContext.middleware);
app.use(
  express.static(path.join(__dirname, "public"), { extensions: ["html"] })
);
app.use("/imports", express.static(path.join(__dirname, "public/imports")));
app.use("/reconciliationfile", express.static(path.join(__dirname, "public/reconciliationfile")));

const globalErrorHandler = require("./src/middleware/errorMiddleware");
const AppError = require("./src/utils/appError");

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/bonuses", bonusRoutes);
app.use("/api/imports", importRoutes);
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

// Handle 404 for API routes
app.all("/api/{*path}", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Serve Frontend - Catch-all middleware
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use(globalErrorHandler);

// Initialize Scheduler Service
const SchedulerService = require("./src/services/schedulerService");

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);

  // Initialize scheduled reports
  SchedulerService.init();
});
