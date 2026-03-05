import { serve } from '@hono/node-server';
import { env } from '@nexo/env';
import { createIntakeWorkerApp } from './app';

const app = createIntakeWorkerApp();
const port = env.PORT;

serve({
	fetch: app.fetch,
	port,
});

console.log(`intake-worker listening on port ${port}`);
