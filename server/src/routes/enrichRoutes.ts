import { Router, Request, Response } from "express";
import { verifyJWT } from "../routes/verifyJWT";
import { getCurrentTime } from "../services/helpers";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { emitEnrichmentResult } from "../services/socket";

const router = Router();
import chunkAssembler from "../services/chunkService";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });

// Publish enrichment request to SQS (replaces RabbitMQ publish)
async function publishEnrichRequest(data: {
  base64: string;
  requestId: string;
  socketId: string;
}) {
  const { base64, requestId, socketId } = data;

  const queueUrl = process.env.SQS_REQUEST_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_REQUEST_QUEUE_URL environment variable is not set");
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ requestId, base64, socketId }),
    })
  );

  console.log(
    `[${getCurrentTime()}] [INFO][enrich] Published enrichment request ${requestId} to SQS`
  );
  return { status: "OK", requestId };
}

// Internal callback — called by Lambda after Replicate API returns result.
// Secured by X-Internal-Token header check.
router.post("/enrich-internal-callback", (req: Request, res: Response) => {
  const token = req.headers["x-internal-token"];
  const expected = process.env.INTERNAL_CALLBACK_SECRET;

  if (!expected || token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { requestId, enrichedData, socketId } = req.body;

  if (!requestId || !enrichedData) {
    res.status(400).json({ error: "Missing requestId or enrichedData" });
    return;
  }

  console.log(
    `[${getCurrentTime()}] [INFO][enrich] Received callback for requestId: ${requestId}, emitting via Socket.IO`
  );

  emitEnrichmentResult(requestId, enrichedData, socketId);
  res.sendStatus(200);
});

router.post("/enrich", verifyJWT, async (req, res) => {
  if (!req.body) {
    res
      .status(422)
      .send("You must provide a base64 image, requestId, and socketId");
    return;
  }

  const user = (req as any).user;
  const userId = user && (user.user_id || user.id || user.email || user.sub);
  if (!userId) {
    res.status(401).json({ error: "User ID not found in JWT" });
    return;
  }

  const { base64, requestId, socketId, batchInfo } = req.body;

  const normalizedBatchInfo = batchInfo || {
    batchId: "",
    batchIndex: 0,
    totalBatches: 1,
    isComplete: true,
    itemsInBatch: 1,
    totalItems: 1,
  };

  console.info(
    `[${getCurrentTime()}] [INFO][enrich] Received enrichment request batch ${
      normalizedBatchInfo.batchIndex + 1
    }/${normalizedBatchInfo.totalBatches} for requestId: ${requestId}, socketId: ${socketId}`
  );
  console.info(
    `[${getCurrentTime()}] [DEBUG][enrich] Base64 data: ${base64?.substring(0, 100)}..., Length: ${base64?.length || 0}`
  );

  try {
    const result = await publishEnrichRequest({ base64, requestId, socketId });

    res.status(202).json({
      ...result,
      batchInfo: {
        ...normalizedBatchInfo,
        processed: true,
      },
    });
  } catch (error) {
    console.error(
      `[${getCurrentTime()}] [ERROR][enrich] Error publishing enrichment request:`,
      error
    );
    res.status(500).json({ message: "Failed to submit enrichment request" });
  }
});

// Handle chunked enrichment requests
router.post("/enrich-chunked", async (req, res) => {
  try {
    const chunk = req.body;
    const { metadata } = chunk;

    console.log(
      `Received chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks} for session ${metadata.sessionId}`
    );

    await chunkAssembler.addChunk(metadata.sessionId, chunk);

    if (await chunkAssembler.isComplete(metadata.sessionId)) {
      console.log(
        `All chunks received for session ${metadata.sessionId}, processing...`
      );

      const fullData = await chunkAssembler.assembleChunks(metadata.sessionId);
      const originalRequest = JSON.parse(fullData);
      const result = await publishEnrichRequest(originalRequest);

      await chunkAssembler.cleanup(metadata.sessionId);

      res.json({
        success: true,
        chunkIndex: metadata.chunkIndex,
        isComplete: true,
        finalResult: result,
      });
    } else {
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
