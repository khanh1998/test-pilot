CREATE TABLE "project_test_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"test_flow_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apis" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "test_flows" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "project_test_flows" ADD CONSTRAINT "project_test_flows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_test_flows" ADD CONSTRAINT "project_test_flows_test_flow_id_test_flows_id_fk" FOREIGN KEY ("test_flow_id") REFERENCES "public"."test_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_test_flows_project_id_idx" ON "project_test_flows" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_test_flows_test_flow_id_idx" ON "project_test_flows" USING btree ("test_flow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_test_flows_unique_idx" ON "project_test_flows" USING btree ("project_id","test_flow_id");--> statement-breakpoint
ALTER TABLE "apis" ADD CONSTRAINT "apis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_flows" ADD CONSTRAINT "test_flows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apis_project_id_idx" ON "apis" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "apis_user_id_idx" ON "apis" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "test_flows_project_id_idx" ON "test_flows" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "test_flows_user_id_idx" ON "test_flows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "test_flows_environment_id_idx" ON "test_flows" USING btree ("environment_id");