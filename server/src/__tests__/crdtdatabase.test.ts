// Tests for the new CRDTDatabase layer
// Testing multi-agent synchronization scenarios

import { CRDTDatabase, DocumentDeltaPacket } from "@crdtdemo/shared";

describe("CRDTDatabase Layer", () => {
  describe("Basic Operations", () => {
    test("should create a CRDTDatabase instance", () => {
      const db = new CRDTDatabase("agent1", "replica1");
      const info = db.getInfo();

      expect(info.agentId).toBe("agent1");
      expect(info.replicaId).toBe("replica1");
    });

    test("should set and get an item", () => {
      const db = new CRDTDatabase("agent1", "replica1");

      // Set an item
      const delta = db.setItem("doc1", "collection1", "item1", {
        data: "value1",
      });

      expect(delta).not.toBeNull();
      expect(delta?.itemId).toBe("item1");
      expect(delta?.value).toEqual({ data: "value1" });

      // Get the item back
      const value = db.getItem("doc1", "collection1", "item1");
      expect(value).toEqual({ data: "value1" });
    });

    test("should handle multiple items in a collection", () => {
      const db = new CRDTDatabase("agent1", "replica1");

      db.setItem("doc1", "collection1", "item1", "value1");
      db.setItem("doc1", "collection1", "item2", "value2");
      db.setItem("doc1", "collection1", "item3", "value3");

      expect(db.getItem("doc1", "collection1", "item1")).toBe("value1");
      expect(db.getItem("doc1", "collection1", "item2")).toBe("value2");
      expect(db.getItem("doc1", "collection1", "item3")).toBe("value3");
    });

    test("should handle multiple collections in a document", () => {
      const db = new CRDTDatabase("agent1", "replica1");

      db.setItem("doc1", "users", "user1", { name: "Alice" });
      db.setItem("doc1", "posts", "post1", { title: "Hello" });

      expect(db.getItem("doc1", "users", "user1")).toEqual({ name: "Alice" });
      expect(db.getItem("doc1", "posts", "post1")).toEqual({ title: "Hello" });
    });

    test("should handle multiple documents", () => {
      const db = new CRDTDatabase("agent1", "replica1");

      db.setItem("doc1", "collection1", "item1", "doc1-value");
      db.setItem("doc2", "collection1", "item1", "doc2-value");

      expect(db.getItem("doc1", "collection1", "item1")).toBe("doc1-value");
      expect(db.getItem("doc2", "collection1", "item1")).toBe("doc2-value");
    });
  });

  describe("Two-Database Synchronization", () => {
    test("Scenario 1: One database adds data, then syncs to empty database", () => {
      // Create two database instances
      const dbA = new CRDTDatabase("agentA", "replicaA");
      const dbB = new CRDTDatabase("agentB", "replicaB");

      // Step 1: Add data to dbA
      dbA.setItem("doc1", "pixels", "0,0", { r: 255, g: 0, b: 0 });
      dbA.setItem("doc1", "pixels", "0,1", { r: 0, g: 255, b: 0 });
      dbA.setItem("doc1", "pixels", "1,0", { r: 0, g: 0, b: 255 });

      // Verify dbA has the data
      expect(dbA.getItem("doc1", "pixels", "0,0")).toEqual({
        r: 255,
        g: 0,
        b: 0,
      });
      expect(dbA.getItem("doc1", "pixels", "0,1")).toEqual({
        r: 0,
        g: 255,
        b: 0,
      });
      expect(dbA.getItem("doc1", "pixels", "1,0")).toEqual({
        r: 0,
        g: 0,
        b: 255,
      });

      // Verify dbB is empty
      expect(dbB.getItem("doc1", "pixels", "0,0")).toBeNull();

      // Step 2: Sync from dbA to dbB
      // Get deltas from dbA for agentB (what agentB doesn't have)
      const deltasForB = dbA.getDeltasForAgent("doc1", "agentB");
      expect(deltasForB).not.toBeNull();
      expect(
        Object.keys(deltasForB?.collectionDeltas || {}).length
      ).toBeGreaterThan(0);

      // Apply deltas to dbB
      if (deltasForB) {
        const mergeResult = dbB.mergeDocument(deltasForB);
        // dbA acknowledges that dbB received the deltas
        dbA.acknowledgeMerge("doc1", "agentB", mergeResult);
        // dbA acknowledges that dbB received the deltas
        dbA.acknowledgeMerge("doc1", "agentB", mergeResult);

        // Check that all deltas were applied
        const pixelDeltas = mergeResult.applied["pixels"];
        expect(pixelDeltas).toBeDefined();
        expect(pixelDeltas?.length).toBe(3);
      }

      // Verify dbB now has the data
      expect(dbB.getItem("doc1", "pixels", "0,0")).toEqual({
        r: 255,
        g: 0,
        b: 0,
      });
      expect(dbB.getItem("doc1", "pixels", "0,1")).toEqual({
        r: 0,
        g: 255,
        b: 0,
      });
      expect(dbB.getItem("doc1", "pixels", "1,0")).toEqual({
        r: 0,
        g: 0,
        b: 255,
      });

      // Step 3: Verify no more deltas needed (databases are in sync)
      const deltasForB2 = dbA.getDeltasForAgent("doc1", "agentB");
      expect(deltasForB2).toBeNull(); // No more deltas to send
    });

    test("Scenario 2: Both databases add data, then sync bidirectionally", () => {
      // Create two database instances
      const dbA = new CRDTDatabase("agentA", "replicaA");
      const dbB = new CRDTDatabase("agentB", "replicaB");

      // Step 1: Both add different data
      // dbA adds red pixels
      dbA.setItem("doc1", "pixels", "0,0", { r: 255, g: 0, b: 0 });
      dbA.setItem("doc1", "pixels", "0,1", { r: 255, g: 0, b: 0 });

      // dbB adds blue pixels
      dbB.setItem("doc1", "pixels", "1,0", { r: 0, g: 0, b: 255 });
      dbB.setItem("doc1", "pixels", "1,1", { r: 0, g: 0, b: 255 });

      // Step 2: Sync A → B
      const deltasAtoB = dbA.getDeltasForAgent("doc1", "agentB");
      expect(deltasAtoB).not.toBeNull();

      if (deltasAtoB) {
        const mergeResultB = dbB.mergeDocument(deltasAtoB);
        dbA.acknowledgeMerge("doc1", "agentB", {
          applied: {},
          missing: {},
        });
        // dbA acknowledges that dbB received the deltas
        dbA.acknowledgeMerge("doc1", "agentB", mergeResultB);
        dbA.acknowledgeMerge("doc1", "agentB", {
          applied: {},
          missing: {},
        });
        // dbA acknowledges that dbB received the deltas
        dbA.acknowledgeMerge("doc1", "agentB", mergeResultB);
        const appliedToB = mergeResultB.applied["pixels"];
        expect(appliedToB?.length).toBe(2); // 2 red pixels applied to B

        // Check missing deltas (what A doesn't have from B)
        const missingAtA = mergeResultB.missing["pixels"];
        expect(missingAtA?.length).toBe(2); // 2 blue pixels that A is missing
      }

      // Step 3: Sync B → A
      const deltasBtoA = dbB.getDeltasForAgent("doc1", "agentA");
      expect(deltasBtoA).not.toBeNull();

      if (deltasBtoA) {
        const mergeResultA = dbA.mergeDocument(deltasBtoA);
        dbB.acknowledgeMerge("doc1", "agentA", {
          applied: {},
          missing: {},
        });
        // dbB acknowledges that dbA received the deltas
        dbB.acknowledgeMerge("doc1", "agentA", mergeResultA);
        dbB.acknowledgeMerge("doc1", "agentA", {
          applied: {},
          missing: {},
        });
        // dbB acknowledges that dbA received the deltas
        dbB.acknowledgeMerge("doc1", "agentA", mergeResultA);
        const appliedToA = mergeResultA.applied["pixels"];
        expect(appliedToA?.length).toBe(2); // 2 blue pixels applied to A
      }

      // Step 4: Verify both databases have all data
      // dbA should have all 4 pixels
      expect(dbA.getItem("doc1", "pixels", "0,0")).toEqual({
        r: 255,
        g: 0,
        b: 0,
      });
      expect(dbA.getItem("doc1", "pixels", "0,1")).toEqual({
        r: 255,
        g: 0,
        b: 0,
      });
      expect(dbA.getItem("doc1", "pixels", "1,0")).toEqual({
        r: 0,
        g: 0,
        b: 255,
      });
      expect(dbA.getItem("doc1", "pixels", "1,1")).toEqual({
        r: 0,
        g: 0,
        b: 255,
      });

      // dbB should have all 4 pixels
      expect(dbB.getItem("doc1", "pixels", "0,0")).toEqual({
        r: 255,
        g: 0,
        b: 0,
      });
      expect(dbB.getItem("doc1", "pixels", "0,1")).toEqual({
        r: 255,
        g: 0,
        b: 0,
      });
      expect(dbB.getItem("doc1", "pixels", "1,0")).toEqual({
        r: 0,
        g: 0,
        b: 255,
      });
      expect(dbB.getItem("doc1", "pixels", "1,1")).toEqual({
        r: 0,
        g: 0,
        b: 255,
      });

      // Step 5: Verify no more deltas needed (both in sync)
      const noMoreDeltasAtoB = dbA.getDeltasForAgent("doc1", "agentB");
      const noMoreDeltasBtoA = dbB.getDeltasForAgent("doc1", "agentA");

      expect(noMoreDeltasAtoB).toBeNull();
      expect(noMoreDeltasBtoA).toBeNull();
    });

    test("Scenario 3: Concurrent updates to same item (Last-Write-Wins)", () => {
      const dbA = new CRDTDatabase("agentA", "replicaA");
      const dbB = new CRDTDatabase("agentB", "replicaB");

      // Both databases update the same item concurrently
      // Simulate by setting without sync
      dbA.setItem("doc1", "config", "theme", "dark");

      // Small delay to ensure different timestamps
      // In real scenario, these would happen at different times
      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      return delay(10).then(() => {
        dbB.setItem("doc1", "config", "theme", "light");

        // Sync A → B
        const deltasAtoB = dbA.getDeltasForAgent("doc1", "agentB");
        if (deltasAtoB) {
          dbB.mergeDocument(deltasAtoB);
          dbA.acknowledgeMerge("doc1", "agentB", {
            applied: {},
            missing: {},
          });
          dbA.acknowledgeMerge("doc1", "agentB", {
            applied: {},
            missing: {},
          });
        }

        // Sync B → A
        const deltasBtoA = dbB.getDeltasForAgent("doc1", "agentA");
        if (deltasBtoA) {
          dbA.mergeDocument(deltasBtoA);
          dbB.acknowledgeMerge("doc1", "agentA", {
            applied: {},
            missing: {},
          });
          dbB.acknowledgeMerge("doc1", "agentA", {
            applied: {},
            missing: {},
          });
        }

        // Last write wins - should be "light" (written later)
        const finalValueA = dbA.getItem("doc1", "config", "theme");
        const finalValueB = dbB.getItem("doc1", "config", "theme");

        expect(finalValueA).toBe(finalValueB); // Both converge to same value
        expect(finalValueA).toBe("light"); // Later write wins
      });
    });
  });

  describe("Serialization and Deserialization", () => {
    test("should serialize and deserialize a database", () => {
      const db1 = new CRDTDatabase("agent1", "replica1");

      // Add some data
      db1.setItem("doc1", "users", "user1", { name: "Alice", age: 30 });
      db1.setItem("doc1", "users", "user2", { name: "Bob", age: 25 });
      db1.setItem("doc1", "posts", "post1", { title: "Hello World" });

      // Serialize
      const json = db1.toJSON();
      expect(json.agentId).toBe("agent1");
      expect(json.replicaId).toBe("replica1");
      expect(json.documents).toBeDefined();

      // Deserialize into new instance
      const db2 = CRDTDatabase.fromJSON(json);
      const info = db2.getInfo();
      expect(info.agentId).toBe("agent1");
      expect(info.replicaId).toBe("replica1");

      // Verify data was preserved
      expect(db2.getItem("doc1", "users", "user1")).toEqual({
        name: "Alice",
        age: 30,
      });
      expect(db2.getItem("doc1", "users", "user2")).toEqual({
        name: "Bob",
        age: 25,
      });
      expect(db2.getItem("doc1", "posts", "post1")).toEqual({
        title: "Hello World",
      });
    });

    test("should maintain sync state after serialization", () => {
      const dbA = new CRDTDatabase("agentA", "replicaA");
      const dbB = new CRDTDatabase("agentB", "replicaB");

      // Add data and sync
      dbA.setItem("doc1", "items", "item1", "value1");
      const deltas = dbA.getDeltasForAgent("doc1", "agentB");
      if (deltas) {
        const mergeResult = dbB.mergeDocument(deltas);
        dbA.acknowledgeMerge("doc1", "agentB", mergeResult);
        dbA.acknowledgeMerge("doc1", "agentB", mergeResult);
      }

      // Serialize and deserialize dbA
      const jsonA = dbA.toJSON();
      const dbA2 = CRDTDatabase.fromJSON(jsonA);

      // Verify no deltas needed (still in sync with B)
      const noMoreDeltas = dbA2.getDeltasForAgent("doc1", "agentB");
      expect(noMoreDeltas).toBeNull();
    });
  });

  describe("Multiple Collections and Documents", () => {
    test("should handle complex multi-document, multi-collection scenario", () => {
      const dbA = new CRDTDatabase("agentA", "replicaA");
      const dbB = new CRDTDatabase("agentB", "replicaB");

      // Document 1: Canvas with pixels
      dbA.setItem("canvas1", "pixels", "0,0", { r: 255, g: 0, b: 0 });
      dbA.setItem("canvas1", "pixels", "0,1", { r: 0, g: 255, b: 0 });

      // Document 2: User profiles
      dbA.setItem("users", "profiles", "alice", {
        name: "Alice",
        online: true,
      });
      dbB.setItem("users", "profiles", "bob", { name: "Bob", online: true });

      // Document 3: Chat messages
      dbA.setItem("chat", "messages", "msg1", { user: "alice", text: "Hello" });
      dbB.setItem("chat", "messages", "msg2", {
        user: "bob",
        text: "Hi there",
      });

      // Sync canvas1 document
      const canvasDeltas = dbA.getDeltasForAgent("canvas1", "agentB");
      if (canvasDeltas) {
        dbB.mergeDocument(canvasDeltas);
      }

      // Sync users document (bidirectional)
      const usersDeltasAtoB = dbA.getDeltasForAgent("users", "agentB");
      if (usersDeltasAtoB) {
        dbB.mergeDocument(usersDeltasAtoB);
      }
      const usersDeltasBtoA = dbB.getDeltasForAgent("users", "agentA");
      if (usersDeltasBtoA) {
        dbA.mergeDocument(usersDeltasBtoA);
      }

      // Sync chat document (bidirectional)
      const chatDeltasAtoB = dbA.getDeltasForAgent("chat", "agentB");
      if (chatDeltasAtoB) {
        dbB.mergeDocument(chatDeltasAtoB);
      }
      const chatDeltasBtoA = dbB.getDeltasForAgent("chat", "agentA");
      if (chatDeltasBtoA) {
        dbA.mergeDocument(chatDeltasBtoA);
      }

      // Verify all data synced correctly
      // Canvas (only A had data)
      expect(dbB.getItem("canvas1", "pixels", "0,0")).toEqual({
        r: 255,
        g: 0,
        b: 0,
      });
      expect(dbB.getItem("canvas1", "pixels", "0,1")).toEqual({
        r: 0,
        g: 255,
        b: 0,
      });

      // Users (both had data)
      expect(dbA.getItem("users", "profiles", "alice")).toEqual({
        name: "Alice",
        online: true,
      });
      expect(dbA.getItem("users", "profiles", "bob")).toEqual({
        name: "Bob",
        online: true,
      });
      expect(dbB.getItem("users", "profiles", "alice")).toEqual({
        name: "Alice",
        online: true,
      });
      expect(dbB.getItem("users", "profiles", "bob")).toEqual({
        name: "Bob",
        online: true,
      });

      // Chat (both had data)
      expect(dbA.getItem("chat", "messages", "msg1")).toEqual({
        user: "alice",
        text: "Hello",
      });
      expect(dbA.getItem("chat", "messages", "msg2")).toEqual({
        user: "bob",
        text: "Hi there",
      });
      expect(dbB.getItem("chat", "messages", "msg1")).toEqual({
        user: "alice",
        text: "Hello",
      });
      expect(dbB.getItem("chat", "messages", "msg2")).toEqual({
        user: "bob",
        text: "Hi there",
      });
    });
  });
});
