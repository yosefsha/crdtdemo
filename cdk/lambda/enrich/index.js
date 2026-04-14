// Lambda handler for CRDT demo image enrichment
// Adapted from enrich-worker/index.js — enrichImage() is unchanged.
// Replaces: amqplib consumer + RabbitMQ with SQS event source + HTTP callback.

import Replicate from "replicate";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const smClient = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });

// Cache secrets in memory for the lifetime of the Lambda container
let _replicateToken = null;
let _callbackSecret = null;

async function getSecret(arn) {
  const { SecretString } = await smClient.send(
    new GetSecretValueCommand({ SecretId: arn })
  );
  return SecretString;
}

async function getReplicateToken() {
  if (!_replicateToken) {
    _replicateToken = await getSecret(process.env.REPLICATE_TOKEN_SECRET_ARN);
  }
  return _replicateToken;
}

async function getCallbackSecret() {
  if (!_callbackSecret) {
    _callbackSecret = await getSecret(process.env.CALLBACK_SECRET_ARN);
  }
  return _callbackSecret;
}

// ── enrichImage ───────────────────────────────────────────────────────────────
// Unchanged from enrich-worker/index.js lines 15-133.
// Calls Replicate SDXL img2img and converts output to base64.

async function enrichImage(base64) {
  try {
    const token = await getReplicateToken();
    const replicate = new Replicate({ auth: token });

    console.log(
      "[enrich-worker] Input base64 preview:",
      base64.substring(0, 100) + "..."
    );
    console.log("[enrich-worker] Input base64 length:", base64.length);
    console.log("[enrich-worker] Calling Replicate API...");

    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          image: base64,
          prompt:
            "very slightly enhance this drawing by adding minimal details while preserving the original style and content, subtle improvement only",
          strength: 0.1,
          guidance_scale: 10,
          num_inference_steps: 3,
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

    // Handle direct ReadableStream response
    if (output && typeof output === "object" && "getReader" in output) {
      console.log("[enrich-worker] Converting direct ReadableStream to base64...");
      const reader = output.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const buffer = Buffer.concat(chunks);
      const base64Result = `data:image/png;base64,${buffer.toString("base64")}`;
      console.log("[enrich-worker] Converted to base64, length:", base64Result.length);
      return base64Result;
    }

    // URL string response
    if (typeof output === "string") {
      console.log("[enrich-worker] Got URL string:", output);
      if (output.startsWith("http")) {
        console.log("[enrich-worker] Fetching image from URL...");
        const response = await fetch(output);
        const buffer = await response.arrayBuffer();
        const base64Result = `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
        console.log("[enrich-worker] Converted URL to base64, length:", base64Result.length);
        return base64Result;
      }
      return output;
    }

    // Array response
    if (Array.isArray(output) && output.length > 0) {
      const firstItem = output[0];
      console.log("[enrich-worker] First item type:", typeof firstItem);
      console.log("[enrich-worker] First item:", firstItem);

      if (firstItem && typeof firstItem === "object" && "getReader" in firstItem) {
        console.log("[enrich-worker] Converting ReadableStream to base64...");
        const reader = firstItem.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const buffer = Buffer.concat(chunks);
        const base64Result = `data:image/png;base64,${buffer.toString("base64")}`;
        console.log("[enrich-worker] Converted to base64, length:", base64Result.length);
        return base64Result;
      }

      return firstItem;
    }

    console.log("[enrich-worker] Unexpected output format:", output);
    return base64;
  } catch (err) {
    console.error("[enrich-worker] Error enriching image via Replicate:", err);
    return base64;
  }
}

// ── Lambda handler ────────────────────────────────────────────────────────────
// Triggered by SQS event source (batch_size=1).
// Calls enrichImage(), then POSTs result to server's internal callback endpoint.

export const handler = async (event) => {
  const record = event.Records[0];
  const { base64, requestId, socketId } = JSON.parse(record.body);

  console.log(`[enrich-lambda] Processing requestId: ${requestId}, socketId: ${socketId}`);

  const enrichedData = await enrichImage(base64);

  const callbackSecret = await getCallbackSecret();

  const callbackUrl = process.env.SERVER_CALLBACK_URL;
  console.log(`[enrich-lambda] Posting result to ${callbackUrl}`);

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": callbackSecret,
    },
    body: JSON.stringify({ requestId, enrichedData, socketId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[enrich-lambda] Callback failed: ${response.status} ${response.statusText} — ${body}`
    );
  }

  console.log(`[enrich-lambda] Callback succeeded for requestId: ${requestId}`);

  // report_batch_item_failures=True on the event source —
  // returning empty array means all records succeeded.
  return { batchItemFailures: [] };
};
