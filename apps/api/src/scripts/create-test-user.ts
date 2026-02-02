import { authPlugin } from '../lib/auth';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

async function createTestUser() {
	const email = 'teste@crudbox.tech';
	const password = '1234Senha';
	const name = 'Test User';

	console.log(`Checking if user ${email} exists...`);
	const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

	if (existingUser.length > 0) {
		console.log('User already exists.');
		process.exit(0);
	}

	console.log('Creating user via better-auth API...');
	try {
		// Calling signUpEmail server-side
		// The type definition might require a context or request, but let's try calling it directly
		// as better-auth often exposes these as callable functions.
		// If this fails, we might need to mock a request.
		const res = await authPlugin.api.signUpEmail({
			body: {
				email,
				password,
				name,
			},
			// We might need to pass headers or undefined context
			asResponse: false,
		});

		console.log('User created successfully:', res);
	} catch (error) {
		console.error('Error creating user:', error);
		if (error instanceof Error) {
			console.error('Stack:', error.stack);
		}
	}
	process.exit(0);
}

createTestUser();
