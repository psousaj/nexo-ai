import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não configurada no .env");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function resetDatabase() {
  try {
    console.log("🔄 Lendo script SQL...");
    const sqlContent = readFileSync(join(__dirname, "reset-db.sql"), "utf-8");

    console.log("🗑️  Dropando tabelas antigas...");
    console.log("🏗️  Recriando schema...");

    await sql.unsafe(sqlContent);

    console.log("✅ Banco de dados resetado com sucesso!");
    console.log("\nTabelas criadas:");
    console.log("  - users (id: uuid)");
    console.log("  - items (id: uuid, user_id: uuid)");
    console.log("  - conversations (id: uuid, user_id: uuid)");
    console.log("  - messages (id: uuid, conversation_id: uuid)");
  } catch (error) {
    console.error("❌ Erro ao resetar banco:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

resetDatabase();
