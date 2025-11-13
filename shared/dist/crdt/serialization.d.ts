/**
 * Serialization utilities for CRDT types
 * Handles conversion between Map-based types and JSON-serializable formats
 */
import { DocumentDeltaPacket, DocumentMergeResult } from "./database/Document";
import { CollectionDelta } from "./database/Collection";
/**
 * JSON-serializable format for DocumentDeltaPacket
 * Converts Map to plain object with string keys
 */
export interface SerializedDocumentDeltaPacket<T = any> {
    documentId: string;
    collectionDeltas: Record<string, CollectionDelta<T>[]>;
    fromReplica: string;
    fromAgent: string;
}
/**
 * JSON-serializable format for DocumentMergeResult
 */
export interface SerializedDocumentMergeResult<T = any> {
    applied: Record<string, CollectionDelta<T>[]>;
    missing: Record<string, CollectionDelta<T>[]>;
}
/**
 * Convert DocumentDeltaPacket to JSON-serializable format
 */
export declare function serializeDeltaPacket<T = any>(packet: DocumentDeltaPacket<T>): SerializedDocumentDeltaPacket<T>;
/**
 * Convert serialized format back to DocumentDeltaPacket
 */
export declare function deserializeDeltaPacket<T = any>(serialized: SerializedDocumentDeltaPacket<T>): DocumentDeltaPacket<T>;
/**
 * Convert DocumentMergeResult to JSON-serializable format
 */
export declare function serializeMergeResult<T = any>(result: DocumentMergeResult<T>): SerializedDocumentMergeResult<T>;
/**
 * Convert serialized format back to DocumentMergeResult
 */
export declare function deserializeMergeResult<T = any>(serialized: SerializedDocumentMergeResult<T>): DocumentMergeResult<T>;
//# sourceMappingURL=serialization.d.ts.map