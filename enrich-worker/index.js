// Enrichment worker: listens to RabbitMQ for image enrichment requests
import amqp from "amqplib";
import Replicate from "replicate";
import fs from "fs";

const RABBIT_URL = process.env.RABBIT_URL || "amqp://rabbit-mq";
const REQUEST_QUEUE = "enrich_requests";
const RESPONSE_QUEUE = "enrich_responses";
const secrets = JSON.parse(
  fs.readFileSync(process.env.SECRETS_PATH || "../secrets/apiconf.json", "utf8")
);
const replicateToken = secrets.replicate.api_token;
const replicate = new Replicate({ auth: replicateToken });

async function enrichImage(base64) {
  try {
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          image: base64,
          prompt: "enhance this image",
          strength: 0.8, // moderate change
          guidance_scale: 7, // typical value
        },
      }
    );
    return output; // Should be base64 or URL, depending on model
  } catch (err) {
    console.error("[enrich-worker] Error enriching image via Replicate:", err);
    return base64;
  }
}

async function main() {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(REQUEST_QUEUE);
  await ch.assertQueue(RESPONSE_QUEUE);
  console.log("[enrich-worker] Waiting for enrichment requests...");

  ch.consume(REQUEST_QUEUE, async (msg) => {
    if (!msg) return;
    const { base64, requestId, socketId } = JSON.parse(msg.content.toString());
    console.log(
      `[enrich-worker] Processing requestId: ${requestId} for socketId: ${socketId}, base64 length: ${base64.length}`
    );
    const enrichedData = await enrichImage(base64);
    ch.sendToQueue(
      RESPONSE_QUEUE,
      Buffer.from(JSON.stringify({ requestId, enrichedData, socketId }))
    );
    ch.ack(msg);
    console.info(`[enrich-worker] Processed requestId: ${requestId}`);
    console.debug(
      `[enrich-worker] Enriched data for requestId: ${requestId}, length: ${
        enrichedData.length || 0
      }`
    );
  });
}

main().catch((err) => {
  console.error("[enrich-worker] Fatal error:", err);
  process.exit(1);
});
