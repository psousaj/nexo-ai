import { Client, GatewayIntentBits, Partials, DMChannel, User } from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

let isReady = false;

client.once('ready', () => {
  isReady = true;
  console.log(`🤖 Discord bot online como ${client.user?.tag}`);
});

export async function sendDiscordDM(discordUserId: string, message: string) {
  if (!isReady) throw new Error('Discord bot não está pronto');
  const user = await client.users.fetch(discordUserId);
  if (!user) throw new Error('Usuário Discord não encontrado');
  await user.send(message);
}

export async function startDiscordBot(token: string) {
  if (!isReady) await client.login(token);
}
