CREATE TABLE "api_endpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_id" integer NOT NULL,
	"path" text NOT NULL,
	"method" varchar(10) NOT NULL,
	"operation_id" text,
	"summary" text,
	"description" text,
	"request_schema" jsonb,
	"response_schema" jsonb,
	"parameters" jsonb,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apis" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"spec_format" varchar(10) NOT NULL,
	"spec_content" text NOT NULL,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_endpoints" ADD CONSTRAINT "api_endpoints_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apis" ADD CONSTRAINT "apis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;