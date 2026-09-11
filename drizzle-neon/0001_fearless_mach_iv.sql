CREATE TABLE "collection_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"set_id" text NOT NULL,
	"set_name" text NOT NULL,
	"share_type" text NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_collection_shares_recipient_created" ON "collection_shares" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_collection_shares_sender_created" ON "collection_shares" USING btree ("sender_id","created_at");