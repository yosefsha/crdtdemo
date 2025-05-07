import { Router, Request, Response, NextFunction } from "express";
import { RequestWithBody } from "./interfaces";

const router = Router();

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
router.post("/register", (req, res) =>
  forwardRequest("/auth/register", req, res)
);
router.post("/login", (req, res) => forwardRequest("/auth/login", req, res));
router.post("/logout", (req, res) => forwardRequest("/auth/logout", req, res));

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.loggedIn) {
    next();
    return;
  }
  res.status(403);
  res.send("Not permitted");
}

// router.get("/login", (req: Request, res: Response) => {
//   res.send(`
//         <h1>login page</h1>
//         <form method="post">
//             <input type="text" name="email" placeholder="email" />
//             <input type="password" name="password" placeholder="password" />
//             <button type="submit">Login</button>`);
// });

router.get("/", (req: RequestWithBody, res: Response) => {
  if (req.session && req.session.loggedIn) {
    res.send(`
        <div>
            <div>You are logged in</div>
            <a href="/logout">Logout</a>
            <a href="/logout">Logout</a>
            <a href="/restricted">Restricted</a>
        </div>
        `);
  } else {
    console.log("not logged in");
    console.log(req.session);
    res.send(`
        <div>
            <div>You are not logged in</div>
            <a href="/login">Login</a>
        </div>
        `);
  }
});

router.post("/login", (req: RequestWithBody, res: Response) => {
  const { email, password } = req.body;
  if (email && password && email === "hi@hi.com" && password === "admin") {
    // mark this person as logged in
    if (req.session) {
      req.session.loggedIn = true;
    }
    // redirect them to the root route
    res.redirect("/");
  } else {
    res.send("Invalid username or password");
  }
});

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

router.get(
  "/restricted",
  requireAuth,
  (req: RequestWithBody, res: Response) => {
    res.send(`
        <div>
            <div>You are logged in restricted area</div>
            <a href="/logout">Logout</a>
        </div>
        `);
  }
);

export { router };
