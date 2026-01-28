import { db } from '../db';
import { users } from '../db/schema';
import { conversations } from '../db/schema/conversations';

async function checkOrphans() {
	console.log('--- Checking for Ghost Conversations ---');

	// Fetch valid users
	const allUsers = await db.select().from(users);
	const validUserIds = new Set(allUsers.map((u) => u.id));

	try {
		const conversationsList = await db.select().from(conversations);
		const ghosts = new Map<string, number>();

		for (const conv of conversationsList) {
			if (!validUserIds.has(conv.userId)) {
				const count = ghosts.get(conv.userId) || 0;
				ghosts.set(conv.userId, count + 1);
			}
		}

		if (ghosts.size === 0) {
			console.log('✅ No ghost conversations found. All conversations belong to valid users.');
		} else {
			console.log(`⚠️ Found ghost conversations for ${ghosts.size} deleted users:`);
			for (const [uid, count] of ghosts.entries()) {
				console.log(`- User ID ${uid}: ${count} conversations`);
			}
		}
	} catch (e) {
		console.error('Could not fetch conversations:', e);
	}

	process.exit(0);
}

checkOrphans().catch(console.error);
