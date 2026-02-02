import { Client, GatewayIntentBits, Partials, DMChannel, User } from 'discord.js';
import { loggers } from '@/utils/logger';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

// Logs de debug do client
client.on('error', (error) => {
  loggers.discord.error({ error }, '❌ [Discord] Client error');
});

client.on('warn', (warning) => {
  loggers.discord.warn({ warning }, '⚠️ [Discord] Client warning');
});

// Debug apenas em dev para não poluir
if (process.env.NODE_ENV === 'development') {
  client.on('debug', (info) => {
    // Filtrar heartbeats para não spammar
    if (!info.includes('Heartbeat')) {
      loggers.discord.debug({ info }, '🔍 [Discord] Debug');
    }
  });
}

let isReady = false;


client.once('ready', () => {
  isReady = true;
  loggers.discord.info(`🤖 Discord bot online como ${client.user?.tag}`);
  loggers.discord.info(`🔗 Invite link: https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot`);
});

client.on('guildCreate', async (guild) => {
  loggers.discord.info({ guildName: guild.name, guildId: guild.id }, '🎉 Joined new guild');
  
  // Tentar notificar o dono do servidor
  try {
    const owner = await guild.fetchOwner();
    await owner.send(`🎉 Olá! Obrigado por adicionar o Nexo AI ao servidor **${guild.name}**! Agora você pode gerenciar as integrações pelo dashboard.`);
    loggers.discord.info({ guildName: guild.name }, '✅ DM enviada para owner do guild');
  } catch (error) {
    loggers.discord.error({ error, guildName: guild.name }, '❌ Falha ao enviar DM para owner do guild');
  }
});

// @ts-ignore - Evento recente, pode não estar nos types dependendo da versão exata instalada/configurada
client.on('installationCreate', async (installation) => {
  loggers.discord.info({ type: installation.targetType }, '🎉 New installation created!');
  
  // Se for instalação de usuário (0 = GUILD, 1 = USER)
  // Ou se a instalação tiver um 'user' associado
  if (installation.user) {
    try {
      await installation.user.send(`🎉 Olá! Obrigado por instalar o Nexo AI no seu perfil! Agora você pode conversar comigo em qualquer lugar.`);
      loggers.discord.info({ userTag: installation.user.tag }, '✅ DM enviada para usuário que instalou o bot');
    } catch (error) {
      loggers.discord.error({ error }, '❌ Falha ao enviar DM para usuário de instalação');
    }
  }
});

export async function sendDiscordDM(discordUserId: string, message: string) {
  if (!isReady) throw new Error('Discord bot não está pronto');
  const user = await client.users.fetch(discordUserId);
  if (!user) throw new Error('Usuário Discord não encontrado');
  await user.send(message);
}

export async function startDiscordBot(token: string) {
  if (isReady) {
    loggers.discord.warn('⚠️ [Discord] Bot já está online, ignorando chamada de start');
    return;
  }
  
  loggers.discord.info('🔄 [Discord] Iniciando bot...');
  try {
    await client.login(token);
    loggers.discord.info('✅ [Discord] Login realizado com sucesso');
  } catch (error) {
    loggers.discord.error({ error }, '❌ [Discord] Erro fatal ao fazer login');
    throw error;
  }
}
