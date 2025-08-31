CREATE TABLE "environment_apis" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment_id" integer NOT NULL,
	"api_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" integer NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_flows" ADD COLUMN "environment_id" integer;--> statement-breakpoint
ALTER TABLE "environment_apis" ADD CONSTRAINT "environment_apis_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_apis" ADD CONSTRAINT "environment_apis_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "environment_apis_env_id_idx" ON "environment_apis" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "environment_apis_api_id_idx" ON "environment_apis" USING btree ("api_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environment_apis_unique_idx" ON "environment_apis" USING btree ("environment_id","api_id");--> statement-breakpoint
CREATE INDEX "environments_config_gin_idx" ON "environments" USING gin ("config");--> statement-breakpoint
CREATE INDEX "environments_user_id_idx" ON "environments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "environments_user_name_unique_idx" ON "environments" USING btree ("user_id","name");--> statement-breakpoint
ALTER TABLE "test_flows" ADD CONSTRAINT "test_flows_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE no action ON UPDATE no action;