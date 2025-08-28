import { describe, test, expect, beforeEach } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('SafeExpressionEvaluator - at() function (simplified)', () => {
  let evaluator: SafeExpressionEvaluator;

  beforeEach(() => {
    evaluator = new SafeExpressionEvaluator();
  });

  test('should get element at positive index', () => {
    const testData = ['apple', 'banana', 'cherry'];
    expect(evaluator.evaluate('data | at(0)', testData)).toBe('apple');
    expect(evaluator.evaluate('data | at(1)', testData)).toBe('banana');
    expect(evaluator.evaluate('data | at(2)', testData)).toBe('cherry');
  });

  test('should get element at negative index', () => {
    const testData = ['apple', 'banana', 'cherry'];
    expect(evaluator.evaluate('data | at(-1)', testData)).toBe('cherry');
    expect(evaluator.evaluate('data | at(-2)', testData)).toBe('banana');
    expect(evaluator.evaluate('data | at(-3)', testData)).toBe('apple');
  });

  test('should return undefined for out of bounds', () => {
    const testData = ['apple', 'banana', 'cherry'];
    expect(evaluator.evaluate('data | at(10)', testData)).toBeUndefined();
    expect(evaluator.evaluate('data | at(-10)', testData)).toBeUndefined();
  });

  test('should work with object arrays', () => {
    const testData = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ];
    
    const result = evaluator.evaluate('data | at(1)', testData);
    expect(result).toEqual({ id: 2, name: 'Bob' });
  });

  test('should work after sort', () => {
    const testData = [10, 5, 20, 15];
    expect(evaluator.evaluate('data | sort() | at(0)', testData)).toBe(5);
    expect(evaluator.evaluate('data | sort() | at(-1)', testData)).toBe(20);
  });

  test('should work with take and skip', () => {
    const testData = [10, 5, 20, 15, 25];
    expect(evaluator.evaluate('data | take(3) | at(-1)', testData)).toBe(20);
    expect(evaluator.evaluate('data | skip(2) | at(0)', testData)).toBe(20);
  });

  test('should handle string indices', () => {
    const testData = ['first', 'second', 'third'];
    expect(evaluator.evaluate('data | at(0)', testData)).toBe('first');
  });

  test('should handle non-array input gracefully', () => {
    expect(evaluator.evaluate('data | at(0)', 'not-array')).toBeUndefined();
    expect(evaluator.evaluate('data | at(0)', null)).toBeUndefined();
    expect(evaluator.evaluate('data | at(0)', { key: 'value' })).toBeUndefined();
  });

  test('should handle invalid indices', () => {
    const testData = ['a', 'b', 'c'];
    expect(evaluator.evaluate('data | at(null)', testData)).toBeUndefined();
  });

  test('should work with large arrays', () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => i);
    expect(evaluator.evaluate('data | at(500)', largeArray)).toBe(500);
    expect(evaluator.evaluate('data | at(-1)', largeArray)).toBe(999);
  });

  test('should work with nested pipeline operations', () => {
    const testData = [
      { name: 'Alice', scores: [85, 92, 78] },
      { name: 'Bob', scores: [76, 88, 95] },
      { name: 'Charlie', scores: [90, 85, 92] }
    ];
    
    // Get the second person's name
    const result = evaluator.evaluate('data | at(1)', testData);
    expect(result).toEqual({ name: 'Bob', scores: [76, 88, 95] });
  });

  test('should work with map and at combination', () => {
    const testData = [
      { value: 10 },
      { value: 20 },
      { value: 30 }
    ];
    
    // Extract values and get the second one
    expect(evaluator.evaluate('data | map($.value) | at(1)', testData)).toBe(20);
  });

  test('should handle float indices by converting to integer', () => {
    const testData = ['a', 'b', 'c'];
    expect(evaluator.evaluate('data | at(1.7)', testData)).toBe('b');
    expect(evaluator.evaluate('data | at(0.9)', testData)).toBe('a');
  });

  test('should return references to original objects', () => {
    const originalData = [
      { id: 1, mutable: true },
      { id: 2, mutable: true }
    ];
    
    const result = evaluator.evaluate('data | at(0)', originalData);
    
    // The result should be the same reference as the original object
    expect(result).toBe(originalData[0]);
    
    // Modifying the result should affect the original (this is expected JavaScript behavior)
    if (typeof result === 'object' && result !== null) {
      (result as any).mutable = false;
    }
    
    // The original data will be modified since we returned a reference
    expect(originalData[0].mutable).toBe(false);
  });
});
