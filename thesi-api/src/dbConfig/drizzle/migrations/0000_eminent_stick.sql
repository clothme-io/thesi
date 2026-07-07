CREATE TABLE "thesi_creator_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone_number" text,
	"country" text NOT NULL,
	"city" text NOT NULL,
	"creator_type" text NOT NULL,
	"tiktok_url" text NOT NULL,
	"instagram_url" text NOT NULL,
	"youtube_url" text,
	"other_links" text,
	"follower_count_range" text NOT NULL,
	"has_ugc_experience" boolean NOT NULL,
	"portfolio_link" text NOT NULL,
	"why_clothme" text NOT NULL,
	"interested_creator_store" text NOT NULL,
	"interested_affiliate" text NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "thesi_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"creator_application_id" text,
	"stripe_connect_account_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "thesi_users_email_unique" UNIQUE("email")
);
