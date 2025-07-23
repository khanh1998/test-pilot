import { z } from 'zod';

// Define Zod schema based on the existing JSON Schema
export const testFlowZodSchema = z.object({
  name: z.string().describe('A descriptive name for the test flow that clearly indicates its purpose'),
  description: z.string().describe('A detailed description explaining what this test flow verifies and any important details about its execution'),
  steps: z.array(
    z.object({
      label: z.string().describe('Human-readable name for this step, e.g. \'Login\', \'Get User Details\''),
      step_id: z.string().describe('Unique identifier for this step, format: \'step1\', \'step2\', etc.\''),
      endpoints: z.array(
        z.object({
          body: z.record(
            z.union([z.string(), z.number(), z.boolean(), z.null()])
          ).nullable().describe('Request body object for POST/PUT/PATCH requests'),
          api_id: z.number().describe('ID of the API host to use, defined in settings.api_hosts'),
          headers: z.array(
            z.object({
              name: z.string().describe('HTTP header name, e.g. \'Content-Type\', \'Authorization\''),
              value: z.string().describe('Header value, can include template expressions like \'{{param:token}}\' or \'{{res:step1-0.$.token}}\''),
              enabled: z.boolean().describe('Whether this header should be included in the request'),
            })
          ).nullable().describe('HTTP headers to include in the request'),
          assertions: z.array(
            z.object({
              id: z.string().describe('Unique identifier for this assertion, should be a valid UUID'),
              data_id: z.string().describe('What to validate: JSONPath for body (e.g. \'$.data.id\') or \'status_code\' for HTTP status'),
              enabled: z.boolean().describe('Whether this assertion should be evaluated'),
              operator: z.enum([
                "equals", "not_equals", "contains", "exists", "greater_than", "less_than",
                "starts_with", "ends_with", "matches_regex", "is_empty", 
                "greater_than_or_equal", "less_than_or_equal", "between", "not_between",
                "has_length", "length_greater_than", "length_less_than", "contains_all", 
                "contains_any", "is_type", "is_null", "is_not_null"
              ]).describe('Comparison operator to use for the assertion'),
              data_source: z.enum(["response", "transformed_data"]).describe('Source of data to validate'),
              assertion_type: z.enum(["status_code", "json_body", "response_time", "header"]).describe('Type of assertion'),
              expected_value: z.union([
                z.string(),
                z.number(),
                z.boolean(),
                z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
                z.null()
              ]).describe('Value to compare against, can be string, number, boolean, array, or null'),
              expected_value_type: z.enum(["number", "string", "boolean", "array", "object", "null"]).describe('Data type of the expected value'),
            })
          ).nullable().describe('Validations to perform on the response'),
          pathParams: z.record(
            z.union([z.string(), z.number(), z.boolean(), z.null()])
          ).nullable().describe('Path parameters to substitute in the endpoint URL, e.g. {id: \'123\'} for \'/users/{id}\''),
          endpoint_id: z.number().describe('Unique ID of the endpoint from the OpenAPI spec'),
          queryParams: z.record(
            z.union([z.string(), z.number(), z.boolean(), z.null()])
          ).nullable().describe('Query string parameters, e.g. {limit: 10, page: 1}'),
          transformations: z.array(
            z.object({
              alias: z.string().describe('Name to identify this transformation result for referencing in subsequent steps'),
              expression: z.string().describe('JSONPath expression to extract/transform data, e.g. \'$.data[*].id\' or \'$.items | where($.active == true) | map($.id)\''),
            })
          ).nullable().describe('Data extraction and manipulation from responses for use in subsequent steps'),
        })
      ).describe('API calls to execute in this step, typically one per step'),
    })
  ).describe('Sequence of steps containing API calls to execute in order'),
  parameters: z.array(
    z.object({
      name: z.string().describe('Unique identifier for this parameter, used in template expressions as \'{{param:name}}\''),
      type: z.enum(["number", "string", "boolean", "array", "object", "null"]).describe('Data type of the parameter'),
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
        z.null()
      ]).describe('Current value of the parameter, can be changed by the user at runtime'),
      required: z.boolean().describe('Whether this parameter is required for the test flow to run'),
      description: z.string().describe('Human-readable description of what this parameter is used for'),
      defaultValue: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
        z.null()
      ]).describe('Default value if the user doesn\'t specify one'),
    })
  ).describe('User-configurable values that can be referenced throughout the flow'),
});

// Export inferred TypeScript type from the Zod schema
export type TestFlowGen = z.infer<typeof testFlowZodSchema>;

// More granular types for easier reuse
export type TestFlowStep = z.infer<typeof testFlowZodSchema>['steps'][number];
export type TestFlowEndpoint = TestFlowStep['endpoints'][number];
export type TestFlowAssertion = NonNullable<TestFlowEndpoint['assertions']>[number];
export type TestFlowHeader = NonNullable<TestFlowEndpoint['headers']>[number];
export type TestFlowTransformation = NonNullable<TestFlowEndpoint['transformations']>[number];
export type TestFlowParameter = z.infer<typeof testFlowZodSchema>['parameters'][number];

// Function to validate a test flow object against the schema
export function validateTestFlow(testFlow: unknown): TestFlowGen {
  return testFlowZodSchema.parse(testFlow);
}

// Function to validate a test flow object and return validation results
export function validateTestFlowSafe(testFlow: unknown): { 
  success: boolean; 
  data?: TestFlowGen; 
  error?: z.ZodError 
} {
  const result = testFlowZodSchema.safeParse(testFlow);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
