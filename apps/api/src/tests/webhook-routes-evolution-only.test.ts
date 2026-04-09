import { Hono } from "hono";
import { describe, expect, test, vi } from "vitest";

const {
  mockTelegramVerifyWebhook,
  mockTelegramParseIncomingMessage,
  mockEvolutionVerifyWebhook,
  mockEvolutionParseIncomingMessage,
} = vi.hoisted(() => ({
  mockTelegramVerifyWebhook: vi.fn(() => true),
  mockTelegramParseIncomingMessage: vi.fn(() => null),
  mockEvolutionVerifyWebhook: vi.fn(() => true),
  mockEvolutionParseIncomingMessage: vi.fn(() => null),
}));

vi.mock("@nexo/api-core/adapters/messaging", () => ({
  telegramAdapter: {
    verifyWebhook: mockTelegramVerifyWebhook,
    parseIncomingMessage: mockTelegramParseIncomingMessage,
  },
  evolutionAdapter: {
    verifyWebhook: mockEvolutionVerifyWebhook,
    parseIncomingMessage: mockEvolutionParseIncomingMessage,
  },
}));

vi.mock("@nexo/api-core/services/queue-service", () => ({
  messageQueue: {
    add: vi.fn(),
  },
}));

vi.mock("@nexo/api-core/config/env", () => ({
  env: {
    EVOLUTION_WEBHOOK_PATH: "/webhook/whatsapp/evolution",
    EVOLUTION_WEBHOOK_SECRET: "test-evolution-secret",
    TELEGRAM_BOT_TOKEN: "test-telegram-token",
  },
}));

describe("Webhook routes - Evolution only", () => {
  test("remove rota legada /webhook/meta e mantém rota oficial Evolution", async () => {
    const { webhookRoutes } = await import("@/routes/webhook-new");
    const app = new Hono().route("/webhook", webhookRoutes);

    const legacyGetResponse = await app.request(
      "http://localhost/webhook/meta",
    );
    const legacyPostResponse = await app.request(
      "http://localhost/webhook/meta",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const officialEvolutionResponse = await app.request(
      "http://localhost/webhook/whatsapp/evolution",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-evolution-secret",
        },
        body: JSON.stringify({ event: "noop" }),
      },
    );

    expect(legacyGetResponse.status).toBe(404);
    expect(legacyPostResponse.status).toBe(404);
    expect(officialEvolutionResponse.status).toBe(200);
  });
});
