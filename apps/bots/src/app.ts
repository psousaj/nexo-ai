import { Hono } from "hono";
import { listChannelRuntimes } from "@/channels";

export function createBotsApp() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      service: "bots",
      timestamp: new Date().toISOString(),
      channels: listChannelRuntimes(),
    });
  });

  app.get("/channels", (c) => {
    return c.json({
      items: listChannelRuntimes(),
    });
  });

  return app;
}
