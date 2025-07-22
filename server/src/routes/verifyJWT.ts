import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { getCurrentTime } from "../services/helpers";

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

export function verifyJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.DISABLE_AUTH_FOR_TESTS === "true") {
    return next();
  }
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    console.error(`[${getCurrentTime()}] Missing Authorization header`);
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }
  if (!authHeader.startsWith("Bearer ")) {
    console.error(`[${getCurrentTime()}] Invalid Authorization header`);
    res.status(401).json({ error: "Invalid Authorization header" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    console.debug(
      `[${getCurrentTime()}] Verifying JWT token with secret:`,
      JWT_SECRET
    );
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    console.debug(
      `[${getCurrentTime()}] JWT token verified successfully:`,
      decoded
    );
    next();
  } catch (err) {
    console.error(`[${getCurrentTime()}] JWT verification failed:`, err);
    console.error(`[${getCurrentTime()}] Token:`, token);
    console.error(`[${getCurrentTime()}] Decoded token:`, (req as any).user);
    console.error(`[${getCurrentTime()}] JWT_SECRET:`, JWT_SECRET);
    console.error(`[${getCurrentTime()}] Authorization header:`, authHeader);
    console.error(`[${getCurrentTime()}] Request headers:`, req.headers);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
