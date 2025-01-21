import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "./loginRoutes";
import { RequestWithBody } from "./interfaces";
import { crdtService } from "../services/crdtService";
const router = Router();

router.get("/sync", (req: RequestWithBody, res: Response) => {
  // respond with json data of the state
  res.json(req.session);
});

router.post("/sync", (req: RequestWithBody, res: Response) => {
  //check if request has a body
  if (!req.body) {
    res.status(422).send("You must provide a state");
    return;
  }
  console.log("body: :", req.body);
  //parse the incoming state
  const { state: incomingState } = req.body;
  if (!incomingState) {
    res.status(422).send("You must provide a state");
    return;
  }
  console.log("state: ", incomingState);

  // merge the incoming state with the current state
  // respond with json data of the state
  //pass the state to the syncState method
  const parsedState = JSON.parse(incomingState);
  try {
    const syncResult = crdtService.syncState(parsedState);
    res.json({ state: syncResult });
  } catch (error) {
    res.status(400).send("Error syncing state");
  }
});

export { router };
