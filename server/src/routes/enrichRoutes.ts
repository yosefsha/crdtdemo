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

  // Simulate opening a socket (dummy, not a real socket)
  console.info(
    `[${getCurrentTime()}] [INFO][enrich] Opened dummy socket for requestId: ${requestId}`
  );
  // Do nothing with the data, just echo it back
  const enrichedData = base64;
  // Simulate closing the socket
  console.info(
    `[${getCurrentTime()}] [INFO][enrich] Closed dummy socket for requestId: ${requestId}`
  );

  // Return the enriched data
  emitEnrichmentResult(requestId, enrichedData, socketId); // Use socketId for targeted emit
  res.json({ type: "enriched-result", requestId, enrichedData });
});

export default router;
