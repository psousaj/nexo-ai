import { db } from '@nexo/api-core/db';
import { userEmails, users } from '@nexo/api-core/db/schema';
import { eq, isNotNull } from 'drizzle-orm';

/**
 * Script para migrar emails existentes da tabela users para user_emails
 * Executa: bun run scripts/migrate-user-emails.ts
 */
async function migrateUserEmails() {
	console.log('🔄 Iniciando migração de emails...');

	// Buscar todos os usuários que têm email
	const usersWithEmail = await db.select().from(users).where(isNotNull(users.email));

	console.log(`📊 Encontrados ${usersWithEmail.length} usuários com email`);

	let migrated = 0;
	let skipped = 0;
	let errors = 0;

	for (const user of usersWithEmail) {
		if (!user.email) {
			skipped++;
			continue;
		}

		try {
			// Verifica se já existe entrada para esse email
			const [existing] = await db.select().from(userEmails).where(eq(userEmails.email, user.email)).limit(1);

			if (existing) {
				console.log(`⏭️  Email ${user.email} já migrado (user ${user.id})`);
				skipped++;
				continue;
			}

			// Cria entrada em user_emails
			await db.insert(userEmails).values({
				userId: user.id,
				email: user.email,
				isPrimary: true, // Email original é sempre primário
				provider: 'email', // Provider padrão para emails originais
				verified: !!user.emailVerified,
			});

			console.log(`✅ Email ${user.email} migrado para user ${user.id}`);
			migrated++;
		} catch (error) {
			console.error(`❌ Erro ao migrar email ${user.email} (user ${user.id}):`, error);
			errors++;
		}
	}

	console.log('\n📊 Resumo da migração:');
	console.log(`✅ Migrados: ${migrated}`);
	console.log(`⏭️  Já existentes: ${skipped}`);
	console.log(`❌ Erros: ${errors}`);
	console.log(`📈 Total processado: ${usersWithEmail.length}`);
}

migrateUserEmails()
	.then(() => {
		console.log('\n🎉 Migração concluída!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n💥 Erro fatal na migração:', error);
		process.exit(1);
	});
