import { describe, it, expect } from 'vitest';
import { resolveTemplate, resolveTemplateExpression } from '$lib/template/engine';
import { createTemplateContextFromFlowRunner } from '$lib/template/utils';
import { createTemplateFunctions, defaultTemplateFunctions } from '$lib/template/functions';

describe('Template Resolution for Request Bodies', () => {
  it('should resolve param templates in JSON objects', () => {
    const parameterValues = {
      username: 'testuser',
      password: 'testpass'
    };

    const templateContext = createTemplateContextFromFlowRunner(
      {}, // storedResponses
      {}, // storedTransformations
      parameterValues,
      createTemplateFunctions({
        responses: {},
        transformedData: {},
        parameters: parameterValues,
        functions: defaultTemplateFunctions
      }),
      {} // environmentVariables
    );

    const requestBodyString = JSON.stringify({
      "password": "{{param:password}}",
      "username": "{{param:username}}",
      "user_type": "employee"
    });

    console.log('Input template string:', requestBodyString);
    console.log('Template context parameters:', templateContext.parameters);

    const result = resolveTemplate(requestBodyString, templateContext);

    console.log('Template resolution result:', result);
    console.log('Type of result:', typeof result);

    if (typeof result === 'string') {
      const parsedResult = JSON.parse(result);
      console.log('Parsed result:', parsedResult);
      
      expect(parsedResult).toEqual({
        "password": "testpass",
        "username": "testuser", 
        "user_type": "employee"
      });
    } else {
      console.log('Result is not a string, direct object:', result);
      expect(result).toEqual({
        "password": "testpass",
        "username": "testuser",
        "user_type": "employee"
      });
    }
  });

  it('should resolve individual param templates', () => {
    const parameterValues = {
      username: 'testuser',
      password: 'testpass'
    };

    const templateContext = createTemplateContextFromFlowRunner(
      {}, // storedResponses
      {}, // storedTransformations
      parameterValues,
      createTemplateFunctions({
        responses: {},
        transformedData: {},
        parameters: parameterValues,
        functions: defaultTemplateFunctions
      }),
      {} // environmentVariables
    );

    // Test individual template expressions
    const usernameResult = resolveTemplate('{{param:username}}', templateContext);
    const passwordResult = resolveTemplate('{{param:password}}', templateContext);

    console.log('Username template result:', usernameResult);
    console.log('Password template result:', passwordResult);

    expect(usernameResult).toBe('testuser');
    expect(passwordResult).toBe('testpass');
  });

  it('should handle templates with different syntax variations', () => {
    const parameterValues = {
      username: 'testuser',
      password: 'testpass'
    };

    const templateContext = createTemplateContextFromFlowRunner(
      {}, // storedResponses
      {}, // storedTransformations
      parameterValues,
      createTemplateFunctions({
        responses: {},
        transformedData: {},
        parameters: parameterValues,
        functions: defaultTemplateFunctions
      }),
      {} // environmentVariables
    );

    // Test different syntax variations
    const variations = [
      '{{param:username}}',
      '{{parameter:username}}',
      '{{var:username}}',
      '{{ param:username }}', // with spaces
      '{{param:password}}',
      '{{parameter:password}}',
    ];

    variations.forEach(variation => {
      console.log(`Testing variation: ${variation}`);
      const result = resolveTemplate(variation, templateContext);
      console.log(`Result: ${result}`);
      
      if (variation.includes('username')) {
        expect(result).toBe('testuser');
      } else if (variation.includes('password')) {
        expect(result).toBe('testpass');
      }
    });
  });

  it('should handle missing parameters gracefully', () => {
    const parameterValues = {
      username: 'testuser'
      // password is missing
    };

    const templateContext = createTemplateContextFromFlowRunner(
      {}, // storedResponses
      {}, // storedTransformations
      parameterValues,
      createTemplateFunctions({
        responses: {},
        transformedData: {},
        parameters: parameterValues,
        functions: defaultTemplateFunctions
      }),
      {} // environmentVariables
    );

    const requestBodyString = JSON.stringify({
      "password": "{{param:password}}", // This parameter doesn't exist
      "username": "{{param:username}}",
      "user_type": "employee"
    });

    console.log('Testing with missing password parameter...');
    
    // Use resolveTemplateExpression instead of resolveTemplate to check the error handling
    const result = resolveTemplateExpression(requestBodyString, templateContext);
    console.log('Result with missing parameter:', result);

    // The template resolution should fail but not throw
    expect(result.success).toBe(false);
    expect(result.error).toContain('Parameter not found: password');
    expect(result.value).toContain('{{param:password}}'); // Should return original template
  });

  it('should preserve non-template strings in objects', () => {
    const parameterValues = {
      username: 'testuser'
    };

    const templateContext = createTemplateContextFromFlowRunner(
      {}, // storedResponses
      {}, // storedTransformations
      parameterValues,
      createTemplateFunctions({
        responses: {},
        transformedData: {},
        parameters: parameterValues,
        functions: defaultTemplateFunctions
      }),
      {} // environmentVariables
    );

    const requestBodyString = JSON.stringify({
      "username": "{{param:username}}",
      "user_type": "employee", // This should remain unchanged
      "static_field": "static_value"
    });

    const result = resolveTemplate(requestBodyString, templateContext);

    if (typeof result === 'string') {
      const parsedResult = JSON.parse(result);
      expect(parsedResult.user_type).toBe('employee');
      expect(parsedResult.static_field).toBe('static_value');
      expect(parsedResult.username).toBe('testuser');
    } else {
      const typedResult = result as Record<string, any>;
      expect(typedResult.user_type).toBe('employee');
      expect(typedResult.static_field).toBe('static_value');
      expect(typedResult.username).toBe('testuser');
    }
  });
});
