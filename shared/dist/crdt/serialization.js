"use strict";
/**
 * Serialization utilities for CRDT types
 * Handles conversion between Map-based types and JSON-serializable formats
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeDeltaPacket = serializeDeltaPacket;
exports.deserializeDeltaPacket = deserializeDeltaPacket;
exports.serializeMergeResult = serializeMergeResult;
exports.deserializeMergeResult = deserializeMergeResult;
/**
 * Convert DocumentDeltaPacket to JSON-serializable format
 */
function serializeDeltaPacket(packet) {
    const collectionDeltas = {};
    packet.collectionDeltas.forEach((deltas, collectionId) => {
        collectionDeltas[collectionId] = deltas;
    });
    return {
        documentId: packet.documentId,
        collectionDeltas,
        fromReplica: packet.fromReplica,
        fromAgent: packet.fromAgent,
    };
}
/**
 * Convert serialized format back to DocumentDeltaPacket
 */
function deserializeDeltaPacket(serialized) {
    const collectionDeltas = new Map();
    Object.entries(serialized.collectionDeltas).forEach(([collectionId, deltas]) => {
        collectionDeltas.set(collectionId, deltas);
    });
    return {
        documentId: serialized.documentId,
        collectionDeltas,
        fromReplica: serialized.fromReplica,
        fromAgent: serialized.fromAgent,
    };
}
/**
 * Convert DocumentMergeResult to JSON-serializable format
 */
function serializeMergeResult(result) {
    const applied = {};
    const missing = {};
    result.applied.forEach((deltas, collectionId) => {
        applied[collectionId] = deltas;
    });
    result.missing.forEach((deltas, collectionId) => {
        missing[collectionId] = deltas;
    });
    return { applied, missing };
}
/**
 * Convert serialized format back to DocumentMergeResult
 */
function deserializeMergeResult(serialized) {
    const applied = new Map();
    const missing = new Map();
    Object.entries(serialized.applied).forEach(([collectionId, deltas]) => {
        applied.set(collectionId, deltas);
    });
    Object.entries(serialized.missing).forEach(([collectionId, deltas]) => {
        missing.set(collectionId, deltas);
    });
    return { applied, missing };
}
