"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const loginRoutes_1 = require("./routes/loginRoutes");
const crdtRoutes_1 = require("./routes/crdtRoutes");
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_session_1 = __importDefault(require("cookie-session"));
const port = process.env.PORT || 4000; // Use the environment PORT or default to 4000
const origin1 = process.env.CLIENT_ORIGIN || "http://localhost:3000"; // For local dev
const origins = [origin1, "http://localhost"]; // Allow both local and configured origins
const app = (0, express_1.default)();
// Enable CORS with dynamic origins based on environment
app.use((0, cors_1.default)({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    optionsSuccessStatus: 204,
}));
// Use body-parser middleware
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
// Use cookie-session middleware
app.use((0, cookie_session_1.default)({
    keys: ["asdf"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: false, // If using HTTPS, set this to true
    name: "session",
}));
// Use the router for login and API
app.use(loginRoutes_1.router);
app.use("/api", crdtRoutes_1.router);
// Health check route
app.get("/health", (req, res) => {
    console.log("Health check endpoint hit");
    res.status(200).send("Health check passed");
});
// Start the server on the configured port
app.listen(port, () => {
    console.log(`Server is listening on ${port}!`);
    console.log(`Allowed origins: ${origins}`);
});
//# sourceMappingURL=index.js.map