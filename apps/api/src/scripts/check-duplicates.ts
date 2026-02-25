import { db } from '@/db';
import { authProviders, users } from '@/db/schema';

async function checkDuplicates() {
	console.log('--- Checking for Duplicate Users ---');

	const allUsers = await db.select().from(users);
	console.log(`Total Users: ${allUsers.length}`);

	// Group users by phone em metadata para identificar possíveis duplicados
	const allAccounts = await db.select().from(authProviders);
	console.log(`Total Accounts: ${allAccounts.length}`);

	console.log('\n--- Accounts ---');
	for (const acc of allAccounts) {
		const user = allUsers.find((u) => u.id === acc.userId);
		console.log(
			`User: ${user?.name} (${user?.id}) | Account: ${acc.provider} / ${acc.providerUserId} | Metadata: ${JSON.stringify(acc.metadata)}`,
		);
	}

	// Check for users with same phone in metadata
	console.log('\n--- Potential Duplicates by Phone ---');
	const phones = new Map<string, string[]>();

	for (const acc of allAccounts) {
		const phone = (acc.metadata as any)?.phone;
		if (phone) {
			const existing = phones.get(phone) || [];
			existing.push(acc.userId);
			phones.set(phone, existing);
		}
	}

	for (const [phone, userIds] of phones.entries()) {
		if (userIds.length > 1) {
			console.log(`Duplicate Phone ${phone} found for User IDs: ${userIds.join(', ')}`);
		}
	}

	process.exit(0);
}

checkDuplicates().catch(console.error);
