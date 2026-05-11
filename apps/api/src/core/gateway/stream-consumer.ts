/**
 * Streaming context scrubber: strips <memory-context>...</memory-context> tags
 * across chunk boundaries using a state machine.
 */
export class StreamingContextScrubber {
	private state: 'out' | 'lt' | 'tag' | 'in' | 'close_lt' | 'close_tag' = 'out';
	private buffer = '';

	scrub(chunk: string): string {
		let output = '';
		for (const char of chunk) {
			switch (this.state) {
				case 'out':
					if (char === '<') {
						this.buffer = '<';
						this.state = 'lt';
					} else {
						output += char;
					}
					break;
				case 'lt':
					this.buffer += char;
					if (this.buffer === '<memory-context>') {
						this.state = 'in';
						this.buffer = '';
					} else if (!'<memory-context>'.startsWith(this.buffer)) {
						output += this.buffer;
						this.buffer = '';
						this.state = 'out';
					}
					break;
				case 'in':
					if (char === '<') {
						this.buffer = '<';
						this.state = 'close_lt';
					}
					break;
				case 'close_lt':
					this.buffer += char;
					if (this.buffer === '</memory-context>') {
						this.state = 'out';
						this.buffer = '';
					} else if (!'</memory-context>'.startsWith(this.buffer)) {
						// False alarm, discard buffered chars (they're inside the tag)
						this.buffer = '';
						this.state = 'in';
					}
					break;
			}
		}
		return output;
	}

	flush(): string {
		if (this.state === 'lt') {
			const buf = this.buffer;
			this.buffer = '';
			this.state = 'out';
			return buf;
		}
		// In 'in' or 'close_lt', discard buffer (inside tag)
		this.buffer = '';
		this.state = 'out';
		return '';
	}
}

export interface GatewayStreamConsumerDeps {
	chatId: number;
	sendMessage: (chatId: number, text: string) => Promise<number | null>;
	editMessageText: (chatId: number, messageId: number, text: string) => Promise<void>;
	throttleMs?: number;
	cursor?: string;
	maxEditBuffer?: number;
	maxStreamingTimeMs?: number;
}

/**
 * GatewayStreamConsumer drives live Telegram message updates during a streaming
 * LLM response. It throttles edits, appends a cursor when over the max buffer,
 * and automatically finishes after the max streaming time.
 */
export class GatewayStreamConsumer {
	private scrubber = new StreamingContextScrubber();
	private accumulated = '';
	private lastEdit = 0;
	private messageId: number | null = null;
	private finished = false;
	private startTime: number;
	private editTimer: ReturnType<typeof setTimeout> | null = null;
	private timeoutTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(private deps: GatewayStreamConsumerDeps) {
		this.startTime = Date.now();
		const maxTime = deps.maxStreamingTimeMs ?? 30000;
		this.timeoutTimer = setTimeout(() => {
			if (!this.finished) {
				void this.finish('');
			}
		}, maxTime);
	}

	async consume(delta: string): Promise<void> {
		if (this.finished) return;

		const scrubbed = this.scrubber.scrub(delta);
		this.accumulated += scrubbed;

		const now = Date.now();
		const throttle = this.deps.throttleMs ?? 1000;

		if (now - this.lastEdit >= throttle) {
			await this.push();
		} else if (!this.editTimer) {
			this.editTimer = setTimeout(() => {
				this.editTimer = null;
				void this.push();
			}, throttle - (now - this.lastEdit));
		}
	}

	private async push(): Promise<void> {
		if (this.finished) return;

		let text = this.accumulated;
		const maxBuffer = this.deps.maxEditBuffer ?? 40;
		const cursor = this.deps.cursor ?? '▉';

		if (text.length > maxBuffer) {
			text = text.slice(0, maxBuffer) + cursor;
		}

		try {
			if (!this.messageId) {
				this.messageId = await this.deps.sendMessage(this.deps.chatId, text);
			} else {
				await this.deps.editMessageText(this.deps.chatId, this.messageId, text);
			}
			this.lastEdit = Date.now();
		} catch {
			// Ignore Telegram API errors during streaming
		}
	}

	async finish(finalText: string): Promise<void> {
		if (this.finished) return;
		this.finished = true;

		if (this.editTimer) {
			clearTimeout(this.editTimer);
			this.editTimer = null;
		}
		if (this.timeoutTimer) {
			clearTimeout(this.timeoutTimer);
			this.timeoutTimer = null;
		}

		// Strip all memory-context tags from final text using regex since it's complete
		const scrubbed = finalText.replace(/<memory-context>[\s\S]*?<\/memory-context>/g, '');

		try {
			if (!this.messageId) {
				await this.deps.sendMessage(this.deps.chatId, scrubbed);
			} else {
				await this.deps.editMessageText(this.deps.chatId, this.messageId, scrubbed);
			}
		} catch {
			// Ignore
		}
	}
}
