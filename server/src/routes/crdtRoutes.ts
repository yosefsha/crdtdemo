import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "./loginRoutes";
import { RequestWithBody } from "./interfaces";
import { crdtService } from "../services/crdtService";
import { PixelDeltaPacket } from "../crdt/PixelDataCRDT";
import { verifyJWT } from "./verifyJWT";
import { getCurrentTime } from "../services/helpers";
const router = Router();

router.get("/sync", verifyJWT, async (req: RequestWithBody, res: Response) => {
  // Get userId from JWT (set by verifyJWT)
  const user = (req as any).user;
  const userId = user && (user.user_id || user.id || user.email || user.sub);
  if (!userId) {
    res.status(401).json({ error: "User ID not found in JWT" });
    return;
  }
  try {
    // Load the user's CRDT data
    console.log("Loading CRDT data for user:", userId);
    const crdt = await crdtService.loadUserPixelData(userId);
    res.json({ crdt });
  } catch (err) {
    res.status(500).send("Failed to load user CRDT data");
  }
});

router.post("/sync", verifyJWT, async (req: RequestWithBody, res: Response) => {
  if (!req.body) {
    res.status(422).send("You must provide a delta packet");
    return;
  }
  // Get userId from JWT (set by verifyJWT)
  const user = (req as any).user;
  const userId = user && (user.user_id || user.id || user.email || user.sub);
  if (!userId) {
    res.status(401).json({ error: "User ID not found in JWT" });
    return;
  }
  //parse the incoming state
  const { deltas } = req.body;
  if (!(deltas as PixelDeltaPacket)) {
    res.status(422).send(`[${getCurrentTime()}] You must provide a state`);
    return;
  }

  // merge the incoming state with the user's state
  try {
    console.log(`[${getCurrentTime()}] will sync deltas: `, deltas);
    const syncResult = await crdtService.syncUserDeltas(userId, deltas);
    res.json({ deltas: syncResult });
  } catch (error) {
    res.status(400).send(`[${getCurrentTime()}] Error syncing state`);
  }
});

export { router };
