import express from "express";

const router = express.Router();

export interface ChunkMetadata {
  sessionId: string;
  totalChunks: number;
  chunkIndex: number;
  originalSize: number;
  contentType: "image" | "crdt" | "json";
}

export interface StoredChunk {
  metadata: ChunkMetadata;
  data: string;
  receivedAt: number;
}

export class ChunkAssembler {
  private chunkStore = new Map<string, Map<number, StoredChunk>>();
  private readonly CHUNK_TTL = 5 * 60 * 1000; // 5 minutes

  async addChunk(sessionId: string, chunk: any): Promise<void> {
    if (!this.chunkStore.has(sessionId)) {
      this.chunkStore.set(sessionId, new Map());
    }

    const sessionChunks = this.chunkStore.get(sessionId)!;
    sessionChunks.set(chunk.metadata.chunkIndex, {
      ...chunk,
      receivedAt: Date.now(),
    });

    // Clean up old chunks periodically
    this.cleanupExpiredSessions();
  }

  async isComplete(sessionId: string): Promise<boolean> {
    const sessionChunks = this.chunkStore.get(sessionId);
    if (!sessionChunks || sessionChunks.size === 0) return false;

    const firstChunk = Array.from(sessionChunks.values())[0];
    const expectedChunks = firstChunk.metadata.totalChunks;

    return sessionChunks.size === expectedChunks;
  }

  async assembleChunks(sessionId: string): Promise<string> {
    const sessionChunks = this.chunkStore.get(sessionId);
    if (!sessionChunks) {
      throw new Error(`No chunks found for session ${sessionId}`);
    }

    // Sort chunks by index and concatenate data
    const sortedChunks = Array.from(sessionChunks.values()).sort(
      (a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex
    );

    const reassembledData = sortedChunks.map((chunk) => chunk.data).join("");

    console.log(
      `Reassembled ${reassembledData.length} bytes from ${sortedChunks.length} chunks`
    );

    return reassembledData;
  }

  async cleanup(sessionId: string): Promise<void> {
    this.chunkStore.delete(sessionId);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();

    for (const [sessionId, chunks] of this.chunkStore.entries()) {
      const firstChunk = Array.from(chunks.values())[0];
      if (firstChunk && now - firstChunk.receivedAt > this.CHUNK_TTL) {
        console.log(`Cleaning up expired session: ${sessionId}`);
        this.chunkStore.delete(sessionId);
      }
    }
  }
}

const chunkAssembler = new ChunkAssembler();

export default chunkAssembler;
