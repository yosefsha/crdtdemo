import { CRDTDatabase } from "@crdtdemo/shared";

// Push all of A's unseen deltas into B and acknowledge on A's side
function syncAtoB(dbA: CRDTDatabase, dbB: CRDTDatabase, docId: string): void {
  const deltas = dbA.getDeltasForAgent(docId, dbB.getInfo().agentId);
  if (deltas) {
    const result = dbB.mergeDocument(deltas);
    dbA.acknowledgeMerge(docId, dbB.getInfo().agentId, result);
  }
}

describe("Three-Agent Sync", () => {
  let dbA: CRDTDatabase;
  let dbB: CRDTDatabase;
  let dbC: CRDTDatabase;

  beforeEach(() => {
    dbA = new CRDTDatabase("agentA", "replicaA");
    dbB = new CRDTDatabase("agentB", "replicaB");
    dbC = new CRDTDatabase("agentC", "replicaC");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── String values ────────────────────────────────────────────────────────

  describe("String values (settings / config)", () => {
    test("chain: A writes, B syncs from A, C syncs from B — C gets A's data without touching A", () => {
      dbA.setItem("doc", "config", "theme", "dark");
      dbA.setItem("doc", "config", "lang", "en");

      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbB, dbC, "doc"); // C learns from B, never from A directly

      expect(dbC.getItem("doc", "config", "theme")).toBe("dark");
      expect(dbC.getItem("doc", "config", "lang")).toBe("en");
      // B has nothing new for C after the sync
      expect(dbB.getDeltasForAgent("doc", "agentC")).toBeNull();
    });

    test("fanout: A writes, B and C each sync independently from A", () => {
      dbA.setItem("doc", "config", "mode", "production");

      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbA, dbC, "doc");

      expect(dbB.getItem("doc", "config", "mode")).toBe("production");
      expect(dbC.getItem("doc", "config", "mode")).toBe("production");
    });

    test("accumulation: A and B write different keys, C syncs from both", () => {
      dbA.setItem("doc", "config", "fontSize", "14px");
      dbB.setItem("doc", "config", "fontFamily", "monospace");

      syncAtoB(dbA, dbC, "doc");
      syncAtoB(dbB, dbC, "doc");

      expect(dbC.getItem("doc", "config", "fontSize")).toBe("14px");
      expect(dbC.getItem("doc", "config", "fontFamily")).toBe("monospace");
    });

    test("LWW: concurrent writes to same key — later timestamp wins on all peers", () => {
      jest.useFakeTimers();

      jest.setSystemTime(1000);
      dbA.setItem("doc", "config", "theme", "dark");

      jest.setSystemTime(2000);
      dbB.setItem("doc", "config", "theme", "light"); // written later — wins

      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbB, dbA, "doc");
      syncAtoB(dbB, dbC, "doc");
      syncAtoB(dbC, dbB, "doc");
      syncAtoB(dbA, dbC, "doc");
      syncAtoB(dbC, dbA, "doc");

      expect(dbA.getItem("doc", "config", "theme")).toBe("light");
      expect(dbB.getItem("doc", "config", "theme")).toBe("light");
      expect(dbC.getItem("doc", "config", "theme")).toBe("light");
    });
  });

  // ─── Number values ────────────────────────────────────────────────────────

  describe("Number values (scores / metrics)", () => {
    test("chain: A records scores, B syncs from A, C syncs from B", () => {
      dbA.setItem("doc", "scores", "alice", 95);
      dbA.setItem("doc", "scores", "bob", 82);

      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbB, dbC, "doc");

      expect(dbC.getItem("doc", "scores", "alice")).toBe(95);
      expect(dbC.getItem("doc", "scores", "bob")).toBe(82);
    });

    test("each agent records their own score, full mesh sync — all see every score", () => {
      dbA.setItem("doc", "scores", "alice", 95);
      dbB.setItem("doc", "scores", "bob", 88);
      dbC.setItem("doc", "scores", "carol", 77);

      syncAtoB(dbA, dbB, "doc"); syncAtoB(dbB, dbA, "doc");
      syncAtoB(dbB, dbC, "doc"); syncAtoB(dbC, dbB, "doc");
      syncAtoB(dbA, dbC, "doc"); syncAtoB(dbC, dbA, "doc");

      for (const db of [dbA, dbB, dbC]) {
        expect(db.getItem("doc", "scores", "alice")).toBe(95);
        expect(db.getItem("doc", "scores", "bob")).toBe(88);
        expect(db.getItem("doc", "scores", "carol")).toBe(77);
      }
    });

    test("LWW: A and C update same score concurrently — higher timestamp wins everywhere", () => {
      jest.useFakeTimers();

      jest.setSystemTime(1000);
      dbA.setItem("doc", "scores", "alice", 70);

      jest.setSystemTime(3000);
      dbC.setItem("doc", "scores", "alice", 99); // later — wins

      syncAtoB(dbA, dbC, "doc"); syncAtoB(dbC, dbA, "doc");
      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbC, dbB, "doc");

      expect(dbA.getItem("doc", "scores", "alice")).toBe(99);
      expect(dbB.getItem("doc", "scores", "alice")).toBe(99);
      expect(dbC.getItem("doc", "scores", "alice")).toBe(99);
    });
  });

  // ─── Object values ────────────────────────────────────────────────────────

  describe("Object values (user profiles)", () => {
    test("each agent writes their own profile, full mesh sync — all have all profiles", () => {
      dbA.setItem("doc", "profiles", "alice", { name: "Alice", status: "online" });
      dbB.setItem("doc", "profiles", "bob",   { name: "Bob",   status: "away"   });
      dbC.setItem("doc", "profiles", "carol", { name: "Carol", status: "offline" });

      syncAtoB(dbA, dbB, "doc"); syncAtoB(dbB, dbA, "doc");
      syncAtoB(dbB, dbC, "doc"); syncAtoB(dbC, dbB, "doc");
      syncAtoB(dbA, dbC, "doc"); syncAtoB(dbC, dbA, "doc");

      for (const db of [dbA, dbB, dbC]) {
        expect(db.getItem("doc", "profiles", "alice")).toEqual({ name: "Alice", status: "online"  });
        expect(db.getItem("doc", "profiles", "bob")).toEqual(  { name: "Bob",   status: "away"    });
        expect(db.getItem("doc", "profiles", "carol")).toEqual({ name: "Carol", status: "offline" });
      }
    });

    test("relay update: A writes profile, B syncs and updates it, C syncs from B — gets B's version", () => {
      jest.useFakeTimers();

      jest.setSystemTime(1000);
      dbA.setItem("doc", "profiles", "alice", { name: "Alice", status: "online" });

      syncAtoB(dbA, dbB, "doc");

      jest.setSystemTime(2000);
      dbB.setItem("doc", "profiles", "alice", { name: "Alice", status: "busy" }); // B updates

      syncAtoB(dbB, dbC, "doc"); // C only ever syncs from B

      expect(dbC.getItem("doc", "profiles", "alice")).toEqual({ name: "Alice", status: "busy" });
    });

    test("concurrent object update — all three converge to the later write", () => {
      jest.useFakeTimers();

      jest.setSystemTime(1000);
      dbA.setItem("doc", "profiles", "alice", { name: "Alice", status: "online" });

      jest.setSystemTime(5000);
      dbC.setItem("doc", "profiles", "alice", { name: "Alice", status: "in-a-meeting" }); // wins

      syncAtoB(dbA, dbB, "doc"); syncAtoB(dbB, dbA, "doc");
      syncAtoB(dbC, dbB, "doc"); syncAtoB(dbB, dbC, "doc");
      syncAtoB(dbA, dbC, "doc"); syncAtoB(dbC, dbA, "doc");

      const expected = { name: "Alice", status: "in-a-meeting" };
      expect(dbA.getItem("doc", "profiles", "alice")).toEqual(expected);
      expect(dbB.getItem("doc", "profiles", "alice")).toEqual(expected);
      expect(dbC.getItem("doc", "profiles", "alice")).toEqual(expected);
    });
  });

  // ─── Pixel colors ─────────────────────────────────────────────────────────

  describe("Pixel colors ({ r, g, b })", () => {
    test("A paints, B syncs and adds more pixels, C syncs from B — C has everything", () => {
      dbA.setItem("doc", "pixels", "0,0", { r: 255, g: 0, b: 0 });
      dbA.setItem("doc", "pixels", "0,1", { r: 255, g: 0, b: 0 });

      syncAtoB(dbA, dbB, "doc");

      dbB.setItem("doc", "pixels", "1,0", { r: 0, g: 0, b: 255 });
      dbB.setItem("doc", "pixels", "1,1", { r: 0, g: 0, b: 255 });

      syncAtoB(dbB, dbC, "doc"); // C gets A's pixels relayed through B, plus B's own

      expect(dbC.getItem("doc", "pixels", "0,0")).toEqual({ r: 255, g: 0, b: 0 });
      expect(dbC.getItem("doc", "pixels", "0,1")).toEqual({ r: 255, g: 0, b: 0 });
      expect(dbC.getItem("doc", "pixels", "1,0")).toEqual({ r: 0, g: 0, b: 255 });
      expect(dbC.getItem("doc", "pixels", "1,1")).toEqual({ r: 0, g: 0, b: 255 });
    });

    test("each agent paints a separate region, full mesh sync — all see the complete canvas", () => {
      dbA.setItem("doc", "pixels", "0,0", { r: 255, g: 0,   b: 0   });
      dbB.setItem("doc", "pixels", "1,0", { r: 0,   g: 255, b: 0   });
      dbC.setItem("doc", "pixels", "2,0", { r: 0,   g: 0,   b: 255 });

      syncAtoB(dbA, dbB, "doc"); syncAtoB(dbB, dbA, "doc");
      syncAtoB(dbB, dbC, "doc"); syncAtoB(dbC, dbB, "doc");
      syncAtoB(dbA, dbC, "doc"); syncAtoB(dbC, dbA, "doc");

      for (const db of [dbA, dbB, dbC]) {
        expect(db.getItem("doc", "pixels", "0,0")).toEqual({ r: 255, g: 0,   b: 0   });
        expect(db.getItem("doc", "pixels", "1,0")).toEqual({ r: 0,   g: 255, b: 0   });
        expect(db.getItem("doc", "pixels", "2,0")).toEqual({ r: 0,   g: 0,   b: 255 });
      }
    });

    test("LWW: concurrent writes to same pixel — all converge to the later color", () => {
      jest.useFakeTimers();

      jest.setSystemTime(1000);
      dbA.setItem("doc", "pixels", "5,5", { r: 255, g: 0,   b: 0 }); // red

      jest.setSystemTime(2000);
      dbB.setItem("doc", "pixels", "5,5", { r: 0,   g: 255, b: 0 }); // green — wins

      syncAtoB(dbA, dbB, "doc"); syncAtoB(dbB, dbA, "doc");
      syncAtoB(dbB, dbC, "doc"); syncAtoB(dbC, dbB, "doc");
      syncAtoB(dbA, dbC, "doc"); syncAtoB(dbC, dbA, "doc");

      const expected = { r: 0, g: 255, b: 0 };
      expect(dbA.getItem("doc", "pixels", "5,5")).toEqual(expected);
      expect(dbB.getItem("doc", "pixels", "5,5")).toEqual(expected);
      expect(dbC.getItem("doc", "pixels", "5,5")).toEqual(expected);
    });

    test("incremental sync: second sync transfers only newly added pixels", () => {
      dbA.setItem("doc", "pixels", "0,0", { r: 255, g: 0, b: 0 });
      syncAtoB(dbA, dbB, "doc"); // B is now up to date

      dbA.setItem("doc", "pixels", "1,0", { r: 0, g: 255, b: 0 });
      dbA.setItem("doc", "pixels", "2,0", { r: 0, g: 0,   b: 255 });

      // Second delta should carry only the 2 new pixels
      const deltas = dbA.getDeltasForAgent("doc", "agentB");
      expect(deltas).not.toBeNull();
      expect(deltas?.collectionDeltas["pixels"]?.length).toBe(2);

      const result = dbB.mergeDocument(deltas!);
      dbA.acknowledgeMerge("doc", "agentB", result);

      expect(dbB.getItem("doc", "pixels", "0,0")).toEqual({ r: 255, g: 0,   b: 0   });
      expect(dbB.getItem("doc", "pixels", "1,0")).toEqual({ r: 0,   g: 255, b: 0   });
      expect(dbB.getItem("doc", "pixels", "2,0")).toEqual({ r: 0,   g: 0,   b: 255 });
    });
  });

  // ─── Deletions ────────────────────────────────────────────────────────────

  describe("Deletions (null tombstones)", () => {
    test("A writes, all sync, A deletes — B and C see the deletion on re-sync", () => {
      jest.useFakeTimers();

      jest.setSystemTime(1000);
      dbA.setItem("doc", "notes", "note1", "Hello");

      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbA, dbC, "doc");

      expect(dbB.getItem("doc", "notes", "note1")).toBe("Hello");
      expect(dbC.getItem("doc", "notes", "note1")).toBe("Hello");

      jest.setSystemTime(2000);
      dbA.setItem("doc", "notes", "note1", null); // delete

      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbA, dbC, "doc");

      expect(dbB.getItem("doc", "notes", "note1")).toBeNull();
      expect(dbC.getItem("doc", "notes", "note1")).toBeNull();
    });

    test("chain deletion: B deletes, C syncs from B — deletion propagates through the chain", () => {
      jest.useFakeTimers();

      jest.setSystemTime(1000);
      dbA.setItem("doc", "notes", "note1", "original");

      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbA, dbC, "doc");

      jest.setSystemTime(2000);
      dbB.setItem("doc", "notes", "note1", null); // B deletes

      syncAtoB(dbB, dbC, "doc"); // deletion reaches C through B, without A's involvement

      expect(dbC.getItem("doc", "notes", "note1")).toBeNull();
    });

    test("delete vs later write — write wins because its timestamp is higher", () => {
      jest.useFakeTimers();

      jest.setSystemTime(1000);
      dbA.setItem("doc", "notes", "note1", "original");
      syncAtoB(dbA, dbB, "doc");
      syncAtoB(dbA, dbC, "doc");

      jest.setSystemTime(2000);
      dbA.setItem("doc", "notes", "note1", null); // A deletes at t=2000

      jest.setSystemTime(3000);
      dbB.setItem("doc", "notes", "note1", "restored"); // B re-writes at t=3000 — wins

      syncAtoB(dbA, dbB, "doc"); syncAtoB(dbB, dbA, "doc");
      syncAtoB(dbB, dbC, "doc"); syncAtoB(dbC, dbB, "doc");
      syncAtoB(dbA, dbC, "doc"); syncAtoB(dbC, dbA, "doc");

      expect(dbA.getItem("doc", "notes", "note1")).toBe("restored");
      expect(dbB.getItem("doc", "notes", "note1")).toBe("restored");
      expect(dbC.getItem("doc", "notes", "note1")).toBe("restored");
    });
  });
});
