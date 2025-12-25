"use strict";
// Pixel-specific wrapper around Document for backwards compatibility
// This maintains the old PixelDataCRDT API while using the new Document underneath
Object.defineProperty(exports, "__esModule", { value: true });
exports.PixelDocument = void 0;
const Document_1 = require("./database/Document");
const PIXEL_COLLECTION_ID = "pixels";
/**
 * Pixel-specific CRDT that wraps Document
 * Maintains backward compatibility with old PixelDataCRDT API
 */
class PixelDocument {
    constructor(agentId, replicaId) {
        this.agentId = agentId;
        this.replicaId = replicaId;
        // Use agentId as document ID for backwards compatibility
        this.document = new Document_1.Document(agentId);
    }
    /**
     * Generate a key from x,y coordinates
     * This is a static method for backward compatibility
     */
    static getKey(x, y) {
        return `${x},${y}`;
    }
    /**
     * Set a pixel value and return the delta
     */
    set(key, value, timestamp = Date.now()) {
        return this.document.setItem(PIXEL_COLLECTION_ID, key, value, timestamp, this.replicaId, this.agentId);
    }
    /**
     * Get a pixel value
     */
    get(key) {
        return this.document.getItem(PIXEL_COLLECTION_ID, key);
    }
    /**
     * Get the number of pixels in the document
     */
    getSize() {
        const collection = this.document.getCollection(PIXEL_COLLECTION_ID);
        const items = collection.getAllItems();
        return items.size;
    }
    /**
     * Get deltas for an agent (inter-agent sync)
     * Returns null if no deltas are available
     */
    getDeltaForAgent(agentId) {
        const packet = this.document.getDeltasForAgent(agentId);
        if (!packet)
            return null;
        // Set the from fields
        packet.fromAgent = this.agentId;
        packet.fromReplica = this.replicaId;
        return packet;
    }
    /**
     * Get deltas for a replica (intra-agent sync)
     * Returns null if no deltas are available
     */
    getDeltaForReplica(replicaId) {
        const packet = this.document.getDeltasForReplica(replicaId);
        if (!packet)
            return null;
        // Set the from fields
        packet.fromAgent = this.agentId;
        packet.fromReplica = this.replicaId;
        return packet;
    }
    /**
     * Merge incoming deltas
     */
    merge(packet) {
        return this.document.merge(packet);
    }
    /**
     * Handle merge result from agent-level sync
     * Returns deltas that need to be sent back
     */
    handleMergeAgentResult(result, agentId) {
        this.document.acknowledgeMerge(agentId, result);
        // Return missing deltas if any
        const missingCount = Object.values(result.missing).reduce((sum, deltas) => sum + deltas.length, 0);
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
    handleMergeReplicaResult(result, replicaId) {
        this.document.acknowledgeReplicaMerge(replicaId, result);
        // Return missing deltas if any
        const missingCount = Object.values(result.missing).reduce((sum, deltas) => sum + deltas.length, 0);
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
    toJSON() {
        return this.document.toJSON();
    }
    /**
     * Deserialize from JSON
     */
    static fromJSON(json, agentId, replicaId) {
        const pixelDoc = new PixelDocument(agentId, replicaId);
        pixelDoc.document = Document_1.Document.fromJSON(json);
        return pixelDoc;
    }
}
exports.PixelDocument = PixelDocument;
