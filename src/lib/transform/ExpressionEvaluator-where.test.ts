/**
 * Tests for the SafeExpressionEvaluator where function with comparison expressions
 * This test validates the fix for the bug where expressions like "$.age > 18" 
 * were incorrectly routed to JSONPath evaluator instead of expression parser
 */
import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('ExpressionEvaluator Where Function with Comparison Expressions', () => {
  const evaluator = new SafeExpressionEvaluator();

  const testData = {
    data: [
      { name: "Alice", age: 25, active: true },
      { name: "Bob", age: 17, active: false },
      { name: "Charlie", age: 30, active: true },
      { name: "Diana", age: 16, active: true },
      { name: "Eve", age: 22, active: false }
    ]
  };

  it('should filter using greater than comparison', () => {
    const result = evaluator.evaluate('$.data | where($.age > 18)', testData);
    const expected = [
      { name: "Alice", age: 25, active: true },
      { name: "Charlie", age: 30, active: true },
      { name: "Eve", age: 22, active: false }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should filter using less than comparison', () => {
    const result = evaluator.evaluate('$.data | where($.age < 20)', testData);
    const expected = [
      { name: "Bob", age: 17, active: false },
      { name: "Diana", age: 16, active: true }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should filter using equality comparison', () => {
    const result = evaluator.evaluate('$.data | where($.age == 25)', testData);
    const expected = [
      { name: "Alice", age: 25, active: true }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should filter using string equality comparison', () => {
    const result = evaluator.evaluate('$.data | where($.name == "Bob")', testData);
    const expected = [
      { name: "Bob", age: 17, active: false }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should filter using boolean comparison', () => {
    const result = evaluator.evaluate('$.data | where($.active == true)', testData);
    const expected = [
      { name: "Alice", age: 25, active: true },
      { name: "Charlie", age: 30, active: true },
      { name: "Diana", age: 16, active: true }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should filter using greater than or equal comparison', () => {
    const result = evaluator.evaluate('$.data | where($.age >= 22)', testData);
    const expected = [
      { name: "Alice", age: 25, active: true },
      { name: "Charlie", age: 30, active: true },
      { name: "Eve", age: 22, active: false }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should filter using less than or equal comparison', () => {
    const result = evaluator.evaluate('$.data | where($.age <= 17)', testData);
    const expected = [
      { name: "Bob", age: 17, active: false },
      { name: "Diana", age: 16, active: true }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should filter using not equal comparison', () => {
    const result = evaluator.evaluate('$.data | where($.age != 25)', testData);
    const expected = [
      { name: "Bob", age: 17, active: false },
      { name: "Charlie", age: 30, active: true },
      { name: "Diana", age: 16, active: true },
      { name: "Eve", age: 22, active: false }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should work with logical AND operator', () => {
    const result = evaluator.evaluate('$.data | where($.age > 18 && $.active == true)', testData);
    const expected = [
      { name: "Alice", age: 25, active: true },
      { name: "Charlie", age: 30, active: true }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should work with logical OR operator', () => {
    const result = evaluator.evaluate('$.data | where($.age < 18 || $.age > 29)', testData);
    const expected = [
      { name: "Bob", age: 17, active: false },
      { name: "Charlie", age: 30, active: true },
      { name: "Diana", age: 16, active: true }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should chain with other pipeline functions like sort', () => {
    const result = evaluator.evaluate('$.data | where($.age > 18) | sort(by: "age")', testData);
    const expected = [
      { name: "Eve", age: 22, active: false },
      { name: "Alice", age: 25, active: true },
      { name: "Charlie", age: 30, active: true }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should chain with map function', () => {
    const result = evaluator.evaluate('$.data | where($.age > 20) | map($.name)', testData);
    const expected = ["Alice", "Charlie", "Eve"];
    
    expect(result).toEqual(expected);
  });

  it('should still work with pure JSONPath expressions (no operators)', () => {
    const result = evaluator.evaluate('$.data[0].name', testData);
    expect(result).toBe("Alice");
  });

  it('should handle empty results from where clause', () => {
    const result = evaluator.evaluate('$.data | where($.age > 100)', testData);
    expect(result).toEqual([]);
  });

  it('should handle invalid field references gracefully', () => {
    const result = evaluator.evaluate('$.data | where($.nonexistent > 0)', testData);
    expect(result).toEqual([]);
  });
});
