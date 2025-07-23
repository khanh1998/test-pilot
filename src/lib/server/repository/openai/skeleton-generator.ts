import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from "openai/helpers/zod";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Define the Zod schema for skeleton test flow
export const ApiInfoItemSchema = z.object({
  apiSignature: z.string().describe("Text used for searching APIs, like 'login', 'create user', etc."),
  actions: z.array(z.string()).describe("Actions to perform with the response like transform or assertion"),
  note: z.string().nullable().describe("Optional note about this API step")
});

export const StepSchema = z.object({
  apiInfoItems: z.array(ApiInfoItemSchema).describe("List of API info items for this step"),
  description: z.string().describe("Description of the test flow step. Describe what does this step do."),
});

export const FlowParameter = z.object({
    name: z.string().describe("unique name for the parameter"),
    required: z.boolean().describe("whether the parameter is required by the flow"),
    type: z.enum(["number", "string", "boolean", "null", "array", "object"]).describe("data type of parameter"),
})

export const SkeletonTestFlowSchema = z.object({
  name: z.string().describe("Name of the test flow"),
  description: z.string().describe("Description of what the test flow does"),
  steps: z.array(StepSchema).describe("Steps in the test flow"),
  parameters: z.array(FlowParameter).describe("User configurable values, can be referenced throughout the flow"),
  note: z.string().nullable().describe("Optional note about this test flow")
});

export type ApiInfoItem = z.infer<typeof ApiInfoItemSchema>;
export type Step = z.infer<typeof StepSchema>;
export type SkeletonTestFlow = z.infer<typeof SkeletonTestFlowSchema>;

export async function generateSkeletonTestFlow(description: string): Promise<SkeletonTestFlow> {
  const response = await openai.responses.parse({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content: `You are a test flow skeleton generator for Test-Pilot, a tool that helps engineers test REST APIs by creating sequences of API calls with proper data dependencies and validations. 

Your task is to analyze a user's description of a test scenario and extract a structured skeleton test flow. This skeleton will later be enriched to create a complete test flow JSON with full implementation details.

# Context: Complete Test Flow Structure
A complete test flow in Test-Pilot has:
- Sequential steps with API calls (auth → fetch → create/update → verify)
- Each step contains one or more API endpoints to call
- Data dependencies between steps using response references
- Request configuration (headers, path/query parameters, body)
- Response assertions to validate expected outcomes
- Data transformations to extract values for subsequent steps
- Template expressions for dynamic values and data dependencies
- User-configurable parameters that can be referenced throughout the flow

# Your Current Task: Create a Skeleton Test Flow
For now, focus only on creating the high-level skeleton that outlines:

1. A skeleton test flow should include:
   - A descriptive name (clear and concise)
   - A thorough description of what the test flow aims to accomplish
   - Ordered steps representing the logical flow of API calls
   - Flow parameters: user-configurable values that can be referenced throughout the flow
   - Optional notes if clarification is needed

2. Each step should contain:
   - A clear description of what this step does in the test flow
   - A list of API info items with:
     - API signatures: Keywords that would be used to search for relevant APIs (e.g., 'login', 'create user', 'get products', etc.)
     - Actions: What to do with the response (e.g., 'extract token', 'validate status code', 'check response contains user data')
     - Optional notes

3. Flow parameters should include:
   - Name: A unique identifier for the parameter (e.g., 'username', 'password', 'itemCount', 'maxPrice')
   - Type: The data type ('string', 'number', 'boolean', etc.)
   - Required: Whether the parameter is mandatory for the flow to work
   
   Flow parameters are external inputs provided by users when running the test flow. They are like function parameters - values that users pass into the flow from outside, not values that are generated within the flow or extracted from responses.

# Best Practices for Skeleton Generation
- Analyze the logical sequence and dependencies between API calls
- Include all necessary steps for a complete test scenario
- Use clear and searchable API signatures that will help match with actual endpoints
- Identify key data dependencies between steps (what data from step 1 is needed in step 2, etc.)
- Consider authentication, data creation, verification, and cleanup steps
- Be specific about the actions needed for each API response
`
      },
      {
        role: "user",
        content: `Extract a skeleton test flow from the following description:\n\n${description}`
      }
    ],
    text: {
        format: zodTextFormat(SkeletonTestFlowSchema, "skeleton_test_flow"),
      }
  });

  const skeletonTestFlow = response.output_parsed as SkeletonTestFlow;
  return skeletonTestFlow;
}