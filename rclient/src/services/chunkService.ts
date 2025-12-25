interface ChunkConfig {
  maxChunkSize: number; // bytes
  chunkOverlap?: number; // for image data
}

interface ChunkMetadata {
  sessionId: string;
  totalChunks: number;
  chunkIndex: number;
  originalSize: number;
  contentType: "image" | "crdt" | "json";
}

interface Chunk {
  metadata: ChunkMetadata;
  data: string; // base64 encoded chunk
}

interface ChunkResponse {
  success: boolean;
  chunkIndex: number;
  isComplete: boolean;
  finalResult?: any;
  message?: string;
  error?: string;
}

class ChunkService {
  private config: ChunkConfig = {
    maxChunkSize: 20 * 1024 * 1024, // 20MB chunks
    chunkOverlap: 0,
  };

  constructor(config?: Partial<ChunkConfig>) {
    this.config = { ...this.config, ...config };
  }

  // Split large base64 data into chunks
  chunkLargePayload(
    data: string,
    contentType: "image" | "crdt" | "json" = "image"
  ): Chunk[] {
    const sessionId = this.generateSessionId();
    const dataSize = data.length;
    const chunkSize = this.config.maxChunkSize;
    const totalChunks = Math.ceil(dataSize / chunkSize);

    console.log(
      `[ChunkService] Chunking ${dataSize} bytes (${(dataSize / 1024 / 1024).toFixed(2)} MB) into ${totalChunks} chunks of ~${(chunkSize / 1024 / 1024).toFixed(2)} MB each`
    );

    const chunks: Chunk[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, dataSize);
      const chunkData = data.slice(start, end);

      chunks.push({
        metadata: {
          sessionId,
          totalChunks,
          chunkIndex: i,
          originalSize: dataSize,
          contentType,
        },
        data: chunkData,
      });

      console.log(
        `[ChunkService] Created chunk ${i + 1}/${totalChunks}: ${chunkData.length} bytes`
      );
    }

    return chunks;
  }

  // Send chunks sequentially or in parallel
  async sendChunkedRequest(
    chunks: Chunk[],
    endpoint: string,
    parallel = false,
    additionalData?: any
  ): Promise<any> {
    console.log(
      `[ChunkService] Sending ${chunks.length} chunks to ${endpoint} (${parallel ? "parallel" : "sequential"})`
    );

    if (parallel) {
      return this.sendChunksParallel(chunks, endpoint, additionalData);
    } else {
      return this.sendChunksSequential(chunks, endpoint, additionalData);
    }
  }

  private async sendChunksSequential(
    chunks: Chunk[],
    endpoint: string,
    additionalData?: any
  ): Promise<any> {
    const responses: ChunkResponse[] = [];

    for (const chunk of chunks) {
      console.log(
        `[ChunkService] Sending chunk ${chunk.metadata.chunkIndex + 1}/${chunk.metadata.totalChunks}`
      );

      const payload = {
        ...chunk,
        ...additionalData, // Include requestId, socketId, etc.
      };

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: ChunkResponse = await response.json();
        responses.push(result);

        // If this chunk completed the assembly, return the final result
        if (result.isComplete && result.finalResult) {
          console.log(
            `[ChunkService] Assembly complete at chunk ${chunk.metadata.chunkIndex + 1}`
          );
          return result.finalResult;
        }
      } catch (error: any) {
        console.error(
          `[ChunkService] Chunk ${chunk.metadata.chunkIndex + 1} failed:`,
          error
        );
        let errorMessage = "Unknown error";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        throw new Error(
          `Chunk ${chunk.metadata.chunkIndex + 1} failed: ${errorMessage}`
        );
      }
    }

    // If we get here, something went wrong (no chunk marked as complete)
    throw new Error("All chunks sent but no final result received");
  }

  private async sendChunksParallel(
    chunks: Chunk[],
    endpoint: string,
    additionalData?: any
  ): Promise<any> {
    console.log(`[ChunkService] Sending ${chunks.length} chunks in parallel`);

    const promises = chunks.map(async (chunk) => {
      const payload = {
        ...chunk,
        ...additionalData,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Chunk ${chunk.metadata.chunkIndex + 1} failed: ${response.statusText}`
        );
      }

      return response.json();
    });

    const responses = await Promise.all(promises);

    // Find the response with the final result
    const finalResponse = responses.find((r) => r.isComplete && r.finalResult);
    if (finalResponse) {
      return finalResponse.finalResult;
    }

    throw new Error(
      "Parallel chunk sending completed but no final result found"
    );
  }

  // Determine if payload should be chunked
  shouldChunk(data: string, threshold: number = 20 * 1024 * 1024): boolean {
    return data.length > threshold;
  }

  // Get estimated number of chunks for a payload
  estimateChunkCount(dataSize: number): number {
    return Math.ceil(dataSize / this.config.maxChunkSize);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const chunkService = new ChunkService();
export type { Chunk, ChunkMetadata, ChunkResponse };
