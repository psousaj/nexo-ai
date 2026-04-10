import { serve } from "@hono/node-server";
import { env } from "@nexo/api-core/config/env";
import { createBotsApp } from "./app";
import {
  createAdapterOutputWorker,
  getAdapterOutputQueueSnapshot,
  shutdownAdapterOutputRuntime,
} from "@/outgoing/adapter-output-worker";
import { createProviderSplitRuntimeConfigService } from "@/runtime/provider-split-runtime-config";

let discordGatewayStarted = false;

async function maybeStartDiscordGateway(
  providerSplitEnabled: boolean,
): Promise<void> {
  if (!providerSplitEnabled) {
    return;
  }

  if (!env.DISCORD_BOT_TOKEN) {
    return;
  }

  if (discordGatewayStarted) {
    return;
  }

  const { startDiscordBot } = await import(
    "@nexo/api-core/adapters/messaging/discord-adapter"
  );
  await startDiscordBot(env.DISCORD_BOT_TOKEN);
  discordGatewayStarted = true;
  console.log("discord gateway started in bots app");
}

const runtimeConfigService = createProviderSplitRuntimeConfigService({
  onProviderSplitChanged: async (next, previous) => {
    console.log("provider split runtime config changed", {
      previous,
      next,
    });

    if (next) {
      await maybeStartDiscordGateway(true);
      return;
    }

    if (previous && discordGatewayStarted) {
      console.warn(
        "provider split was disabled remotely; restart bots app to unload discord gateway",
      );
    }
  },
});

const app = createBotsApp({
  getProviderSplitEnabled: () =>
    runtimeConfigService.getSnapshot().providerSplitEnabled,
  getOutgoingSnapshot: getAdapterOutputQueueSnapshot,
  getRuntimeConfigSnapshot: runtimeConfigService.getSnapshot,
});
const port = Number(process.env.BOTS_PORT || 3030);
const adapterOutputWorker = createAdapterOutputWorker();

async function bootstrapRuntime(): Promise<void> {
  const runtimeConfig = await runtimeConfigService.initialize();
  await maybeStartDiscordGateway(runtimeConfig.providerSplitEnabled);
}

void bootstrapRuntime().catch((error) => {
  console.error("failed to bootstrap provider split runtime config", error);
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
  await Promise.all([
    shutdownAdapterOutputRuntime(adapterOutputWorker),
    runtimeConfigService.shutdown(),
  ]);
}

process.on("SIGTERM", async () => {
  await shutdown();
});

process.on("SIGINT", async () => {
  await shutdown();
});
