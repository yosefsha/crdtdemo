import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

export function verifyJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    console.error("Missing Authorization header");
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }
  if (!authHeader.startsWith("Bearer ")) {
    console.error("Invalid Authorization header");
    res.status(401).json({ error: "Invalid Authorization header" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    console.debug("Verifying JWT token with secret:", JWT_SECRET);
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    console.debug("Token:", token);
    console.debug("Decoded token:", (req as any).user);
    console.debug("JWT_SECRET:", JWT_SECRET);
    console.debug("Authorization header:", authHeader);
    console.debug("Request headers:", req.headers);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
