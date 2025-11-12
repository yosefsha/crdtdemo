import { Router, Request, Response, NextFunction } from "express";
// Update the import path if needed, or create the middleware/auth.ts file with verifyJWT exported
import { verifyJWT } from "../routes/verifyJWT";
import { crdtService } from "../services/crdtService";
import { PixelDeltaPacket } from "@crdtdemo/shared";
import { getCurrentTime } from "../services/helpers";

const router = Router();

// In-memory store for demo purposes
const userCRDTs: Record<string, any> = {};

router.get("/sync", verifyJWT, async (req, res) => {
  // Get userId from JWT (set by verifyJWT)
  const user = (req as any).user;
  const userId = user && (user.user_id || user.id || user.email || user.sub);
  if (!userId) {
    res.status(401).json({ error: "User ID not found in JWT" });
    return;
  }
  try {
    // Load the user's CRDT data
    console.debug("Loading CRDT data for user:", userId);
    const packet = await crdtService.getAllReplicaDeltas(userId);

    // Count total deltas across all collections
    let totalDeltas = 0;
    if (packet?.collectionDeltas) {
      for (const deltas of packet.collectionDeltas.values()) {
        totalDeltas += deltas.length;
      }
    }

    console.info(
      `[${getCurrentTime()}] Loaded CRDT deltas for user: ${userId}: ${totalDeltas} deltas `
    );
    // If no CRDT data found, return 404
    if (!packet) {
      console.warn("CRDT not found for user:", userId);
      res.status(404).json({ error: "CRDT not found for user", userId });
      return;
    }
    res.json({ deltas: packet });
  } catch (err) {
    res.status(500).json({ error: `Failed to load user CRDT data: ${err}` });
    return;
  }
});

router.post("/sync", verifyJWT, async (req, res) => {
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
    console.log(`[${getCurrentTime()}] will sync deltas: for user ${userId}`);
    const mergeResult = await crdtService.syncUserDeltas(`${userId}`, deltas);
    res.json({ data: mergeResult });
  } catch (error) {
    res.status(400).send(`[${getCurrentTime()}] Error syncing state`);
  }
});

// New route for syncing with another user's CRDT
router.post("/sync-from-other", verifyJWT, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user && (user.user_id || user.id || user.email || user.sub);
    const { deltas, targetUser } = req.body;
    console.log("/sync-from-other called", {
      userId,
      targetUser,
      deltasPresent: !!deltas,
      userObj: user,
    });
    if (!userId) {
      res.status(401).json({ error: "User ID not found in JWT" });
      return;
    }
    if (!targetUser) {
      res.status(400).json({ error: "Missing targetUser" });
      return;
    }

    if (!deltas) {
      res.status(422).json({ error: "You must provide a delta packet" });
      return;
    }

    // 3. Merge the other user's CRDT into the current user's CRDT
    const result = await crdtService.mergeOtherUserCRDTs(userId, targetUser);
    // 4. Return the merged CRDT (or just confirmation)
    res.json({ data: result });
  } catch (err) {
    console.error("[/sync-from-other] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
