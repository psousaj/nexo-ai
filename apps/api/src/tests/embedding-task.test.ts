import { describe, expect, it, vi } from "vitest";

const { mockGenerateEmbedding, mockCaptureException } = vi.hoisted(() => ({
  mockGenerateEmbedding: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock("@nexo/api-core/services/ai/embedding-service", () => ({
  embeddingService: {
    generateEmbedding: mockGenerateEmbedding,
  },
}));

vi.mock("@nexo/api-core/sentry", () => ({
  captureException: mockCaptureException,
}));

describe("executeEmbeddingTask", () => {
  it("retorna bloco completed quando embedding é gerado", async () => {
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

    const { executeEmbeddingTask } =
      await import("@nexo/api-core/services/ai/embedding-task");
    const result = await executeEmbeddingTask({
      input: "texto para embedding",
      async: false,
      source: "search_items_query",
      metadata: { userId: "u-1" },
    });

    expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(result.block.status).toBe("completed");
    expect(result.block.metadata).toEqual(
      expect.objectContaining({
        source: "search_items_query",
        dimensions: 3,
        userId: "u-1",
      }),
    );
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("retorna bloco failed e embedding nulo quando serviço falha", async () => {
    mockGenerateEmbedding.mockRejectedValue(new Error("gateway timeout"));

    const { executeEmbeddingTask } =
      await import("@nexo/api-core/services/ai/embedding-task");
    const result = await executeEmbeddingTask({
      input: "texto para embedding",
      async: true,
      source: "create_local_item",
      metadata: { itemId: "item-1" },
    });

    expect(result.embedding).toBeNull();
    expect(result.block.status).toBe("failed");
    expect(result.block.error).toContain("gateway timeout");
    expect(result.block.metadata).toEqual(
      expect.objectContaining({
        source: "create_local_item",
        itemId: "item-1",
      }),
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
