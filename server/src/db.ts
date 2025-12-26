// db.ts
import { Pool } from "pg";

// This file sets up a connection to PostgreSQL.
// It exports a connectDb function to establish the connection and test it

const postgresUrl =
  process.env.POSTGRES_URL ||
  "postgresql://postgres:postgres@localhost:5432/crdtdemo";

const pool = new Pool({
  connectionString: postgresUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const connectDb = async () => {
  try {
    const client = await pool.connect();
    console.log("PostgreSQL connection test successful");
    client.release();
    return pool;
  } catch (err) {
    console.error("PostgreSQL connection failed:", err);
    throw err;
  }
};

export { pool };
