import { Document, DocumentDeltaPacket, DocumentMergeResult } from "./database/Document";
import { CollectionDelta } from "./database/Collection";
import { AgentId, ReplicaId } from "./database/CRDTItem";
import { RGBHEX } from "./types";
export type PixelDeltaPacket = DocumentDeltaPacket<RGBHEX>;
export type MergeResult = DocumentMergeResult<RGBHEX>;
/**
 * Pixel-specific CRDT that wraps Document
 * Maintains backward compatibility with old PixelDataCRDT API
 */
export declare class PixelDocument {
    private document;
    private agentId;
    private replicaId;
    constructor(agentId: AgentId, replicaId: ReplicaId);
    /**
     * Generate a key from x,y coordinates
     * This is a static method for backward compatibility
     */
    static getKey(x: number, y: number): string;
    /**
     * Set a pixel value and return the delta
     */
    set(key: string, value: RGBHEX | null, timestamp?: number): CollectionDelta<RGBHEX> | null;
    /**
     * Get a pixel value
     */
    get(key: string): RGBHEX | null;
    /**
     * Get the number of pixels in the document
     */
    getSize(): number;
    /**
     * Get deltas for an agent (inter-agent sync)
     * Returns null if no deltas are available
     */
    getDeltaForAgent(agentId: AgentId): PixelDeltaPacket | null;
    /**
     * Get deltas for a replica (intra-agent sync)
     * Returns null if no deltas are available
     */
    getDeltaForReplica(replicaId: ReplicaId): PixelDeltaPacket | null;
    /**
     * Merge incoming deltas
     */
    merge(packet: PixelDeltaPacket): MergeResult;
    /**
     * Handle merge result from agent-level sync
     * Returns deltas that need to be sent back
     */
    handleMergeAgentResult(result: MergeResult, agentId: AgentId): PixelDeltaPacket | null;
    /**
     * Handle merge result from replica-level sync
     * Returns deltas that need to be sent back
     */
    handleMergeReplicaResult(result: MergeResult, replicaId: ReplicaId): PixelDeltaPacket | null;
    /**
     * Serialize to JSON
     */
    toJSON(): ReturnType<Document<RGBHEX>["toJSON"]>;
    /**
     * Deserialize from JSON
     */
    static fromJSON(json: ReturnType<Document<RGBHEX>["toJSON"]>, agentId: AgentId, replicaId: ReplicaId): PixelDocument;
}
//# sourceMappingURL=PixelDocument.d.ts.map