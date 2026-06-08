import { describe, expect, it } from 'vitest';
import { SessionContextBuilder, type SessionSource } from './session-context-builder';

describe('SessionContextBuilder', () => {
	const builder = new SessionContextBuilder();

	describe('build', () => {
		it('should include platform and user name in session context', () => {
			const source: SessionSource = {
				platform: 'telegram',
				chatId: '123456',
				chatType: 'dm',
				userId: '789',
				userName: 'José Filho',
			};

			const result = builder.build(source);

			expect(result).toContain('**Source:** Telegram (DM with José Filho)');
			expect(result).toContain('**User:** José Filho');
			expect(result).toContain('**Connected Platforms:** local, telegram: ✓');
			expect(result).toContain('**Delivery options:**');
			expect(result).toContain('"origin" → Back to this chat');
			expect(result).toContain('"local" → Save to local files only');
		});

		it('should format DM differently from group', () => {
			const dmSource: SessionSource = {
				platform: 'telegram',
				chatId: '123456',
				chatType: 'dm',
				userId: '789',
				userName: 'José Filho',
			};

			const groupSource: SessionSource = {
				platform: 'telegram',
				chatId: '789012',
				chatName: 'Nexo Developers',
				chatType: 'group',
				userId: '789',
				userName: 'José Filho',
			};

			const dmResult = builder.build(dmSource);
			const groupResult = builder.build(groupSource);

			expect(dmResult).toContain('DM with José Filho');
			expect(groupResult).toContain('Group: Nexo Developers');
			expect(dmResult).not.toContain('Group:');
			expect(groupResult).not.toContain('DM with');
		});

		it('should hash PII when redactPii is true', () => {
			const source: SessionSource = {
				platform: 'telegram',
				chatId: '123456',
				chatType: 'dm',
				userId: '789',
				userName: 'José Filho',
			};

			const result = builder.build(source, { redactPii: true });

			expect(result).not.toContain('José Filho');
			expect(result).toContain('User-');
			expect(result).toMatch(/User-[a-f0-9]+/);
		});

		it('should handle missing userName gracefully', () => {
			const source: SessionSource = {
				platform: 'telegram',
				chatId: '123456',
				chatType: 'dm',
				userId: '789',
			};

			const result = builder.build(source);

			expect(result).toContain('DM with Unknown');
			expect(result).toContain('**User:** Unknown');
		});

		it('should handle missing chatName in group gracefully', () => {
			const source: SessionSource = {
				platform: 'telegram',
				chatId: '789012',
				chatType: 'group',
				userId: '789',
				userName: 'José Filho',
			};

			const result = builder.build(source);

			expect(result).toContain('Group: Unknown');
		});
	});
});
