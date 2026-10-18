require("dotenv").config();

const express = require("express");
const cors = require("cors");

const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const aiRoutes = require("./routes/aiRoutes");
const { registerListeners } = require("./listeners");
const connectDB = require("./config/db");

// Register event listeners exactly once on startup before any request triggers an event
registerListeners();

// Connect to MongoDB if not running in automated test mode
if (process.env.NODE_ENV !== "test") {
    connectDB();
}

const app = express();

// Enable CORS for frontend integration
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Request logging middleware
app.use(logger);

// Welcome / Health check route for browser visits to http://localhost:5000/
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Practical 13: AI API Integration into a Web Application API is running",
        studentId: "24CS018",
        status: "active",
        endpoints: {
            register: "POST /register",
            login: "POST /login",
            tasks: "GET, POST /tasks",
            taskById: "GET, PUT, DELETE /tasks/:id",
            cacheStats: "GET /debug/cache-stats",
            generateDescription: "POST /api/ai/generate-description"
        },
        documentation: "Use Postman, Thunder Client, or curl to test POST/PUT/DELETE requests."
    });
});

// Auth routes (available at root /register, /login, /me and /auth/*)
app.use("/", authRoutes);
app.use("/auth", authRoutes);

// AI Integration routes
app.use("/api/ai", aiRoutes);

const { getStats } = require("./config/cache");

// Debug endpoint for cache metrics (Supplementary)
app.get("/debug/cache-stats", (req, res) => {
    res.status(200).json(getStats());
});

// Protected Task routes
app.use("/tasks", taskRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

// Global error handler - must be last
app.use(errorHandler);

module.exports = app;
