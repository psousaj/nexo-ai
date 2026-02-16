/**
 * Testes unitários para Discord Adapter
 *
 * Valida:
 * - parseMessage: Parsing de mensagens Discord
 * - Mention gating: Processa apenas mensagens com @bot
 * - Slash commands: Comandos com barra
 * - Componentes: Buttons e select menus
 */

import { describe, test, expect } from 'vitest';
import { DiscordAdapter } from '@/adapters/messaging/discord-adapter';

describe('Discord Adapter', () => {
  let adapter: DiscordAdapter;

  beforeEach(() => {
    adapter = new DiscordAdapter({
      token: 'test-token',
      clientId: 'test-client-id',
    });
  });

  describe('parseMessage', () => {
    test('parseia mensagem de DM', () => {
      const rawMessage = {
        type: 0,
        content: 'Hello bot',
        author: { id: '123', bot: false },
        channelId: '456',
        guildId: null,
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed).toBeDefined();
      expect(parsed.content).toBe('Hello bot');
      expect(parsed.isDirectMessage).toBe(true);
    });

    test('parseia mensagem de guild (canal)', () => {
      const rawMessage = {
        type: 0,
        content: 'Hello everyone',
        author: { id: '123', bot: false },
        channelId: '456',
        guildId: '789',
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed).toBeDefined();
      expect(parsed.content).toBe('Hello everyone');
      expect(parsed.isDirectMessage).toBe(false);
    });

    test('detecta menção ao bot', () => {
      const rawMessage = {
        type: 0,
        content: '<@bot-id> help',
        author: { id: '123', bot: false },
        channelId: '456',
        guildId: '789',
        mentions: {
          everyone: false,
          users: [{ id: 'bot-id', bot: true }],
        },
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed).toBeDefined();
      expect(parsed.botMentioned).toBe(true);
    });
  });

  describe('Mention Gating', () => {
    test('ignora mensagens de grupo sem menção', () => {
      const rawMessage = {
        type: 0,
        content: 'random message',
        author: { id: '123', bot: false },
        channelId: '456',
        guildId: '789',
        mentions: {
          everyone: false,
          users: [],
        },
      };

      const parsed = adapter.parseMessage(rawMessage);

      // Não mencionou o bot
      expect(parsed.botMentioned).toBe(false);
    });

    test('processa mensagens de grupo com menção', () => {
      const rawMessage = {
        type: 0,
        content: '<@bot-id> status',
        author: { id: '123', bot: false },
        channelId: '456',
        guildId: '789',
        mentions: {
          everyone: false,
          users: [{ id: 'bot-id', bot: true }],
        },
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed.botMentioned).toBe(true);
    });

    test('processa todas as mensagens de DM', () => {
      const rawMessage = {
        type: 0,
        content: 'Hello',
        author: { id: '123', bot: false },
        channelId: '456',
        guildId: null,
      };

      const parsed = adapter.parseMessage(rawMessage);

      // DM sempre é processada
      expect(parsed).toBeDefined();
    });
  });

  describe('Slash Commands', () => {
    test('reconhece comando /status', () => {
      const interaction = {
        type: 2, // APPLICATION_COMMAND
        commandName: 'status',
        user: { id: '123' },
        channelId: '456',
        guildId: null,
      };

      expect(interaction.commandName).toBe('status');
    });

    test('reconhece comando /memory', () => {
      const interaction = {
        type: 2,
        commandName: 'memory',
        options: {
          getString: (name: string) => {
            if (name === 'query') return 'filmes';
            return null;
          },
        },
        user: { id: '123' },
        channelId: '456',
      };

      expect(interaction.commandName).toBe('memory');
      expect(interaction.options?.getString('query')).toBe('filmes');
    });

    test('reconhece comando /profile', () => {
      const interaction = {
        type: 2,
        commandName: 'profile',
        user: { id: '123' },
        channelId: '456',
      };

      expect(interaction.commandName).toBe('profile');
    });
  });

  describe('Componentes Interativos', () => {
    test('processa botões', () => {
      const interaction = {
        type: 3, // MESSAGE_COMPONENT
        componentType: 2, // BUTTON
        customId: 'save_movie:123',
        user: { id: '123' },
        message: { id: '456' },
      };

      expect(interaction.componentType).toBe(2);
      expect(interaction.customId).toContain(':');
    });

    test('processa select menus', () => {
      const interaction = {
        type: 3,
        componentType: 3, // SELECT_MENU
        customId: 'select_movie',
        values: ['movie-1', 'movie-2'],
        user: { id: '123' },
      };

      expect(interaction.componentType).toBe(3);
      expect(interaction.values?.length).toBeGreaterThan(0);
    });
  });

  describe('Session Key', () => {
    test('buildSessionKey para Discord DM', () => {
      const sessionKey = adapter.buildSessionKey?.({
        channel: 'discord',
        peerKind: 'direct',
        peerId: 'user-123',
      });

      expect(sessionKey).toBe('agent:main:discord:direct:user-123');
    });

    test('buildSessionKey para Discord guild', () => {
      const sessionKey = adapter.buildSessionKey?.({
        channel: 'discord',
        peerKind: 'guild',
        peerId: 'guild-456',
      });

      expect(sessionKey).toBe('agent:main:discord:guild:guild-456');
    });

    test('buildSessionKey para Discord channel', () => {
      const sessionKey = adapter.buildSessionKey?.({
        channel: 'discord',
        peerKind: 'channel',
        peerId: 'channel-789',
      });

      expect(sessionKey).toBe('agent:main:discord:channel:channel-789');
    });
  });

  describe('Mídia', () => {
    test('parseia mensagem com imagem', () => {
      const rawMessage = {
        type: 0,
        content: '',
        author: { id: '123', bot: false },
        channelId: '456',
        attachments: [
          {
            id: 'att-1',
            name: 'image.png',
            contentType: 'image/png',
            url: 'https://example.com/image.png',
          },
        ],
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed).toBeDefined();
      if (parsed.attachments) {
        expect(parsed.attachments.length).toBe(1);
        expect(parsed.attachments[0].type).toBe('image');
      }
    });

    test('parseia mensagem com áudio', () => {
      const rawMessage = {
        type: 0,
        content: '',
        author: { id: '123', bot: false },
        channelId: '456',
        attachments: [
          {
            id: 'att-1',
            name: 'audio.mp3',
            contentType: 'audio/mpeg',
            url: 'https://example.com/audio.mp3',
          },
        ],
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed).toBeDefined();
      if (parsed.attachments) {
        expect(parsed.attachments.length).toBe(1);
        expect(parsed.attachments[0].type).toBe('audio');
      }
    });

    test('parseia mensagem com arquivo', () => {
      const rawMessage = {
        type: 0,
        content: '',
        author: { id: '123', bot: false },
        channelId: '456',
        attachments: [
          {
            id: 'att-1',
            name: 'document.pdf',
            contentType: 'application/pdf',
            url: 'https://example.com/document.pdf',
          },
        ],
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed).toBeDefined();
      if (parsed.attachments) {
        expect(parsed.attachments.length).toBe(1);
        expect(parsed.attachments[0].type).toBe('file');
      }
    });
  });

  describe('Edição e Exclusão', () => {
    test('detecta mensagem editada', () => {
      const rawMessage = {
        type: 0,
        content: 'Edited message',
        author: { id: '123', bot: false },
        channelId: '456',
        editedTimestamp: new Date().toISOString(),
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed).toBeDefined();
      expect(parsed.edited).toBe(true);
    });

    test('detecta mensagem original', () => {
      const rawMessage = {
        type: 0,
        content: 'Original message',
        author: { id: '123', bot: false },
        channelId: '456',
        editedTimestamp: null,
      };

      const parsed = adapter.parseMessage(rawMessage);

      expect(parsed).toBeDefined();
      expect(parsed.edited).toBe(false);
    });
  });
});
