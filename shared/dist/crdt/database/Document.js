"use strict";
// Document: A sync unit containing multiple collections
// Documents are the unit of synchronization in the CRDT system
Object.defineProperty(exports, "__esModule", { value: true });
exports.Document = void 0;
const Collection_1 = require("./Collection");
/**
 * A document containing multiple named collections
 * Documents are the unit of synchronization
 */
class Document {
    constructor(documentId) {
        this.documentId = documentId;
        this.collections = new Map();
        this.agentTimestamps = new Map();
        this.replicaTimestamps = new Map();
    }
    /**
     * Get the document ID
     */
    getDocumentId() {
        return this.documentId;
    }
    /**
     * Get or create a collection
     */
    getCollection(collectionId) {
        let collection = this.collections.get(collectionId);
        if (!collection) {
            collection = new Collection_1.Collection(collectionId);
            this.collections.set(collectionId, collection);
        }
        return collection;
    }
    /**
     * Check if a collection exists
     */
    hasCollection(collectionId) {
        return this.collections.has(collectionId);
    }
    /**
     * Get all collection IDs
     */
    getAllCollectionIds() {
        return Array.from(this.collections.keys());
    }
    /**
     * Set an item in a collection
     * Automatically creates the collection if it doesn't exist
     */
    setItem(collectionId, itemId, value, timestamp, replicaId, agentId) {
        const collection = this.getCollection(collectionId);
        const delta = collection.setItem(itemId, value, timestamp, replicaId, agentId);
        // Update vector clocks if delta was applied
        if (delta) {
            this.updateVectorClock(collectionId, itemId, timestamp, agentId, replicaId);
        }
        return delta;
    }
    /**
     * Get an item from a collection
     */
    getItem(collectionId, itemId) {
        const collection = this.collections.get(collectionId);
        return collection ? collection.getItem(itemId) : null;
    }
    /**
     * Update vector clocks when an item is updated
     */
    updateVectorClock(collectionId, itemId, timestamp, agentId, replicaId) {
        // Update agent timestamp
        if (!this.agentTimestamps.has(agentId)) {
            this.agentTimestamps.set(agentId, new Map());
        }
        const agentCollections = this.agentTimestamps.get(agentId);
        if (!agentCollections.has(collectionId)) {
            agentCollections.set(collectionId, new Map());
        }
        const agentItems = agentCollections.get(collectionId);
        agentItems.set(itemId, timestamp);
        // Update replica timestamp
        if (!this.replicaTimestamps.has(replicaId)) {
            this.replicaTimestamps.set(replicaId, new Map());
        }
        const replicaCollections = this.replicaTimestamps.get(replicaId);
        if (!replicaCollections.has(collectionId)) {
            replicaCollections.set(collectionId, new Map());
        }
        const replicaItems = replicaCollections.get(collectionId);
        replicaItems.set(itemId, timestamp);
    }
    /**
     * Get deltas for an agent (inter-agent sync)
     */
    getDeltasForAgent(agentId) {
        const collectionDeltas = {};
        const agentCollections = this.agentTimestamps.get(agentId) || new Map();
        this.collections.forEach((collection, collectionId) => {
            const agentItems = agentCollections.get(collectionId) || new Map();
            const deltas = collection.getDeltasSince(agentItems);
            if (deltas.length > 0) {
                collectionDeltas[collectionId] = deltas;
            }
        });
        if (Object.keys(collectionDeltas).length === 0) {
            return null;
        }
        return {
            documentId: this.documentId,
            collectionDeltas,
            fromReplica: "", // Will be set by caller
            fromAgent: "", // Will be set by caller
        };
    }
    /**
     * Get all items from all collections
     */
    getAllItems() {
        const result = {};
        this.collections.forEach((collection, collectionId) => {
            result[collectionId] = Object.fromEntries(collection.getAllItems());
        });
        return result;
    }
    /**
     * Get deltas for a replica (intra-agent sync)
     */
    getDeltasForReplica(replicaId) {
        const collectionDeltas = {};
        const isNewReplica = !this.replicaTimestamps.has(replicaId);
        // If this is a new replica and we have collections, return all deltas
        if (isNewReplica && this.collections.size > 0) {
            this.collections.forEach((collection, collectionId) => {
                const deltas = collection.getAllDeltas();
                if (deltas.length > 0) {
                    collectionDeltas[collectionId] = deltas;
                }
            });
        }
        else {
            // For existing replicas, return only incremental deltas
            const replicaCollections = this.replicaTimestamps.get(replicaId) || new Map();
            this.collections.forEach((collection, collectionId) => {
                const replicaItems = replicaCollections.get(collectionId) || new Map();
                const deltas = collection.getDeltasSince(replicaItems);
                if (deltas.length > 0) {
                    collectionDeltas[collectionId] = deltas;
                }
            });
        }
        if (Object.keys(collectionDeltas).length === 0) {
            return null;
        }
        return {
            documentId: this.documentId,
            collectionDeltas,
            fromReplica: "", // Will be set by caller
            fromAgent: "", // Will be set by caller
        };
    }
    /**
     * Merge a delta packet into this document
     */
    merge(packet) {
        const applied = {};
        const missing = {};
        Object.entries(packet.collectionDeltas).forEach(([collectionId, deltas]) => {
            const collection = this.getCollection(collectionId);
            const appliedDeltas = collection.applyDeltas(deltas);
            if (appliedDeltas.length > 0) {
                applied[collectionId] = appliedDeltas;
                // Update vector clocks for applied deltas
                appliedDeltas.forEach((delta) => {
                    this.updateVectorClock(collectionId, delta.itemId, delta.timestamp, delta.agentId, delta.replicaId);
                });
            }
        });
        // Calculate missing deltas (what the sender doesn't have)
        this.collections.forEach((collection, collectionId) => {
            const senderAgent = packet.fromAgent;
            const senderCollections = this.agentTimestamps.get(senderAgent) || new Map();
            const senderItems = senderCollections.get(collectionId) || new Map();
            const missingDeltas = collection.getDeltasSince(senderItems);
            if (missingDeltas.length > 0) {
                missing[collectionId] = missingDeltas;
            }
        });
        return { applied, missing };
    }
    /**
     * Acknowledge that we sent deltas to an agent and they confirmed receipt
     * This updates our tracking of what the agent has seen
     * Call this after receiving merge result from the agent
     */
    acknowledgeMerge(agentId, mergeResult) {
        // Update tracking for all applied deltas - the agent now has these
        Object.entries(mergeResult.applied).forEach(([collectionId, deltas]) => {
            if (!this.agentTimestamps.has(agentId)) {
                this.agentTimestamps.set(agentId, new Map());
            }
            const agentCollections = this.agentTimestamps.get(agentId);
            if (!agentCollections.has(collectionId)) {
                agentCollections.set(collectionId, new Map());
            }
            const agentItems = agentCollections.get(collectionId);
            deltas.forEach((delta) => {
                const currentTimestamp = agentItems.get(delta.itemId);
                if (currentTimestamp === undefined ||
                    delta.timestamp > currentTimestamp) {
                    agentItems.set(delta.itemId, delta.timestamp);
                }
            });
        });
        // Also update for missing deltas - the agent sent these in their original packet
        // so they definitely have them (they're "missing" from our perspective, not theirs)
        Object.entries(mergeResult.missing).forEach(([collectionId, deltas]) => {
            if (!this.agentTimestamps.has(agentId)) {
                this.agentTimestamps.set(agentId, new Map());
            }
            const agentCollections = this.agentTimestamps.get(agentId);
            if (!agentCollections.has(collectionId)) {
                agentCollections.set(collectionId, new Map());
            }
            const agentItems = agentCollections.get(collectionId);
            deltas.forEach((delta) => {
                const currentTimestamp = agentItems.get(delta.itemId);
                if (currentTimestamp === undefined ||
                    delta.timestamp > currentTimestamp) {
                    agentItems.set(delta.itemId, delta.timestamp);
                }
            });
        });
    }
    /**
     * Acknowledge that we sent deltas to a replica and they confirmed receipt
     * This updates our tracking of what the replica has seen
     * Call this after receiving merge result from the replica
     */
    acknowledgeReplicaMerge(replicaId, mergeResult) {
        // Update tracking for all applied deltas - the replica now has these
        Object.entries(mergeResult.applied).forEach(([collectionId, deltas]) => {
            if (!this.replicaTimestamps.has(replicaId)) {
                this.replicaTimestamps.set(replicaId, new Map());
            }
            const replicaCollections = this.replicaTimestamps.get(replicaId);
            if (!replicaCollections.has(collectionId)) {
                replicaCollections.set(collectionId, new Map());
            }
            const replicaItems = replicaCollections.get(collectionId);
            deltas.forEach((delta) => {
                const currentTimestamp = replicaItems.get(delta.itemId);
                if (currentTimestamp === undefined ||
                    delta.timestamp > currentTimestamp) {
                    replicaItems.set(delta.itemId, delta.timestamp);
                }
            });
        });
        // Also update for missing deltas - the replica sent these in their original packet
        // so they definitely have them (they're "missing" from our perspective, not theirs)
        Object.entries(mergeResult.missing).forEach(([collectionId, deltas]) => {
            if (!this.replicaTimestamps.has(replicaId)) {
                this.replicaTimestamps.set(replicaId, new Map());
            }
            const replicaCollections = this.replicaTimestamps.get(replicaId);
            if (!replicaCollections.has(collectionId)) {
                replicaCollections.set(collectionId, new Map());
            }
            const replicaItems = replicaCollections.get(collectionId);
            deltas.forEach((delta) => {
                const currentTimestamp = replicaItems.get(delta.itemId);
                if (currentTimestamp === undefined ||
                    delta.timestamp > currentTimestamp) {
                    replicaItems.set(delta.itemId, delta.timestamp);
                }
            });
        });
    }
    /**
     * Get all deltas (entire document state)
     */
    getAllDeltas() {
        const collectionDeltas = {};
        this.collections.forEach((collection, collectionId) => {
            const deltas = collection.getAllDeltas();
            if (deltas.length > 0) {
                collectionDeltas[collectionId] = deltas;
            }
        });
        return {
            documentId: this.documentId,
            collectionDeltas,
            fromReplica: "",
            fromAgent: "",
        };
    }
    /**
     * Serialize to JSON for database persistence
     * Excludes replicaTimestamps as they are session-only state
     */
    toDBJSON() {
        const collectionsObj = {};
        this.collections.forEach((collection, collectionId) => {
            collectionsObj[collectionId] = collection.toJSON();
        });
        const agentTimestampsObj = {};
        this.agentTimestamps.forEach((colMap, agentId) => {
            agentTimestampsObj[agentId] = {};
            colMap.forEach((itemMap, collectionId) => {
                agentTimestampsObj[agentId][collectionId] = {};
                itemMap.forEach((timestamp, itemId) => {
                    agentTimestampsObj[agentId][collectionId][itemId] = timestamp;
                });
            });
        });
        return {
            documentId: this.documentId,
            collections: collectionsObj,
            agentTimestamps: agentTimestampsObj,
            // NOTE: replicaTimestamps intentionally excluded - they are session-only state
        };
    }
    /**
     * Serialize to JSON
     */
    toJSON() {
        const collectionsObj = {};
        this.collections.forEach((collection, collectionId) => {
            collectionsObj[collectionId] = collection.toJSON();
        });
        // Serialize agent timestamps
        const agentTimestampsObj = {};
        this.agentTimestamps.forEach((collections, agentId) => {
            agentTimestampsObj[agentId] = {};
            collections.forEach((items, collectionId) => {
                agentTimestampsObj[agentId][collectionId] = Object.fromEntries(items);
            });
        });
        // Serialize replica timestamps
        const replicaTimestampsObj = {};
        this.replicaTimestamps.forEach((collections, replicaId) => {
            replicaTimestampsObj[replicaId] = {};
            collections.forEach((items, collectionId) => {
                replicaTimestampsObj[replicaId][collectionId] =
                    Object.fromEntries(items);
            });
        });
        return {
            documentId: this.documentId,
            collections: collectionsObj,
            agentTimestamps: agentTimestampsObj,
            replicaTimestamps: replicaTimestampsObj,
        };
    }
    /**
     * Deserialize from JSON
     */
    static fromJSON(json) {
        const doc = new Document(json.documentId);
        // Deserialize collections
        Object.entries(json.collections).forEach(([collectionId, collectionData]) => {
            const collection = Collection_1.Collection.fromJSON(collectionData);
            doc.collections.set(collectionId, collection);
        });
        // Deserialize agent timestamps
        Object.entries(json.agentTimestamps).forEach(([agentId, collections]) => {
            const agentMap = new Map();
            Object.entries(collections).forEach(([collectionId, items]) => {
                agentMap.set(collectionId, new Map(Object.entries(items)));
            });
            doc.agentTimestamps.set(agentId, agentMap);
        });
        // Deserialize replica timestamps (optional - may not be present in DB data)
        if (json.replicaTimestamps) {
            Object.entries(json.replicaTimestamps).forEach(([replicaId, collections]) => {
                const replicaMap = new Map();
                Object.entries(collections).forEach(([collectionId, items]) => {
                    replicaMap.set(collectionId, new Map(Object.entries(items)));
                });
                doc.replicaTimestamps.set(replicaId, replicaMap);
            });
        }
        return doc;
    }
}
exports.Document = Document;
