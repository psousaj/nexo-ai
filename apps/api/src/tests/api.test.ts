import { describe, expect, it } from 'vitest';
import app from '../server';

describe('Health Endpoint', () => {
	it('should return OK status', async () => {
		const response = await app.request('http://localhost:3000/health');

		expect(response.status).toBe(200);
		const body = (await response.json()) as any;
		expect(body.status).toBe('ok');
		expect(body.timestamp).toBeDefined();
	});
});

describe('Items Endpoints', () => {
	const testUserId = 'test-user-123';

	it('should require userId for listing items', async () => {
		const response = await app.request('http://localhost:3000/items');

		expect(response.status).toBe(400);
		const body = (await response.json()) as any;
		expect(body.error).toBeDefined();
	});

	it('should return items list with userId', async () => {
		const response = await app.request(`http://localhost:3000/items?userId=${testUserId}`);

		expect(response.status).toBe(200);
		const body = (await response.json()) as any;
		expect(Array.isArray(body.items)).toBe(true);
	});

	it('should require userId for search', async () => {
		const response = await app.request('http://localhost:3000/items/search', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: 'test' }),
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as any;
		expect(body.error).toBeDefined();
	});

	it('should return 404 for unknown routes', async () => {
		const response = await app.request('http://localhost:3000/unknown');

		expect(response.status).toBe(404);
		const body = (await response.json()) as any;
		expect(body.error).toBe('Route not found');
	});
});
