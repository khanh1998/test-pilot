ALTER TABLE "api_endpoints" DROP CONSTRAINT "api_endpoints_api_id_apis_id_fk";
--> statement-breakpoint
ALTER TABLE "test_flow_apis" DROP CONSTRAINT "test_flow_apis_test_flow_id_test_flows_id_fk";
--> statement-breakpoint
ALTER TABLE "test_flow_apis" DROP CONSTRAINT "test_flow_apis_api_id_apis_id_fk";
--> statement-breakpoint
ALTER TABLE "api_endpoints" ADD CONSTRAINT "api_endpoints_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_flow_apis" ADD CONSTRAINT "test_flow_apis_test_flow_id_test_flows_id_fk" FOREIGN KEY ("test_flow_id") REFERENCES "public"."test_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_flow_apis" ADD CONSTRAINT "test_flow_apis_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE cascade ON UPDATE no action;