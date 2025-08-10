/**
 * Tests for template expressions in assertions
 */
import { describe, it, expect } from 'vitest';
import { evaluateAssertion } from '$lib/assertions/engine';
import type { Assertion } from '$lib/assertions/types';
import type { TemplateContext } from '$lib/assertions/template';

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
};  it('should resolve response template expressions', () => {
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
      expected_value: '{{param:maxRetries}}',
      enabled: true,
      is_template_expression: true
    };

    const result = evaluateAssertion(assertion, 2, mockTemplateContext);
    
    expect(result.passed).toBe(true);
    expect(result.actualValue).toBe(2);
    expect(result.expectedValue).toBe(3);
  });

  it('should preserve original data types with triple braces', () => {
    const assertion: Assertion = {
      id: 'test-4',
      data_source: 'response',
      assertion_type: 'json_body',
      data_id: '$.isActive',
      operator: 'equals',
      expected_value: '{{{res:step1-0.$.data.active}}}',
      enabled: true,
      is_template_expression: true
    };

    const result = evaluateAssertion(assertion, true, mockTemplateContext);
    
    expect(result.passed).toBe(true);
    expect(result.actualValue).toBe(true);
    expect(result.expectedValue).toBe(true);
    expect(typeof result.expectedValue).toBe('boolean');
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
});
