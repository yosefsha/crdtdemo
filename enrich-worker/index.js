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
    console.log(
      "[enrich-worker] Input base64 preview:",
      base64.substring(0, 100) + "..."
    );
    console.log("[enrich-worker] Input base64 length:", base64.length);
    console.log("[enrich-worker] Calling Replicate API...");
    // Use SDXL with img2img for creative enhancement of drawings
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          image: base64,
          prompt:
            "enhance this simple drawing by adding creative details like windows, doors, sun, clouds, trees, flowers, or other appropriate elements that would make the drawing more complete and interesting, keep the original drawing style, digital art",
          strength: 0.2, // More subtle creative additions
          guidance_scale: 8, // Higher guidance for better prompt following
          num_inference_steps: 25,
          width: 512,
          height: 512,
          disable_safety_checker: true,
        },
      }
    );
    console.log("[enrich-worker] Replicate API response type:", typeof output);
    console.log(
      "[enrich-worker] Replicate API response:",
      Array.isArray(output) ? `Array with ${output.length} items` : output
    );

    // Handle direct ReadableStream response (Real-ESRGAN sometimes returns this directly)
    if (output && typeof output === "object" && "getReader" in output) {
      console.log(
        "[enrich-worker] Converting direct ReadableStream to base64..."
      );
      const reader = output.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const buffer = Buffer.concat(chunks);
      const base64Result = `data:image/png;base64,${buffer.toString("base64")}`;
      console.log(
        "[enrich-worker] Converted to base64, length:",
        base64Result.length
      );
      return base64Result;
    }

    // Real-ESRGAN returns a single URL string, not an array
    if (typeof output === "string") {
      console.log("[enrich-worker] Got URL string:", output);

      // If it's a URL, fetch the image and convert to base64
      if (output.startsWith("http")) {
        console.log("[enrich-worker] Fetching image from URL...");
        const response = await fetch(output);
        const buffer = await response.arrayBuffer();
        const base64Result = `data:image/png;base64,${Buffer.from(
          buffer
        ).toString("base64")}`;
        console.log(
          "[enrich-worker] Converted URL to base64, length:",
          base64Result.length
        );
        return base64Result;
      }

      return output;
    }

    if (Array.isArray(output) && output.length > 0) {
      const firstItem = output[0];
      console.log("[enrich-worker] First item type:", typeof firstItem);
      console.log("[enrich-worker] First item:", firstItem);

      // Handle ReadableStream - convert to buffer then base64
      if (
        firstItem &&
        typeof firstItem === "object" &&
        "getReader" in firstItem
      ) {
        console.log("[enrich-worker] Converting ReadableStream to base64...");
        const reader = firstItem.getReader();
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const buffer = Buffer.concat(chunks);
        const base64Result = `data:image/png;base64,${buffer.toString(
          "base64"
        )}`;
        console.log(
          "[enrich-worker] Converted to base64, length:",
          base64Result.length
        );
        return base64Result;
      }

      // If it's already a string (URL or base64), return it
      return firstItem;
    }

    console.log("[enrich-worker] Unexpected output format:", output);
    return base64; // Return original if we can't process the output
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
