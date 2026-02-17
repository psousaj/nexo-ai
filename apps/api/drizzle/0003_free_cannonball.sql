CREATE TABLE "global_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "global_tools_tool_name_unique" UNIQUE("tool_name")
);
--> statement-breakpoint
CREATE INDEX "global_tools_tool_name_idx" ON "global_tools" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "global_tools_category_idx" ON "global_tools" USING btree ("category");