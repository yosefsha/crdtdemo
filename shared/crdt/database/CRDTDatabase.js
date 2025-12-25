"use strict";
// CRDTDatabase: Main facade for the CRDT database system
// Manages documents which contain collections of CRDT items
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRDTDatabase = exports.Document = exports.Collection = exports.CRDTItem = void 0;
exports.createTestDatabase = createTestDatabase;
const Document_1 = require("./Document");
var CRDTItem_1 = require("./CRDTItem");
Object.defineProperty(exports, "CRDTItem", { enumerable: true, get: function () { return CRDTItem_1.CRDTItem; } });
var Collection_1 = require("./Collection");
Object.defineProperty(exports, "Collection", { enumerable: true, get: function () { return Collection_1.Collection; } });
var Document_2 = require("./Document");
Object.defineProperty(exports, "Document", { enumerable: true, get: function () { return Document_2.Document; } });
/**
 * Main CRDTDatabase class
 * Manages multiple documents, each containing multiple collections
 */
class CRDTDatabase {
    constructor(agentId, replicaId) {
        this.agentId = agentId;
        this.replicaId = replicaId;
        this.documents = new Map();
    }
    /**
     * Get database info
     */
    getInfo() {
        return {
            agentId: this.agentId,
            replicaId: this.replicaId,
        };
    }
    /**
     * Get or create a document
     */
    getDocument(documentId) {
        let doc = this.documents.get(documentId);
        if (!doc) {
            doc = new Document_1.Document(documentId);
            this.documents.set(documentId, doc);
        }
        return doc;
    }
    /**
     * Check if a document exists
     */
    hasDocument(documentId) {
        return this.documents.has(documentId);
    }
    /**
     * Get all document IDs
     */
    getAllDocumentIds() {
        return Array.from(this.documents.keys());
    }
    /**
     * Set an item in a document's collection
     * This is the main user-facing API
     * Timestamp is generated automatically
     */
    setItem(documentId, collectionId, itemId, value) {
        const timestamp = Date.now();
        const doc = this.getDocument(documentId);
        return doc.setItem(collectionId, itemId, value, timestamp, this.replicaId, this.agentId);
    }
    /**
     * Get an item from a document's collection
     */
    getItem(documentId, collectionId, itemId) {
        const doc = this.documents.get(documentId);
        return doc ? doc.getItem(collectionId, itemId) : null;
    }
    /**
     * Get deltas for a document to sync with an agent
     */
    getDeltasForAgent(documentId, agentId) {
        const doc = this.documents.get(documentId);
        if (!doc)
            return null;
        const packet = doc.getDeltasForAgent(agentId);
        if (packet) {
            packet.fromAgent = this.agentId;
            packet.fromReplica = this.replicaId;
        }
        return packet;
    }
    /**
     * Get deltas for a document to sync with a replica
     */
    getDeltasForReplica(documentId, replicaId) {
        const doc = this.documents.get(documentId);
        if (!doc)
            return null;
        const packet = doc.getDeltasForReplica(replicaId);
        if (packet) {
            packet.fromAgent = this.agentId;
            packet.fromReplica = this.replicaId;
        }
        return packet;
    }
    /**
     * Merge a delta packet for a document
     */
    mergeDocument(packet) {
        const doc = this.getDocument(packet.documentId);
        return doc.merge(packet);
    }
    /**
     * Acknowledge that deltas were sent to an agent and they confirmed receipt
     * Call this after sending deltas and receiving the merge result back
     */
    acknowledgeMerge(documentId, agentId, mergeResult) {
        const doc = this.documents.get(documentId);
        if (doc) {
            doc.acknowledgeMerge(agentId, mergeResult);
        }
    }
    /**
     * Acknowledge that deltas were sent to a replica and they confirmed receipt
     * Call this after sending deltas and receiving the merge result back from a replica
     */
    acknowledgeReplicaMerge(documentId, replicaId, mergeResult) {
        const doc = this.documents.get(documentId);
        if (doc) {
            doc.acknowledgeReplicaMerge(replicaId, mergeResult);
        }
    }
    /**
     * Get all deltas for a document
     */
    getAllDeltas(documentId) {
        const doc = this.documents.get(documentId);
        if (!doc)
            return null;
        const packet = doc.getAllDeltas();
        packet.fromAgent = this.agentId;
        packet.fromReplica = this.replicaId;
        return packet;
    }
    /**
     * Serialize to JSON
     */
    toJSON() {
        const documentsObj = {};
        this.documents.forEach((doc, docId) => {
            documentsObj[docId] = doc.toJSON();
        });
        return {
            agentId: this.agentId,
            replicaId: this.replicaId,
            documents: documentsObj,
        };
    }
    /**
     * Deserialize from JSON
     */
    static fromJSON(json) {
        const db = new CRDTDatabase(json.agentId, json.replicaId);
        Object.entries(json.documents).forEach(([docId, docData]) => {
            const doc = Document_1.Document.fromJSON(docData);
            db.documents.set(docId, doc);
        });
        return db;
    }
}
exports.CRDTDatabase = CRDTDatabase;
/**
 * Utility function for testing
 */
function createTestDatabase(agentId, replicaId) {
    return new CRDTDatabase(agentId, replicaId);
}
