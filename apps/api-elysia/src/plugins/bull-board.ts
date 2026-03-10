import { closeConversationQueue, enrichmentQueue, messageQueue, responseQueue } from '@nexo/api-core/services/queue-service';
import { BullAdapter } from '@bull-board/api/bullAdapter';
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
			new BullAdapter(messageQueue),
			new BullAdapter(closeConversationQueue),
			new BullAdapter(responseQueue),
			new BullAdapter(enrichmentQueue),
		],
		serverAdapter,
	});

	serverAdapter.setBasePath('/admin/queues');

	const honoApp = new Hono();
	honoApp.route('/', serverAdapter.registerPlugin());

	return honoApp;
}

export const bullBoardApp = createBullBoardApp();
