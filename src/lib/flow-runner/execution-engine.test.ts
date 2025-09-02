import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowExecutionEngine, type ExecutionContext } from './execution-engine';
import { resolveTemplate, createTemplateContextFromFlowRunner } from '$lib/template';
import type { TestFlowData, StepEndpoint } from '$lib/components/test-flows/types';

// Mock the dependencies
vi.mock('$lib/template', () => ({
  resolveTemplate: vi.fn(),
  createTemplateContextFromFlowRunner: vi.fn(),
  createTemplateFunctions: vi.fn(() => ({})),
  defaultTemplateFunctions: {}
}));

vi.mock('$lib/http_client/test-flow', () => ({
  executeDirectEndpoint: vi.fn(),
  executeProxiedEndpoint: vi.fn()
}));

vi.mock('$lib/environment', () => ({
  isDesktop: false
}));

describe('FlowExecutionEngine Template Resolution', () => {
  let mockContext: ExecutionContext;
  let engine: FlowExecutionEngine;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock context
    mockContext = {
      flowData: {
        parameters: [
          { name: 'username', type: 'string', value: 'testuser', required: true, defaultValue: null },
          { name: 'password', type: 'string', value: 'testpass', required: true, defaultValue: null }
        ],
        settings: { api_hosts: {}, environment: { environmentId: null, subEnvironment: null } },
        steps: [],
        endpoints: [
          {
            id: 1,
            apiId: 1,
            path: '/api/login',
            method: 'POST',
            operationId: 'login',
            summary: 'User login'
          }
        ]
      } as TestFlowData,
      preferences: {
        parallelExecution: false,
        stopOnError: true,
        serverCookieHandling: false,
        retryCount: 0,
        timeout: 30000
      },
      storedResponses: {},
      storedTransformations: {},
      parameterValues: {
        username: 'testuser',
        password: 'testpass'
      },
      environmentVariables: {},
      cookieStore: new Map(),
      selectedEnvironment: null,
      shouldStopExecution: false,
      error: null,
      executionState: {},
      addLog: vi.fn(),
      updateExecutionState: vi.fn()
    };

    engine = new FlowExecutionEngine(mockContext);
  });

  describe('resolveTemplateObjectUnified', () => {
    it('should resolve template expressions in request body objects', () => {
      // Setup: Mock the template resolution
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: { username: 'testuser', password: 'testpass' },
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      
      // Mock resolveTemplate to simulate proper template resolution
      vi.mocked(resolveTemplate).mockImplementation((template: string) => {
        // Handle JSON strings with multiple templates
        let resolved = template;
        resolved = resolved.replace(/\{\{param:username\}\}/g, 'testuser');
        resolved = resolved.replace(/\{\{param:password\}\}/g, 'testpass');
        return resolved;
      });

      // Test data: Request body with template expressions
      const requestBody = {
        "password": "{{param:password}}",
        "username": "{{param:username}}",
        "user_type": "employee"
      };

      // Call the private method using bracket notation to access it
      const result = (engine as any).resolveTemplateObjectUnified(requestBody);

      // Verify the template context was created correctly
      expect(createTemplateContextFromFlowRunner).toHaveBeenCalledWith(
        {},  // storedResponses
        {},  // storedTransformations
        { username: 'testuser', password: 'testpass' }, // parameterValues
        {}, // templateFunctions
        {} // environmentVariables
      );

      // Verify resolveTemplate was called with the stringified object
      expect(resolveTemplate).toHaveBeenCalledWith(
        JSON.stringify(requestBody),
        mockTemplateContext
      );

      // Verify the result has resolved templates
      expect(result).toEqual({
        "password": "testpass",
        "username": "testuser",
        "user_type": "employee"
      });
    });

    it('should handle nested template expressions', () => {
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: { userId: '123', apiKey: 'secret123' },
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      
      vi.mocked(resolveTemplate).mockImplementation((template: string) => {
        return template
          .replace('{{param:userId}}', '123')
          .replace('{{param:apiKey}}', 'secret123');
      });

      const requestBody = {
        "user": {
          "id": "{{param:userId}}",
          "auth": {
            "key": "{{param:apiKey}}"
          }
        },
        "metadata": {
          "source": "test"
        }
      };

      // Update context with new parameter values
      mockContext.parameterValues = { userId: '123', apiKey: 'secret123' };
      engine = new FlowExecutionEngine(mockContext);

      const result = (engine as any).resolveTemplateObjectUnified(requestBody);

      expect(result).toEqual({
        "user": {
          "id": "123",
          "auth": {
            "key": "secret123"
          }
        },
        "metadata": {
          "source": "test"
        }
      });
    });

    it('should handle arrays with template expressions', () => {
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: { tag1: 'urgent', tag2: 'important' },
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      
      vi.mocked(resolveTemplate).mockImplementation((template: string) => {
        return template
          .replace('{{param:tag1}}', 'urgent')
          .replace('{{param:tag2}}', 'important');
      });

      const requestBody = {
        "tags": ["{{param:tag1}}", "{{param:tag2}}", "test"],
        "user": "{{param:username}}"
      };

      // Update context with new parameter values
      mockContext.parameterValues = { tag1: 'urgent', tag2: 'important', username: 'testuser' };
      engine = new FlowExecutionEngine(mockContext);

      // Also mock the username resolution
      vi.mocked(resolveTemplate).mockImplementation((template: string) => {
        return template
          .replace('{{param:tag1}}', 'urgent')
          .replace('{{param:tag2}}', 'important')
          .replace('{{param:username}}', 'testuser');
      });

      const result = (engine as any).resolveTemplateObjectUnified(requestBody);

      expect(result).toEqual({
        "tags": ["urgent", "important", "test"],
        "user": "testuser"
      });
    });

    it('should handle template resolution errors gracefully', () => {
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: { username: 'testuser' },
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      
      // Mock resolveTemplate to throw an error
      vi.mocked(resolveTemplate).mockImplementation(() => {
        throw new Error('Template resolution failed');
      });

      const requestBody = {
        "username": "{{param:username}}",
        "invalid": "{{param:nonexistent}}"
      };

      const result = (engine as any).resolveTemplateObjectUnified(requestBody);

      // Should return the original object when template resolution fails
      expect(result).toEqual(requestBody);
      
      // Should log the error
      expect(mockContext.addLog).toHaveBeenCalledWith(
        'error',
        'Template object resolution failed',
        'Template resolution failed'
      );
    });

    it('should handle null and undefined values', () => {
      expect((engine as any).resolveTemplateObjectUnified(null)).toBe(null);
      expect((engine as any).resolveTemplateObjectUnified(undefined)).toBe(undefined);
    });

    it('should handle non-string template results', () => {
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: { count: 42 },
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      
      // Mock resolveTemplate to return a non-string result
      vi.mocked(resolveTemplate).mockReturnValue({ resolved: true, count: 42 });

      const requestBody = {
        "data": "{{param:count}}"
      };

      const result = (engine as any).resolveTemplateObjectUnified(requestBody);

      // Should return the non-string result directly
      expect(result).toEqual({ resolved: true, count: 42 });
    });
  });

  describe('resolveTemplateValueUnified', () => {
    it('should resolve simple template expressions to strings', () => {
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: { username: 'testuser' },
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      vi.mocked(resolveTemplate).mockReturnValue('testuser');

      const result = (engine as any).resolveTemplateValueUnified('{{param:username}}');

      expect(result).toBe('testuser');
      expect(resolveTemplate).toHaveBeenCalledWith('{{param:username}}', mockTemplateContext);
    });

    it('should handle null/undefined template results', () => {
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: {},
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      vi.mocked(resolveTemplate).mockReturnValue(null);

      const result = (engine as any).resolveTemplateValueUnified('{{param:missing}}');

      expect(result).toBe('');
    });

    it('should handle template resolution errors', () => {
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: {},
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      vi.mocked(resolveTemplate).mockImplementation(() => {
        throw new Error('Template error');
      });

      const originalValue = '{{param:invalid}}';
      const result = (engine as any).resolveTemplateValueUnified(originalValue);

      // Should return original value on error
      expect(result).toBe(originalValue);
      
      // Should log the error
      expect(mockContext.addLog).toHaveBeenCalledWith(
        'error',
        'Template resolution failed for "{{param:invalid}}"',
        'Template error'
      );
    });
  });

  describe('prepareRequest integration', () => {
    it('should resolve templates in all request parts', () => {
      // Mock the host resolution
      const mockEndpoint: StepEndpoint = {
        endpoint_id: '1',
        api_id: '1',
        pathParams: { userId: '{{param:userId}}' },
        queryParams: { filter: '{{param:filterValue}}' },
        headers: [
          { name: 'Authorization', value: 'Bearer {{param:token}}', enabled: true },
          { name: 'Content-Type', value: 'application/json', enabled: true }
        ],
        body: {
          username: '{{param:username}}',
          password: '{{param:password}}'
        }
      };

      const endpointDef = {
        path: '/api/users/{userId}',
        method: 'POST'
      };

      // Setup parameter values
      mockContext.parameterValues = {
        userId: '123',
        filterValue: 'active',
        token: 'abc123',
        username: 'testuser',
        password: 'testpass'
      };

      engine = new FlowExecutionEngine(mockContext);

      // Mock template resolution functions
      const mockTemplateContext = {
        responses: {},
        transformedData: {},
        parameters: mockContext.parameterValues,
        environment: {},
        functions: {}
      };

      vi.mocked(createTemplateContextFromFlowRunner).mockReturnValue(mockTemplateContext);
      
      // Mock resolveTemplate for different scenarios
      vi.mocked(resolveTemplate).mockImplementation((template: string) => {
        if (template === '{{param:userId}}') return '123';
        if (template === '{{param:filterValue}}') return 'active';
        if (template === 'Bearer {{param:token}}') return 'Bearer abc123';
        if (template.includes('username') && template.includes('password')) {
          return template
            .replace('{{param:username}}', 'testuser')
            .replace('{{param:password}}', 'testpass');
        }
        return template;
      });

      const result = (engine as any).prepareRequest(endpointDef, mockEndpoint, 'https://api.example.com');

      expect(result.url).toBe('https://api.example.com/api/users/123?filter=active');
      expect(result.headers).toEqual({
        'Authorization': 'Bearer abc123',
        'Content-Type': 'application/json'
      });
      expect(result.body).toEqual({
        username: 'testuser',
        password: 'testpass'
      });
    });
  });

  describe('updateParameterValues', () => {
    it('should update the execution context parameter values', () => {
      const engine = new FlowExecutionEngine(mockContext);

      const newParameterValues = {
        username: 'updated_user',
        password: 'updated_pass',
        newParam: 'new_value'
      };

      engine.updateParameterValues(newParameterValues);

      expect(mockContext.parameterValues).toEqual(newParameterValues);
    });
  });
});
