import amqp from "amqplib";
import { emitEnrichmentResult } from "./socket";

const RABBIT_URL = process.env.RABBIT_URL || "amqp://rabbit-mq";
const RESPONSE_QUEUE = "enrich_responses";

async function connectWithRetry(maxRetries = 10, delay = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.info(
        `[rabbit] Attempt ${
          i + 1
        }/${maxRetries} - Connecting to RabbitMQ at ${RABBIT_URL}`
      );
      const conn = await amqp.connect(RABBIT_URL);
      console.info("[rabbit] Successfully connected to RabbitMQ");
      return conn;
    } catch (error: any) {
      console.warn(
        `[rabbit] Connection attempt ${i + 1} failed:`,
        error?.message || error
      );
      if (i === maxRetries - 1) {
        throw new Error(
          `Failed to connect to RabbitMQ after ${maxRetries} attempts`
        );
      }
      console.info(`[rabbit] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Failed to connect to RabbitMQ");
}

export async function startEnrichmentConsumer() {
  try {
    console.info("[rabbit] Starting RabbitMQ consumer with retry logic...");
    const conn = await connectWithRetry();
    const ch = await conn.createChannel();
    await ch.assertQueue(RESPONSE_QUEUE);
    console.info("[rabbit] Listening for enrichment responses...");

    ch.consume(RESPONSE_QUEUE, (msg) => {
      if (!msg) return;
      try {
        const { requestId, enrichedData, socketId } = JSON.parse(
          msg.content.toString()
        );
        console.info(
          `[rabbit] Received enrichment response for requestId: ${requestId}, socketId: ${socketId}`
        );
        console.info(
          `[rabbit] Enriched data length: ${enrichedData?.length || 0}`
        );
        emitEnrichmentResult(requestId, enrichedData, socketId);
        ch.ack(msg);
        console.info(
          `[rabbit] Emitted enrichment for requestId: ${requestId} to socketId: ${socketId}`
        );
      } catch (err) {
        console.error("[rabbit] Error processing enrichment response:", err);
        ch.nack(msg);
      }
    });

    // Handle connection close
    conn.on("close", () => {
      console.warn("[rabbit] Connection closed, attempting to reconnect...");
      setTimeout(() => startEnrichmentConsumer(), 5000);
    });
  } catch (err) {
    console.error("[rabbit] Fatal error:", err);
    console.info("[rabbit] Will retry consumer in 10 seconds...");
    setTimeout(() => startEnrichmentConsumer(), 10000);
  }
}
