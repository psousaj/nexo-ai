import { describe, expect, test } from "vitest";
import { createBotsApp } from "@/app";

describe("bots app", () => {
  test("health route returns service metadata", async () => {
    const app = createBotsApp();

    const response = await app.request("http://localhost/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("bots");
    expect(body.providerSplitEnabled).toBe(false);
    expect(Array.isArray(body.channels)).toBe(true);
    expect(body.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "whatsapp", mode: "webhook" }),
        expect.objectContaining({ channel: "telegram", mode: "webhook" }),
        expect.objectContaining({ channel: "discord", mode: "gateway" }),
      ]),
    );
  });

  test("outgoing health route returns unavailable without snapshot provider", async () => {
    const app = createBotsApp();

    const response = await app.request("http://localhost/health/outgoing");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("unavailable");
    expect(body.providerSplitEnabled).toBe(false);
  });

  test("outgoing health route returns queue snapshot when provider is configured", async () => {
    const app = createBotsApp({
      providerSplitEnabled: true,
      getOutgoingSnapshot: async () => ({
        main: {
          waiting: 1,
          active: 2,
          delayed: 0,
          completed: 10,
          failed: 1,
          paused: 0,
        },
        dlq: {
          waiting: 0,
          active: 0,
          delayed: 0,
          completed: 4,
          failed: 0,
          paused: 0,
        },
      }),
    });

    const response = await app.request("http://localhost/health/outgoing");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.providerSplitEnabled).toBe(true);
    expect(body.queues.main.waiting).toBe(1);
    expect(body.queues.dlq.completed).toBe(4);
  });
});
