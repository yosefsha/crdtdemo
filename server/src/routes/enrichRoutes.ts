import { Router, Request, Response, NextFunction } from "express";
// Update the import path if needed, or create the middleware/auth.ts file with verifyJWT exported
import { verifyJWT } from "../routes/verifyJWT";
import { getCurrentTime } from "../services/helpers";
import { emitEnrichmentResult } from "../services/socket";

const router = Router();

router.post("/enrich", verifyJWT, async (req, res) => {
  if (!req.body) {
    res
      .status(422)
      .send("You must provide a base64 image, requestId, and socketId");
    return;
  }
  // Get userId from JWT (set by verifyJWT)
  const user = (req as any).user;
  const userId = user && (user.user_id || user.id || user.email || user.sub);
  if (!userId) {
    res.status(401).json({ error: "User ID not found in JWT" });
    return;
  }
  // Parse the incoming data
  const { base64, requestId, socketId } = req.body;

  // Log request
  console.info(
    `[${getCurrentTime()}] [INFO][enrich] Received enrichment request for requestId: ${requestId}`
  );

  // For testing: wait 5 seconds, then emit the same data back to the socket
  setTimeout(() => {
    emitEnrichmentResult(requestId, base64, socketId);
    console.info(
      `[${getCurrentTime()}] [INFO][enrich] Emitted test enrichment result for requestId: ${requestId} to socketId: ${socketId}`
    );
  }, 5000);

  // Respond immediately
  res.status(202).json({ status: "OK", requestId });
});

export default router;
