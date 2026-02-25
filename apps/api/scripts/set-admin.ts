import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import * as schema from '../src/db/schema';

async function setAdmin(email: string) {
	console.log(`🔍 Procurando usuário com email: ${email}...`);

	const user = await db.query.users.findFirst({
		where: eq(schema.users.email, email),
	});

	if (!user) {
		console.error(`❌ Usuário com email ${email} não encontrado.`);
		process.exit(1);
	}

	console.log(`found user: ${user.id}. Atualizando para admin...`);

	await db.update(schema.users).set({ role: 'admin' }).where(eq(schema.users.id, user.id));

	console.log(`✅ Role atualizada. Inserindo permissões CASL...`);

	// Remove permissões antigas para evitar duplicidade se rodar de novo
	await db.delete(schema.userPermissions).where(eq(schema.userPermissions.userId, user.id));

	await db.insert(schema.userPermissions).values({
		userId: user.id,
		action: 'manage',
		subject: 'all',
	});

	console.log(`🚀 Sucesso! O usuário ${email} agora é administrador com permissões totais.`);
	process.exit(0);
}

const email = process.argv[2];
if (!email) {
	console.error('⚠️ Por favor, informe o email do usuário: tsx scripts/set-admin.ts usuario@exemplo.com');
	process.exit(1);
} else {
	setAdmin(email);
}
