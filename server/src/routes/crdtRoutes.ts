import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "./loginRoutes";
import { RequestWithBody } from "./interfaces";
import { crdtService } from "../services/crdtService";
import { PixelDeltaPacket } from "../crdt/PixelDataCRDT";
const router = Router();

router.get("/sync", (req: RequestWithBody, res: Response) => {
  // respond with json data of the state
  res.json(req.session);
});

router.post("/sync", (req: RequestWithBody, res: Response) => {
  //check if request has a body
  console.log("req.body: ", req.body);
  if (!req.body) {
    res.status(422).send("You must provide a delta packet");
    return;
  }
  console.log("body: :", req.body);
  //parse the incoming state
  const { deltas } = req.body;
  if (!(deltas as PixelDeltaPacket)) {
    res.status(422).send("You must provide a state");
    return;
  }
  console.log("deltas: ", deltas);

  // merge the incoming state with the current state
  // respond with json data of the state
  //pass the state to the syncState method
  try {
    const syncResult = crdtService.syncDeltas(deltas);
    res.json({ deltas: syncResult });
  } catch (error) {
    res.status(400).send("Error syncing state");
  }
});

export { router };
