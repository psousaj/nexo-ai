/**
 * Tools com contratos fortes - v2
 *
 * Cada tool faz UMA coisa específica.
 * Entradas validadas, saídas previsíveis, zero decisão.
 */

import { PostgresProjectionStore } from '@/core/memory/projection-store';
import { conversationService } from '@/services/conversation-service';
import { getRandomLogMessage, toolLogs } from '@/services/conversation/logMessages';
import { enrichmentService } from '@/services/enrichment';
import { bookService } from '@/services/enrichment/book-service';
import { braveSearchService } from '@/services/enrichment/brave-search-service';
import { imageMetadataService } from '@/services/enrichment/image-metadata-service';
import { openGraphService } from '@/services/enrichment/opengraph-service';
import { spotifyService } from '@/services/enrichment/spotify-service';
import { itemService } from '@/services/item-service';
import type {
	BookMetadata,
	ImageMetadata,
	LinkMetadata,
	MemoryMetadata,
	MovieMetadata,
	MusicMetadata,
	NoteMetadata,
	TVShowMetadata,
	VideoMetadata,
} from '@/types';
import { loggers } from '@/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';

export interface ToolContext {
	userId: string;
	conversationId: string;
	provider?: 'telegram' | 'whatsapp' | 'discord';
	externalId?: string;
}

export interface ToolOutput {
	success: boolean;
	message?: string;
	data?: any;
	error?: string;
}

// ProjectionStore instance for writing memory envelopes (Path A)
const projectionStore = new PostgresProjectionStore();
