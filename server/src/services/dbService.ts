import { MongoClient, Db, Collection, ObjectId } from "mongodb";

// This is a database service that uses the MongoDb client to interact with the database.
// The service is used by the controllers to interact with the database.

class DbService {
  private client: MongoClient;
  private db!: Db;
  private collection!: Collection;

  constructor(
    private uri: string,
    private dbName: string,
    private collectionName: string
  ) {
    this.client = new MongoClient(this.uri, {});
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.collection = this.db.collection(this.collectionName);
    console.log(
      `Connected to database: ${this.dbName}, collection: ${this.collectionName}`
    );
  }

  async disconnect() {
    await this.client.close();
    console.log(`Disconnected from database: ${this.dbName}`);
  }

  async createDocument(document: any) {
    const result = await this.collection.insertOne(document);
    const insertedDocument = await this.collection.findOne({
      _id: result.insertedId,
    });
    return insertedDocument;
  }

  async readDocument(id: string) {
    const document = await this.collection.findOne({ _id: new ObjectId(id) });
    return document;
  }

  async updateDocument(id: string, update: any) {
    const result = await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    return result.modifiedCount > 0;
  }

  async deleteDocument(id: string) {
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  async readAllDocuments() {
    const documents = await this.collection.find().toArray();
    return documents;
  }

  // Upsert a document by filter (e.g., { userId })
  async upsertDocument(filter: any, update: any) {
    const result = await this.collection.updateOne(
      filter,
      { $set: update },
      { upsert: true }
    );
    // Return the upserted or updated document
    return this.collection.findOne(filter);
  }
}

export default DbService;
