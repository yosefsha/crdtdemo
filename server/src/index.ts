import express, { Request, Response } from "express";
import { router as loginRouter } from "./routes/loginRoutes";
import { router as crdtRouter } from "./routes/crdtRoutes";
import cors from "cors";
import bodyParser from "body-parser";
import cookieSession from "cookie-session";

const port = process.env.PORT || 3333; // Use the environment PORT or default to 3000
const origin1 = process.env.CLIENT_ORIGIN || "http://localhost:3000"; // For local dev
const origins = [origin1, "http://localhost"]; // Allow both local and configured origins

const app = express();

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
app.use("/auth", loginRouter);
app.use("/api", crdtRouter);
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
