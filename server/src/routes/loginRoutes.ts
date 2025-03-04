import { Router, Request, Response, NextFunction } from "express";
import { RequestWithBody } from "./interfaces";
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = "secret_key";
const router = Router();

interface User {
  name: string;
  email: string;
  password: string;
}

const users: User[] = []; // store users in memory for demo purposes
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.loggedIn) {
    next();
    return;
  }
  res.status(403);
  res.send("Not permitted");
}

router.get("/login", (req: Request, res: Response) => {
  res.send(`
        <h1>login page</h1>
        <form method="post">
            <input type="text" name="email" placeholder="email" />
            <input type="password" name="password" placeholder="password" />
            <button type="submit">Login</button>`);
});

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
  console.log("login request: ", req.body);
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

router.post("/signup", (req: RequestWithBody, res: Response) => {
  console.log("signup request: ", req.body);
  const { name, email, password } = req.body;
  const userExists = users.find((u) => u.email === email);
  if (userExists) {
    res.status(409).send("User already exists");
  } else {
    const hashedPassword = bcrypt.hashSync(password, 8);
    users.push({ name, email, password: hashedPassword });
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });
    res.status(201).send({ token });
  }
});

router.get("/logout", (req: RequestWithBody, res: Response) => {
  if (req.session && req.session.loggedIn) {
    req.session.loggedIn = false;
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
      } else {
        console.log("logged out");
        res.redirect("/");
      }
    });
  }
});

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
