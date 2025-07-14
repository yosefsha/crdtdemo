"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const express_1 = require("express");
const verifyJWT_1 = require("./verifyJWT");
const router = (0, express_1.Router)();
// /me endpoint for JWT validation and user info
router.get("/me", verifyJWT_1.verifyJWT, (req, res) => {
    // The user info is attached to req by verifyJWT middleware
    const user = req.user;
    if (!user) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }
    // You can customize what user info to return here
    res.json({ user });
});
// Helper function to forward requests using fetch
function forwardRequest(path, req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(`http://auth:5000${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(req.body),
            });
            const data = yield response.json();
            res.status(response.status).json(data);
        }
        catch (error) {
            console.error(`Error forwarding to ${path}:`, error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
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
function requireAuth(req, res, next) {
    if (req.session && req.session.loggedIn) {
        next();
        return;
    }
    res.status(403);
    res.send("Not permitted");
}
router.get("/", (req, res) => {
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
router.get("/restricted", requireAuth, (req, res) => {
    res.send(`
        <div>
            <div>You are logged in restricted area</div>
            <a href="/logout">Logout</a>
        </div>
        `);
});
exports.default = router;
//# sourceMappingURL=loginRoutes.js.map