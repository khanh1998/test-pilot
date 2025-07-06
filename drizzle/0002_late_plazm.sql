CREATE TABLE "test_flow_apis" (
	"test_flow_id" integer NOT NULL,
	"api_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" integer,
	"flow_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_flow_apis" ADD CONSTRAINT "test_flow_apis_test_flow_id_test_flows_id_fk" FOREIGN KEY ("test_flow_id") REFERENCES "public"."test_flows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_flow_apis" ADD CONSTRAINT "test_flow_apis_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_flows" ADD CONSTRAINT "test_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;