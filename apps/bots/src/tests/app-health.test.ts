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
    expect(Array.isArray(body.channels)).toBe(true);
    expect(body.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "whatsapp", mode: "webhook" }),
        expect.objectContaining({ channel: "telegram", mode: "webhook" }),
        expect.objectContaining({ channel: "discord", mode: "gateway" }),
      ]),
    );
  });
});
