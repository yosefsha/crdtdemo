import amqp from "amqplib";
import { emitEnrichmentResult } from "./socket";

const RABBIT_URL = process.env.RABBIT_URL || "amqp://rabbit-mq";
const RESPONSE_QUEUE = "enrich_responses";

export async function startRabbitListener() {
  try {
    const conn = await amqp.connect(RABBIT_URL);
    const ch = await conn.createChannel();
    await ch.assertQueue(RESPONSE_QUEUE);
    console.log("[rabbit] Listening for enrichment responses...");

    ch.consume(RESPONSE_QUEUE, (msg) => {
      if (!msg) return;
      try {
        const { requestId, enrichedData, socketId } = JSON.parse(
          msg.content.toString()
        );
        emitEnrichmentResult(requestId, enrichedData, socketId);
        ch.ack(msg);
        console.log(
          `[rabbit] Emitted enrichment for requestId: ${requestId} to socketId: ${socketId}`
        );
      } catch (err) {
        console.error("[rabbit] Error processing enrichment response:", err);
        ch.nack(msg);
      }
    });
  } catch (err) {
    console.error("[rabbit] Fatal error:", err);
  }
}
