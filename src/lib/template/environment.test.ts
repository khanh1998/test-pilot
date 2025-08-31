import { describe, it, expect } from 'vitest';
import { resolveTemplate } from './engine';
import type { TemplateContext } from './types';

describe('Template Engine - Environment Variables', () => {
  const mockContext: TemplateContext = {
    responses: {},
    transformedData: {},
    parameters: {
      username: 'param_user'
    },
    environment: {
      username: 'env_user',
      api_key: 'secret_key_123',
      api_url: 'https://api.dev.com'
    }
  };

  it('should resolve environment variables', () => {
    const result = resolveTemplate('{{env:username}}', mockContext);
    expect(result).toBe('env_user');
  });

  it('should resolve environment variables with type preservation', () => {
    // Use quoted triple braces as per the template engine's expected format
    const result = resolveTemplate('"{{{env:api_url}}}"', mockContext);
    expect(result).toBe('https://api.dev.com');
  });

  it('should handle mixed parameter and environment variables', () => {
    const result = resolveTemplate('User: {{env:username}}, Param: {{param:username}}', mockContext);
    expect(result).toBe('User: env_user, Param: param_user');
  });

  it('should throw error for missing environment variable', () => {
    expect(() => {
      resolveTemplate('{{env:missing_var}}', mockContext);
    }).toThrow('Environment variable not found: missing_var');
  });

  it('should throw error when environment context is not available', () => {
    const contextWithoutEnv: TemplateContext = {
      responses: {},
      transformedData: {},
      parameters: {}
    };

    expect(() => {
      resolveTemplate('{{env:username}}', contextWithoutEnv);
    }).toThrow('Environment context not available');
  });
});
