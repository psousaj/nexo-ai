-- Migration 0029: Drop legacy tables from old Nexo architecture
-- Tables replaced by Hermes architecture:
--   memory_items → memory_envelopes
--   messages → session_transcripts
--   conversations → agent_sessions
--   semantic_external_items → (no replacement, was cache for external APIs)

-- 1. Drop FK from agent_sessions to conversations (if still exists)
ALTER TABLE "agent_sessions" DROP CONSTRAINT IF EXISTS "agent_sessions_conversation_id_conversations_id_fk";

-- 2. Drop conversation_id column from agent_sessions (no longer needed)
ALTER TABLE "agent_sessions" DROP COLUMN IF EXISTS "conversation_id";

-- 3. Drop legacy tables with internal FK dependencies
DROP TABLE IF EXISTS "messages";
DROP TABLE IF EXISTS "memory_items" CASCADE;
DROP TABLE IF EXISTS "semantic_external_items";
DROP TABLE IF EXISTS "conversations" CASCADE;

-- 4. Drop legacy enum types if they exist and are no longer used
DROP TYPE IF EXISTS "cognitive_type" CASCADE;
DROP TYPE IF EXISTS "message_role" CASCADE;
DROP TYPE IF EXISTS "item_type" CASCADE;
