import { Request } from "express";

export interface RequestWithBody extends Request {
  body: { [key: string]: any };
}

declare module "express-session" {
  interface Session {
    loggedIn?: boolean;
  }
}
