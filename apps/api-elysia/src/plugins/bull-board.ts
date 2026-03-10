import { closeConversationQueue, enrichmentQueue, messageQueue, responseQueue } from '@nexo/api-core/services/queue-service';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import { HonoAdapter } from '@bull-board/hono';
import { serveStatic } from 'hono/bun';
import { Hono } from 'hono';

/**
 * Creates a Hono app with Bull Board mounted.
 * Exported as a fetch handler to be mounted in Elysia via .mount()
 */
function createBullBoardApp() {
	const serverAdapter = new HonoAdapter(serveStatic);

	createBullBoard({
		queues: [
			new BullMQAdapter(messageQueue),
			new BullMQAdapter(closeConversationQueue),
			new BullMQAdapter(responseQueue),
			new BullMQAdapter(enrichmentQueue),
		],
		serverAdapter,
	});

	serverAdapter.setBasePath('/admin/queues');

	const honoApp = new Hono();
	honoApp.route('/', serverAdapter.registerPlugin());

	return honoApp;
}

export const bullBoardApp = createBullBoardApp();
