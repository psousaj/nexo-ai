import postgres from 'postgres';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('DATABASE_URL não configurada');
	process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrateUuidToText() {
	try {
		console.log('🔧 Removendo TODAS as foreign keys relacionadas a users.id...');
		await sql`ALTER TABLE account DROP CONSTRAINT IF EXISTS account_user_id_users_id_fk`;
		await sql`ALTER TABLE session DROP CONSTRAINT IF EXISTS session_user_id_users_id_fk`;
		await sql`ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_users_id_fk`;
		await sql`ALTER TABLE memory_items DROP CONSTRAINT IF EXISTS memory_items_user_id_users_id_fk`;
		await sql`ALTER TABLE user_accounts DROP CONSTRAINT IF EXISTS user_accounts_user_id_users_id_fk`;
		await sql`ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_users_id_fk`;
		await sql`ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_users_id_fk`;
		await sql`ALTER TABLE linking_tokens DROP CONSTRAINT IF EXISTS linking_tokens_user_id_users_id_fk`;
		
		console.log('🔧 Convertendo users.id para text...');
		await sql`ALTER TABLE users ALTER COLUMN id SET DATA TYPE text`;
		await sql`ALTER TABLE users ALTER COLUMN id DROP DEFAULT`;
		
		console.log('🔧 Convertendo todas as colunas user_id para text...');
		await sql`ALTER TABLE account ALTER COLUMN user_id SET DATA TYPE text`;
		await sql`ALTER TABLE session ALTER COLUMN user_id SET DATA TYPE text`;
		await sql`ALTER TABLE conversations ALTER COLUMN user_id SET DATA TYPE text`;
		await sql`ALTER TABLE memory_items ALTER COLUMN user_id SET DATA TYPE text`;
		await sql`ALTER TABLE user_accounts ALTER COLUMN user_id SET DATA TYPE text`;
		await sql`ALTER TABLE user_preferences ALTER COLUMN user_id SET DATA TYPE text`;
		await sql`ALTER TABLE user_permissions ALTER COLUMN user_id SET DATA TYPE text`;
		await sql`ALTER TABLE linking_tokens ALTER COLUMN user_id SET DATA TYPE text`;
		
		console.log('🔧 Recriando foreign keys...');
		await sql`ALTER TABLE account ADD CONSTRAINT account_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`;
		await sql`ALTER TABLE session ADD CONSTRAINT session_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`;
		await sql`ALTER TABLE conversations ADD CONSTRAINT conversations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`;
		await sql`ALTER TABLE memory_items ADD CONSTRAINT memory_items_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`;
		await sql`ALTER TABLE user_accounts ADD CONSTRAINT user_accounts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`;
		await sql`ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`;
		await sql`ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`;
		await sql`ALTER TABLE linking_tokens ADD CONSTRAINT linking_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`;
		
		console.log('✅ Migração concluída com sucesso!');
	} catch (error) {
		console.error('❌ Erro:', error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

migrateUuidToText();
