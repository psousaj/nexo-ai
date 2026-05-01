import { Hono } from "hono";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockGetPivotFeatureFlags,
  mockGetWhatsAppSettings,
  mockInvalidateCache,
  mockGetConnectionState,
  mockConnectInstance,
} = vi.hoisted(() => ({
  mockGetPivotFeatureFlags: vi.fn(),
  mockGetWhatsAppSettings: vi.fn(),
  mockInvalidateCache: vi.fn(),
  mockGetConnectionState: vi.fn(),
  mockConnectInstance: vi.fn(),
}));

vi.mock("@nexo/api-core/config/pivot-feature-flags", () => ({
  getPivotFeatureFlags: mockGetPivotFeatureFlags,
}));

vi.mock("@nexo/api-core/adapters/messaging", () => ({
  getWhatsAppSettings: mockGetWhatsAppSettings,
  invalidateWhatsAppProviderCache: mockInvalidateCache,
}));

vi.mock("@nexo/api-core/services/evolution-service", () => ({
  evolutionService: {
    getConnectionState: mockGetConnectionState,
    connectInstance: mockConnectInstance,
  },
}));

describe("Admin routes - pivot feature flags", () => {
  beforeEach(() => {
    mockGetPivotFeatureFlags.mockReset();
    mockGetWhatsAppSettings.mockReset();
    mockGetConnectionState.mockReset();
    mockConnectInstance.mockReset();

    mockGetWhatsAppSettings.mockResolvedValue({
      phoneNumber: null,
      lastError: null,
    });
  });

  test("returns effective pivot feature flags and metadata", async () => {
    const { adminRoutes } = await import("@/routes/dashboard/admin.routes");

    mockGetPivotFeatureFlags.mockResolvedValue({
      CONVERSATION_FREE: true,
      TOOL_SCHEMA_V2: false,
      MULTIMODAL_AUDIO: true,
      MULTIMODAL_IMAGE: false,
      PROVIDER_SPLIT: false,
    });

    const app = new Hono().route("/admin", adminRoutes);
    const response = await app.request(
      "http://localhost/admin/pivot-feature-flags",
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetPivotFeatureFlags).toHaveBeenCalledTimes(1);
    expect(body).toEqual({
      success: true,
      data: {
        flags: {
          CONVERSATION_FREE: true,
          TOOL_SCHEMA_V2: false,
          MULTIMODAL_AUDIO: true,
          MULTIMODAL_IMAGE: false,
          PROVIDER_SPLIT: false,
        },
        meta: {
          enabled: 2,
          total: 5,
        },
      },
    });
  });

  test("não expõe mais endpoints legados de troca de API e aliases /baileys", async () => {
    const { adminRoutes } = await import("@/routes/dashboard/admin.routes");

    const app = new Hono().route("/admin", adminRoutes);

    const setApiResponse = await app.request(
      "http://localhost/admin/whatsapp-settings/api",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api: "evolution" }),
      },
    );

    const disconnectAliasResponse = await app.request(
      "http://localhost/admin/whatsapp-settings/baileys/disconnect",
      {
        method: "POST",
      },
    );

    const restartAliasResponse = await app.request(
      "http://localhost/admin/whatsapp-settings/baileys/restart",
      {
        method: "POST",
      },
    );

    expect(setApiResponse.status).toBe(404);
    expect(disconnectAliasResponse.status).toBe(404);
    expect(restartAliasResponse.status).toBe(404);
  });

  test("qr-code não tenta reconectar quando status já está connecting", async () => {
    const { adminRoutes } = await import("@/routes/dashboard/admin.routes");

    mockGetConnectionState.mockResolvedValue({
      instance: {
        state: "connecting",
      },
    });

    const app = new Hono().route("/admin", adminRoutes);
    const response = await app.request(
      "http://localhost/admin/whatsapp-settings/qr-code",
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockConnectInstance).not.toHaveBeenCalled();
    expect(body.connectionStatus.status).toBe("connecting");
  });

  test("qr-code preserva status quando connect retorna nulo", async () => {
    const { adminRoutes } = await import("@/routes/dashboard/admin.routes");

    mockGetConnectionState.mockResolvedValue({
      instance: {
        state: "disconnected",
      },
    });
    mockConnectInstance.mockResolvedValue(null);

    const app = new Hono().route("/admin", adminRoutes);
    const response = await app.request(
      "http://localhost/admin/whatsapp-settings/qr-code",
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockConnectInstance).toHaveBeenCalledTimes(1);
    expect(body.connectionStatus.status).toBe("disconnected");
    expect(body.connectionStatus.error).toContain("Instância Evolution não encontrada");
  });
});
