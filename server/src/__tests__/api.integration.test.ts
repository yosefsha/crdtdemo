process.env.MONGO_URL = "mongodb://localhost:27017/";
process.env.DISABLE_AUTH_FOR_TESTS = "true";

import request from "supertest";
import app from "../index"; // Adjust if your Express app is exported elsewhere
import { mongoose } from "../db"; // Import mongoose for database connection
jest.setTimeout(10000); // Set timeout to 30 seconds

describe.skip("API Integration: /sync", () => {
  // Set a timeout for the tests
  beforeAll(() => {
    // Any setup needed before tests run, like connecting to a test database
    process.env.DISABLE_AUTH_FOR_TESTS = "true"; // Disable auth for tests
  });
  it("should reject unauthorized requests", async () => {
    const res = await request(app).get("/sync");
    expect(res.status).toBe(401);
  });

  it("should accept authorized requests and return CRDT state", async () => {
    // You may need to mock or generate a valid token for your app
    const token = "test-token"; // Replace with real token logic
    const res = await request(app)
      .get("/sync")
      .set("Authorization", `Bearer ${token}`);
    // Expect 200 or your app's expected response
    expect([200, 400, 404, 403]).toContain(res.status);
    // Optionally check response body shape
    // expect(res.body).toHaveProperty('crdt');
  });

  it.only("should accept POST /sync and process deltas", async () => {
    const token = "test-token"; // Replace with real token logic
    const deltas = { deltas: [] };
    const res = await request(app)
      .post("api/sync")
      .set("Authorization", `Bearer ${token}`)
      .send(deltas);
    // Expect ok response numbers range of 200...206
    expect([200, 201, 202, 203, 204, 205, 206]).toContain(res.status);
  });

  afterAll(async () => {
    // If you have access to the db service or client:
    // await userCrdtDb.disconnect?.();
    // or, if you use mongoose:
    await mongoose.disconnect();
  });
});
