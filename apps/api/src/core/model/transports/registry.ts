import type { ProviderTransport } from './base';
import { ChatCompletionsTransport } from './chat-completions';
import type { ApiMode } from './types';

const registry = new Map<ApiMode, ProviderTransport>();

export function registerTransport(mode: ApiMode, transport: ProviderTransport): void {
	registry.set(mode, transport);
}

export function getTransport(mode: ApiMode): ProviderTransport {
	const transport = registry.get(mode);
	if (!transport) throw new Error(`No transport registered for api_mode: ${mode}`);
	return transport;
}

// Register defaults
registerTransport('chat_completions', new ChatCompletionsTransport());
