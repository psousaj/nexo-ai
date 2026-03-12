import { authPlugin } from '@nexo/api-core/lib/auth';
import { Hono } from 'hono';

export const authRouter = new Hono().all('/*', (c) => authPlugin.handler(c.req.raw));
