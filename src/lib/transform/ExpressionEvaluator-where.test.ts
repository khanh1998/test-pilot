/**
 * Tests for the SafeExpressionEvaluator where function with comparison expressions
 * This test validates the fix for the bug where expressions like "$.age > 18" 
 * were incorrectly routed to JSONPath evaluator instead of expression parser
 */
import { describe, it, expect, beforeEach } from 'vitest';
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

describe('ExpressionEvaluator Where Function with Template Expressions', () => {
  const evaluator = new SafeExpressionEvaluator();

  const testData = {
    data: [
      { username: "alice", balance: 1500, status: "active", category: "premium" },
      { username: "bob", balance: 500, status: "inactive", category: "basic" },
      { username: "charlie", balance: 2000, status: "active", category: "premium" },
      { username: "diana", balance: 750, status: "active", category: "basic" },
      { username: "eve", balance: 1200, status: "inactive", category: "premium" }
    ]
  };

  beforeEach(() => {
    // Set up template context with parameters
    evaluator.setTemplateContext({
      responses: {},
      transformedData: {},
      parameters: {
        minBalance: 1000,
        targetStatus: "active",
        premiumCategory: "premium",
        maxBalance: 1500,
        isActive: true
      },
      environment: {
        FILTER_CATEGORY: "premium",
        MIN_THRESHOLD: 800
      },
      functions: {}
    });
  });

  it('should support template expressions with numeric parameters - the exact example', () => {
    // This tests the exact example from the user request
    const result = evaluator.evaluate('$.data | where($.balance > {{param:minBalance}}) | map($.username)', testData);
    const expected = ["alice", "charlie", "eve"];
    
    expect(result).toEqual(expected);
  });

  it('should support template expressions with string parameters', () => {
    const result = evaluator.evaluate('$.data | where($.status == "{{param:targetStatus}}")', testData);
    const expected = [
      { username: "alice", balance: 1500, status: "active", category: "premium" },
      { username: "charlie", balance: 2000, status: "active", category: "premium" },
      { username: "diana", balance: 750, status: "active", category: "basic" }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should support unquoted template expressions preserving numeric types', () => {
    const result = evaluator.evaluate('$.data | where($.balance <= {{param:maxBalance}})', testData);
    const expected = [
      { username: "alice", balance: 1500, status: "active", category: "premium" },
      { username: "bob", balance: 500, status: "inactive", category: "basic" },
      { username: "diana", balance: 750, status: "active", category: "basic" },
      { username: "eve", balance: 1200, status: "inactive", category: "premium" }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should support environment variable template expressions', () => {
    const result = evaluator.evaluate('$.data | where($.category == "{{env:FILTER_CATEGORY}}")', testData);
    const expected = [
      { username: "alice", balance: 1500, status: "active", category: "premium" },
      { username: "charlie", balance: 2000, status: "active", category: "premium" },
      { username: "eve", balance: 1200, status: "inactive", category: "premium" }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should support numeric environment variable templates', () => {
    const result = evaluator.evaluate('$.data | where($.balance >= {{env:MIN_THRESHOLD}})', testData);
    const expected = [
      { username: "alice", balance: 1500, status: "active", category: "premium" },
      { username: "charlie", balance: 2000, status: "active", category: "premium" },
      { username: "eve", balance: 1200, status: "inactive", category: "premium" }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should support complex expressions with multiple template parameters', () => {
    const result = evaluator.evaluate('$.data | where($.balance > {{param:minBalance}} && $.status == "{{param:targetStatus}}")', testData);
    const expected = [
      { username: "alice", balance: 1500, status: "active", category: "premium" },
      { username: "charlie", balance: 2000, status: "active", category: "premium" }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should support template expressions in complex pipelines', () => {
    const result = evaluator.evaluate('$.data | where($.balance > {{param:minBalance}}) | where($.category == "{{env:FILTER_CATEGORY}}") | map($.username)', testData);
    const expected = ["alice", "charlie", "eve"];
    
    expect(result).toEqual(expected);
  });

  it('should handle quoted vs unquoted template expressions correctly', () => {
    // Unquoted should preserve numeric type
    const unquotedResult = evaluator.evaluate('$.data | where($.balance == {{param:maxBalance}})', testData);
    expect(unquotedResult).toEqual([
      { username: "alice", balance: 1500, status: "active", category: "premium" }
    ]);

    // Quoted should convert to string
    const quotedResult = evaluator.evaluate('$.data | where($.balance == "{{param:maxBalance}}")', testData);
    expect(quotedResult).toEqual([]); // No matches because 1500 !== "1500"
  });

  it('should handle missing parameters gracefully', () => {
    const result = evaluator.evaluate('$.data | where($.balance > {{param:nonexistentParam}})', testData);
    // Should return empty array when template cannot be resolved
    expect(result).toEqual([]);
  });

  it('should support response template expressions', () => {
    // Set up a response in the template context
    evaluator.setTemplateContext({
      responses: {
        'step1-0': { threshold: 1000, filterStatus: "active" }
      },
      transformedData: {},
      parameters: {},
      environment: {},
      functions: {}
    });

    const result = evaluator.evaluate('$.data | where($.balance > {{res:step1-0.$.threshold}})', testData);
    const expected = [
      { username: "alice", balance: 1500, status: "active", category: "premium" },
      { username: "charlie", balance: 2000, status: "active", category: "premium" },
      { username: "eve", balance: 1200, status: "inactive", category: "premium" }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should support transformed data template expressions', () => {
    // Set up transformed data in the template context
    evaluator.setTemplateContext({
      responses: {},
      transformedData: {
        'step1-0': {
          'filterConfig': { minAmount: 1000, targetCategory: "premium" }
        }
      },
      parameters: {},
      environment: {},
      functions: {}
    });

    const result = evaluator.evaluate('$.data | where($.balance >= {{proc:step1-0.$.filterConfig.minAmount}})', testData);
    const expected = [
      { username: "alice", balance: 1500, status: "active", category: "premium" },
      { username: "charlie", balance: 2000, status: "active", category: "premium" },
      { username: "eve", balance: 1200, status: "inactive", category: "premium" }
    ];
    
    expect(result).toEqual(expected);
  });
});
