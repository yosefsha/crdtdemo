"use strict";
/**
 * Tests for Document.acknowledgeReplicaMerge
 * This tests the critical logic that tracks what each replica has seen
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Document_1 = require("../database/Document");
describe("Document.acknowledgeReplicaMerge", () => {
    let doc;
    const replicaId = "client_replica";
    beforeEach(() => {
        doc = new Document_1.Document("doc1");
    });
    describe("Initial replica sync", () => {
        it("should mark replica as known after first acknowledgment", () => {
            // Add some items to the document
            const collection = doc.getCollection("pixels");
            collection.setItem("1,1", "ff0000ff", 100, "user1", "server");
            collection.setItem("2,2", "00ff00ff", 101, "user1", "server");
            // First getDeltasForReplica should return ALL deltas (new replica)
            const deltas1 = doc.getDeltasForReplica(replicaId);
            expect(deltas1).not.toBeNull();
            expect(deltas1?.collectionDeltas["pixels"]).toHaveLength(2);
            // Acknowledge that replica received these deltas
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: deltas1.collectionDeltas,
                missing: {},
            });
            // Second getDeltasForReplica should return NOTHING (no new data)
            const deltas2 = doc.getDeltasForReplica(replicaId);
            expect(deltas2).toBeNull();
        });
        it("should handle empty acknowledgment gracefully", () => {
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: {},
                missing: {},
            });
            // Should not crash, replica should be tracked
            const deltas = doc.getDeltasForReplica(replicaId);
            expect(deltas).toBeNull(); // No data yet
        });
    });
    describe("Incremental sync", () => {
        it("should track acknowledged items and return only new deltas", () => {
            const collection = doc.getCollection("pixels");
            // Add initial items
            collection.setItem("1,1", "ff0000ff", 100, "user1", "server");
            collection.setItem("2,2", "00ff00ff", 101, "user1", "server");
            // Replica gets initial sync
            const deltas1 = doc.getDeltasForReplica(replicaId);
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: deltas1.collectionDeltas,
                missing: {},
            });
            // Add NEW items
            collection.setItem("3,3", "0000ffff", 102, "user1", "server");
            // Replica should get ONLY the new item
            const deltas2 = doc.getDeltasForReplica(replicaId);
            expect(deltas2).not.toBeNull();
            expect(deltas2?.collectionDeltas["pixels"]).toHaveLength(1);
            expect(deltas2?.collectionDeltas["pixels"][0].itemId).toBe("3,3");
        });
        it("should handle partial acknowledgment (some items applied)", () => {
            const collection = doc.getCollection("pixels");
            collection.setItem("1,1", "ff0000ff", 100, "user1", "server");
            collection.setItem("2,2", "00ff00ff", 101, "user1", "server");
            collection.setItem("3,3", "0000ffff", 102, "user1", "server");
            const allDeltas = doc.getDeltasForReplica(replicaId);
            // Acknowledge only 2 out of 3 items
            const partialApplied = {
                pixels: allDeltas.collectionDeltas["pixels"].slice(0, 2),
            };
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: partialApplied,
                missing: {},
            });
            // Should return only the unacknowledged item
            const remaining = doc.getDeltasForReplica(replicaId);
            expect(remaining).not.toBeNull();
            expect(remaining?.collectionDeltas["pixels"]).toHaveLength(1);
            expect(remaining?.collectionDeltas["pixels"][0].itemId).toBe("3,3");
        });
    });
    describe("Multiple collections", () => {
        it("should track acknowledgments per collection", () => {
            const pixels = doc.getCollection("pixels");
            const metadata = doc.getCollection("metadata");
            pixels.setItem("1,1", "ff0000ff", 100, "user1", "server");
            metadata.setItem("meta1", "value1", 100, "user1", "server");
            const deltas = doc.getDeltasForReplica(replicaId);
            // Acknowledge only pixels, not metadata
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: {
                    pixels: deltas.collectionDeltas["pixels"],
                },
                missing: {},
            });
            // Should return only metadata
            const remaining = doc.getDeltasForReplica(replicaId);
            expect(remaining).not.toBeNull();
            expect(remaining?.collectionDeltas["pixels"]).toBeUndefined();
            expect(remaining?.collectionDeltas["metadata"]).toHaveLength(1);
        });
    });
    describe("Timestamp tracking", () => {
        it("should update to highest timestamp when acknowledging", () => {
            const collection = doc.getCollection("pixels");
            // Add item with timestamp 100
            collection.setItem("1,1", "ff0000ff", 100, "user1", "server");
            const deltas1 = doc.getDeltasForReplica(replicaId);
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: deltas1.collectionDeltas,
                missing: {},
            });
            // Update SAME item with higher timestamp
            collection.setItem("1,1", "00ff00ff", 200, "user1", "server");
            // Should return the updated item
            const deltas2 = doc.getDeltasForReplica(replicaId);
            expect(deltas2).not.toBeNull();
            expect(deltas2?.collectionDeltas["pixels"]).toHaveLength(1);
            expect(deltas2?.collectionDeltas["pixels"][0].timestamp).toBe(200);
        });
        it("should not return items with lower timestamps", () => {
            const collection = doc.getCollection("pixels");
            // Add item with timestamp 200
            collection.setItem("1,1", "ff0000ff", 200, "user1", "server");
            const deltas = doc.getDeltasForReplica(replicaId);
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: deltas.collectionDeltas,
                missing: {},
            });
            // Manually set item with LOWER timestamp (shouldn't happen in practice)
            collection.setItem("1,1", "00ff00ff", 100, "user1", "server");
            // Should NOT return the item (timestamp 100 < 200)
            const deltas2 = doc.getDeltasForReplica(replicaId);
            expect(deltas2).toBeNull();
        });
    });
    describe("Missing deltas acknowledgment", () => {
        it("should also acknowledge missing deltas (what replica sent)", () => {
            const collection = doc.getCollection("pixels");
            // Initial sync
            collection.setItem("1,1", "ff0000ff", 100, "user1", "server");
            const deltas = doc.getDeltasForReplica(replicaId);
            // Simulate replica sending us data we don't have (missing)
            const missingDeltas = [
                {
                    itemId: "2,2",
                    value: "00ff00ff",
                    timestamp: 101,
                    replicaId: replicaId,
                    agentId: "user1",
                },
            ];
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: deltas.collectionDeltas,
                missing: {
                    pixels: missingDeltas,
                },
            });
            // Replica should have both applied AND missing items acknowledged
            // If we add item 2,2 with same timestamp, it shouldn't be returned
            collection.setItem("2,2", "00ff00ff", 101, "user1", "server");
            const newDeltas = doc.getDeltasForReplica(replicaId);
            expect(newDeltas).toBeNull(); // Already acknowledged via missing
        });
    });
    describe("Batched acknowledgments", () => {
        it("should accumulate acknowledgments across multiple calls", () => {
            const collection = doc.getCollection("pixels");
            // Add 6 items
            for (let i = 1; i <= 6; i++) {
                collection.setItem(`${i},${i}`, "ff0000ff", 100 + i, "user1", "server");
            }
            const allDeltas = doc.getDeltasForReplica(replicaId);
            expect(allDeltas?.collectionDeltas["pixels"]).toHaveLength(6);
            // Acknowledge in 3 batches of 2 items each
            const deltas = allDeltas.collectionDeltas["pixels"];
            // Batch 1: items 1-2
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: { pixels: deltas.slice(0, 2) },
                missing: {},
            });
            // Batch 2: items 3-4
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: { pixels: deltas.slice(2, 4) },
                missing: {},
            });
            // Batch 3: items 5-6
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: { pixels: deltas.slice(4, 6) },
                missing: {},
            });
            // All items should be acknowledged
            const remaining = doc.getDeltasForReplica(replicaId);
            expect(remaining).toBeNull();
        });
        it("should handle duplicate acknowledgments (idempotent)", () => {
            const collection = doc.getCollection("pixels");
            collection.setItem("1,1", "ff0000ff", 100, "user1", "server");
            const deltas = doc.getDeltasForReplica(replicaId);
            // Acknowledge twice (simulating duplicate/retry)
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: deltas.collectionDeltas,
                missing: {},
            });
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: deltas.collectionDeltas,
                missing: {},
            });
            // Should still work correctly (idempotent)
            const remaining = doc.getDeltasForReplica(replicaId);
            expect(remaining).toBeNull();
        });
    });
    describe("Edge cases", () => {
        it("should handle acknowledgment before any data exists", () => {
            // Acknowledge when document is empty
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: {},
                missing: {},
            });
            const deltas = doc.getDeltasForReplica(replicaId);
            expect(deltas).toBeNull();
        });
        it("should handle acknowledgment with non-existent collection", () => {
            // Acknowledge a collection that doesn't exist
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: {
                    nonexistent: [],
                },
                missing: {},
            });
            // Should not crash
            const deltas = doc.getDeltasForReplica(replicaId);
            expect(deltas).toBeNull();
        });
        it("should handle large number of items", () => {
            const collection = doc.getCollection("pixels");
            // Add 1000 items
            const items = [];
            for (let i = 0; i < 1000; i++) {
                collection.setItem(`${i},${i}`, "ff0000ff", 100 + i, "user1", "server");
            }
            const deltas = doc.getDeltasForReplica(replicaId);
            expect(deltas?.collectionDeltas["pixels"]).toHaveLength(1000);
            doc.acknowledgeReplicaMerge(replicaId, {
                applied: deltas.collectionDeltas,
                missing: {},
            });
            const remaining = doc.getDeltasForReplica(replicaId);
            expect(remaining).toBeNull();
        });
    });
});
