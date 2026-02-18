import { db } from '@/db';
import { userAccounts, users } from '@/db/schema';

async function checkDuplicates() {
	console.log('--- Checking for Duplicate Users ---');

	const allUsers = await db.select().from(users);
	console.log(`Total Users: ${allUsers.length}`);

	// Group users by email or phone if possible to find duplicates
	// Since we don't have email in users table directly (it's in userAccounts or Better Auth tables), let's inspect userAccounts

	const allAccounts = await db.select().from(userAccounts);
	console.log(`Total Accounts: ${allAccounts.length}`);

	console.log('\n--- Accounts ---');
	for (const acc of allAccounts) {
		const user = allUsers.find((u) => u.id === acc.userId);
		console.log(
			`User: ${user?.name} (${user?.id}) | Account: ${acc.provider} / ${acc.externalId} | Metadata: ${JSON.stringify(acc.metadata)}`,
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
