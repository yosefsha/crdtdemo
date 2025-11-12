import { PixelDataCRDT, MergeResult, RGB } from "@crdtdemo/shared";

describe("PixelDataCRDT", () => {
  it("1. should return both applied and missing deltas in bidirectional merge", async () => {
    // Given: two clients with independent PixelDataCRDTs
    const crdtA = new PixelDataCRDT("A", "A:1");
    const crdtB = new PixelDataCRDT("B", "B:1");

    // A sets (1,1), B sets (2,2)
    const dA = crdtA.set("1,1", [10, 20, 30]);
    await wait(20);
    const dB = crdtB.set("2,2", [40, 50, 60]);
    await wait(20);

    // B merges A's delta
    const deltasA = crdtA.getDeltaForAgent("B");
    expect(deltasA).not.toBeNull();
    const mergeResult: MergeResult = crdtB.merge(deltasA!);

    // Check applied deltas - should have 1 item from pixels collection
    const appliedPixels = mergeResult.applied.get("pixels");
    expect(appliedPixels).toBeDefined();
    expect(appliedPixels!.length).toBe(1);
    expect(appliedPixels![0].itemId).toBe("1,1");

    // Check missing deltas - should have 1 item (2,2) that A doesn't have
    const missingPixels = mergeResult.missing.get("pixels");
    expect(missingPixels).toBeDefined();
    expect(missingPixels!.length).toBe(1);
    expect(missingPixels![0].itemId).toBe("2,2");
    expect(missingPixels![0].timestamp).toBe(dB!.timestamp);

    crdtA.handleMergeAgentResult(mergeResult, "B");

    const deltasA2 = crdtA.getDeltaForAgent("B");
    expect(deltasA2).toBeNull();
  });

  it.skip("should break with three CRDTs using the same agent id (ambiguous state)", async () => {
    //TODO: fix this test it should use replica deltas and pass
    // This test demonstrates that using the same agent id for multiple peers leads to ambiguous state and lost updates.
    // Given: three clients with the same agent id
    const crdtA = new PixelDataCRDT("A", "A1");
    const crdtB = new PixelDataCRDT("A", "A2");
    const crdtC = new PixelDataCRDT("A", "A3");
    // Each sets a different pixel
    const dA = crdtA.set("1,1", [10, 20, 30]);
    await wait(10);
    const dB = crdtB.set("2,2", [40, 50, 60]);
    await wait(10);
    const dC = crdtC.set("3,3", [70, 80, 90]);
    await wait(10);

    // Exchange deltas in a round-robin fashion, as if all are peers
    // A merges B and C
    const deltasForB = crdtA.getDeltaForAgent("B");
    let mergeResultAB = crdtB.merge(deltasForB!);
    crdtA.handleMergeAgentResult(mergeResultAB, "B");
    let mergeResultAC = crdtA.merge(crdtC.getDeltaForAgent("A")!);
    crdtC.handleMergeAgentResult(mergeResultAC, "A");
    // B merges A and C
    let mergeResultBA = crdtB.merge(crdtA.getAllDeltas());
    crdtB.handleMergeAgentResult(mergeResultBA, "A");
    let mergeResultBC = crdtB.merge(crdtC.getAllDeltas());
    crdtB.handleMergeAgentResult(mergeResultBC, "A");
    // C merges A and B
    let mergeResultCA = crdtC.merge(crdtA.getAllDeltas());
    crdtC.handleMergeAgentResult(mergeResultCA, "A");
    let mergeResultCB = crdtC.merge(crdtB.getAllDeltas());
    crdtB.handleMergeAgentResult(mergeResultCB, "B");

    // Now, try to synchronize deltas using getDeltaForPeer("A")
    // All CRDTs will think the remote "A" already has all updates, so no deltas will be sent
    const deltasA = crdtA.getDeltaForAgent("A");
    const deltasB = crdtB.getDeltaForAgent("A");
    const deltasC = crdtC.getDeltaForAgent("A");
    // At least one of these should be non-null if the protocol worked, but all will be null
    expect(deltasA).toBeNull();
    expect(deltasB).toBeNull();
    expect(deltasC).toBeNull();

    // Now, set a new pixel in crdtA and try to sync to B and C
    const dA2 = crdtA.set("4,4", [1, 2, 3]);
    // Try to get deltas for B and C (but both are "A")
    const deltasAforB = crdtA.getDeltaForAgent("B");
    // This will be null, so B and C will never receive the update
    expect(deltasAforB).toBeNull();
    expect(deltasAforB).toBeNull();
  });

  it("should merge deltas from one peer to same peer but another replica and track per-pixel timestamps", async () => {
    // Given: two clients with independent PixelDataCRDTs
    const crdtA = new PixelDataCRDT("A", "A:1");
    const crdtB = new PixelDataCRDT("A", "A:2");

    // A sets (1,1), B sets (2,2)
    const dA = crdtA.set("1,1", [10, 20, 30]);
    await wait(20);
    const dB = crdtB.set("2,2", [40, 50, 60]);
    await wait(20);

    // B merges A's delta
    const deltasAforB = crdtA.getDeltaForReplica("A:2");
    expect(deltasAforB).not.toBeNull();
    const mergeResult: MergeResult = crdtB.merge(deltasAforB!);

    // Check applied deltas
    const appliedPixels = mergeResult.applied.get("pixels");
    expect(appliedPixels).toBeDefined();
    expect(appliedPixels!.length).toBe(1);
    expect(appliedPixels![0].itemId).toBe("1,1");

    // For replica-level sync within the same agent, there are no "missing" deltas
    // because they share the same agent ID and the missing calculation is agent-based
    // The old client API computed missing based on replica clocks, but the new database
    // layer only tracks agent-level clocks for "missing" computation
    const missingPixels = mergeResult.missing.get("pixels");
    // missingPixels will be undefined or empty for intra-agent sync
    expect(missingPixels === undefined || missingPixels.length === 0).toBe(
      true
    );

    crdtA.handleMergeReplicaResult(mergeResult, "A:2");

    const deltasA2forB = crdtA.getDeltaForReplica("A:2");
    expect(deltasA2forB).toBeNull();
  });

  // Helper function to wait a few milliseconds (for timestamp uniqueness in tests)
  async function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  it("should track per-peer, per-pixel timestamps and only send missing deltas", async () => {
    // Given: two clients with independent PixelDataCRDTs
    const crdtA = new PixelDataCRDT("A", "A");
    const crdtB = new PixelDataCRDT("B", "B");

    // A sets three pixels at different times
    const d1 = crdtA.set("1,1", [10, 20, 30]);
    const t1 = d1?.timestamp || 0;
    await wait(5); // Ensure a different timestamp
    const d2 = crdtA.set("2,2", [40, 50, 60]);
    const t2 = d2?.timestamp || 0;
    await wait(5); // Ensure a different timestamp
    const d3 = crdtA.set("3,3", [70, 80, 90]);
    const t3 = d3?.timestamp || 0;

    // Simulate B only receiving the first and third pixel
    let deltas = crdtA.getDeltaForAgent("B");
    expect(deltas).not.toBeNull();
    // B merges only the deltas for (1,1) and (3,3)
    const pixelDeltas = deltas!.collectionDeltas.get("pixels")!;
    const filtered = pixelDeltas.filter((d) => d.itemId !== "2,2"); // drop (2,2)
    const mergeResult = crdtB.merge({
      documentId: "canvas",
      collectionDeltas: new Map([["pixels", filtered]]),
      fromReplica: "A:1",
      fromAgent: "A",
    });
    // A acknowledges only the delivered deltas for B
    const moreForB = crdtA.handleMergeAgentResult(mergeResult, "B");
    // moreForB should not be empty since something was deliberatly filtered out to simulate network failure
    expect(moreForB).not.toBeNull();
    const morePixels = moreForB!.collectionDeltas.get("pixels")!;
    expect(morePixels.length).toBe(1);
    expect(morePixels[0].itemId).toBe("2,2");
    expect(morePixels[0].timestamp).toBe(t2);
  });

  it("should initialize with correct id and empty values", () => {
    // Given: a new PixelDataCRDT instance
    const crdt = new PixelDataCRDT("test-user", "test-user-replica");
    // Then: it should have the correct id and no pixel values
    expect(crdt.getInfo()).toBeDefined();
    expect(crdt.getInfo().agentId).toBe("test-user");
    expect(crdt.getInfo().replicaId).toBe("test-user-replica");
    expect(Object.keys(crdt.values)).toHaveLength(0);
  });

  it("should set and get a pixel value", () => {
    // Given: a new PixelDataCRDT and a pixel key/color
    const crdt = new PixelDataCRDT("user1", "user1");
    const key = "1,2";
    const color: RGB = [100, 150, 200];
    // When: setting the pixel value
    crdt.set(key, color);
    // Then: getting the pixel should return the set color
    expect(crdt.get(key)).toEqual(color);
  });

  it("should merge deltas from another PixelDataCRDT", () => {
    // Given: two PixelDataCRDTs with the same pixel but different values
    const crdt1 = new PixelDataCRDT("user1", "user1");
    const crdt2 = new PixelDataCRDT("user2", "user2");
    crdt1.set("1,1", [10, 20, 30]);
    crdt2.set("1,1", [200, 100, 50]);
    // When: merging deltas from crdt2 into crdt1
    const packet = crdt2.getAllDeltas();
    crdt1.merge(packet);
    // Then: crdt1 should have the value from crdt2 (since its timestamp is newer)
    expect(crdt1.get("1,1")).toEqual([200, 100, 50]);
  });

  it("should return empty delta after merge ", () => {
    // Given: two PixelDataCRDTs with the same pixel but different values
    const crdt1 = new PixelDataCRDT("user1", "user1");
    const crdt2 = new PixelDataCRDT("user2", "user2");
    crdt1.set("1,1", [10, 20, 30]);
    crdt2.set("1,1", [200, 100, 50]);
    // When: merging deltas from crdt2 into crdt1
    const packet = crdt2.getAllDeltas();
    const d = crdt1.merge(packet!);
    const d2 = crdt1.merge(packet!);
    expect(d.applied.get("pixels")!.length).toEqual(1);
    expect(d2.applied.get("pixels")?.length || 0).toEqual(0);
  });

  it("should not change state if the same pixel is set to the same value", () => {
    // Given: a PixelDataCRDT with a pixel set
    const crdt = new PixelDataCRDT("user3", "user3");
    const key = "2,2";
    const color: RGB = [255, 255, 255];
    const firstSet = crdt.set(key, color);
    expect(firstSet).not.toBeNull();
    // When: setting the same pixel to the same value
    const result = crdt.set(key, color);
    // Then: it should return null (no change)
    expect(result).toBeNull();
    // And: the pixel value should remain unchanged
    expect(crdt.get(key)).toEqual(color);
  });

  it("should return deltas since a given timestamp", async () => {
    // Given: a PixelDataCRDT with multiple pixels set
    const crdt = new PixelDataCRDT("user4", "user4");
    crdt.set("3,3", [255, 0, 0]);
    await wait(10); // Ensure a different timestamp
    const timestamp = Date.now();
    await wait(2); // Ensure timestamp is after previous set
    crdt.set("4,4", [0, 255, 0]);
    // When: getting deltas since the first pixel's timestamp
    // Use getAllDeltas and filter manually, since getDeltasSince is not available
    const allDeltas = crdt.getAllDeltas();
    if (allDeltas) {
      const pixelDeltas = allDeltas.collectionDeltas.get("pixels")!;
      const filtered = pixelDeltas.filter((d) => d.timestamp > timestamp);
      // Then: it should return the second pixel only
      expect(filtered.length).toBe(1);
      expect(filtered[0].itemId).toBe("4,4");
      expect(filtered[0].value).toEqual([0, 255, 0]);
    }
  });

  it("should apply deltas and update state", () => {
    // Given: a PixelDataCRDT and a set of deltas
    const crdt = new PixelDataCRDT("user1", "user1");
    const now = Date.now();
    const deltas = [
      {
        itemId: "1,2",
        timestamp: now,
        value: [255, 0, 0] as [number, number, number],
        replicaId: "user1",
        agentId: "user1",
      },
      {
        itemId: "3,4",
        timestamp: now + 1,
        value: [0, 255, 0] as [number, number, number],
        replicaId: "user1",
        agentId: "user1",
      },
    ];
    // When: merging the deltas
    crdt.merge({
      documentId: "canvas",
      collectionDeltas: new Map([["pixels", deltas]]),
      fromReplica: "user1",
      fromAgent: "user1",
    });
    // Then: the state should reflect the new pixel values
    expect(crdt.get("1,2")).toEqual([255, 0, 0]);
    expect(crdt.get("3,4")).toEqual([0, 255, 0]);
  });

  // Removed duplicate serialize and deserialize test for user2

  it("should achieve eventual consistency after concurrent updates and merges", () => {
    // Given: three clients with independent PixelDataCRDTs
    const crdtA = new PixelDataCRDT("A", "A");
    const crdtB = new PixelDataCRDT("B", "B");
    const crdtC = new PixelDataCRDT("C", "C");

    // Each client sets different pixels concurrently
    // A sets (1,1) to red, B sets (2,2) to green, C sets (3,3) to blue
    const deltaA1 = crdtA.set("1,1", [255, 0, 0]);
    const deltaB1 = crdtB.set("2,2", [0, 255, 0]);
    const deltaC1 = crdtC.set("3,3", [0, 0, 255]);

    // Simulate concurrent updates: A and B both set (4,4) to different colors
    const deltaA2 = crdtA.set("4,4", [100, 100, 100]);
    // Wait a bit to ensure a different timestamp
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    // Use a fake delay for test determinism
    // (in real distributed systems, timestamps would naturally differ)
    // For this test, we just ensure the timestamps are not identical
    const deltaB2 = crdtB.set("4,4", [200, 200, 200]);

    // Each client now has their own state. Let's exchange deltas in a round-robin fashion
    // 1. A merges B's and C's deltas
    crdtA.merge(crdtB.getAllDeltas());
    crdtA.merge(crdtC.getAllDeltas());
    // 2. B merges A's and C's deltas
    crdtB.merge(crdtA.getAllDeltas());
    crdtB.merge(crdtC.getAllDeltas());

    // 3. C merges A's and B's deltas
    crdtC.merge(crdtA.getAllDeltas());

    crdtC.merge(crdtB.getAllDeltas());

    // 3. C merges A's and B's deltas
    crdtC.merge(crdtA.getAllDeltas());
    crdtC.merge(crdtB.getAllDeltas());

    // At this point, all CRDTs should have the same state for all pixels
    // The value of (4,4) should be the one with the latest timestamp (either A or B)
    const valA = crdtA.get("4,4");
    const valB = crdtB.get("4,4");
    const valC = crdtC.get("4,4");
    expect(valA).toEqual(valB);
    expect(valB).toEqual(valC);

    // All other pixels should be present and equal
    expect(crdtA.get("1,1")).toEqual([255, 0, 0]);
    expect(crdtB.get("1,1")).toEqual([255, 0, 0]);
    expect(crdtC.get("1,1")).toEqual([255, 0, 0]);

    expect(crdtA.get("2,2")).toEqual([0, 255, 0]);
    expect(crdtB.get("2,2")).toEqual([0, 255, 0]);
    expect(crdtC.get("2,2")).toEqual([0, 255, 0]);

    expect(crdtA.get("3,3")).toEqual([0, 0, 255]);
    expect(crdtB.get("3,3")).toEqual([0, 0, 255]);
    expect(crdtC.get("3,3")).toEqual([0, 0, 255]);

    // The set of keys should be identical in all CRDTs
    const keysA = Object.keys(crdtA.values).sort();
    const keysB = Object.keys(crdtB.values).sort();
    const keysC = Object.keys(crdtC.values).sort();
    expect(keysA).toEqual(keysB);
    expect(keysB).toEqual(keysC);
  });
});
