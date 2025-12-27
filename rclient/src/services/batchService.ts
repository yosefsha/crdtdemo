/**
 * Client-side batching service for handling large payloads
 * Automatically splits large requests into multiple batches
 */

interface BatchInfo {
  batchId: string;
  batchIndex: number;
  totalBatches: number;
  isComplete: boolean;
  itemsInBatch: number;
  totalItems: number;
}

interface BatchedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  getData: (batchIndex: number) => any; // Function to get data for specific batch
  onBatchComplete?: (response: any, batchIndex: number) => void;
  onComplete?: () => void;
  onError?: (error: any) => void;
}

/**
 * Send a request with automatic batching support
 * If payload is small, sends as single request with batchInfo
 * If payload is large, automatically batches into multiple requests
 */
export async function sendWithBatching(
  url: string,
  method: string,
  headers: Record<string, string>,
  payload: any,
  options: {
    maxBatchSize?: number; // Max bytes per batch (default 4MB to stay under 5MB limit)
    onBatchComplete?: (response: any, batchIndex: number) => void;
  } = {}
): Promise<any> {
  const maxBatchSize = options.maxBatchSize || 4 * 1024 * 1024; // 4MB default

  // Estimate payload size
  const payloadStr = JSON.stringify(payload);
  const payloadSize = new Blob([payloadStr]).size;

  console.log(
    `[Batch] Payload size: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`
  );

  // If small enough, send as single batch
  if (payloadSize < maxBatchSize * 0.8) {
    const batchInfo: BatchInfo = {
      batchId: "",
      batchIndex: 0,
      totalBatches: 1,
      isComplete: true,
      itemsInBatch: 1,
      totalItems: 1,
    };

    console.log(`[Batch] Sending single batch (under size limit)`);

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ ...payload, batchInfo }),
    });

    if (!response.ok) {
      throw await response.json();
    }

    return await response.json();
  }

  // Large payload - need to batch
  console.log(`[Batch] Payload too large, batching...`);

  // For now, we'll split the payload by estimating batch count
  const estimatedBatches = Math.ceil(payloadSize / maxBatchSize);
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Split payload into batches
  const batches = splitPayloadIntoBatches(payload, estimatedBatches);

  console.log(`[Batch] Split into ${batches.length} batches`);

  // Send batches sequentially
  let lastResponse: any = null;
  for (let i = 0; i < batches.length; i++) {
    const batchInfo: BatchInfo = {
      batchId,
      batchIndex: i,
      totalBatches: batches.length,
      isComplete: i === batches.length - 1,
      itemsInBatch: 1,
      totalItems: batches.length,
    };

    const timestamp = new Date().toISOString();
    console.log(
      `[Batch ${timestamp}] 🚀 SENDING batch ${i + 1}/${batches.length} (batchId: ${batchId})`
    );

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ ...batches[i], batchInfo }),
    });

    console.log(
      `[Batch ${timestamp}] ✅ RECEIVED response for batch ${i + 1}/${batches.length}`
    );

    if (!response.ok) {
      throw await response.json();
    }

    lastResponse = await response.json();

    if (options.onBatchComplete) {
      options.onBatchComplete(lastResponse, i);
    }
  }

  console.log(`[Batch] All batches sent successfully`);
  return lastResponse;
}

/**
 * Simple payload splitter - divides data into N batches
 * For more sophisticated splitting, use Document.startBatchedDeltasForAgent/Replica
 */
function splitPayloadIntoBatches(payload: any, batchCount: number): any[] {
  // If payload has deltas (CRDT sync), split by collections/deltas
  if (payload.deltas && payload.deltas.collectionDeltas) {
    return splitDeltaPayload(payload, batchCount);
  }

  // If payload has base64 (image enrichment), split base64
  if (payload.base64) {
    return splitBase64Payload(payload, batchCount);
  }

  // Fallback: just return as single batch
  return [payload];
}

/**
 * Split CRDT delta payload into batches
 */
function splitDeltaPayload(payload: any, batchCount: number): any[] {
  const { deltas, ...rest } = payload;
  const { collectionDeltas } = deltas;

  // Get all deltas across all collections
  const allDeltas: any[] = [];
  const collectionKeys: string[] = [];
  for (const [key, deltaArray] of Object.entries(collectionDeltas)) {
    (deltaArray as any[]).forEach((delta) => {
      allDeltas.push({ collectionId: key, delta });
    });
  }

  if (allDeltas.length === 0) {
    return [payload];
  }

  // Split deltas into batches
  const batchSize = Math.ceil(allDeltas.length / batchCount);
  const batches: any[] = [];

  for (let i = 0; i < allDeltas.length; i += batchSize) {
    const batchDeltas = allDeltas.slice(i, i + batchSize);

    // Reconstruct collectionDeltas for this batch
    const batchCollectionDeltas: Record<string, any[]> = {};
    for (const item of batchDeltas) {
      if (!batchCollectionDeltas[item.collectionId]) {
        batchCollectionDeltas[item.collectionId] = [];
      }
      batchCollectionDeltas[item.collectionId].push(item.delta);
    }

    batches.push({
      ...rest,
      deltas: {
        ...deltas,
        collectionDeltas: batchCollectionDeltas,
      },
    });
  }

  return batches;
}

/**
 * Split base64 image into batches
 */
function splitBase64Payload(payload: any, batchCount: number): any[] {
  const { base64, ...rest } = payload;
  const chunkSize = Math.ceil(base64.length / batchCount);
  const batches: any[] = [];

  for (let i = 0; i < base64.length; i += chunkSize) {
    batches.push({
      ...rest,
      base64: base64.substring(i, i + chunkSize),
      isPartial: i + chunkSize < base64.length,
    });
  }

  return batches;
}
