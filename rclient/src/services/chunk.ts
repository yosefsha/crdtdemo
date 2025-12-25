export interface ChunkConfig {
  maxChunkSize: number; // bytes
  chunkOverlap?: number; // for image data
}

export interface ChunkMetadata {
  sessionId: string;
  totalChunks: number;
  chunkIndex: number;
  originalSize: number;
  contentType: "image" | "crdt" | "json";
}

export interface Chunk {
  metadata: ChunkMetadata;
  data: string; // base64 encoded chunk
}

class ChunkService {
  private config: ChunkConfig = {
    maxChunkSize: 20 * 1024 * 1024, // 20MB chunks
    chunkOverlap: 0,
  };

  constructor(config?: Partial<ChunkConfig>) {
    this.config = { ...this.config, ...config };
  }

  // Split large base64 image into chunks
  chunkLargePayload(
    data: string,
    contentType: "image" | "crdt" | "json" = "image"
  ): Chunk[] {
    const sessionId = this.generateSessionId();
    const dataSize = data.length;
    const chunkSize = this.config.maxChunkSize;
    const totalChunks = Math.ceil(dataSize / chunkSize);

    console.log(
      `Chunking ${dataSize} bytes into ${totalChunks} chunks of ~${chunkSize} bytes each`
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
    }

    return chunks;
  }

  // Send chunks sequentially or in parallel
  async sendChunkedRequest(
    chunks: Chunk[],
    endpoint: string,
    parallel = false
  ): Promise<any> {
    if (parallel) {
      return this.sendChunksParallel(chunks, endpoint);
    } else {
      return this.sendChunksSequential(chunks, endpoint);
    }
  }

  private async sendChunksSequential(
    chunks: Chunk[],
    endpoint: string
  ): Promise<any> {
    const responses: any[] = [];

    for (const chunk of chunks) {
      console.log(
        `Sending chunk ${chunk.metadata.chunkIndex + 1}/${chunk.metadata.totalChunks}`
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        throw new Error(
          `Chunk ${chunk.metadata.chunkIndex} failed: ${response.statusText}`
        );
      }

      const result = await response.json();
      responses.push(result);
    }

    return this.assembleResponse(responses);
  }

  private async sendChunksParallel(
    chunks: Chunk[],
    endpoint: string
  ): Promise<any> {
    console.log(`Sending ${chunks.length} chunks in parallel`);

    const promises = chunks.map(async (chunk) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        throw new Error(
          `Chunk ${chunk.metadata.chunkIndex} failed: ${response.statusText}`
        );
      }

      return response.json();
    });

    const responses = await Promise.all(promises);
    return this.assembleResponse(responses);
  }

  private assembleResponse(responses: any[]): any {
    // Sort responses by chunk index
    responses.sort((a, b) => a.chunkIndex - b.chunkIndex);

    // Return the final result from the last chunk, or assemble data
    return responses[responses.length - 1]?.finalResult || responses;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const chunkService = new ChunkService();
