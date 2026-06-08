import type { ItemMetadata, ItemType } from '@nexo/shared';

export type { ItemType, ItemMetadata };

export type ConversationState =
	| 'idle'
	| 'processing'
	| 'awaiting_context'
	| 'off_topic_chat'
	| 'awaiting_confirmation'
	| 'awaiting_final_confirmation'
	| 'enriching'
	| 'saving'
	| 'error'
	| 'waiting_close'
	| 'closed';

export type ConversationContext = Record<string, unknown>;

export type MessageRole = 'user' | 'assistant';

export type MessageMetadata = Record<string, unknown>;
