import type { IncomingMessage } from "@nexo/api-core/adapters/messaging";
import { Hono } from "hono";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockMessageQueueAdd,
  mockTelegramVerifyWebhook,
  mockTelegramParseIncomingMessage,
  mockTelegramAnswerCallbackQuery,
  mockEvolutionVerifyWebhook,
  mockEvolutionParseIncomingMessage,
} = vi.hoisted(() => ({
  mockMessageQueueAdd: vi.fn(),
  mockTelegramVerifyWebhook: vi.fn(() => true),
  mockTelegramParseIncomingMessage: vi.fn(() => null),
  mockTelegramAnswerCallbackQuery: vi.fn().mockResolvedValue(undefined),
  mockEvolutionVerifyWebhook: vi.fn(() => true),
  mockEvolutionParseIncomingMessage: vi.fn(() => null),
}));

vi.mock("@nexo/api-core/adapters/messaging", () => ({
  createCanonicalIncomingEnvelope: vi.fn((params) => {
    const { incomingMsg, providerName, providerApi, traceId } = params;
    const idempotencyKey = `${providerName}:${incomingMsg.messageId}`;

    return {
      version: "1.0",
      eventType: "incoming.message.received",
      channel: providerName,
      eventId: `ingress:${idempotencyKey}`,
      idempotencyKey,
      occurredAt: incomingMsg.timestamp.toISOString(),
      traceId,
      payload: {
        incomingMsg,
        providerName,
        providerApi,
      },
    };
  }),
  telegramAdapter: {
    verifyWebhook: mockTelegramVerifyWebhook,
    parseIncomingMessage: mockTelegramParseIncomingMessage,
    answerCallbackQuery: mockTelegramAnswerCallbackQuery,
  },
  evolutionAdapter: {
    verifyWebhook: mockEvolutionVerifyWebhook,
    parseIncomingMessage: mockEvolutionParseIncomingMessage,
  },
}));

vi.mock("@nexo/api-core/services/queue-service", () => ({
  messageQueue: {
    add: mockMessageQueueAdd,
  },
}));

vi.mock("@nexo/api-core/config/env", () => ({
  env: {
    EVOLUTION_WEBHOOK_PATH: "/webhook/whatsapp/evolution",
    EVOLUTION_WEBHOOK_SECRET: "test-evolution-secret",
    TELEGRAM_BOT_TOKEN: "test-telegram-token",
  },
}));

function makeIncomingMessage(
  provider: IncomingMessage["provider"],
  messageId: string,
  externalId: string,
): IncomingMessage {
  return {
    messageId,
    externalId,
    text: "hello",
    timestamp: new Date("2026-04-10T12:00:00.000Z"),
    provider,
    metadata: {
      isGroupMessage: false,
      messageType: "text",
    },
  };
}

async function buildApp() {
  const { webhookRoutes } = await import("@/routes/webhook-new");
  return new Hono().route("/webhook", webhookRoutes);
}

describe("Webhook routes - canonical ingest envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("telegram enqueues canonical envelope", async () => {
    const incoming = makeIncomingMessage("telegram", "tg-msg-1", "telegram-user-1");
    mockTelegramParseIncomingMessage.mockReturnValue(incoming);

    const app = await buildApp();
    const response = await app.request("http://localhost/webhook/telegram", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "trace-telegram-1",
      },
      body: JSON.stringify({ update_id: 1 }),
    });

    expect(response.status).toBe(200);
    expect(mockMessageQueueAdd).toHaveBeenCalledTimes(1);

    const [, jobData] = mockMessageQueueAdd.mock.calls[0];

    expect(jobData).toMatchObject({
      version: "1.0",
      eventType: "incoming.message.received",
      channel: "telegram",
      idempotencyKey: "telegram:tg-msg-1",
      traceId: "trace-telegram-1",
      payload: {
        incomingMsg: incoming,
        providerName: "telegram",
      },
    });
  });

  test("whatsapp enqueues canonical envelope with providerApi", async () => {
    const incoming = makeIncomingMessage(
      "whatsapp",
      "wa-msg-1",
      "whatsapp-user-1",
    );
    mockEvolutionParseIncomingMessage.mockReturnValue(incoming);

    const app = await buildApp();
    const response = await app.request(
      "http://localhost/webhook/whatsapp/evolution",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-evolution-secret",
          "x-request-id": "trace-whatsapp-1",
        },
        body: JSON.stringify({ event: "messages.upsert" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockMessageQueueAdd).toHaveBeenCalledTimes(1);

    const [, jobData] = mockMessageQueueAdd.mock.calls[0];

    expect(jobData).toMatchObject({
      version: "1.0",
      eventType: "incoming.message.received",
      channel: "whatsapp",
      idempotencyKey: "whatsapp:wa-msg-1",
      traceId: "trace-whatsapp-1",
      payload: {
        incomingMsg: incoming,
        providerName: "whatsapp",
        providerApi: "evolution",
      },
    });
  });
});
