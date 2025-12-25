"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const loginRoutes_1 = __importDefault(require("./routes/loginRoutes"));
const crdtRoutes_1 = __importDefault(require("./routes/crdtRoutes"));
const enrichRoutes_1 = __importDefault(require("./routes/enrichRoutes"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_session_1 = __importDefault(require("cookie-session"));
const db_1 = require("./db");
const http_1 = __importDefault(require("http"));
const port = process.env.PORT || 4000; // Use the environment PORT or default to 4000
const origin1 = process.env.CLIENT_ORIGIN || "http://localhost:3000"; // For local dev
const origins = [origin1, "http://localhost"]; // Allow both local and configured origins
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
(0, db_1.connectDb)()
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => {
    console.error("MongoDB error:", err);
});
// Enable CORS with dynamic origins based on environment
app.use((0, cors_1.default)({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    optionsSuccessStatus: 204,
}));
// Health endpoint for CI/CD checks
app.get("/api/health", (_req, res) => {
    res
        .status(200)
        .json({ status: "ok", service: "server", ts: new Date().toISOString() });
});
// Use body-parser middleware with increased size limits
app.use(body_parser_1.default.json({ limit: "10mb" }));
app.use(body_parser_1.default.urlencoded({ limit: "10mb", extended: true }));
// Use cookie-session middleware
app.use((0, cookie_session_1.default)({
    keys: ["asdf"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: false, // If using HTTPS, set this to true
    name: "session",
}));
// Use the router for login and API
app.use("/api", crdtRoutes_1.default);
app.use("/api", enrichRoutes_1.default); // Assuming enrichRouter is defined in enrichRoutes.ts
app.use("/api", loginRoutes_1.default);
// Health check route
app.get("/health", (req, res) => {
    console.log("Health check endpoint hit");
    res.status(200).send("Health check passed");
});
// Socket.IO server setup
const socket_1 = require("./services/socket");
(0, socket_1.setupSocket)(server);
// Start RabbitMQ consumer for enrichment responses
const consumeRabit_1 = require("./services/consumeRabit");
(0, consumeRabit_1.startEnrichmentConsumer)();
// Start the server on the configured port
server.listen(port, () => {
    console.log(`Server is listening on ${port}!`);
    console.log(`Allowed origins: ${origins}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map