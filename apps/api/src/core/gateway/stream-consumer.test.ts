import { describe, expect, it, vi } from 'vitest';
import { GatewayStreamConsumer, StreamingContextScrubber } from './stream-consumer';

describe('StreamingContextScrubber', () => {
	it('should remove memory-context tags from chunks', () => {
		const scrubber = new StreamingContextScrubber();
		expect(scrubber.scrub('Hello <memory-context>')).toBe('Hello ');
		expect(scrubber.scrub('secret data</memory-context> world')).toBe(' world');
	});

	it('should pass through normal text', () => {
		const scrubber = new StreamingContextScrubber();
		expect(scrubber.scrub('Hello world')).toBe('Hello world');
	});

	it('should handle complete tag in one chunk', () => {
		const scrubber = new StreamingContextScrubber();
		expect(scrubber.scrub('Hello <memory-context>secret</memory-context> world')).toBe('Hello  world');
	});
});

describe('GatewayStreamConsumer', () => {
	function createDeps() {
		return {
			chatId: 123,
			sendMessage: vi.fn().mockResolvedValue(1),
			editMessageText: vi.fn().mockResolvedValue(undefined),
			throttleMs: 0, // No throttle for testing
		};
	}

	it('should create a message on first chunk', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.consume('Hello');
		expect(deps.sendMessage).toHaveBeenCalledTimes(1);
	});

	it('should throttle edits via throttleMs option', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer({ ...deps, throttleMs: 100000 });
		await consumer.consume('Hello');
		expect(deps.sendMessage).toHaveBeenCalledTimes(1);
		await consumer.consume(' world');
		// With long throttle, second chunk should not trigger immediate edit
		expect(deps.editMessageText).not.toHaveBeenCalled();
	});

	it('should remove cursor on finish via edit', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.consume('Hello');
		await consumer.finish('Hello world');
		expect(deps.editMessageText).toHaveBeenCalledWith(123, 1, 'Hello world');
	});

	it('should send finish text via sendMessage if no chunks consumed', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.finish('Final text');
		expect(deps.sendMessage).toHaveBeenCalledTimes(1);
		expect(deps.sendMessage).toHaveBeenCalledWith(123, 'Final text');
	});

	it('should call finish on timeout', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer({ ...deps, maxStreamingTimeMs: 10 });
		// Wait for timeout to fire
		await new Promise((r) => setTimeout(r, 50));
		expect(deps.sendMessage).toHaveBeenCalled();
	});

	it('should strip memory-context tags on finish', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.consume('Hello');
		await consumer.finish('Hello <memory-context>secret</memory-context> world');
		expect(deps.editMessageText).toHaveBeenCalledWith(123, 1, 'Hello  world');
	});
});
