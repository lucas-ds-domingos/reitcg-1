ALTER TABLE "collection_shares" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_shares" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "collection_shares" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_collection_shares_recipient_status" ON "collection_shares" USING btree ("recipient_id","status");