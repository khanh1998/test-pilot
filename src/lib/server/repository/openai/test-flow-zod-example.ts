import { validateTestFlow, validateTestFlowSafe } from './flow-zod-gen-schema';
import type { TestFlowGen } from './flow-zod-gen-schema';

// Example of how to use the type
const exampleTestFlow: TestFlowGen = {
  name: 'User Registration and Authentication Flow',
  description: 'Tests user registration, login, and profile retrieval endpoints',
  steps: [
    {
      label: 'Register New User',
      step_id: 'step1',
      endpoints: [
        {
          api_id: 1,
          endpoint_id: 101,
          body: {
            email: 'test@example.com',
            password: 'securePassword123',
            name: 'Test User'
          },
          headers: [
            {
              name: 'Content-Type',
              value: 'application/json',
              enabled: true
            }
          ],
          assertions: [
            {
              id: 'a1b2c3d4',
              data_id: 'status_code',
              enabled: true,
              operator: 'equals',
              data_source: 'response',
              assertion_type: 'status_code',
              expected_value: 201,
              expected_value_type: 'number'
            },
            {
              id: 'e5f6g7h8',
              data_id: '$.user.id',
              enabled: true,
              operator: 'exists',
              data_source: 'response',
              assertion_type: 'json_body',
              expected_value: true,
              expected_value_type: 'boolean'
            }
          ],
          pathParams: null,
          queryParams: null,
          transformations: [
            {
              alias: 'userId',
              expression: '$.user.id'
            }
          ]
        }
      ]
    },
    {
      label: 'Login User',
      step_id: 'step2',
      endpoints: [
        {
          api_id: 1,
          endpoint_id: 102,
          body: {
            email: 'test@example.com',
            password: 'securePassword123'
          },
          headers: [
            {
              name: 'Content-Type',
              value: 'application/json',
              enabled: true
            }
          ],
          assertions: [
            {
              id: 'i9j0k1l2',
              data_id: 'status_code',
              enabled: true,
              operator: 'equals',
              data_source: 'response',
              assertion_type: 'status_code',
              expected_value: 200,
              expected_value_type: 'number'
            },
            {
              id: 'm3n4o5p6',
              data_id: '$.token',
              enabled: true,
              operator: 'exists',
              data_source: 'response',
              assertion_type: 'json_body',
              expected_value: true,
              expected_value_type: 'boolean'
            }
          ],
          pathParams: null,
          queryParams: null,
          transformations: [
            {
              alias: 'authToken',
              expression: '$.token'
            }
          ]
        }
      ]
    },
    {
      label: 'Get User Profile',
      step_id: 'step3',
      endpoints: [
        {
          api_id: 1,
          endpoint_id: 103,
          body: null,
          headers: [
            {
              name: 'Authorization',
              value: 'Bearer {{res:step2-0.$.token}}',
              enabled: true
            }
          ],
          assertions: [
            {
              id: 'q7r8s9t0',
              data_id: 'status_code',
              enabled: true,
              operator: 'equals',
              data_source: 'response',
              assertion_type: 'status_code',
              expected_value: 200,
              expected_value_type: 'number'
            },
            {
              id: 'u1v2w3x4',
              data_id: '$.user.email',
              enabled: true,
              operator: 'equals',
              data_source: 'response',
              assertion_type: 'json_body',
              expected_value: 'test@example.com',
              expected_value_type: 'string'
            }
          ],
          pathParams: {
            userId: '{{res:step1-0.$.user.id}}'
          },
          queryParams: null,
          transformations: null
        }
      ]
    }
  ],
  parameters: [
    {
      name: 'baseUrl',
      type: 'string',
      value: 'https://api.example.com',
      required: true,
      description: 'Base URL for the API',
      defaultValue: 'https://api.example.com'
    }
  ]
};

// Example of validating a test flow object
try {
  const validatedFlow = validateTestFlow(exampleTestFlow);
  console.log('Validation successful', validatedFlow);
} catch (error) {
  console.error('Validation failed:', error);
}

// Example of safely validating a test flow object
const validationResult = validateTestFlowSafe(exampleTestFlow);
if (validationResult.success) {
  console.log('Safe validation successful', validationResult.data);
} else {
  console.error('Safe validation failed:', validationResult.error?.errors);
}

// Example of validating an invalid test flow (missing required fields)
const invalidTestFlow = {
  name: 'Invalid Flow',
  // missing description and other required fields
};

const invalidResult = validateTestFlowSafe(invalidTestFlow);
if (!invalidResult.success && invalidResult.error) {
  console.log('Expected validation failure with errors:');
  console.log(invalidResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`));
}
