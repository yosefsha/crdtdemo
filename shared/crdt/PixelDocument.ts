// Pixel-specific wrapper around Document for backwards compatibility
// This maintains the old PixelDataCRDT API while using the new Document underneath

import {
  Document,
  DocumentDeltaPacket,
  DocumentMergeResult,
} from "./database/Document";
import { CollectionDelta } from "./database/Collection";
import { AgentId, ReplicaId, ItemId } from "./database/CRDTItem";
import { RGB } from "./types";

export type PixelDeltaPacket = DocumentDeltaPacket<RGB>;
export type MergeResult = DocumentMergeResult<RGB>;

const PIXEL_COLLECTION_ID = "pixels";

/**
 * Pixel-specific CRDT that wraps Document
 * Maintains backward compatibility with old PixelDataCRDT API
 */
export class PixelDocument {
  private document: Document<RGB>;
  private agentId: AgentId;
  private replicaId: ReplicaId;

  constructor(agentId: AgentId, replicaId: ReplicaId) {
    this.agentId = agentId;
    this.replicaId = replicaId;
    // Use agentId as document ID for backwards compatibility
    this.document = new Document<RGB>(agentId);
  }

  /**
   * Generate a key from x,y coordinates
   * This is a static method for backward compatibility
   */
  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /**
   * Set a pixel value and return the delta
   */
  set(
    key: string,
    value: RGB | null,
    timestamp: number = Date.now()
  ): CollectionDelta<RGB> | null {
    return this.document.setItem(
      PIXEL_COLLECTION_ID,
      key,
      value,
      timestamp,
      this.replicaId,
      this.agentId
    );
  }

  /**
   * Get a pixel value
   */
  get(key: string): RGB | null {
    return this.document.getItem(PIXEL_COLLECTION_ID, key);
  }

  /**
   * Get the number of pixels in the document
   */
  getSize(): number {
    const collection = this.document.getCollection(PIXEL_COLLECTION_ID);
    const items = collection.getAllItems();
    return items.size;
  }

  /**
   * Get deltas for an agent (inter-agent sync)
   * Returns null if no deltas are available
   */
  getDeltaForAgent(agentId: AgentId): PixelDeltaPacket | null {
    const packet = this.document.getDeltasForAgent(agentId);
    if (!packet) return null;

    // Set the from fields
    packet.fromAgent = this.agentId;
    packet.fromReplica = this.replicaId;
    return packet;
  }

  /**
   * Get deltas for a replica (intra-agent sync)
   * Returns null if no deltas are available
   */
  getDeltaForReplica(replicaId: ReplicaId): PixelDeltaPacket | null {
    const packet = this.document.getDeltasForReplica(replicaId);
    if (!packet) return null;

    // Set the from fields
    packet.fromAgent = this.agentId;
    packet.fromReplica = this.replicaId;
    return packet;
  }

  /**
   * Merge incoming deltas
   */
  merge(packet: PixelDeltaPacket): MergeResult {
    return this.document.merge(packet);
  }

  /**
   * Handle merge result from agent-level sync
   * Returns deltas that need to be sent back
   */
  handleMergeAgentResult(
    result: MergeResult,
    agentId: AgentId
  ): PixelDeltaPacket | null {
    this.document.acknowledgeMerge(agentId, result);

    // Return missing deltas if any
    const missingCount = Object.values(result.missing).reduce(
      (sum, deltas) => sum + deltas.length,
      0
    );

    if (missingCount > 0) {
      return {
        documentId: this.document.getDocumentId(),
        collectionDeltas: result.missing,
        fromAgent: this.agentId,
        fromReplica: this.replicaId,
      };
    }

    return null;
  }

  /**
   * Handle merge result from replica-level sync
   * Returns deltas that need to be sent back
   */
  handleMergeReplicaResult(
    result: MergeResult,
    replicaId: ReplicaId
  ): PixelDeltaPacket | null {
    this.document.acknowledgeReplicaMerge(replicaId, result);

    // Return missing deltas if any
    const missingCount = Object.values(result.missing).reduce(
      (sum, deltas) => sum + deltas.length,
      0
    );

    if (missingCount > 0) {
      return {
        documentId: this.document.getDocumentId(),
        collectionDeltas: result.missing,
        fromAgent: this.agentId,
        fromReplica: this.replicaId,
      };
    }

    return null;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): ReturnType<Document<RGB>["toJSON"]> {
    return this.document.toJSON();
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(
    json: ReturnType<Document<RGB>["toJSON"]>,
    agentId: AgentId,
    replicaId: ReplicaId
  ): PixelDocument {
    const pixelDoc = new PixelDocument(agentId, replicaId);
    pixelDoc.document = Document.fromJSON<RGB>(json);
    return pixelDoc;
  }
}
