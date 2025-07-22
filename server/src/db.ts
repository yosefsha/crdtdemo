// db.ts
import mongoose from "mongoose";
// This file sets up a connection to MongoDB using Mongoose.
// It exports a connectDb function to establish the connection and the mongoose instance for use in other
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/mydb";
export const connectDb = () => mongoose.connect(mongoUrl);
export { mongoose };
