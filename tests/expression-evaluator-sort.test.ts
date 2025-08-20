/**
 * Tests for the SafeExpressionEvaluator sort function
 */
import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from '$lib/transform/ExpressionEvaluator';

describe('ExpressionEvaluator Sort Function', () => {
  const evaluator = new SafeExpressionEvaluator();

  it('should sort numbers correctly in ascending order', () => {
    const testData = {
      data: [1, 2, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 3, 30, 31, 32, 33]
    };

    const result = evaluator.evaluate('$.data | sort()', testData);
    const expected = [1, 2, 3, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];
    
    expect(result).toEqual(expected);
  });

  it('should sort category_ids from objects correctly', () => {
    const testData = {
      data: [
        { category_id: 1 },
        { category_id: 2 },
        { category_id: 20 },
        { category_id: 21 },
        { category_id: 22 },
        { category_id: 3 },
        { category_id: 30 },
        { category_id: 31 },
        { category_id: 32 }
      ]
    };

    const result = evaluator.evaluate('$.data | map($.category_id) | sort()', testData);
    const expected = [1, 2, 3, 20, 21, 22, 30, 31, 32];
    
    expect(result).toEqual(expected);
  });

  it('should sort numbers in descending order', () => {
    const testData = {
      data: [1, 3, 2, 20, 21]
    };

    const result = evaluator.evaluate('$.data | sort(desc: true)', testData);
    const expected = [21, 20, 3, 2, 1];
    
    expect(result).toEqual(expected);
  });

  it('should sort by field in objects', () => {
    const testData = {
      data: [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 35 }
      ]
    };

    const result = evaluator.evaluate('$.data | sort(by: "age")', testData);
    const expected = [
      { name: 'Bob', age: 25 },
      { name: 'Alice', age: 30 },
      { name: 'Charlie', age: 35 }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should sort strings lexicographically', () => {
    const testData = {
      data: ['banana', 'apple', 'cherry', 'date']
    };

    const result = evaluator.evaluate('$.data | sort()', testData);
    const expected = ['apple', 'banana', 'cherry', 'date'];
    
    expect(result).toEqual(expected);
  });

  it('should handle mixed numeric and string values (prioritize numeric)', () => {
    const testData = {
      data: [10, '2', 1, '20']
    };

    const result = evaluator.evaluate('$.data | sort()', testData);
    // Numbers should be sorted numerically
    const expected = [1, '2', 10, '20'];
    
    expect(result).toEqual(expected);
  });

  it('should handle null and undefined values', () => {
    const testData = {
      data: [3, null, 1, undefined, 2]
    };

    const result = evaluator.evaluate('$.data | sort()', testData);
    // null/undefined should come first in ascending order
    const expected = [null, undefined, 1, 2, 3];
    
    expect(result).toEqual(expected);
  });

  it('should handle empty array', () => {
    const testData = {
      data: []
    };

    const result = evaluator.evaluate('$.data | sort()', testData);
    expect(result).toEqual([]);
  });

  it('should handle non-array input gracefully', () => {
    const testData = {
      data: null
    };

    const result = evaluator.evaluate('$.data | sort()', testData);
    expect(result).toEqual([]);
  });
});
