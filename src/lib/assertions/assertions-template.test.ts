/**
 * Tests for template expressions in assertions
 */
import { describe, it, expect } from 'vitest';
import { evaluateAssertion } from '$lib/assertions/engine';
import type { Assertion } from '$lib/assertions/types';
import type { TemplateContext } from '$lib/assertions/template';
import { 
  hasTemplateExpressions, 
  validateAssertionExpectedValue 
} from '$lib/assertions/template';

describe('Template Expression Utilities', () => {
  it('should detect template expressions correctly', () => {
    expect(hasTemplateExpressions('{{res:step1-0.$.data}}')).toBe(true);
    expect(hasTemplateExpressions('no templates here')).toBe(false);
    expect(hasTemplateExpressions('single brace {not template}')).toBe(false);
  });

  it('should validate template expressions', () => {
    const validResult = validateAssertionExpectedValue('{{res:step1-0.$.data}}', true);
    expect(validResult.valid).toBe(true);

    const invalidSourceResult = validateAssertionExpectedValue('{{invalid:step1-0.$.data}}', true);
    expect(invalidSourceResult.valid).toBe(false);
    expect(invalidSourceResult.error).toContain('Unknown template source');

    const nonTemplateResult = validateAssertionExpectedValue('static value', false);
    expect(nonTemplateResult.valid).toBe(true);
  });
});

describe('Template Expression Assertions', () => {
  const mockTemplateContext: TemplateContext = {
    responses: {
      'step1-0': { data: { id: 123, name: 'Test User', active: true } }
    },
    transformedData: {
      'step1-0': { 'processedData': { calculatedValue: 456, isValid: false } }
    },
    parameters: {
      userId: 789,
      testName: 'Sample Test'
    }
  };
  
  it('should resolve response template expressions', () => {
    const assertion: Assertion = {
      id: 'test-1',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.userId',
      operator: 'equals',
      expected_value: '{{res:step1-0.$.data.id}}',
      enabled: true,
      is_template_expression: true
    };

    const result = evaluateAssertion(assertion, 123, mockTemplateContext);
    
    expect(result.passed).toBe(true);
    expect(result.actualValue).toBe(123);
    expect(result.expectedValue).toBe(123);
    expect(result.originalExpectedValue).toBe('{{res:step1-0.$.data.id}}');
  });

  it('should resolve transformed data template expressions', () => {
    const assertion: Assertion = {
      id: 'test-2',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.calculatedField',
      operator: 'equals',
      expected_value: '{{proc:step1-0.$.processedData.calculatedValue}}',
      enabled: true,
      is_template_expression: true
    };

    const result = evaluateAssertion(assertion, 456, mockTemplateContext);
    
    expect(result.passed).toBe(true);
    expect(result.actualValue).toBe(456);
    expect(result.expectedValue).toBe(456);
  });

  it('should resolve parameter template expressions', () => {
    const assertion: Assertion = {
      id: 'test-3',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.retryCount',
      operator: 'less_than',
      expected_value: '{{param:userId}}',
      enabled: true,
      is_template_expression: true
    };

    const result = evaluateAssertion(assertion, 2, mockTemplateContext);
    
    expect(result.passed).toBe(true);
    expect(result.actualValue).toBe(2);
    expect(result.expectedValue).toBe(789);
  });

  it('should handle template resolution errors gracefully', () => {
    const assertion: Assertion = {
      id: 'test-5',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.someField',
      operator: 'equals',
      expected_value: '{{res:nonexistent-step.$.data}}',
      enabled: true,
      is_template_expression: true
    };

    const result = evaluateAssertion(assertion, 'test', mockTemplateContext);
    
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Template resolution failed');
  });

  it('should work with non-template assertions as before', () => {
    const assertion: Assertion = {
      id: 'test-6',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.staticValue',
      operator: 'equals',
      expected_value: 'static-value',
      enabled: true,
      is_template_expression: false
    };

    const result = evaluateAssertion(assertion, 'static-value', mockTemplateContext);
    
    expect(result.passed).toBe(true);
    expect(result.actualValue).toBe('static-value');
    expect(result.expectedValue).toBe('static-value');
    expect(result.originalExpectedValue).toBeUndefined();
  });

  it('should handle complex template expressions', () => {
    const assertion: Assertion = {
      id: 'test-7',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.compositeValue',
      operator: 'equals',
      expected_value: 'User {{res:step1-0.$.data.name}} has ID {{res:step1-0.$.data.id}}',
      enabled: true,
      is_template_expression: true
    };

    const result = evaluateAssertion(assertion, 'User Test User has ID 123', mockTemplateContext);
    
    expect(result.passed).toBe(true);
    expect(result.expectedValue).toBe('User Test User has ID 123');
  });

  it('should preserve data types for single expressions', () => {
    // Test number preservation
    const numberAssertion: Assertion = {
      id: 'test-8',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.userId',
      operator: 'equals',
      expected_value: '{{res:step1-0.$.data.id}}',
      enabled: true,
      is_template_expression: true
    };

    const numberResult = evaluateAssertion(numberAssertion, 123, mockTemplateContext);
    expect(numberResult.passed).toBe(true);
    expect(numberResult.expectedValue).toBe(123);
    expect(typeof numberResult.expectedValue).toBe('number');

    // Test boolean preservation
    const boolAssertion: Assertion = {
      id: 'test-9',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.isActive',
      operator: 'equals',
      expected_value: '{{res:step1-0.$.data.active}}',
      enabled: true,
      is_template_expression: true
    };

    const boolResult = evaluateAssertion(boolAssertion, true, mockTemplateContext);
    expect(boolResult.passed).toBe(true);
    expect(boolResult.expectedValue).toBe(true);
    expect(typeof boolResult.expectedValue).toBe('boolean');

    // Test string preservation
    const stringAssertion: Assertion = {
      id: 'test-10',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.userName',
      operator: 'equals',
      expected_value: '{{res:step1-0.$.data.name}}',
      enabled: true,
      is_template_expression: true
    };

    const stringResult = evaluateAssertion(stringAssertion, 'Test User', mockTemplateContext);
    expect(stringResult.passed).toBe(true);
    expect(stringResult.expectedValue).toBe('Test User');
    expect(typeof stringResult.expectedValue).toBe('string');
  });

  it('should handle smart string cases - quoted and unquoted expressions with string values', () => {
    // Test that both "{{var}}" and {{var}} return the same string when var is a string
    const quotedStringAssertion: Assertion = {
      id: 'test-11',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.userName',
      operator: 'equals',
      expected_value: '"{{res:step1-0.$.data.name}}"',
      enabled: true,
      is_template_expression: true
    };

    const unquotedStringAssertion: Assertion = {
      id: 'test-12',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.userName',
      operator: 'equals',
      expected_value: '{{res:step1-0.$.data.name}}',
      enabled: true,
      is_template_expression: true
    };

    const quotedResult = evaluateAssertion(quotedStringAssertion, 'Test User', mockTemplateContext);
    const unquotedResult = evaluateAssertion(unquotedStringAssertion, 'Test User', mockTemplateContext);
    
    // Both should pass and return the same string value
    expect(quotedResult.passed).toBe(true);
    expect(unquotedResult.passed).toBe(true);
    expect(quotedResult.expectedValue).toBe('Test User');
    expect(unquotedResult.expectedValue).toBe('Test User');
    expect(typeof quotedResult.expectedValue).toBe('string');
    expect(typeof unquotedResult.expectedValue).toBe('string');
    
    // Test with numbers - quoted should convert to string, unquoted should preserve type
    const quotedNumberAssertion: Assertion = {
      id: 'test-13',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.userId',
      operator: 'equals',
      expected_value: '"{{res:step1-0.$.data.id}}"',
      enabled: true,
      is_template_expression: true
    };

    const unquotedNumberAssertion: Assertion = {
      id: 'test-14',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.userId',
      operator: 'equals',
      expected_value: '{{res:step1-0.$.data.id}}',
      enabled: true,
      is_template_expression: true
    };

    const quotedNumberResult = evaluateAssertion(quotedNumberAssertion, '123', mockTemplateContext);
    const unquotedNumberResult = evaluateAssertion(unquotedNumberAssertion, 123, mockTemplateContext);
    
    // Quoted should convert number to string
    expect(quotedNumberResult.passed).toBe(true);
    expect(quotedNumberResult.expectedValue).toBe('123');
    expect(typeof quotedNumberResult.expectedValue).toBe('string');
    
    // Unquoted should preserve number type
    expect(unquotedNumberResult.passed).toBe(true);
    expect(unquotedNumberResult.expectedValue).toBe(123);
    expect(typeof unquotedNumberResult.expectedValue).toBe('number');
  });
});
