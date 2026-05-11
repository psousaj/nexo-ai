import { describe, expect, it, vi } from 'vitest';
import { PostgresTranscriptStore } from '../core/session/transcript-store';

vi.mock('@/db', () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => []),
					limit: vi.fn(() => []),
				})),
			})),
		})),
		insert: vi.fn(() => ({
			values: vi.fn(() => Promise.resolve()),
		})),
	},
}));

vi.mock('@/db/schema/session-transcripts', () => ({
	sessionTranscripts: {
		sessionId: { name: 'session_id' },
		sequence: { name: 'sequence' },
		content: { name: 'content' },
		searchText: { name: 'search_text' },
		createdAt: { name: 'created_at' },
	},
}));

import { db } from '@/db';
import { sessionTranscripts } from '@/db/schema/session-transcripts';

describe('PostgresTranscriptStore', () => {
	const store = new PostgresTranscriptStore();

	describe('load', () => {
		it('should return transcripts in order', async () => {
			const mockRows = [
				{
					sessionId: 'sess-1',
					content: { role: 'user', content: 'Hello' },
					sequence: 0,
					createdAt: new Date('2024-01-01'),
				},
				{
					sessionId: 'sess-1',
					content: { role: 'assistant', content: 'Hi there' },
					sequence: 1,
					createdAt: new Date('2024-01-02'),
				},
			];

			const whereFn = vi.fn(() => ({
				orderBy: vi.fn(() => mockRows),
			}));
			const fromFn = vi.fn(() => ({
				where: whereFn,
			}));
			const selectFn = vi.fn(() => ({
				from: fromFn,
			}));

			(db.select as any).mockImplementation(selectFn);

			const result = await store.load('sess-1');

			expect(selectFn).toHaveBeenCalled();
			expect(fromFn).toHaveBeenCalledWith(sessionTranscripts);
			expect(whereFn).toHaveBeenCalled();
			expect(result).toHaveLength(2);
			expect(result[0].role).toBe('user');
			expect(result[0].content).toBe('Hello');
			expect(result[0].sequence).toBe(0);
			expect(result[1].role).toBe('assistant');
			expect(result[1].content).toBe('Hi there');
			expect(result[1].sequence).toBe(1);
		});

		it('should return empty array when no transcripts', async () => {
			const whereFn = vi.fn(() => ({
				orderBy: vi.fn(() => []),
			}));
			const fromFn = vi.fn(() => ({
				where: whereFn,
			}));
			const selectFn = vi.fn(() => ({
				from: fromFn,
			}));

			(db.select as any).mockImplementation(selectFn);

			const result = await store.load('sess-empty');
			expect(result).toEqual([]);
		});
	});

	describe('append', () => {
		it('should insert entry with correct values', async () => {
			const valuesFn = vi.fn(() => Promise.resolve());
			(db.insert as any).mockImplementation(() => ({
				values: valuesFn,
			}));

			const entry = {
				role: 'user' as const,
				content: 'Test message',
				sequence: 5,
				timestamp: new Date('2024-06-01'),
			};

			await store.append('sess-1', entry);

			expect(db.insert).toHaveBeenCalledWith(sessionTranscripts);
			expect(valuesFn).toHaveBeenCalledWith({
				sessionId: 'sess-1',
				content: {
					role: 'user',
					content: 'Test message',
					tool_calls: undefined,
				},
				sequence: 5,
				searchText: 'Test message',
				createdAt: entry.timestamp,
			});
		});
	});

	describe('getLastSequence', () => {
		it('should return the last sequence number', async () => {
			const whereFn = vi.fn(() => ({
				orderBy: vi.fn(() => ({
					limit: vi.fn(() => [{ sequence: 42 }]),
				})),
			}));
			const fromFn = vi.fn(() => ({
				where: whereFn,
			}));
			const selectFn = vi.fn(() => ({
				from: fromFn,
			}));

			(db.select as any).mockImplementation(selectFn);

			const result = await store.getLastSequence('sess-1');
			expect(result).toBe(42);
		});

		it('should return -1 when no transcripts exist', async () => {
			const whereFn = vi.fn(() => ({
				orderBy: vi.fn(() => ({
					limit: vi.fn(() => []),
				})),
			}));
			const fromFn = vi.fn(() => ({
				where: whereFn,
			}));
			const selectFn = vi.fn(() => ({
				from: fromFn,
			}));

			(db.select as any).mockImplementation(selectFn);

			const result = await store.getLastSequence('sess-empty');
			expect(result).toBe(-1);
		});
	});
});
