/**
 * Tests for the SafeExpressionEvaluator sort function with numbers
 */
import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('ExpressionEvaluator Sort Function with Numbers', () => {
  const evaluator = new SafeExpressionEvaluator();

  it('should sort numbers in ascending order (default)', () => {
    const testData = [5, 2, 8, 1, 9, 3, 10, 15, 4];
    const result = evaluator.evaluate('data | sort()', testData);
    const expected = [1, 2, 3, 4, 5, 8, 9, 10, 15];
    
    expect(result).toEqual(expected);
  });

  it('should sort numbers in descending order', () => {
    const testData = [5, 2, 8, 1, 9, 3, 10, 15, 4];
    const result = evaluator.evaluate('data | sort(desc: true)', testData);
    const expected = [15, 10, 9, 8, 5, 4, 3, 2, 1];
    
    expect(result).toEqual(expected);
  });

  it('should sort decimal numbers correctly', () => {
    const testData = [5.5, 2.1, 8.9, 1.3, 9.7, 3.2];
    
    // Ascending
    const ascResult = evaluator.evaluate('data | sort()', testData);
    const expectedAsc = [1.3, 2.1, 3.2, 5.5, 8.9, 9.7];
    expect(ascResult).toEqual(expectedAsc);
    
    // Descending
    const descResult = evaluator.evaluate('data | sort(desc: true)', testData);
    const expectedDesc = [9.7, 8.9, 5.5, 3.2, 2.1, 1.3];
    expect(descResult).toEqual(expectedDesc);
  });

  it('should sort mixed numbers and numeric strings numerically', () => {
    const testData = [10, '2', 1, '20', 5];
    const result = evaluator.evaluate('data | sort()', testData);
    // Should be sorted numerically: 1, 2, 5, 10, 20
    const expected = [1, '2', 5, 10, '20'];
    
    expect(result).toEqual(expected);
  });

  it('should sort objects by numeric field in ascending order', () => {
    const testData = [
      { name: 'Alice', age: 30, score: 85.5 },
      { name: 'Bob', age: 25, score: 92.1 },
      { name: 'Charlie', age: 35, score: 78.9 },
      { name: 'David', age: 20, score: 88.0 }
    ];

    const result = evaluator.evaluate('data | sort(by: $.age)', testData);
    const expected = [
      { name: 'David', age: 20, score: 88.0 },
      { name: 'Bob', age: 25, score: 92.1 },
      { name: 'Alice', age: 30, score: 85.5 },
      { name: 'Charlie', age: 35, score: 78.9 }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should sort objects by numeric field in descending order', () => {
    const testData = [
      { name: 'Alice', score: 85.5 },
      { name: 'Bob', score: 92.1 },
      { name: 'Charlie', score: 78.9 },
      { name: 'David', score: 88.0 }
    ];

    const result = evaluator.evaluate('data | sort(by: $.score, desc: true)', testData);
    const expected = [
      { name: 'Bob', score: 92.1 },
      { name: 'David', score: 88.0 },
      { name: 'Alice', score: 85.5 },
      { name: 'Charlie', score: 78.9 }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should handle null and undefined values in numeric sort', () => {
    const testData = [5, null, 2, undefined, 8, 1];
    
    // Ascending - null comes first, then numbers, then undefined
    const ascResult = evaluator.evaluate('data | sort()', testData);
    const expectedAsc = [null, 1, 2, 5, 8, undefined];
    expect(ascResult).toEqual(expectedAsc);
    
    // Descending - numbers in desc order, then null, then undefined
    const descResult = evaluator.evaluate('data | sort(desc: true)', testData);
    const expectedDesc = [8, 5, 2, 1, null, undefined];
    expect(descResult).toEqual(expectedDesc);
  });

  it('should handle large numbers correctly', () => {
    const testData = [1000000, 999, 1000001, 1, 1000];
    const result = evaluator.evaluate('data | sort()', testData);
    const expected = [1, 999, 1000, 1000000, 1000001];
    
    expect(result).toEqual(expected);
  });

  it('should handle negative numbers', () => {
    const testData = [5, -2, 8, -10, 0, 3];
    
    // Ascending
    const ascResult = evaluator.evaluate('data | sort()', testData);
    const expectedAsc = [-10, -2, 0, 3, 5, 8];
    expect(ascResult).toEqual(expectedAsc);
    
    // Descending
    const descResult = evaluator.evaluate('data | sort(desc: true)', testData);
    const expectedDesc = [8, 5, 3, 0, -2, -10];
    expect(descResult).toEqual(expectedDesc);
  });

  it('should handle empty array', () => {
    const testData: number[] = [];
    const result = evaluator.evaluate('data | sort()', testData);
    expect(result).toEqual([]);
  });

  it('should handle non-array input gracefully', () => {
    const testData = null;
    const result = evaluator.evaluate('data | sort()', testData);
    expect(result).toEqual([]);
  });

  it('should work with JSONPath data access', () => {
    const testData = {
      numbers: [5, 2, 8, 1, 9, 3],
      metadata: { name: 'test' }
    };
    
    const result = evaluator.evaluate('$.numbers | sort()', testData);
    const expected = [1, 2, 3, 5, 8, 9];
    
    expect(result).toEqual(expected);
  });

  it('should sort objects by JSONPath expression in by parameter', () => {
    const testData = [
      { user: { profile: { id: 3, name: 'Alice' } }, score: 85 },
      { user: { profile: { id: 1, name: 'Bob' } }, score: 92 },
      { user: { profile: { id: 2, name: 'Charlie' } }, score: 78 },
      { user: { profile: { id: 4, name: 'David' } }, score: 88 }
    ];

    const result = evaluator.evaluate('data | sort(by: $.user.profile.id)', testData);
    const expected = [
      { user: { profile: { id: 1, name: 'Bob' } }, score: 92 },
      { user: { profile: { id: 2, name: 'Charlie' } }, score: 78 },
      { user: { profile: { id: 3, name: 'Alice' } }, score: 85 },
      { user: { profile: { id: 4, name: 'David' } }, score: 88 }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should sort objects by JSONPath expression in descending order', () => {
    const testData = [
      { profile: { score: 85, stats: { rating: 4.2 } } },
      { profile: { score: 92, stats: { rating: 4.8 } } },
      { profile: { score: 78, stats: { rating: 3.9 } } },
      { profile: { score: 88, stats: { rating: 4.5 } } }
    ];

    const result = evaluator.evaluate('data | sort(by: $.profile.stats.rating, desc: true)', testData);
    const expected = [
      { profile: { score: 92, stats: { rating: 4.8 } } },
      { profile: { score: 88, stats: { rating: 4.5 } } },
      { profile: { score: 85, stats: { rating: 4.2 } } },
      { profile: { score: 78, stats: { rating: 3.9 } } }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should handle JSONPath with array indexing in sort', () => {
    const testData = [
      { tags: ['important', 'urgent'], priority: 1 },
      { tags: ['normal', 'review'], priority: 3 },
      { tags: ['critical', 'bug'], priority: 2 },
      { tags: ['minor', 'enhancement'], priority: 4 }
    ];

    // Sort by first tag alphabetically
    const result = evaluator.evaluate('data | sort(by: $.tags[0])', testData);
    const expected = [
      { tags: ['critical', 'bug'], priority: 2 },
      { tags: ['important', 'urgent'], priority: 1 },
      { tags: ['minor', 'enhancement'], priority: 4 },
      { tags: ['normal', 'review'], priority: 3 }
    ];
    
    expect(result).toEqual(expected);
  });

  it('should handle missing fields in JSONPath gracefully', () => {
    const testData = [
      { name: 'Alice', profile: { age: 30 } },
      { name: 'Bob' }, // missing profile
      { name: 'Charlie', profile: { age: 25 } },
      { name: 'David', profile: {} } // missing age
    ];

    const result = evaluator.evaluate('data | sort(by: $.profile.age)', testData);
    // Items with undefined/null values should come first, then sorted by age
    const expected = [
      { name: 'Bob' }, 
      { name: 'David', profile: {} },
      { name: 'Charlie', profile: { age: 25 } },
      { name: 'Alice', profile: { age: 30 } }
    ];
    
    expect(result).toEqual(expected);
  });
});
