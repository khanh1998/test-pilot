/**
 * Tests for sum function with JSON path support in PipelineFunctions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('Sum function with JSON path support', () => {
  let evaluator: SafeExpressionEvaluator;

  beforeEach(() => {
    evaluator = new SafeExpressionEvaluator();
  });

  describe('Basic sum functionality', () => {
    it('should sum simple numeric values without field parameter', () => {
      const testData = {
        values: [1, 2, 3, 4, 5]
      };
      
      const result = evaluator.evaluate('$.values | sum()', testData);
      expect(result).toBe(15);
    });

    it('should sum with simple field access (backwards compatibility)', () => {
      const testData = {
        items: [
          { id: 1, amount: 10 },
          { id: 2, amount: 20 },
          { id: 3, amount: 30 }
        ]
      };
      
      const result = evaluator.evaluate('$.items | sum($.amount)', testData);
      expect(result).toBe(60);
    });
  });

  describe('JSON path support', () => {
    it('should sum with simple JSON path ($.field)', () => {
      const testData = {
        items: [
          { user: { score: 10 } },
          { user: { score: 25 } },
          { user: { score: 30 } }
        ]
      };
      
      const result = evaluator.evaluate('$.items | sum($.user.score)', testData);
      expect(result).toBe(65);
    });

    it('should sum with nested JSON path without $ prefix', () => {
      const testData = {
        items: [
          { user: { profile: { points: 100 } } },
          { user: { profile: { points: 150 } } },
          { user: { profile: { points: 200 } } }
        ]
      };
      
      const result = evaluator.evaluate('$.items | sum($.user.profile.points)', testData);
      expect(result).toBe(450);
    });

    it('should sum with complex nested structure', () => {
      const testData = {
        orders: [
          { 
            customer: { 
              billing: { 
                address: { 
                  country: "US", 
                  total: 100.50 
                } 
              } 
            } 
          },
          { 
            customer: { 
              billing: { 
                address: { 
                  country: "CA", 
                  total: 75.25 
                } 
              } 
            } 
          },
          { 
            customer: { 
              billing: { 
                address: { 
                  country: "US", 
                  total: 125.75 
                } 
              } 
            } 
          }
        ]
      };
      
      const result = evaluator.evaluate('$.orders | sum($.customer.billing.address.total)', testData);
      expect(result).toBe(301.5);
    });

    it('should handle missing fields gracefully', () => {
      const testData = {
        items: [
          { user: { score: 10 } },
          { user: {} }, // missing score
          { user: { score: 30 } },
          {} // missing user entirely
        ]
      };
      
      const result = evaluator.evaluate('$.items | sum($.user.score)', testData);
      expect(result).toBe(40); // 10 + 0 + 30 + 0
    });

    it('should handle non-numeric values gracefully', () => {
      const testData = {
        items: [
          { value: 10 },
          { value: "invalid" },
          { value: 30 },
          { value: null }
        ]
      };
      
      const result = evaluator.evaluate('$.items | sum($.value)', testData);
      expect(result).toBe(40); // 10 + 0 + 30 + 0
    });
  });

  describe('Integration with other pipeline functions', () => {
    it('should work with where and sum together', () => {
      const testData = {
        transactions: [
          { type: "income", amount: 1000, category: { points: 50 } },
          { type: "expense", amount: 500, category: { points: 25 } },
          { type: "income", amount: 750, category: { points: 40 } },
          { type: "expense", amount: 200, category: { points: 15 } }
        ]
      };
      
      const result = evaluator.evaluate(
        '$.transactions | where($.type == "income") | sum($.category.points)', 
        testData
      );
      expect(result).toBe(90); // 50 + 40
    });

    it('should work with map and sum', () => {
      const testData = {
        users: [
          { profile: { stats: { level: 5, experience: 1000 } } },
          { profile: { stats: { level: 3, experience: 600 } } },
          { profile: { stats: { level: 7, experience: 1500 } } }
        ]
      };
      
      const result = evaluator.evaluate(
        '$.users | map($.profile.stats.experience) | sum()', 
        testData
      );
      expect(result).toBe(3100);
    });
  });
});
