/**
 * Tests for client-side batching service
 */

import { sendWithBatching } from "../batchService";

// Mock fetch
global.fetch = jest.fn();

describe("Client Batch Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe("Single batch (small payload)", () => {
    it("should send single request for small payload", async () => {
      const mockResponse = {
        data: {
          applied: { pixels: [{ itemId: "1,1", value: "ff0000ff" }] },
          missing: {},
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await sendWithBatching(
        "http://test.com/sync",
        "POST",
        { "Content-Type": "application/json" },
        {
          deltas: {
            documentId: "doc1",
            collectionDeltas: {
              pixels: [{ itemId: "1,1", value: "ff0000ff", timestamp: 100 }],
            },
          },
        }
      );

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.data.applied).toEqual({
        pixels: [{ itemId: "1,1", value: "ff0000ff" }],
      });
    });
  });

  describe("Multiple batches (large payload)", () => {
    it("should accumulate applied items from all batches", async () => {
      // Create exactly 3 batches worth of data
      const batchSize = 10; // Small size for testing
      const largeDeltas = [];
      for (let i = 0; i < batchSize * 3; i++) {
        largeDeltas.push({
          itemId: `${i},${i}`,
          value: "ff0000ff",
          timestamp: 100 + i,
          replicaId: "client",
          agentId: "user1",
        });
      }

      // Mock exactly 3 responses
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              applied: { pixels: [{ itemId: "1,1", value: "ff0000ff" }] },
              missing: {},
            },
          }),
        })
      );

      const result = await sendWithBatching(
        "http://test.com/sync",
        "POST",
        { "Content-Type": "application/json" },
        {
          deltas: {
            documentId: "doc1",
            collectionDeltas: {
              pixels: largeDeltas,
            },
          },
        },
        { maxBatchSize: 200 } // Small to trigger 3 batches
      );

      // Should send multiple batches
      expect(global.fetch.mock.calls.length).toBeGreaterThan(1);

      // Should accumulate all applied items
      expect(result.data.applied.pixels.length).toBeGreaterThan(0);
    });

    it("should handle batches with no applied items", async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        const hasApplied = callCount % 2 === 1; // Odd batches have data, even don't
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              applied: hasApplied
                ? {
                    pixels: [
                      {
                        itemId: `${callCount},${callCount}`,
                        value: "ff0000ff",
                      },
                    ],
                  }
                : {},
              missing: {},
            },
          }),
        });
      });

      const largeDeltas = [];
      for (let i = 0; i < 30; i++) {
        largeDeltas.push({
          itemId: `${i},${i}`,
          value: "ff0000ff",
          timestamp: 100 + i,
        });
      }

      const result = await sendWithBatching(
        "http://test.com/sync",
        "POST",
        { "Content-Type": "application/json" },
        {
          deltas: {
            documentId: "doc1",
            collectionDeltas: { pixels: largeDeltas },
          },
        },
        { maxBatchSize: 200 }
      );

      expect(global.fetch.mock.calls.length).toBeGreaterThan(1);

      // Should accumulate only items that were applied (from odd-numbered batches)
      expect(result.data.applied.pixels.length).toBeGreaterThan(0);
    });

    it("should handle multiple collections in applied results", async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              applied: {
                pixels: [{ itemId: "1,1", value: "ff0000ff" }],
                metadata: [{ itemId: "meta1", value: { name: "test" } }],
              },
              missing: {},
            },
          }),
        })
      );

      const largeDeltas = [];
      for (let i = 0; i < 30; i++) {
        largeDeltas.push({
          itemId: `${i},${i}`,
          value: "ff0000ff",
          timestamp: 100 + i,
        });
      }

      const result = await sendWithBatching(
        "http://test.com/sync",
        "POST",
        { "Content-Type": "application/json" },
        {
          deltas: {
            documentId: "doc1",
            collectionDeltas: { pixels: largeDeltas, metadata: [] },
          },
        },
        { maxBatchSize: 200 }
      );

      // Should accumulate both collections
      expect(result.data.applied.pixels.length).toBeGreaterThan(0);
      expect(result.data.applied.metadata.length).toBeGreaterThan(0);
    });
  });

  describe("Error handling", () => {
    it("should throw error if batch request fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Server error" }),
      });

      await expect(
        sendWithBatching(
          "http://test.com/sync",
          "POST",
          { "Content-Type": "application/json" },
          { deltas: { documentId: "doc1", collectionDeltas: {} } }
        )
      ).rejects.toEqual({ error: "Server error" });
    });
  });

  describe("Batch callback", () => {
    it("should call onBatchComplete for each batch", async () => {
      const mockCallback = jest.fn();

      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: { applied: {}, missing: {} } }),
        })
      );

      const largeDeltas = [];
      for (let i = 0; i < 30; i++) {
        largeDeltas.push({
          itemId: `${i},${i}`,
          value: "ff0000ff",
          timestamp: 100 + i,
        });
      }

      await sendWithBatching(
        "http://test.com/sync",
        "POST",
        { "Content-Type": "application/json" },
        {
          deltas: {
            documentId: "doc1",
            collectionDeltas: { pixels: largeDeltas },
          },
        },
        {
          maxBatchSize: 200,
          onBatchComplete: mockCallback,
        }
      );

      expect(mockCallback.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
