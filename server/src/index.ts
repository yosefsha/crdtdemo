import express, { Request, Response } from "express";
import loginRouter from "./routes/loginRoutes";
import crdtRouter from "./routes/crdtRoutes";
import enrichRouter from "./routes/enrichRoutes";
import cors from "cors";
import bodyParser from "body-parser";
import cookieSession from "cookie-session";
import { connectDb } from "./db";
import http from "http";
const port = process.env.PORT || 4000; // Use the environment PORT or default to 4000
const origin1 = process.env.CLIENT_ORIGIN || "http://localhost:3000"; // For local dev
const origins = [origin1, "http://localhost"]; // Allow both local and configured origins

const app = express();
const server = http.createServer(app);

connectDb()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => {
    console.error("PostgreSQL error:", err);
  });
// Enable CORS with dynamic origins based on environment
app.use(
  cors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

// Health endpoint for CI/CD checks
app.get("/api/health", (_req, res) => {
  res
    .status(200)
    .json({ status: "ok", service: "server", ts: new Date().toISOString() });
});

// Use body-parser middleware with increased size limits
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// Use cookie-session middleware
app.use(
  cookieSession({
    keys: ["asdf"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: false, // If using HTTPS, set this to true
    name: "session",
  })
);

// Use the router for login and API
app.use("/api", crdtRouter);
app.use("/api", enrichRouter); // Assuming enrichRouter is defined in enrichRoutes.ts
app.use("/api", loginRouter);
// Health check route
app.get("/health", (req, res) => {
  console.log("Health check endpoint hit");
  res.status(200).send("Health check passed");
});

// Socket.IO server setup
import { setupSocket } from "./services/socket";
setupSocket(server);

// Start RabbitMQ consumer for enrichment responses
import { startEnrichmentConsumer } from "./services/consumeRabit";
startEnrichmentConsumer();

// Start the server on the configured port
server.listen(port, () => {
  console.log(`Server is listening on ${port}!`);
  console.log(`Allowed origins: ${origins}`);
});

export default app;
