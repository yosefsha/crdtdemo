// userCrdtDb.ts
// This file sets up a singleton database service for storing per-user CRDT (Conflict-free Replicated Data Type) data in MongoDB.
// It uses the DbService class to connect to the MongoDB instance and provides a collection for user CRDT state persistence.

import DbService from "./dbService";

// Create a singleton instance of DbService for user CRDT data.
// - Uses the MONGO_URL environment variable or defaults to localhost.
// - Database: crdtdemo
// - Collection: user_crdt_data
export const userCrdtDb = new DbService(
  process.env.MONGO_URL || "mongodb://localhost:27017/mydb",
  "crdtdemo",
  "user_crdt_data"
);

// Immediately connect to MongoDB on startup so the service is ready for use.
userCrdtDb.connect().catch((err) => {
  console.error("Failed to connect to MongoDB for user CRDT data:", err);
});

// Re-export upsertDocument for convenience
export const upsertUserCrdtDocument = (filter: any, update: any) =>
  userCrdtDb.upsertDocument(filter, update);
