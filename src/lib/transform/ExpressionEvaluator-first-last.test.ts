/**
 * Tests for the first() and last() pipeline functions
 */
import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('ExpressionEvaluator First and Last Functions', () => {
  const evaluator = new SafeExpressionEvaluator();

  describe('first() function', () => {
    it('should return the first element from an array of numbers', () => {
      const testData = { numbers: [10, 20, 30, 40] };
      const result = evaluator.evaluate('$.numbers | first()', testData);
      expect(result).toBe(10);
    });

    it('should return the first element from an array of objects', () => {
      const testData = {
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 }
        ]
      };
      const result = evaluator.evaluate('$.users | first()', testData);
      expect(result).toEqual({ name: 'Alice', age: 25 });
    });

    it('should work with filtered results', () => {
      const testData = {
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 },
          { name: 'Charlie', age: 35 }
        ]
      };
      const result = evaluator.evaluate('$.users | where($.age > 28) | first()', testData);
      expect(result).toEqual({ name: 'Bob', age: 30 });
    });

    it('should return undefined for empty arrays', () => {
      const testData = { emptyArray: [] };
      const result = evaluator.evaluate('$.emptyArray | first()', testData);
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-arrays', () => {
      const testData = { notArray: 'hello' };
      const result = evaluator.evaluate('$.notArray | first()', testData);
      expect(result).toBeUndefined();
    });
  });

  describe('last() function', () => {
    it('should return the last element from an array of numbers', () => {
      const testData = { numbers: [10, 20, 30, 40] };
      const result = evaluator.evaluate('$.numbers | last()', testData);
      expect(result).toBe(40);
    });

    it('should return the last element from an array of objects', () => {
      const testData = {
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 }
        ]
      };
      const result = evaluator.evaluate('$.users | last()', testData);
      expect(result).toEqual({ name: 'Bob', age: 30 });
    });

    it('should work with filtered results', () => {
      const testData = {
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 },
          { name: 'Charlie', age: 35 }
        ]
      };
      const result = evaluator.evaluate('$.users | where($.age > 28) | last()', testData);
      expect(result).toEqual({ name: 'Charlie', age: 35 });
    });

    it('should return undefined for empty arrays', () => {
      const testData = { emptyArray: [] };
      const result = evaluator.evaluate('$.emptyArray | last()', testData);
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-arrays', () => {
      const testData = { notArray: 'hello' };
      const result = evaluator.evaluate('$.notArray | last()', testData);
      expect(result).toBeUndefined();
    });
  });

  describe('comparison with other functions', () => {
    it('should be more convenient than take(1) for getting single values', () => {
      const testData = { numbers: [10, 20, 30] };
      
      const takeResult = evaluator.evaluate('$.numbers | take(1)', testData);
      const firstResult = evaluator.evaluate('$.numbers | first()', testData);
      
      expect(takeResult).toEqual([10]); // Array
      expect(firstResult).toBe(10);     // Single value
    });

    it('should work with single-element arrays', () => {
      const testData = { singleItem: [42] };
      
      const firstResult = evaluator.evaluate('$.singleItem | first()', testData);
      const lastResult = evaluator.evaluate('$.singleItem | last()', testData);
      
      expect(firstResult).toBe(42);
      expect(lastResult).toBe(42);
    });
  });
});
