import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { users } from '../src/db/schema';

async function setup() {
	const userId = 'a6051a80-0000-0000-0000-000000000000';
	const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

	if (!existing) {
		console.log('Criando usuário demo...');
		await db.insert(users).values({
			id: userId,
			name: 'Jose Demo',
		});
		console.log('Usuário demo criado com sucesso!');
	} else {
		console.log('Usuário demo já existe.');
	}
	process.exit(0);
}

setup();
