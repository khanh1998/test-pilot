import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';


// Import the JSON schema for test flow generation
import { testFlowSchema } from './test-flow-schema';
import type { TestFlowJson } from '$lib/types/test-flow';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Function to load the guide content
function loadTestFlowGuide(): string {
  try {
    const guidePath = path.join(process.cwd(), 'docs', 'llm_test_flow_generation_guide.md');
    return fs.readFileSync(guidePath, 'utf8');
  } catch (error) {
    console.error('Failed to load test flow generation guide:', error);
    return '';
  }
}

interface ApiEndpoint {
  id: number;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: any;
  requestSchema?: any;
  responseSchema?: any;
  apiId: number;
}


export async function generateTestFlowFromSpec(
  endpoints: ApiEndpoint[], 
  description: string
): Promise<TestFlowJson> {
  // Load the test flow generation guide content
  const guideContent = loadTestFlowGuide();
  
  // Create a system message with instructions
  const systemMessage = `
You are an expert API test flow generator. Your task is to create a comprehensive test flow JSON 
that validates the given API endpoints according to the user's description.

Please follow the detailed guide below for generating valid test flows for Test-Pilot:

${guideContent}

Remember to: follow API specs (request schema, response schema, parameters, path) strictly, otherwise the flow won't work.
`;

  // Prepare endpoint data for the prompt
  const endpointData = endpoints.map(endpoint => ({
    id: endpoint.id,
    path: endpoint.path,
    method: endpoint.method,
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    description: endpoint.description,
    parameters: endpoint.parameters,
    requestSchema: endpoint.requestSchema,
    responseSchema: endpoint.responseSchema,
    apiId: endpoint.apiId
  }));

  // Create the prompt with a concise instruction
  const userMessage = `
Generate a test flow for the following API endpoints:
${JSON.stringify(endpointData, null, 2)}

Flow description: ${description}

Please generate a complete test flow JSON that follows the Test-Pilot structure according to the guide provided in the system message.
`;

  try {
    // Use OpenAI's structured output capability with JSON schema
    const response = await openai.responses.create({
      model: "gpt-4o", // Using gpt-4o as it's the latest model
      input: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "test_flow",
          schema: testFlowSchema,
          strict: true
        }
      }
    });

    const flowJson = JSON.parse(response.output_text);
    
    if (!flowJson) {
      throw new Error('No content returned from OpenAI');
    }
    
    // Ensure all assertion IDs are valid UUIDs
    ensureAssertionIds(flowJson);

    // Return the generated flow JSON (without settings - will be added by service layer)
    return flowJson;
  } catch (error: unknown) {
    console.error('OpenAI API error:', error);
    
    if (error instanceof Error) {
      throw new Error(`Failed to generate test flow: ${error.message}`);
    } else {
      throw new Error('Failed to generate test flow: Unknown error');
    }
  }
}


// Ensure all assertions have valid UUID IDs
function ensureAssertionIds(flowJson: TestFlowJson): TestFlowJson {
  if (!flowJson.steps) return flowJson;
  
  flowJson.steps.forEach((step) => {
    if (!step.endpoints) return;
    
    step.endpoints.forEach((endpoint) => {
      if (!endpoint.assertions || endpoint.assertions === null) return;
      
      endpoint.assertions.forEach((assertion) => {
        if (!assertion.id || assertion.id === 'unique-id') {
          assertion.id = uuidv4();
        }
      });
    });
  });
  
  return flowJson;
}

