import { readFileSync } from 'fs';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';

async function runMigration() {
	console.log('🔧 Aplicando migration 0016_fix_user_id_cast.sql...');

	const migration = readFileSync('./drizzle/0016_fix_user_id_cast.sql', 'utf-8');

	// Executar como um bloco único
	try {
		console.log('Executando migration completa...');
		await db.execute(sql.raw(migration));
		console.log('✅ Migration aplicada com sucesso!');
	} catch (error: any) {
		if (error.cause?.code === '42P07' && error.cause.message?.includes('already exists')) {
			console.log('⚠️  Tabela já existe, tentando recriar...');

			// DROP manual e retry
			try {
				await db.execute(sql`DROP TABLE IF EXISTS user_emails CASCADE`);
				console.log('✅ Tabela dropada');

				// Executar novamente
				await db.execute(sql.raw(migration));
				console.log('✅ Migration aplicada com sucesso!');
			} catch (retryError: any) {
				console.error('❌ Erro no retry:', retryError.message);
				throw retryError;
			}
		} else {
			console.error('❌ Erro:', error.message);
			throw error;
		}
	}

	process.exit(0);
}

runMigration().catch((err) => {
	console.error('❌ Falha na migration:', err);
	process.exit(1);
});
