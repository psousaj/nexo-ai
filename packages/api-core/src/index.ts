/**
 * @nexo/api-core - Framework-agnostic business logic for Nexo AI
 *
 * Shared between the Hono (apps/api) and Elysia (apps/api-elysia) runtimes.
 *
 * Sub-path imports are supported via package.json "exports":
 *   import { db } from '@nexo/api-core/db'
 *   import { conversationService } from '@nexo/api-core/services/conversation-service'
 */

// Core types
export * from './types/index.js';

// DB
export * from './db/index.js';

// Services — commonly needed exports
export { conversationService } from './services/conversation-service.js';
export { itemService } from './services/item-service.js';
export { userService } from './services/user-service.js';
export { globalErrorHandler } from './services/error/error.service.js';
export { featureFlagService } from './services/feature-flag.service.js';
export {
	messageQueue,
	closeConversationQueue,
	responseQueue,
	enrichmentQueue,
	runConversationCloseCron,
	runAwaitingConfirmationTimeoutCron,
	scheduleConversationClose,
	cancelConversationClose,
	queueResponse,
} from './services/queue-service.js';

// Utils
export * from './utils/logger.js';
export * from './utils/json-parser.js';
export * from './utils/retry.js';

// Sentry & OTel
export * from './sentry.js';
export * from './otel.js';

// Auth
export { authPlugin } from './lib/auth.js';
