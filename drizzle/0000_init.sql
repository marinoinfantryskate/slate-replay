CREATE TABLE "daily_slates" (
	"date" text PRIMARY KEY NOT NULL,
	"game_ids" jsonb NOT NULL,
	"seed" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slate_date" text,
	"mode" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"locked" boolean DEFAULT false NOT NULL,
	"lock_reason" text
);
--> statement-breakpoint
CREATE TABLE "picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"market" text NOT NULL,
	"selection" text,
	"odds_at_pick" integer,
	"line" real,
	"outcome" text,
	"clv" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_played_date" text,
	"lifetime_picks" integer DEFAULT 0 NOT NULL,
	"lifetime_correct" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_user_daily" ON "entries" USING btree ("user_id","slate_date","mode");--> statement-breakpoint
CREATE UNIQUE INDEX "picks_entry_game_market" ON "picks" USING btree ("entry_id","game_id","market");