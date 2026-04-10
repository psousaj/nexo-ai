import { describe, expect, test, vi } from "vitest";
import { createProviderSplitRuntimeConfigService } from "@/runtime/provider-split-runtime-config";

describe("provider split runtime config service", () => {
  test("keeps env fallback when endpoint is not configured", async () => {
    const service = createProviderSplitRuntimeConfigService({
      initialProviderSplitEnabled: true,
      endpointUrl: undefined,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    const snapshot = await service.initialize();

    expect(snapshot.providerSplitEnabled).toBe(true);
    expect(snapshot.source).toBe("env");
    expect(snapshot.endpointUrl).toBeNull();
    expect(snapshot.pollingActive).toBe(false);

    await service.shutdown();
  });

  test("loads runtime config from API and stores API source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            version: "1.0",
            providerSplitEnabled: true,
            fetchedAt: "2026-04-10T20:00:00.000Z",
            flags: {
              CONVERSATION_FREE: true,
              TOOL_SCHEMA_V2: false,
              MULTIMODAL_AUDIO: false,
              MULTIMODAL_IMAGE: false,
              PROVIDER_SPLIT: true,
              ELYSIA_RUNTIME: false,
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const service = createProviderSplitRuntimeConfigService({
      initialProviderSplitEnabled: false,
      endpointUrl: "http://localhost/internal/runtime/provider-split-config",
      sharedToken: "shared-token",
      refreshIntervalMs: 120000,
      requestTimeoutMs: 1000,
      fetchImpl: fetchMock,
    });

    const snapshot = await service.initialize();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    expect((requestInit?.headers as Record<string, string>).Authorization).toBe(
      "Bearer shared-token",
    );
    expect(snapshot.providerSplitEnabled).toBe(true);
    expect(snapshot.source).toBe("api");
    expect(snapshot.lastError).toBeNull();
    expect(snapshot.pollingActive).toBe(true);

    await service.shutdown();
  });

  test("keeps previous config when remote fetch fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));

    const service = createProviderSplitRuntimeConfigService({
      initialProviderSplitEnabled: true,
      endpointUrl: "http://localhost/internal/runtime/provider-split-config",
      sharedToken: "shared-token",
      refreshIntervalMs: 120000,
      requestTimeoutMs: 1000,
      fetchImpl: fetchMock,
    });

    const snapshot = await service.initialize();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snapshot.providerSplitEnabled).toBe(true);
    expect(snapshot.source).toBe("env");
    expect(snapshot.lastError).toContain("timeout");
    expect(snapshot.failureCount).toBe(1);

    await service.shutdown();
  });
});
