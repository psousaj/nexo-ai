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
			sendMessage: vi.fn().mockResolvedValue({ messageId: 1 }),
			editMessage: vi.fn().mockResolvedValue(undefined),
		};
	}

	it('should create a message on first chunk', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.consume('Hello', false);
		expect(deps.sendMessage).toHaveBeenCalledTimes(1);
		expect(deps.sendMessage).toHaveBeenCalledWith(123, 'Hello▉');
	});

	it('should throttle edits to 1 second', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.consume('Hello', false);
		expect(deps.editMessage).not.toHaveBeenCalled();
		await consumer.consume(' world', false);
		expect(deps.editMessage).not.toHaveBeenCalled();
	});

	it('should edit immediately when buffer reaches 40+ chars', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.consume('Hello', false);
		const longText = 'a'.repeat(40);
		await consumer.consume(longText, false);
		expect(deps.editMessage).toHaveBeenCalledTimes(1);
		expect(deps.editMessage).toHaveBeenCalledWith(123, 1, 'Hello' + 'a'.repeat(40) + '▉');
	});

	it('should remove cursor on finish', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.consume('Hello', false);
		await consumer.finish('Hello world');
		expect(deps.editMessage).toHaveBeenCalledWith(123, 1, 'Hello world');
	});

	it('should send new message when max streaming time exceeded', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		// Override start time to be in the past
		(consumer as any).startTime = Date.now() - 31 * 1000;
		await consumer.consume('Hello', false);
		await consumer.consume(' world', false);
		expect(deps.sendMessage).toHaveBeenCalledTimes(2);
		expect(deps.sendMessage).toHaveBeenLastCalledWith(123, 'Hello world');
	});

	it('should send final text via sendMessage if no chunks were consumed', async () => {
		const deps = createDeps();
		const consumer = new GatewayStreamConsumer(deps);
		await consumer.finish('Final text');
		expect(deps.sendMessage).toHaveBeenCalledTimes(1);
		expect(deps.sendMessage).toHaveBeenCalledWith(123, 'Final text');
	});
});
