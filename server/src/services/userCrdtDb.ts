// userCrdtDb.ts
// This file sets up a singleton database service for storing per-user CRDT (Conflict-free Replicated Data Type) data in PostgreSQL.
// It uses the DbService class to connect to the PostgreSQL instance and provides a table for user CRDT state persistence.

import DbService from "./dbService";

// Create a singleton instance of DbService for user CRDT data.
// - Uses the POSTGRES_URL environment variable or defaults to localhost.
// - Database: crdtdemo
// - Table: user_crdt_data
export const userCrdtDb = new DbService(
  process.env.POSTGRES_URL ||
    "postgresql://postgres:postgres@localhost:5432/crdtdemo",
  "crdtdemo",
  "user_crdt_data"
);

// Immediately connect to PostgreSQL on startup so the service is ready for use.
userCrdtDb.connect().catch((err) => {
  console.error("Failed to connect to PostgreSQL for user CRDT data:", err);
});

// Re-export upsertDocument for convenience
export const upsertUserCrdtDocument = (filter: any, update: any) =>
  userCrdtDb.upsertDocument(filter, update);
