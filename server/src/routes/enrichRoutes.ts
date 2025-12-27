import { Router, Request, Response, NextFunction } from "express";
// Update the import path if needed, or create the middleware/auth.ts file with verifyJWT exported
import { verifyJWT } from "../routes/verifyJWT";
import { getCurrentTime } from "../services/helpers";
import amqp from "amqplib";

const router = Router();
import chunkAssembler from "../services/chunkService";

// Function to handle enrichment through RabbitMQ
async function enrichImage(data: {
  base64: string;
  requestId: string;
  socketId: string;
}) {
  const { base64, requestId, socketId } = data;

  try {
    // Connect to RabbitMQ and publish request
    const connection = await amqp.connect(
      process.env.RABBIT_URL || "amqp://rabbit-mq"
    );
    const channel = await connection.createChannel();

    await channel.assertQueue("enrich_requests", { durable: true });

    const message = JSON.stringify({
      requestId,
      base64,
      socketId,
    });

    channel.sendToQueue("enrich_requests", Buffer.from(message), {
      persistent: true,
    });

    await channel.close();
    await connection.close();

    console.log(
      `[${getCurrentTime()}] [INFO][enrich] Published enrichment request ${requestId} to queue`
    );
    return { status: "OK", requestId };
  } catch (error) {
    console.error(
      `[${getCurrentTime()}] [ERROR][enrich] Error publishing to RabbitMQ:`,
      error
    );
    throw new Error("Failed to submit enrichment request");
  }
}

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
  const { base64, requestId, socketId, batchInfo } = req.body;

  // Treat missing batchInfo as single batch
  const normalizedBatchInfo = batchInfo || {
    batchId: "",
    batchIndex: 0,
    totalBatches: 1,
    isComplete: true,
    itemsInBatch: 1,
    totalItems: 1,
  };

  // Log request
  console.info(
    `[${getCurrentTime()}] [INFO][enrich] Received enrichment request batch ${
      normalizedBatchInfo.batchIndex + 1
    }/${
      normalizedBatchInfo.totalBatches
    } for requestId: ${requestId}, socketId: ${socketId}`
  );
  console.info(
    `[${getCurrentTime()}] [DEBUG][enrich] Base64 data: ${base64?.substring(
      0,
      100
    )}..., Length: ${base64?.length || 0}`
  );

  try {
    const result = await enrichImage({ base64, requestId, socketId });

    // Always return batchInfo
    res.status(202).json({
      ...result,
      batchInfo: {
        ...normalizedBatchInfo,
        processed: true,
      },
    });
  } catch (error) {
    console.error(
      `[${getCurrentTime()}] [ERROR][enrich] Error processing enrichment:`,
      error
    );
    res.status(500).json({ message: "Failed to submit enrichment request" });
  }
});

// Handle chunked enrichment requests
router.post("/enrich-chunked", async (req, res) => {
  try {
    const chunk = req.body;
    const { metadata, data } = chunk;

    console.log(
      `Received chunk ${metadata.chunkIndex + 1}/${
        metadata.totalChunks
      } for session ${metadata.sessionId}`
    );

    // Store chunk
    await chunkAssembler.addChunk(metadata.sessionId, chunk);

    // Check if all chunks received
    if (await chunkAssembler.isComplete(metadata.sessionId)) {
      console.log(
        `All chunks received for session ${metadata.sessionId}, processing...`
      );

      // Reassemble and process
      const fullData = await chunkAssembler.assembleChunks(metadata.sessionId);
      const originalRequest = JSON.parse(fullData);
      const enrichedResult = await enrichImage(originalRequest);

      // Clean up stored chunks
      await chunkAssembler.cleanup(metadata.sessionId);

      res.json({
        success: true,
        chunkIndex: metadata.chunkIndex,
        isComplete: true,
        finalResult: enrichedResult,
      });
    } else {
      // Just acknowledge chunk receipt
      res.json({
        success: true,
        chunkIndex: metadata.chunkIndex,
        isComplete: false,
        message: "Chunk received, waiting for more",
      });
    }
  } catch (error: any) {
    console.error("Chunk processing error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
