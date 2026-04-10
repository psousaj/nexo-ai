import type { PivotFeatureFlags } from "@nexo/api-core/config/pivot-feature-flags";
import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { createInternalRuntimeConfigRoutes } from "@/routes/internal/runtime-config.routes";

function makePivotFlags(
  overrides?: Partial<PivotFeatureFlags>,
): PivotFeatureFlags {
  return {
    CONVERSATION_FREE: true,
    TOOL_SCHEMA_V2: false,
    MULTIMODAL_AUDIO: false,
    MULTIMODAL_IMAGE: false,
    PROVIDER_SPLIT: true,
    ELYSIA_RUNTIME: false,
    ...overrides,
  };
}

describe("internal runtime config route", () => {
  test("returns 503 when shared token is not configured", async () => {
    const routes = createInternalRuntimeConfigRoutes({
      resolveSharedToken: () => undefined,
      resolvePivotFeatureFlags: async () => makePivotFlags(),
    });
    const app = new Hono().route("/internal/runtime", routes);

    const response = await app.request(
      "http://localhost/internal/runtime/provider-split-config",
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
  });

  test("returns 401 when authorization token is missing or invalid", async () => {
    const routes = createInternalRuntimeConfigRoutes({
      resolveSharedToken: () => "shared-token",
      resolvePivotFeatureFlags: async () => makePivotFlags(),
    });
    const app = new Hono().route("/internal/runtime", routes);

    const missingToken = await app.request(
      "http://localhost/internal/runtime/provider-split-config",
    );
    const invalidToken = await app.request(
      "http://localhost/internal/runtime/provider-split-config",
      {
        headers: {
          authorization: "Bearer wrong-token",
        },
      },
    );

    expect(missingToken.status).toBe(401);
    expect(invalidToken.status).toBe(401);
  });

  test("returns provider split runtime payload with valid shared token", async () => {
    const routes = createInternalRuntimeConfigRoutes({
      resolveSharedToken: () => "shared-token",
      resolvePivotFeatureFlags: async () =>
        makePivotFlags({
          PROVIDER_SPLIT: true,
          TOOL_SCHEMA_V2: true,
        }),
      now: () => new Date("2026-04-10T19:00:00.000Z"),
    });
    const app = new Hono().route("/internal/runtime", routes);

    const response = await app.request(
      "http://localhost/internal/runtime/provider-split-config",
      {
        headers: {
          authorization: "Bearer shared-token",
        },
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      success: true,
      data: {
        version: "1.0",
        providerSplitEnabled: true,
        fetchedAt: "2026-04-10T19:00:00.000Z",
        flags: {
          CONVERSATION_FREE: true,
          TOOL_SCHEMA_V2: true,
          MULTIMODAL_AUDIO: false,
          MULTIMODAL_IMAGE: false,
          PROVIDER_SPLIT: true,
          ELYSIA_RUNTIME: false,
        },
      },
    });
  });
});
