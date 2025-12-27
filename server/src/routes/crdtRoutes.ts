import { Router, Request, Response, NextFunction } from "express";
// Update the import path if needed, or create the middleware/auth.ts file with verifyJWT exported
import { verifyJWT } from "../routes/verifyJWT";
import { crdtService } from "../services/crdtService";
import { batchService } from "../services/batchService";
import { DocumentDeltaPacket, RGBHEX } from "@crdtdemo/shared";
import { getCurrentTime } from "../services/helpers";

const router = Router();

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
      for (const deltas of Object.values(packet.collectionDeltas)) {
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
    res.status(422).json({ error: "You must provide a delta packet" });
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
  const { deltas, batchInfo } = req.body;
  if (!(deltas as DocumentDeltaPacket<RGBHEX>)) {
    res.status(422).json({ error: "You must provide a state" });
    return;
  }

  // merge the incoming state with the user's state
  try {
    // Treat missing batchInfo as single batch
    const normalizedBatchInfo = batchInfo || {
      batchId: "",
      batchIndex: 0,
      totalBatches: 1,
      isComplete: true,
      itemsInBatch: 0,
      totalItems: 0,
    };

    console.log(
      `[${getCurrentTime()}] Receiving batch ${
        normalizedBatchInfo.batchIndex + 1
      }/${normalizedBatchInfo.totalBatches} from user ${userId}`
    );

    const mergeResult = await batchService.handleBatchSync(`${userId}`, {
      deltas,
      batchInfo: normalizedBatchInfo,
    });

    // Always return batchInfo
    res.json({
      data: mergeResult,
      batchInfo: {
        ...normalizedBatchInfo,
        processed: true,
      },
    });
  } catch (error) {
    res.status(400).json({ error: "Error syncing state" });
  }
});

// New route for syncing with another user's CRDT
router.post("/sync-from-other", verifyJWT, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user && (user.user_id || user.id || user.email || user.sub);
    const { deltas, targetUser, batchInfo } = req.body;

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

    // Treat missing batchInfo as single batch
    const normalizedBatchInfo = batchInfo || {
      batchId: "",
      batchIndex: 0,
      totalBatches: 1,
      isComplete: true,
      itemsInBatch: 0,
      totalItems: 0,
    };

    // Merge the other user's CRDT using batch service
    const result = await batchService.handleBatchSyncFromOther(userId, {
      deltas,
      batchInfo: normalizedBatchInfo,
      targetUser,
    });

    // Always return batchInfo
    res.json({
      data: result,
      batchInfo: {
        ...normalizedBatchInfo,
        processed: true,
      },
    });
  } catch (err) {
    console.error("[/sync-from-other] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
