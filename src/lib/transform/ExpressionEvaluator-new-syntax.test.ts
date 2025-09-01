import { describe, it, expect, beforeEach } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('ExpressionEvaluator New Map Syntax', () => {
  let evaluator: SafeExpressionEvaluator;

  const sampleData = {
    users: [
      { 
        id: 1, 
        name: "Alice", 
        balance: 1500, 
        init_credit: 2000, 
        used_credit: 500,
        profile: { city: "New York", country: "USA" } 
      },
      { 
        id: 2, 
        name: "Bob", 
        balance: 2500, 
        init_credit: 3000, 
        used_credit: 500,
        profile: { city: "London", country: "UK" } 
      },
      { 
        id: 3, 
        name: "Charlie", 
        balance: 3500, 
        init_credit: 4000, 
        used_credit: 500,
        profile: { city: "Tokyo", country: "Japan" } 
      }
    ]
  };

  beforeEach(() => {
    evaluator = new SafeExpressionEvaluator();
    evaluator.setTemplateContext({
      parameters: { username: "current_user", userRole: "admin" },
      environment: { APP_NAME: "TestApp", DEFAULT_CURRENCY: "USD" },
      responses: {},
      transformedData: {},
      functions: {}
    });
  });

  describe('New Map Syntax Without Quotes', () => {
    it('should support JSONPath without quotes in object mapping', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, name: $.name)', sampleData);
      expect(result).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" }
      ]);
    });

    it('should support nested JSONPath without quotes', () => {
      const result = evaluator.evaluate('$.users | map(userId: $.id, city: $.profile.city, country: $.profile.country)', sampleData);
      expect(result).toEqual([
        { userId: 1, city: "New York", country: "USA" },
        { userId: 2, city: "London", country: "UK" },
        { userId: 3, city: "Tokyo", country: "Japan" }
      ]);
    });

    it('should support simple arithmetic in single expression mapping', () => {
      const result = evaluator.evaluate('$.users | map($.init_credit - $.used_credit)', sampleData);
      expect(result).toEqual([1500, 2500, 3500]);
    });

    it('should support complex mapping with pipeline expressions', () => {
      const result = evaluator.evaluate('$.users | map(balance: $.balance | div(100), used: $.used_credit | div(100))', sampleData);
      expect(result).toEqual([
        { balance: 15, used: 5 },
        { balance: 25, used: 5 },
        { balance: 35, used: 5 }
      ]);
    });

    it('should support arithmetic expressions in object mapping', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, available: $.init_credit - $.used_credit)', sampleData);
      expect(result).toEqual([
        { id: 1, available: 1500 },
        { id: 2, available: 2500 },
        { id: 3, available: 3500 }
      ]);
    });

    it('should support mixed syntax with literals and expressions', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, name: $.name, status: "active", ratio: $.used_credit / $.init_credit)', sampleData);
      expect(result).toEqual([
        { id: 1, name: "Alice", status: "active", ratio: 0.25 },
        { id: 2, name: "Bob", status: "active", ratio: 0.16666666666666666 },
        { id: 3, name: "Charlie", status: "active", ratio: 0.125 }
      ]);
    });

    it('should support multiple arithmetic operations', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, total: $.balance + $.init_credit - $.used_credit)', sampleData);
      expect(result).toEqual([
        { id: 1, total: 3000 },
        { id: 2, total: 5000 },
        { id: 3, total: 7000 }
      ]);
    });
  });

  describe('Template Expression Support', () => {
    it('should support template expressions with the new syntax', () => {
      const result = evaluator.evaluate('$.users | map(user: "{{param:username}}", name: $.name)', sampleData);
      expect(result).toEqual([
        { user: "current_user", name: "Alice" },
        { user: "current_user", name: "Bob" },
        { user: "current_user", name: "Charlie" }
      ]);
    });
  });
});
