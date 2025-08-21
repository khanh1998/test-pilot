/**
 * Tests for JSONPath wildcard functionality
 * This test validates wildcard array access followed by property access
 */
import { describe, it, expect } from 'vitest';
import { SafeJSONPathEvaluator } from './JSONPathEvaluator';

describe('JSONPath Wildcard Tests', () => {
  const evaluator = new SafeJSONPathEvaluator();

  const testData = {
    data: [
      {
        code: 'fusion-cafe',
        terminals: [
          { id: 2, name: 'Terminal 1' },
          { id: 3, name: 'Terminal 2' }
        ]
      },
      {
        code: 'other-cafe',
        terminals: [
          { id: 4, name: 'Terminal 3' }
        ]
      }
    ],
    config: {
      setting1: { value: 'a', priority: 1 },
      setting2: { value: 'b', priority: 2 },
      setting3: { value: 'c', priority: 3 }
    }
  };

  it('should handle array wildcard with property access', () => {
    const result = evaluator.evaluate('$.data[0].terminals[*].id', testData);
    expect(result).toEqual([2, 3]);
  });

  it('should handle array wildcard with name property access', () => {
    const result = evaluator.evaluate('$.data[0].terminals[*].name', testData);
    expect(result).toEqual(['Terminal 1', 'Terminal 2']);
  });

  it('should handle object wildcard with property access', () => {
    const result = evaluator.evaluate('$.config[*].value', testData);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('should handle object wildcard with numeric property access', () => {
    const result = evaluator.evaluate('$.config[*].priority', testData);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should handle empty array wildcard', () => {
    const emptyData = { items: [] };
    const result = evaluator.evaluate('$.items[*].id', emptyData);
    expect(result).toEqual([]);
  });

  it('should handle missing property after wildcard', () => {
    const result = evaluator.evaluate('$.data[0].terminals[*].nonexistent', testData);
    expect(result).toEqual([undefined, undefined]);
  });

  it('should handle wildcard on different array sizes', () => {
    const result1 = evaluator.evaluate('$.data[0].terminals[*].id', testData);
    const result2 = evaluator.evaluate('$.data[1].terminals[*].id', testData);
    
    expect(result1).toEqual([2, 3]);
    expect(result2).toEqual([4]);
  });

  it('should work with numeric array access vs wildcard', () => {
    const numericResult = evaluator.evaluate('$.data[0].terminals[0].id', testData);
    const wildcardResult = evaluator.evaluate('$.data[0].terminals[*].id', testData);
    
    expect(numericResult).toBe(2);
    expect(wildcardResult).toEqual([2, 3]);
  });

  it('should handle nested wildcards', () => {
    const nestedData = {
      groups: [
        { items: [{ value: 1 }, { value: 2 }] },
        { items: [{ value: 3 }, { value: 4 }] }
      ]
    };
    
    const result = evaluator.evaluate('$.groups[*].items', nestedData);
    expect(result).toEqual([
      [{ value: 1 }, { value: 2 }],
      [{ value: 3 }, { value: 4 }]
    ]);
  });

  it('should handle wildcard with null/undefined gracefully', () => {
    const testDataWithNulls = {
      items: [
        { id: 1, data: { value: 'a' } },
        { id: 2, data: null },
        { id: 3, data: { value: 'c' } }
      ]
    };
    
    const result = evaluator.evaluate('$.items[*].data', testDataWithNulls);
    expect(result).toEqual([
      { value: 'a' },
      null,
      { value: 'c' }
    ]);
  });
});
