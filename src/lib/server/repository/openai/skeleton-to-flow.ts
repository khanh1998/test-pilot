import OpenAI from 'openai';
import { z } from 'zod';
import * as zo from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Define the input interface for enriching an endpoint
interface EnrichEndpointInput {
  apiInfoItem: {
    id: string;
    apiSignature: string;
    transforms: string[];
    assertions: string[];
    note: string | null;
    dependsOn: string[];
    endpoint?: {
      id: number;
      path: string;
      method: string;
      summary?: string;
      description?: string;
    };
  };
  endpointSpec: {
    id: number;
    apiId: number;
    path: string;
    method: string;
    operationId?: string | null;
    summary?: string | null;
    description?: string | null;
    requestSchema?: any;
    responseSchema?: any;
    parameters?: any;
    tags?: string[] | null;
  };
  flowParameters: Array<{
    name: string;
    required: boolean;
    type: "number" | "string" | "boolean" | "null" | "array" | "object";
  }>;
  dependentEndpoints: Array<{
    id: string;
    endpoint: any;
    enrichedData: any;
  }>;
  flowDescription: string;
}

// Helper function to convert JSON Schema to Zod schema for request body
function jsonSchemaToZodSchema(jsonSchema: any): z.ZodTypeAny {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    // Fallback to simple record schema
    return z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable();
  }

  try {
    // Manual conversion for common JSON Schema patterns to ensure full Zod compatibility
    return convertJsonSchemaToZodManual(jsonSchema);
  } catch (error) {
    console.warn('Failed to convert JSON schema to Zod schema:', error);
    // Fallback to simple record schema
    return z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable();
  }
}

// Manual JSON Schema to Zod conversion for better compatibility
function convertJsonSchemaToZodManual(schema: any): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') {
    return z.unknown();
  }

  const { type, properties, items, required = [], oneOf, anyOf, allOf, enum: enumValues } = schema;

  // Handle allOf - merge all schemas (simplified approach)
  if (allOf && Array.isArray(allOf)) {
    // For allOf, we merge the schemas by combining their properties
    let mergedSchema: any = { type: 'object', properties: {}, required: [] };
    
    for (const subSchema of allOf) {
      if (subSchema.type === 'object' && subSchema.properties) {
        mergedSchema.properties = { ...mergedSchema.properties, ...subSchema.properties };
      }
      if (subSchema.required && Array.isArray(subSchema.required)) {
        mergedSchema.required = [...mergedSchema.required, ...subSchema.required];
      }
      if (subSchema.type && !mergedSchema.type) {
        mergedSchema.type = subSchema.type;
      }
    }
    
    return convertJsonSchemaToZodManual(mergedSchema);
  }

  // Handle oneOf, anyOf
  if (oneOf) {
    const schemas = oneOf.map((s: any) => convertJsonSchemaToZodManual(s));
    return z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  if (anyOf) {
    const schemas = anyOf.map((s: any) => convertJsonSchemaToZodManual(s));
    return z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  // Handle enum values
  if (enumValues && Array.isArray(enumValues)) {
    // For string enums
    if (type === 'string') {
      return z.enum(enumValues as [string, ...string[]]);
    }
    // For number/integer enums, use literal values
    if (type === 'number' || type === 'integer') {
      const literals = enumValues.map(val => z.literal(val));
      if (literals.length === 1) {
        return literals[0];
      }
      return z.union(literals as [z.ZodLiteral<any>, z.ZodLiteral<any>, ...z.ZodLiteral<any>[]]);
    }
  }

  // Basic type conversions
  switch (type) {
    case 'string':
      return z.string();
    
    case 'number':
    case 'integer':
      return z.number();
    
    case 'boolean':
      return z.boolean();
    
    case 'null':
      return z.null();
    
    case 'array':
      if (items) {
        return z.array(convertJsonSchemaToZodManual(items));
      }
      return z.array(z.unknown());
    
    case 'object':
      if (properties) {
        const zodProperties: Record<string, z.ZodTypeAny> = {};
        
        for (const [key, propSchema] of Object.entries(properties)) {
          let zodProp = convertJsonSchemaToZodManual(propSchema);
          
          // Make optional and nullable if not in required array
          // OpenAI structured outputs requires optional fields to also be nullable
          if (!required.includes(key)) {
            zodProp = zodProp.nullable().optional();
          }
          
          zodProperties[key] = zodProp;
        }
        
        return z.object(zodProperties);
      }
      
      // Object without properties - use record
      return z.record(z.unknown());
    
    default:
      return z.unknown();
  }
}

// Function to create the enriched endpoint schema based on request schema
function createEnrichedEndpointSchema(jsonSchema: any) {
  const bodySchema = jsonSchemaToZodSchema(jsonSchema) as z.ZodTypeAny;
  return z.object({
    api_id: z.number().describe("The API ID for this endpoint"),
    endpoint_id: z.number().describe("The endpoint ID"),
    headers: z.array(z.object({
      name: z.string(),
      value: z.string(),
      enabled: z.boolean()
    })).nullable().describe("HTTP headers to send with the request"),
    pathParams: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable().describe("Path parameters for the request"),
    queryParams: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable().describe("Query parameters for the request"),
    body: bodySchema,
    assertions: z.array(z.object({
      id: z.string().describe("Unique ID for the assertion"),
      data_id: z.string().describe("JSONPath or status_code"),
      enabled: z.boolean(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'exists', 'greater_than', 'less_than', 'starts_with', 'ends_with', 'matches_regex', 'is_empty', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'not_between', 'has_length', 'length_greater_than', 'length_less_than', 'contains_all', 'contains_any', 'is_type', 'is_null', 'is_not_null']),
      data_source: z.enum(['response', 'transformed_data']),
      assertion_type: z.enum(['status_code', 'json_body', 'response_time', 'header']),
      expected_value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])), z.null()]),
      expected_value_type: z.enum(['number', 'string', 'boolean', 'array', 'object', 'null'])
    })).nullable().describe("Assertions to validate the response"),
    transformations: z.array(z.object({
      alias: z.string().describe("Alias name for the extracted value"),
      expression: z.string().describe("JSONPath expression to extract the value")
    })).nullable().describe("Data transformations to extract values from response")
  });
}

// Base type for the enriched endpoint (will be dynamically typed in the function)
type EnrichedEndpointBase = {
  api_id: number;
  endpoint_id: number;
  headers: Array<{ name: string; value: string; enabled: boolean }> | null;
  pathParams: Record<string, string | number | boolean | null> | null;
  queryParams: Record<string, string | number | boolean | null> | null;
  body: any | null; // This contains the request body object structure with template expressions
  assertions: Array<{
    id: string;
    data_id: string;
    enabled: boolean;
    operator: string;
    data_source: 'response' | 'transformed_data';
    assertion_type: 'status_code' | 'json_body' | 'response_time' | 'header';
    expected_value: string | number | boolean | Array<string | number | boolean | null> | null;
    expected_value_type: 'number' | 'string' | 'boolean' | 'array' | 'object' | 'null';
  }> | null;
  transformations: Array<{
    alias: string;
    expression: string;
  }> | null;
};

export async function enrichEndpointFromSkeleton(input: EnrichEndpointInput): Promise<EnrichedEndpointBase> {
  const { apiInfoItem, endpointSpec, flowParameters, dependentEndpoints, flowDescription } = input;

  // Create dynamic schema based on the endpoint's request schema
  const enrichedEndpointSchema = createEnrichedEndpointSchema(endpointSpec.requestSchema);

  // Static system prompt defining AI role and capabilities
  const systemPrompt = `You are an expert API test flow generator for Test-Pilot. Your task is to enrich a single API endpoint within a test flow by generating complete request configuration, assertions, and data transformations.

# Your Role
Generate realistic, production-ready API test configurations that work within larger test flows. You must create comprehensive request data, meaningful assertions, and extract key response data for dependent endpoints.

# Understanding API Test Flows
API test flows simulate real-world usage patterns that frontend applications follow when interacting with APIs. Each flow represents a complete user journey through your API, demonstrating how APIs are actually used to build frontends. Examples:
- Authentication flow: login → get user profile → update settings
- E-commerce flow: browse products → add to cart → create order → check order status
- Social media flow: login → create post → get feed → like posts → get notifications

The goal is to create DYNAMIC and REUSABLE test configurations that can adapt to different data and scenarios while maintaining realistic API usage patterns. This helps developers validate that their API changes don't break real-world frontend integration patterns.

# Tools and Capabilities

## Template Expressions
Use these template expressions to create dynamic, reusable requests:

### Template Expression Types
{{expr}}- String Template (Default)
- Result: Always returns a string value
- Usage: Can be used everywhere - headers, query parameters, path parameters, and JSON body
- JSON Compatibility: Safe to use anywhere since the result is always a string

{{{expr}}} - Type-Preserving Template (JSON Body Only)
- Result: Preserves the original data type (number, boolean, array, object)
- Usage: Only works in JSON request body
- JSON Compatibility: Requires special parsing to remove quotes and preserve types

#### Headers - Use {{expr}} Only
headers: [
  {
    name: "Authorization",
    value: "Bearer {{res:step1-0.$.token}}", // Correct
    enabled: true
  },
  {
    name: "X-User-ID", 
    value: "{{res:step1-0.$.user.id}}", // Correct - converts number to string
    enabled: true
  }
]

#### Query Parameters - Use {{expr}} Only
queryParams: {
  "userId": "{{res:step1-0.$.user.id}}", // Correct
  "filter": "{{param:filterType}}", // Correct
  "limit": "{{func:randomInt(10,50)}}" // Correct
}

#### Path Parameters - Use {{expr}} Only
pathParams: {
  "id": "{{res:step1-0.$.user.id}}", // Correct
  "category": "{{param:categoryName}}" // Correct
}

#### JSON Request Body - Dynamic Object Structure
Create dynamic request bodies using template expressions directly in the object structure:

{
  // String values - use {{expr}}
  "name": "{{res:step1-0.$.user.name}}", // Result: "name": "John"
  "email": "{{param:userEmail}}", // Result: "email": "user@example.com"
  
  // Non-string values - use {{{expr}}} to preserve type
  "id": "{{{res:step1-0.$.user.id}}}", // Result: "id": 123 (number)
  "active": "{{{res:step1-0.$.user.active}}}", // Result: "active": true (boolean)
  "tags": "{{{res:step1-0.$.user.tags}}}", // Result: "tags": ["admin", "user"] (array)
  
  // You can still use {{expr}} in JSON body for strings
  "description": "User {{res:step1-0.$.user.name}} profile" // String interpolation
}

The body field should contain the actual object structure with template expressions, not an encoded string.

### Parameter References
- {{param:parameterName}} - Reference flow parameters (user inputs that can vary between test runs)
- Example: {{param:userId}} or {{{param:userId}}} for a user ID that changes per test execution

### Response References  
- {{res:stepId.$.jsonPath}} - Reference data from previous step responses to create realistic API call chains
- Example: {{res:step1-0.$.token}} to use authentication token from login step
- Example: {{res:step2-0.$.product.id}} to use product ID from product creation in subsequent order creation
- Example: {{{res:step2-0.$.product.id}}} to use integer product ID from product creation in subsequent order creation
- This creates the realistic flow where each API call depends on data from previous calls

### Template Functions
- {{func:uuid()}} - Generate unique identifiers for creating new resources
- {{func:randomInt(min, max)}} or {{{func:randomInt(min, max)}}} - Generate realistic numeric data
- {{func:randomString(length)}} - Generate realistic string data  
- {{func:timestamp()}} or {{{func:timestamp()}}} - Generate current timestamps for time-sensitive operations
- {{func:isoDate()}} - Generate properly formatted dates
- {{func:formatDatePattern(pattern, offset)}} - Generate dates with specific patterns and offsets

## Assertions
Create meaningful assertions to validate responses:
- Status code assertions (typically 200, 201, 400, 401, etc.)
- JSON body field existence and value checks
- Data type validations
- Range and format validations

## Advanced Transformations
Extract and process data for subsequent steps using powerful transformation expressions:

### JSONPath Expressions
- Basic access: $.token, $.user.id, $.items[0].id
- Array access: $.users[*].email (all user emails), $.orders[0].items[*].price
- Conditional access: $.users[?(@.active == true)].id
- Complex paths: $.response.data.results[*].profile.settings.theme

### Functional Pipeline Transformations
Use pipeline syntax with functional operations:
// Filter and map operations
data.users | where($.age > 18) | map(pick(['name', 'email']))

// Aggregation operations
data.orders | group(by: 'status') | map(count: length(items), total: sum(items.amount))

// Sorting and limiting
data.products | sort(by: 'price', desc: true) | take(10)

// Complex transformations
data.transactions | where($.amount > 100 && $.status == 'completed') | map(userId: $.user.id, amount: $.amount) | sort(by: 'amount')

### Available Pipeline Functions
- **Filtering**: where(), select()
- **Transformation**: map(), transform(), pick(), omit()
- **Aggregation**: group(), count(), sum(), avg(), min(), max()
- **Sorting**: sort(by: field, desc: boolean)
- **Slicing**: take(n), skip(n), slice(start, end)
- **Array operations**: join(), flatten(), unique()
- **Conditional logic**: if(), switch(), coalesce()

### Complex Expression Syntax
Support for logical expressions with operators:
// Logical operators
$.user.age > 18 && $.user.verified == true
$.status == 'active' || $.status == 'pending'

// String operations
$.email contains '@company.com'
$.name startswith 'John'
$.description matches '^[A-Z].*'

// Array operations
$.tags any (tag => tag == 'premium')
$.scores all (score => score > 50)
'admin' in $.user.roles

// Null/existence checks
$.profile.avatar exists
$.optionalField null
$.array empty

### Multi-step Transformations
Create multiple transformations to extract different pieces of data:
{
  "alias": "authToken",
  "expression": "$.access_token"
},
{
  "alias": "userId", 
  "expression": "$.user.id"
},
{
  "alias": "userPermissions",
  "expression": "$.user.roles | map($.permissions) | flatten() | unique()"
},
{
  "alias": "activeProducts",
  "expression": "$.products | where($.status == 'active' && $.inventory > 0) | map(pick(['id', 'name', 'price'])) | sort(by: 'price')"
}

# Instructions
1. Generate realistic request data that simulates real frontend usage patterns
2. Use template expressions to make requests dynamic and reusable across different test scenarios
3. Use response references to connect this endpoint with previous steps in the flow (e.g., use tokens from login, IDs from creation endpoints)
4. Create comprehensive assertions to validate the response matches expected API behavior
5. Add powerful transformations to extract and process key data that subsequent endpoints will need
6. Follow the endpoint's actual schema requirements strictly
7. Make the test data realistic and appropriate for the endpoint's purpose in the overall user journey
8. Consider the endpoint's role in the larger flow - is it providing authentication? Creating resources? Fetching data?
9. Generate realistic test data using template functions to ensure tests work with different data sets
10. Create assertions that validate both successful operations and proper error handling
11. Use advanced transformation expressions to extract complex data structures, perform filtering, aggregation, and conditional logic
12. Think about what processed data the next steps in the flow will need - not just raw field values, but computed, filtered, or aggregated data
13. Use pipeline transformations to create clean, readable data processing logic
14. Extract multiple pieces of data with meaningful alias names that describe their purpose in the flow
15. **IMPORTANT: Generate the 'body' field as a direct object structure with template expressions.** Do not encode or stringify the body - provide it as a structured object that follows the endpoint's schema requirements.`;

  const userPrompt = `Enrich this API endpoint for the test flow. Generate a complete endpoint configuration with appropriate headers, parameters, body, assertions, and transformations.

# Context
Endpoint: "${apiInfoItem.apiSignature}" (ID: ${apiInfoItem.id})
Test Flow: "${flowDescription}"
Dependencies: ${apiInfoItem.dependsOn.length > 0 ? apiInfoItem.dependsOn.join(', ') : 'none'}

# Request Body Schema
${endpointSpec.requestSchema ? `The endpoint expects a request body that follows this JSON schema:
${JSON.stringify(endpointSpec.requestSchema, null, 2)}

IMPORTANT: Follow the provided JSON schema exactly for the request body structure.` : 'This endpoint does not have a specific request schema defined.'}

# Endpoint Specification
${JSON.stringify(endpointSpec, null, 2)}

# Flow Parameters Available
${JSON.stringify(flowParameters, null, 2)}

# Dependent Endpoints Data
${dependentEndpoints.length > 0 ? JSON.stringify(dependentEndpoints, null, 2) : 'None'}

# Original Skeleton Info
- Transforms: ${JSON.stringify(apiInfoItem.transforms)}
- Assertions: ${JSON.stringify(apiInfoItem.assertions)}
- Note: ${apiInfoItem.note || 'None'}`;

  // store the `userPrompt` to md file, no need to do any convert, just store the raw string to file, i want to see how do it look
  const promptOutputPath = join(process.cwd(), 'enrich-endpoint-prompt.md');
  await writeFile(promptOutputPath, userPrompt, 'utf8');

  const expectedSchema = zodTextFormat(enrichedEndpointSchema, "enriched_endpoint");
  
  // Write the expected schema to file for debugging
  const schemaOutputPath = join(process.cwd(), 'expected-schema.json');
  await writeFile(schemaOutputPath, JSON.stringify(expectedSchema, null, 2), 'utf8');

  try {
    const response = await openai.responses.parse({
      model: "gpt-4o",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      text: {
        format: expectedSchema,
      }
    });

    const enrichedEndpoint = response.output_parsed as EnrichedEndpointBase;

    // Ensure all assertion IDs are unique UUIDs
    if (enrichedEndpoint.assertions) {
      enrichedEndpoint.assertions.forEach((assertion: any) => {
        if (!assertion.id || assertion.id === 'unique-id') {
          assertion.id = uuidv4();
        }
      });
    }

    return enrichedEndpoint;
  } catch (error) {
    console.error('Error enriching endpoint from skeleton:', error);
    throw new Error(`Failed to enrich endpoint ${apiInfoItem.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}