import { Router, Request, Response, NextFunction } from "express";
import { verifyJWT } from "./verifyJWT";
import { RequestWithBody } from "./interfaces";

const router = Router();

// /me endpoint for JWT validation and user info
router.get("/me", verifyJWT, (req: Request, res: Response): void => {
  // The user info is attached to req by verifyJWT middleware
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  // You can customize what user info to return here
  res.json({ user });
});

// Helper function to forward requests using fetch
async function forwardRequest(path: string, req: Request, res: Response) {
  try {
    const response = await fetch(`http://auth:5000${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error(`Error forwarding to ${path}:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Forwarded auth routes
router.post("/register", (req, res) => {
  console.log("Register request received forwarding ", req.body || "");
  return forwardRequest("/auth/register", req, res);
});
router.post("/login", (req, res) => {
  console.log("Login request received forwarding ", req.body || "");
  return forwardRequest("/auth/login", req, res);
});
router.post("/logout", (req, res) => forwardRequest("/auth/logout", req, res));
/*
 * Middleware to check if user is authenticated
 * This is a placeholder for session-based auth, replaced with JWT logic completely
 */
// export function requireAuth(req: Request, res: Response, next: NextFunction) {
//   if (req.session && req.session.loggedIn) {
//     next();
//     return;
//   }
//   res.status(403);
//   res.send("Not permitted");
// }

router.get("/", (req: RequestWithBody, res: Response) => {
  // Remove session logic, just return a simple message or status
  res.send({
    status: "ok",
    message: "Auth API root. Use /register or /login.",
  });
});

// Remove legacy session-based login route, as JWT is now used and forwarding is handled above

// router.get("/logout", (req: RequestWithBody, res: Response) => {
//   if (req.session && req.session.loggedIn) {
//     req.session.loggedIn = false;
//     req.session.destroy((err) => {
//       if (err) {
//         console.log(err);
//       } else {
//         console.log("logged out");
//         res.redirect("/");
//       }
//     });
//   }
// });

router.get("/restricted", (req: RequestWithBody, res: Response) => {
  res.send(`
        <div>
            <div>You are logged in restricted area</div>
            <a href="/logout">Logout</a>
        </div>
        `);
});

export default router;
