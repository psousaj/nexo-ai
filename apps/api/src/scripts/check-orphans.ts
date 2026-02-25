import { db } from '@/db';
import { authProviders, users } from '@/db/schema';
import { conversations } from '@/db/schema/conversations';

async function checkOrphans() {
	console.log('--- Checking for Orphan Users ---');

	const allAccounts = await db.select().from(authProviders);
	const userIdsWithAccounts = new Set(allAccounts.map((a) => a.userId));

	const allUsers = await db.select().from(users);

	const orphans = allUsers.filter((u) => !userIdsWithAccounts.has(u.id));

	console.log(`Total Users: ${allUsers.length}`);
	console.log(`Users with Accounts: ${userIdsWithAccounts.size}`);
	console.log(`Orphan Users: ${orphans.length}`);

	for (const orphan of orphans) {
		console.log(`Orphan: ${orphan.name} (${orphan.id})`);
	}

	console.log('\n--- checking conversations ---');
	// I need to check conversation schema path if it fails, but assuming defaults
	try {
		const conversationsData = await db.select().from(conversations);
		const convsByUser = new Map<string, number>();
		for (const conv of conversationsData) {
			const count = convsByUser.get(conv.userId) || 0;
			convsByUser.set(conv.userId, count + 1);
		}

		for (const [uid, count] of convsByUser.entries()) {
			const user = allUsers.find((u) => u.id === uid);
			console.log(`User ${user?.name || 'Unknown'} (${uid}): ${count} conversations`);
		}
	} catch (_e) {
		console.log('Could not fetch conversations (schema path might be wrong)');
	}

	process.exit(0);
}

checkOrphans().catch(console.error);
