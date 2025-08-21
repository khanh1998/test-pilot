/**
 * Tests for the flatten pipeline function
 */
import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('ExpressionEvaluator Flatten Function', () => {
  const evaluator = new SafeExpressionEvaluator();

  it('should flatten array of arrays', () => {
    const testData = { data: [[1, 2], [3, 4], [5]] };
    const result = evaluator.evaluate('$.data | flatten()', testData);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should flatten with specified depth', () => {
    const testData = { data: [[[1, 2]], [[3, 4]], [5]] };
    const result = evaluator.evaluate('$.data | flatten(1)', testData);
    expect(result).toEqual([[1, 2], [3, 4], 5]);
  });

  it('should flatten deeply nested arrays', () => {
    const testData = { data: [[[1, 2]], [[3, 4]], [5]] };
    const result = evaluator.evaluate('$.data | flatten(2)', testData);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should work with map and wildcard followed by flatten', () => {
    const testData = {
      data: [
        {
          code: 'fusion-cafe',
          terminals: [
            { id: 2, name: 'Terminal 1' },
            { id: 1, name: 'Terminal 2' }
          ]
        }
      ]
    };

    const result = evaluator.evaluate('$.data | where($.code == \'fusion-cafe\') | map($.terminals[*].id) | flatten() | sort() | first()', testData);
    expect(result).toBe(1);
  });

  it('should handle empty arrays', () => {
    const testData = { data: [] };
    const result = evaluator.evaluate('$.data | flatten()', testData);
    expect(result).toEqual([]);
  });

  it('should handle non-arrays gracefully', () => {
    const testData = { data: 'not an array' };
    const result = evaluator.evaluate('$.data | flatten()', testData);
    expect(result).toEqual([]);
  });

  it('should handle mixed content', () => {
    const testData = { data: [1, [2, 3], 4, [5, [6, 7]]] };
    const result = evaluator.evaluate('$.data | flatten()', testData);
    expect(result).toEqual([1, 2, 3, 4, 5, [6, 7]]);
  });
});
