"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
exports.requireAuth = requireAuth;
const express_1 = require("express");
const router = (0, express_1.Router)();
exports.router = router;
function requireAuth(req, res, next) {
    if (req.session && req.session.loggedIn) {
        next();
        return;
    }
    res.status(403);
    res.send("Not permitted");
}
router.get("/login", (req, res) => {
    res.send(`
        <h1>login page</h1>
        <form method="post">
            <input type="text" name="email" placeholder="email" />
            <input type="password" name="password" placeholder="password" />
            <button type="submit">Login</button>`);
});
router.get("/", (req, res) => {
    if (req.session && req.session.loggedIn) {
        res.send(`
        <div>
            <div>You are logged in</div>
            <a href="/logout">Logout</a>
            <a href="/logout">Logout</a>
            <a href="/restricted">Restricted</a>
        </div>
        `);
    }
    else {
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
router.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (email && password && email === "hi@hi.com" && password === "admin") {
        // mark this person as logged in
        if (req.session) {
            req.session.loggedIn = true;
        }
        // redirect them to the root route
        res.redirect("/");
    }
    else {
        res.send("Invalid username or password");
    }
});
router.get("/logout", (req, res) => {
    if (req.session && req.session.loggedIn) {
        req.session.loggedIn = false;
        req.session.destroy((err) => {
            if (err) {
                console.log(err);
            }
            else {
                console.log("logged out");
                res.redirect("/");
            }
        });
    }
});
router.get("/restricted", requireAuth, (req, res) => {
    res.send(`
        <div>
            <div>You are logged in restricted area</div>
            <a href="/logout">Logout</a>
        </div>
        `);
});
//# sourceMappingURL=loginRoutes.js.map