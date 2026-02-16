/**
 * Testes unitários para Session Service (OpenClaw Session Keys)
 */

import { describe, test, expect } from 'vitest';
import {
  buildSessionKey,
  parseSessionKey,
  type SessionKeyParams,
} from '@/services/session-service';

describe('Session Service - OpenClaw Session Keys', () => {
  describe('buildSessionKey', () => {
    test('cria session key básica para Telegram DM', () => {
      const params: SessionKeyParams = {
        channel: 'telegram',
        peerKind: 'direct',
        peerId: '+1234567890',
      };

      const sessionKey = buildSessionKey(params);
      expect(sessionKey).toBe('agent:main:telegram:direct:+1234567890');
    });

    test('cria session key com agentId customizado', () => {
      const params: SessionKeyParams = {
        agentId: 'dev',
        channel: 'telegram',
        peerKind: 'direct',
        peerId: '+1234567890',
      };

      const sessionKey = buildSessionKey(params);
      expect(sessionKey).toBe('agent:dev:telegram:direct:+1234567890');
    });

    test('cria session key para Discord canal', () => {
      const params: SessionKeyParams = {
        channel: 'discord',
        peerKind: 'channel',
        peerId: '987654321',
      };

      const sessionKey = buildSessionKey(params);
      expect(sessionKey).toBe('agent:main:discord:channel:987654321');
    });

    test('cria session key para grupo', () => {
      const params: SessionKeyParams = {
        channel: 'telegram',
        peerKind: 'group',
        peerId: '-1001234567890',
      };

      const sessionKey = buildSessionKey(params);
      expect(sessionKey).toBe('agent:main:telegram:group:-1001234567890');
    });
  });

  describe('parseSessionKey', () => {
    test('faz parse de session key básica', () => {
      const sessionKey = 'agent:main:telegram:direct:+1234567890';
      const parsed = parseSessionKey(sessionKey);

      expect(parsed).toEqual({
        agentId: 'main',
        channel: 'telegram',
        peerKind: 'direct',
        peerId: '+1234567890',
      });
    });

    test('faz parse de session key com accountId', () => {
      const sessionKey = 'agent:main:telegram:bot12345:direct:+1234567890';
      const parsed = parseSessionKey(sessionKey);

      expect(parsed).toEqual({
        agentId: 'main',
        channel: 'telegram',
        accountId: 'bot12345',
        peerKind: 'direct',
        peerId: '+1234567890',
      });
    });

    test('lança erro em session key inválida', () => {
      const invalidKey = 'invalid-session-key';
      expect(() => parseSessionKey(invalidKey)).toThrow();
    });
  });

  describe('Round-trip', () => {
    test('build -> parse preserva dados', () => {
      const originalParams: SessionKeyParams = {
        agentId: 'custom',
        channel: 'whatsapp',
        accountId: 'business123',
        peerKind: 'direct',
        peerId: 'user-456',
      };

      const sessionKey = buildSessionKey(originalParams);
      const parsed = parseSessionKey(sessionKey);

      expect(parsed.agentId).toBe(originalParams.agentId);
      expect(parsed.channel).toBe(originalParams.channel);
      expect(parsed.accountId).toBe(originalParams.accountId);
      expect(parsed.peerKind).toBe(originalParams.peerKind);
      expect(parsed.peerId).toBe(originalParams.peerId);
    });
  });
});
