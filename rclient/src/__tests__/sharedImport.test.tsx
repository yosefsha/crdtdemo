// Test file to verify shared folder compilation works
import { CRDTDatabase, createTestDatabase } from "@crdtdemo/shared";

describe("Shared CRDT Import Tests", () => {
  test("should import and instantiate CRDTDatabase", () => {
    const db = new CRDTDatabase("test-agent", "test-replica");
    const info = db.getInfo();

    expect(info.agentId).toBe("test-agent");
    expect(info.replicaId).toBe("test-replica");
  });

  test("should use utility function to create database", () => {
    const db = createTestDatabase("util-agent", "util-replica");
    const info = db.getInfo();

    expect(info.agentId).toBe("util-agent");
    expect(info.replicaId).toBe("util-replica");
  });
});
