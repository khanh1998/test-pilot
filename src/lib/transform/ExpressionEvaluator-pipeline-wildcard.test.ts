/**
 * Tests for Expression Evaluator wildcard functionality in pipelines
 * This test validates the fix for the specific issue mentioned by the user
 */
import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('ExpressionEvaluator Pipeline Wildcard Tests', () => {
  const evaluator = new SafeExpressionEvaluator();

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
    ]
  };

  it('should work with specific index - original working case', () => {
    const result = evaluator.evaluate('$.data | where($.code == \'fusion-cafe\') | map($.terminals[0].id)', testData);
    expect(result).toEqual([2]);
  });

  it('should work with wildcard - previously broken case', () => {
    const result = evaluator.evaluate('$.data | where($.code == \'fusion-cafe\') | map($.terminals[*].id)', testData);
    expect(result).toEqual([[2, 3]]);
  });

  it('should work with wildcard for multiple cafes', () => {
    const result = evaluator.evaluate('$.data | map($.terminals[*].id)', testData);
    expect(result).toEqual([[2, 3], [4]]);
  });

  it('should work with wildcard followed by other transformations', () => {
    const result = evaluator.evaluate('$.data | where($.code == \'fusion-cafe\') | map($.terminals[*].name)', testData);
    expect(result).toEqual([['Terminal 1', 'Terminal 2']]);
  });
});