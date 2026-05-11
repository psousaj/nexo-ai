import { describe, expect, it, vi } from 'vitest';
import { GatewayStreamConsumer, StreamingContextScrubber } from '../core/gateway/stream-consumer';

describe('StreamingContextScrubber', () => {
	it('strips complete tags in a single chunk', () => {
		const scrubber = new StreamingContextScrubber();
		expect(scrubber.scrub('hello <memory-context>secret</memory-context> world')).toBe('hello  world');
	});

	it('strips tags split across chunks', () => {
		const scrubber = new StreamingContextScrubber();
		expect(scrubber.scrub('hello <memo')).toBe('hello ');
		expect(scrubber.scrub('ry-context>secret</mem')).toBe('');
		expect(scrubber.scrub('ory-context> world')).toBe(' world');
	});

	it('returns uncompleted opening tag on flush', () => {
		const scrubber = new StreamingContextScrubber();
		expect(scrubber.scrub('hello <me')).toBe('hello ');
		expect(scrubber.flush()).toBe('<me');
	});

	it('discards incomplete closing tag on flush', () => {
		const scrubber = new StreamingContextScrubber();
		expect(scrubber.scrub('hello <memory-context>secret</mem')).toBe('hello ');
		expect(scrubber.flush()).toBe('');
	});
});

describe('GatewayStreamConsumer', () => {
	const createConsumer = (overrides?: Partial<Parameters<typeof GatewayStreamConsumer>[0]>) => {
		const sendMessage = vi.fn(async (_chatId: number, _text: string) => 42);
		const editMessageText = vi.fn(async (_chatId: number, _messageId: number, _text: string) => {});
		const consumer = new GatewayStreamConsumer({
			chatId: 123,
			sendMessage,
			editMessageText,
			throttleMs: 100,
			cursor: '▉',
			maxEditBuffer: 10,
			maxStreamingTimeMs: 500,
			...overrides,
		});
		return { consumer, sendMessage, editMessageText };
	};

	it('sends a new message on first chunk', async () => {
		const { consumer, sendMessage, editMessageText } = createConsumer();
		await consumer.consume('hello');
		expect(sendMessage).toHaveBeenCalledWith(123, 'hello');
		expect(editMessageText).not.toHaveBeenCalled();
	});

	it('throttles edits', async () => {
		const { consumer, sendMessage, editMessageText } = createConsumer();
		await consumer.consume('a');
		expect(sendMessage).toHaveBeenCalledTimes(1);
		await consumer.consume('b');
		// Within throttle window, no edit yet
		expect(editMessageText).not.toHaveBeenCalled();
		// Wait for throttle
		await new Promise((r) => setTimeout(r, 120));
		expect(editMessageText).toHaveBeenCalledWith(123, 42, 'ab');
	});

	it('appends cursor when text exceeds maxEditBuffer', async () => {
		const { consumer, sendMessage } = createConsumer();
		await consumer.consume('this is a very long text');
		expect(sendMessage).toHaveBeenCalledWith(123, 'this is a ▉');
	});

	it('auto-finishes after maxStreamingTimeMs', async () => {
		const { consumer, sendMessage, editMessageText } = createConsumer();
		await consumer.consume('x');
		expect(sendMessage).toHaveBeenCalledWith(123, 'x');
		// Wait for timeout
		await new Promise((r) => setTimeout(r, 600));
		expect(editMessageText).toHaveBeenCalledWith(123, 42, '');
	});

	it('finish replaces accumulated text with finalText', async () => {
		const { consumer, sendMessage, editMessageText } = createConsumer();
		await consumer.consume('partial');
		expect(sendMessage).toHaveBeenCalledWith(123, 'partial');
		await consumer.finish('final response');
		expect(editMessageText).toHaveBeenCalledWith(123, 42, 'final response');
	});

	it('strips memory-context tags in finish', async () => {
		const { consumer, sendMessage } = createConsumer();
		await consumer.finish('hello <memory-context>secret</memory-context> world');
		expect(sendMessage).toHaveBeenCalledWith(123, 'hello  world');
	});
});
