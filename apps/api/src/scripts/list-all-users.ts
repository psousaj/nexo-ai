import { db } from '../db';
import { userAccounts, users } from '../db/schema';
import { conversations } from '../db/schema/conversations';

async function listUsers() {
	console.log('--- Listing All Users ---');

	const allUsers = await db.select().from(users);
	const allAccounts = await db.select().from(userAccounts);
	const allConversations = await db.select().from(conversations);

	console.log(`Debug: Total Conversations in DB: ${allConversations.length}`);

	for (const u of allUsers) {
		const accounts = allAccounts.filter((a) => a.userId === u.id);
		const userConvs = allConversations.filter((c) => c.userId === u.id);
		console.log(`User ID: ${u.id} | Name: ${u.name} | Accounts: ${accounts.length} | Convs: ${userConvs.length}`);
	}

	// Check for conversations not belonging to these users
	const validUserIds = new Set(allUsers.map((u) => u.id));
	const orphanConvs = allConversations.filter((c) => !validUserIds.has(c.userId));
	if (orphanConvs.length > 0) {
		console.log(`\n⚠️ ORPHAN CONVERSATIONS FOUND: ${orphanConvs.length}`);
		// Group by userId
		const orphansMap = new Map<string, number>();
		orphanConvs.forEach((c) => orphansMap.set(c.userId, (orphansMap.get(c.userId) || 0) + 1));
		orphansMap.forEach((cnt, uid) => console.log(`- Missing User ${uid}: ${cnt} convs`));
	}

	process.exit(0);
}

listUsers().catch(console.error);
