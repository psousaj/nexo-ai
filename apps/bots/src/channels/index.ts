export type BotChannel = "whatsapp" | "telegram" | "discord";
export type BotChannelMode = "webhook" | "gateway";

export interface ChannelRuntimeDescriptor {
  channel: BotChannel;
  mode: BotChannelMode;
  status: "planned" | "ready";
}

const channelRuntimes: ChannelRuntimeDescriptor[] = [
  {
    channel: "whatsapp",
    mode: "webhook",
    status: "planned",
  },
  {
    channel: "telegram",
    mode: "webhook",
    status: "planned",
  },
  {
    channel: "discord",
    mode: "gateway",
    status: "planned",
  },
];

export function listChannelRuntimes(): ChannelRuntimeDescriptor[] {
  return channelRuntimes;
}
