"use strict";
// SIMPLIFIED PixelDataCRDT - Just a thin wrapper over CRDTDatabase
// Breaking changes: No backward compatibility with old format
Object.defineProperty(exports, "__esModule", { value: true });
exports.PixelDataCRDT = void 0;
const CRDTDatabase_1 = require("../crdt/database/CRDTDatabase");
const DOCUMENT_ID = "canvas";
const COLLECTION_ID = "pixels";
class PixelDataCRDT {
    constructor(agentId, replicaId) {
        this.db = new CRDTDatabase_1.CRDTDatabase(agentId, replicaId);
    }
    // Compatibility: id property for old client code
    get id() {
        const info = this.db.getInfo();
        return `${info.agentId}:${info.replicaId}`;
    }
    // Compatibility: static getKey method for old client code
    static getKey(x, y) {
        return `${x},${y}`;
    }
    // Match old API: set(key, color) where key is "x,y"
    set(key, color) {
        return this.db.setItem(DOCUMENT_ID, COLLECTION_ID, key, color);
    }
    // Match old API: get(key) where key is "x,y"
    get(key) {
        return this.db.getItem(DOCUMENT_ID, COLLECTION_ID, key);
    }
    getDeltasForAgent(agentId) {
        return this.db.getDeltasForAgent(DOCUMENT_ID, agentId);
    }
    // Alias for old API
    getDeltaForAgent(agentId) {
        return this.getDeltasForAgent(agentId);
    }
    getDeltasForReplica(replicaId) {
        return this.db.getDeltasForReplica(DOCUMENT_ID, replicaId);
    }
    // Alias for old API
    getDeltaForReplica(replicaId) {
        return this.getDeltasForReplica(replicaId);
    }
    merge(packet) {
        return this.db.mergeDocument(packet);
    }
    acknowledgeMerge(agentId, mergeResult) {
        this.db.acknowledgeMerge(DOCUMENT_ID, agentId, mergeResult);
    }
    // Old API: calls acknowledgeMerge and returns deltas
    handleMergeAgentResult(result, fromAgent) {
        this.acknowledgeMerge(fromAgent, result);
        return this.getDeltaForAgent(fromAgent);
    }
    // Old API: for replica-level sync
    handleMergeReplicaResult(result, fromReplica) {
        this.db.acknowledgeReplicaMerge(DOCUMENT_ID, fromReplica, result);
        return this.getDeltaForReplica(fromReplica);
    }
    getAllDeltas() {
        return this.db.getAllDeltas(DOCUMENT_ID);
    }
    getInfo() {
        return this.db.getInfo();
    }
    // Get all pixel values as a flat object
    get values() {
        const doc = this.db["documents"].get(DOCUMENT_ID);
        if (!doc)
            return {};
        const collection = doc["collections"].get(COLLECTION_ID);
        if (!collection)
            return {};
        const result = {};
        for (const [key, item] of collection["items"]) {
            if (item.getValue() !== null) {
                result[key] = item.getValue();
            }
        }
        return result;
    }
    toJSON() {
        return this.db.toJSON();
    }
    static fromJSON(json) {
        const db = CRDTDatabase_1.CRDTDatabase.fromJSON(json);
        const info = db.getInfo();
        const crdt = new PixelDataCRDT(info.agentId, info.replicaId);
        crdt.db = db;
        return crdt;
    }
}
exports.PixelDataCRDT = PixelDataCRDT;
