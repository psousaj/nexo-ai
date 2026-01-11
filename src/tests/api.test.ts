import { describe, expect, it } from 'bun:test';
import app from '../app';

describe('Health Endpoint', () => {
	it('should return OK status', async () => {
		const response = await app.handle(new Request('http://localhost/health'));

		expect(response.status).toBe(200);
		const body = (await response.json()) as any;
		expect(body.status).toBe('ok');
		expect(body.timestamp).toBeDefined();
	});
});

describe('Items Endpoints', () => {
	const testUserId = 'test-user-123';

	it('should require userId for listing items', async () => {
		const response = await app.handle(new Request('http://localhost/items'));

		expect(response.status).toBe(400);
		const body = (await response.json()) as any;
		expect(body.error).toBeDefined();
	});

	it('should return items list with userId', async () => {
		const response = await app.handle(new Request(`http://localhost/items?userId=${testUserId}`));

		expect(response.status).toBe(200);
		const body = (await response.json()) as any;
		expect(body.items).toBeArray();
	});

	it('should require userId for search', async () => {
		const response = await app.handle(
			new Request('http://localhost/items/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: 'test' }),
			})
		);

		expect(response.status).toBe(400);
		const body = (await response.json()) as any;
		expect(body.error).toBeDefined();
	});

	it('should return 404 for unknown routes', async () => {
		const response = await app.handle(new Request('http://localhost/unknown'));

		expect(response.status).toBe(404);
		const body = (await response.json()) as any;
		expect(body.error).toBe('Route not found');
	});
});
