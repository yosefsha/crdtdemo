"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const loginRoutes_1 = require("./routes/loginRoutes");
const crdtRoutes_1 = require("./routes/crdtRoutes");
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_session_1 = __importDefault(require("cookie-session"));
// import cookieSession from 'express-session';
const port = process.env.PORT || 3001;
const app = (0, express_1.default)();
// app.use(express.json()); // middleware to parse json
// Use body-parser middleware
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
// Use cookie-session middleware
app.use((0, cookie_session_1.default)({
    keys: ["asdf"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: false,
    name: "session",
}));
// use the router
app.use(loginRoutes_1.router);
app.use(crdtRoutes_1.router);
app.listen(port, () => console.log(`Server is listening on ${port}!`));
//# sourceMappingURL=index.js.map