import { Pool, PoolClient, QueryResult } from "pg";

// This is a database service that uses PostgreSQL to interact with the database.
// The service is used by the controllers to interact with the database.

class DbService {
  private pool: Pool;
  private tableName: string;

  constructor(
    private connectionString: string,
    private dbName: string, // Not used in Postgres, kept for compatibility
    private tableNameParam: string
  ) {
    this.tableName = tableNameParam;
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async connect() {
    // Create table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        _id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        crdt JSONB NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_user_id ON ${this.tableName}(user_id);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_timestamp ON ${this.tableName}(timestamp);
    `;

    await this.pool.query(createTableQuery);
    console.log(`Connected to PostgreSQL database, table: ${this.tableName}`);
  }

  async disconnect() {
    await this.pool.end();
    console.log(`Disconnected from PostgreSQL database`);
  }

  async createDocument(document: any) {
    const { _id, userId, crdt, timestamp } = document;
    const query = `
      INSERT INTO ${this.tableName} (_id, user_id, crdt, timestamp)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      _id,
      userId || _id,
      JSON.stringify(crdt),
      timestamp || new Date(),
    ];
    const result = await this.pool.query(query, values);
    return this.parseRow(result.rows[0]);
  }

  async readDocument(id: string) {
    const query = `SELECT * FROM ${this.tableName} WHERE _id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.parseRow(result.rows[0]) : null;
  }

  async updateDocument(id: string, update: any) {
    const { userId, crdt, timestamp } = update;
    const query = `
      UPDATE ${this.tableName}
      SET user_id = COALESCE($2, user_id),
          crdt = COALESCE($3, crdt),
          timestamp = COALESCE($4, timestamp),
          updated_at = CURRENT_TIMESTAMP
      WHERE _id = $1
      RETURNING *
    `;
    const values = [id, userId, crdt ? JSON.stringify(crdt) : null, timestamp];
    const result = await this.pool.query(query, values);
    return result.rowCount! > 0;
  }

  async deleteDocument(id: string) {
    const query = `DELETE FROM ${this.tableName} WHERE _id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount! > 0;
  }

  async readAllDocuments() {
    const query = `SELECT * FROM ${this.tableName} ORDER BY timestamp DESC`;
    const result = await this.pool.query(query);
    return result.rows.map((row) => this.parseRow(row));
  }

  // Upsert a document by filter (e.g., { _id: userId })
  async upsertDocument(filter: any, update: any) {
    const id = filter._id || filter.userId;
    const { userId, crdt, timestamp } = update;

    if (!id) {
      throw new Error("Upsert requires _id or userId in filter");
    }

    // First try to find existing document
    const existing = await this.readDocument(id);

    // If no update data provided, just return existing or null
    if (!userId && !crdt && !timestamp) {
      return existing;
    }

    const query = `
      INSERT INTO ${this.tableName} (_id, user_id, crdt, timestamp)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (_id)
      DO UPDATE SET
        user_id = COALESCE(EXCLUDED.user_id, ${this.tableName}.user_id),
        crdt = COALESCE(EXCLUDED.crdt, ${this.tableName}.crdt),
        timestamp = COALESCE(EXCLUDED.timestamp, ${this.tableName}.timestamp),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      id,
      userId || id,
      crdt
        ? JSON.stringify(crdt)
        : existing?.crdt
        ? JSON.stringify(existing.crdt)
        : null,
      timestamp || new Date(),
    ];

    const result = await this.pool.query(query, values);
    return this.parseRow(result.rows[0]);
  }

  // Helper to parse JSONB back to object
  private parseRow(row: any) {
    if (!row) return null;
    return {
      ...row,
      crdt: typeof row.crdt === "string" ? JSON.parse(row.crdt) : row.crdt,
    };
  }
}

export default DbService;
