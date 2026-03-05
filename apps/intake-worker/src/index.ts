import { serve } from '@hono/node-server';
import { createIntakeWorkerApp } from './app';
import { getWorkerEnv } from './config/env';

const app = createIntakeWorkerApp();
const env = getWorkerEnv();

serve({
	fetch: app.fetch,
	port: env.PORT,
});

console.log(`intake-worker listening on port ${env.PORT}`);
