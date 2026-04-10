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

export interface RuntimeConfigSnapshot {
  providerSplitEnabled: boolean;
  source: "env" | "api";
  endpointUrl: string | null;
  refreshIntervalMs: number;
  requestTimeoutMs: number;
  lastAttemptAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  failureCount: number;
  pollingActive: boolean;
}

interface CreateBotsAppOptions {
  providerSplitEnabled?: boolean;
  getProviderSplitEnabled?: () => boolean;
  getOutgoingSnapshot?: () => Promise<OutgoingQueuesSnapshot>;
  getRuntimeConfigSnapshot?: () => RuntimeConfigSnapshot;
}

export function createBotsApp(options: CreateBotsAppOptions = {}) {
  const app = new Hono();
  const readProviderSplitEnabled = () =>
    options.getProviderSplitEnabled?.() ??
    options.providerSplitEnabled ??
    false;

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      service: "bots",
      timestamp: new Date().toISOString(),
      providerSplitEnabled: readProviderSplitEnabled(),
      channels: listChannelRuntimes(),
    });
  });

  app.get("/health/outgoing", async (c) => {
    if (!options.getOutgoingSnapshot) {
      return c.json({
        status: "unavailable",
        providerSplitEnabled: readProviderSplitEnabled(),
        reason: "outgoing snapshot provider is not configured",
      });
    }

    const queues = await options.getOutgoingSnapshot();

    return c.json({
      status: "ok",
      providerSplitEnabled: readProviderSplitEnabled(),
      queues,
    });
  });

  app.get("/health/runtime-config", (c) => {
    if (!options.getRuntimeConfigSnapshot) {
      return c.json({
        status: "unavailable",
        providerSplitEnabled: readProviderSplitEnabled(),
        reason: "runtime config snapshot provider is not configured",
      });
    }

    return c.json({
      status: "ok",
      providerSplitEnabled: readProviderSplitEnabled(),
      runtimeConfig: options.getRuntimeConfigSnapshot(),
    });
  });

  app.get("/channels", (c) => {
    return c.json({
      items: listChannelRuntimes(),
    });
  });

  return app;
}
