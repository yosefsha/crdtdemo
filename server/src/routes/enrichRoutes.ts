import { Router, Request, Response, NextFunction } from "express";
// Update the import path if needed, or create the middleware/auth.ts file with verifyJWT exported
import { verifyJWT } from "../routes/verifyJWT";
import { getCurrentTime } from "../services/helpers";
import amqp from "amqplib";

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
    `[${getCurrentTime()}] [INFO][enrich] Received enrichment request for requestId: ${requestId}, socketId: ${socketId}`
  );
  console.info(
    `[${getCurrentTime()}] [DEBUG][enrich] Base64 data: ${base64?.substring(
      0,
      100
    )}..., Length: ${base64?.length || 0}`
  );

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
    res.status(202).json({ status: "OK", requestId });
  } catch (error) {
    console.error(
      `[${getCurrentTime()}] [ERROR][enrich] Error publishing to RabbitMQ:`,
      error
    );
    res.status(500).json({ message: "Failed to submit enrichment request" });
  }
});

export default router;
