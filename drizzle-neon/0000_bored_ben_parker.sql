CREATE TABLE "collection_items" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"set_id" text NOT NULL,
	"card_name" text NOT NULL,
	"card_image" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"requester_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_a_user_b_pk" PRIMARY KEY("user_a","user_b")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"age_group" text,
	"guardian_consent" boolean DEFAULT false NOT NULL,
	"guardian_name" text,
	"guardian_email" text,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"privacy_accepted" boolean DEFAULT false NOT NULL,
	"terms_version" text,
	"consent_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_a_profiles_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_b_profiles_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_collection_items_card_quantity" ON "collection_items" USING btree ("card_id","quantity");--> statement-breakpoint
CREATE INDEX "idx_collection_items_user_set" ON "collection_items" USING btree ("user_id","set_id");--> statement-breakpoint
CREATE INDEX "idx_friendships_user_a_status" ON "friendships" USING btree ("user_a","status");--> statement-breakpoint
CREATE INDEX "idx_friendships_user_b_status" ON "friendships" USING btree ("user_b","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profiles_username" ON "profiles" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profiles_email" ON "profiles" USING btree ("email");