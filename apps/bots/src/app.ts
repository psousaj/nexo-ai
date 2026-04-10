import { Hono } from "hono";
import { listChannelRuntimes } from "@/channels";

export interface QueueJobCountsSnapshot {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
}

export interface OutgoingQueuesSnapshot {
  main: QueueJobCountsSnapshot;
  dlq: QueueJobCountsSnapshot;
}

interface CreateBotsAppOptions {
  providerSplitEnabled?: boolean;
  getOutgoingSnapshot?: () => Promise<OutgoingQueuesSnapshot>;
}

export function createBotsApp(options: CreateBotsAppOptions = {}) {
  const app = new Hono();
  const providerSplitEnabled = options.providerSplitEnabled ?? false;

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      service: "bots",
      timestamp: new Date().toISOString(),
      providerSplitEnabled,
      channels: listChannelRuntimes(),
    });
  });

  app.get("/health/outgoing", async (c) => {
    if (!options.getOutgoingSnapshot) {
      return c.json({
        status: "unavailable",
        providerSplitEnabled,
        reason: "outgoing snapshot provider is not configured",
      });
    }

    const queues = await options.getOutgoingSnapshot();

    return c.json({
      status: "ok",
      providerSplitEnabled,
      queues,
    });
  });

  app.get("/channels", (c) => {
    return c.json({
      items: listChannelRuntimes(),
    });
  });

  return app;
}
