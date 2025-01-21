import { Request } from "express";

export interface RequestWithBody extends Request {
  body: { [key: string]: string | undefined };
}

declare module "express-session" {
  interface Session {
    loggedIn?: boolean;
  }
}
