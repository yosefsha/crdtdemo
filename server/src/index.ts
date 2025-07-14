import express, { Request, Response } from "express";
import loginRouter from "./routes/loginRoutes";
import crdtRouter from "./routes/crdtRoutes";
import cors from "cors";
import bodyParser from "body-parser";
import cookieSession from "cookie-session";
import mongoose from "mongoose";

const port = process.env.PORT || 4000; // Use the environment PORT or default to 4000
const origin1 = process.env.CLIENT_ORIGIN || "http://localhost:3000"; // For local dev
const origins = [origin1, "http://localhost"]; // Allow both local and configured origins

const app = express();

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/mydb";
mongoose
  .connect(mongoUrl)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("MongoDB error:", err));

// Enable CORS with dynamic origins based on environment
app.use(
  cors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

// Use body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
app.use("/api", loginRouter);
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
