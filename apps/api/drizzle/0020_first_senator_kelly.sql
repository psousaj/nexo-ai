ALTER TABLE "session_transcripts" ADD COLUMN "search_text" text;--> statement-breakpoint
CREATE INDEX "session_transcripts_search_text_idx" ON "session_transcripts" USING btree ("search_text");