import postgres from 'postgres';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('DATABASE_URL não configurada');
	process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function fixEmailVerified() {
	try {
		console.log('🔧 Convertendo tipo da coluna...');
		await sql`ALTER TABLE users ALTER COLUMN email_verified TYPE boolean USING CASE WHEN email_verified IS NULL THEN false ELSE true END`;

		console.log('🔧 Definindo default...');
		await sql`ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false`;

		console.log('🔧 Definindo NOT NULL...');
		await sql`ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL`;

		console.log('✅ Coluna email_verified convertida com sucesso!');
	} catch (error) {
		console.error('❌ Erro:', error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

fixEmailVerified();
