/**
 * Tests for the assertion module
 */
import { describe, it, expect } from 'vitest';
import { getOperator, evaluateAssertion } from '$lib/assertions';

describe('Assertion Operators', () => {
  // Basic operators
  it('equals operator should compare values correctly', () => {
    const operator = getOperator('equals');
    expect(operator.evaluate(5, 5)).toBe(true);
    expect(operator.evaluate('test', 'test')).toBe(true);
    expect(operator.evaluate(5, '5')).toBe(true); // Loose equality
    expect(operator.evaluate(5, 6)).toBe(false);
  });

  it('not_equals operator should compare values correctly', () => {
    const operator = getOperator('not_equals');
    expect(operator.evaluate(5, 6)).toBe(true);
    expect(operator.evaluate('test', 'other')).toBe(true);
    expect(operator.evaluate(5, 5)).toBe(false);
  });

  it('contains operator should handle strings and arrays', () => {
    const operator = getOperator('contains');
    expect(operator.evaluate('test string', 'string')).toBe(true);
    expect(operator.evaluate([1, 2, 3], 2)).toBe(true);
    expect(operator.evaluate('test', 'other')).toBe(false);
    expect(operator.evaluate([1, 2, 3], 4)).toBe(false);
    expect(operator.evaluate(null, 'anything')).toBe(false); // Handles invalid types
  });

  it('exists operator should check for null/undefined', () => {
    const operator = getOperator('exists');
    expect(operator.evaluate('', null)).toBe(true); // Empty string exists
    expect(operator.evaluate(0, null)).toBe(true); // Zero exists
    expect(operator.evaluate(null, null)).toBe(false);
    expect(operator.evaluate(undefined, null)).toBe(false);
  });

  // Numeric operators
  it('greater_than operator should compare numbers correctly', () => {
    const operator = getOperator('greater_than');
    expect(operator.evaluate(5, 4)).toBe(true);
    expect(operator.evaluate(5, 5)).toBe(false);
    expect(operator.evaluate(4, 5)).toBe(false);
    expect(operator.evaluate('5', 4)).toBe(false); // Strict type check
  });

  it('less_than operator should compare numbers correctly', () => {
    const operator = getOperator('less_than');
    expect(operator.evaluate(4, 5)).toBe(true);
    expect(operator.evaluate(5, 5)).toBe(false);
    expect(operator.evaluate(6, 5)).toBe(false);
  });

  // String operators
  it('starts_with operator should check string prefix', () => {
    const operator = getOperator('starts_with');
    expect(operator.evaluate('test string', 'test')).toBe(true);
    expect(operator.evaluate('test string', 'string')).toBe(false);
    expect(operator.evaluate(123, 'test')).toBe(false); // Invalid type
  });

  it('ends_with operator should check string suffix', () => {
    const operator = getOperator('ends_with');
    expect(operator.evaluate('test string', 'string')).toBe(true);
    expect(operator.evaluate('test string', 'test')).toBe(false);
  });

  // Array operators
  it('has_length operator should check array/string length', () => {
    const operator = getOperator('has_length');
    expect(operator.evaluate([1, 2, 3], 3)).toBe(true);
    expect(operator.evaluate('test', 4)).toBe(true);
    expect(operator.evaluate([1, 2], 3)).toBe(false);
    expect(operator.evaluate(null, 3)).toBe(false); // Invalid type
  });

  it('contains_all operator should check all items exist', () => {
    const operator = getOperator('contains_all');
    expect(operator.evaluate([1, 2, 3, 4], [1, 3])).toBe(true);
    expect(operator.evaluate([1, 2, 3], [1, 4])).toBe(false);
    expect(operator.evaluate('test', [1])).toBe(false); // Invalid type
  });
});

describe('Assertion Evaluation', () => {
  it('evaluateAssertion should return correct result for passing assertion', () => {
    const assertion = {
      id: 'test-1',
      data_source: 'response',
      assertion_type: 'status_code',
      data_id: 'status_code',
      operator: 'equals',
      expected_value: 200,
      enabled: true
    } as import('$lib/assertions/types').Assertion;

    const result = evaluateAssertion(assertion, 200);
    expect(result.passed).toBe(true);
    expect(result.actualValue).toBe(200);
    expect(result.expectedValue).toBe(200);
    expect(result.message).toContain('Assertion passed');
  });

  it('evaluateAssertion should return correct result for failing assertion', () => {
    const assertion = {
      id: 'test-2',
      data_source: 'response',
      assertion_type: 'status_code',
      data_id: 'status_code',
      operator: 'equals',
      expected_value: 200,
      enabled: true
    } as import('$lib/assertions/types').Assertion;

    const result = evaluateAssertion(assertion, 404);
    expect(result.passed).toBe(false);
    expect(result.actualValue).toBe(404);
    expect(result.expectedValue).toBe(200);
    expect(result.message).toContain('Assertion failed');
  });
});
