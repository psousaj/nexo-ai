import { serve } from "@hono/node-server";
import { startDiscordBot } from "@nexo/api-core/adapters/messaging/discord-adapter";
import { env } from "@nexo/api-core/config/env";
import { createBotsApp } from "./app";
import {
  createAdapterOutputWorker,
  getAdapterOutputQueueSnapshot,
  shutdownAdapterOutputRuntime,
} from "@/outgoing/adapter-output-worker";

const app = createBotsApp({
  providerSplitEnabled: env.PROVIDER_SPLIT,
  getOutgoingSnapshot: getAdapterOutputQueueSnapshot,
});
const port = Number(process.env.BOTS_PORT || process.env.PORT || 3030);
const adapterOutputWorker = createAdapterOutputWorker();

async function bootstrapDiscordGateway(): Promise<void> {
  if (!env.PROVIDER_SPLIT) {
    return;
  }

  if (!env.DISCORD_BOT_TOKEN) {
    return;
  }

  await startDiscordBot(env.DISCORD_BOT_TOKEN);
  console.log("discord gateway started in bots app");
}

void bootstrapDiscordGateway().catch((error) => {
  console.error("failed to bootstrap discord gateway", error);
});

serve({
  fetch: app.fetch,
  port,
});

console.log(`bots app listening on port ${port}`);

adapterOutputWorker.on("ready", () => {
  console.log("adapter-output worker ready");
});

adapterOutputWorker.on("failed", (job, error) => {
  console.error("adapter-output job failed", {
    jobId: job?.id,
    err: error.message,
  });
});

async function shutdown() {
  await shutdownAdapterOutputRuntime(adapterOutputWorker);
}

process.on("SIGTERM", async () => {
  await shutdown();
});

process.on("SIGINT", async () => {
  await shutdown();
});
