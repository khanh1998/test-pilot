ALTER TABLE "test_flows" ADD COLUMN "draft_of" integer REFERENCES "test_flows"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_flows_draft_of_idx" ON "test_flows" USING btree ("draft_of");
