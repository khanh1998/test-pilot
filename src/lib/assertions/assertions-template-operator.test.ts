/**
 * Test script to verify that operator selection works correctly with templates
 */
import { describe, it, expect } from 'vitest';

type AssertionType = 'json_body' | 'status_code';
type ExpectedValueType = 'string' | 'number' | 'boolean';

// Mock the operators that would be available
const mockOperatorsByType: Record<AssertionType, string[]> = {
  json_body: [
    'equals', 'not_equals', 'exists', 
    'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
    'between', 'not_between',
    'contains', 'not_contains', 'starts_with', 'ends_with', 'matches_regex',
    'is_empty', 'is_not_empty',
    'has_length', 'length_greater_than', 'length_less_than',
    'contains_all', 'contains_any', 'not_contains_any',
    'one_of', 'not_one_of',
    'is_type', 'is_null', 'is_not_null'
  ],
  status_code: [
    'equals', 'not_equals', 'greater_than', 'less_than',
    'greater_than_or_equal', 'less_than_or_equal',
    'between', 'not_between'
  ]
};

// Mock the function that would be in AssertionEditor.svelte
function getOperatorsForType(assertionType: AssertionType, valueType?: ExpectedValueType, isTemplate = false): string[] {
  // If using template expressions, return all available operators for the assertion type
  if (isTemplate) {
    return mockOperatorsByType[assertionType];
  }
  
  // If no specific value type or not json_body, return all operators for the assertion type
  if (!valueType || assertionType !== 'json_body') {
    return mockOperatorsByType[assertionType];
  }
  
  // Filter operators based on value type
  switch (valueType) {
    case 'number':
      return [
        'equals', 'not_equals', 'exists',
        'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
        'between', 'not_between', 'is_null', 'is_not_null'
      ];
    
    case 'string':
      return [
        'equals', 'not_equals', 'exists', 'contains', 'not_contains',
        'starts_with', 'ends_with', 'matches_regex', 'is_empty', 'is_not_empty',
        'is_null', 'is_not_null'
      ];
    
    case 'boolean':
      return [
        'equals', 'not_equals', 'exists', 'is_null', 'is_not_null'
      ];
    
    default:
      return mockOperatorsByType[assertionType];
  }
}

describe('Operator Selection with Templates', () => {
  it('should return filtered operators for string type without template', () => {
    const operators = getOperatorsForType('json_body', 'string', false);
    
    expect(operators).toContain('equals');
    expect(operators).toContain('contains');
    expect(operators).toContain('starts_with');
    expect(operators).not.toContain('greater_than'); // Numeric operator
    expect(operators).not.toContain('has_length'); // Array operator
  });

  it('should return all operators for json_body when using template', () => {
    const operators = getOperatorsForType('json_body', 'string', true);
    
    expect(operators).toContain('equals');
    expect(operators).toContain('contains');
    expect(operators).toContain('greater_than'); // Should now be available
    expect(operators).toContain('has_length'); // Should now be available
    expect(operators).toContain('contains_all'); // Should now be available
    expect(operators).toHaveLength(mockOperatorsByType.json_body.length);
  });

  it('should return all operators for json_body when using template regardless of value type', () => {
    const stringOperators = getOperatorsForType('json_body', 'string', true);
    const numberOperators = getOperatorsForType('json_body', 'number', true);
    const booleanOperators = getOperatorsForType('json_body', 'boolean', true);
    
    // All should be the same and contain all operators
    expect(stringOperators).toEqual(numberOperators);
    expect(numberOperators).toEqual(booleanOperators);
    expect(stringOperators).toHaveLength(mockOperatorsByType.json_body.length);
  });

  it('should work correctly for status_code assertion type', () => {
    const withoutTemplate = getOperatorsForType('status_code', undefined, false);
    const withTemplate = getOperatorsForType('status_code', undefined, true);
    
    // Should be the same since status_code doesn't filter by value type
    expect(withoutTemplate).toEqual(withTemplate);
    expect(withTemplate).toHaveLength(mockOperatorsByType.status_code.length);
  });
});
