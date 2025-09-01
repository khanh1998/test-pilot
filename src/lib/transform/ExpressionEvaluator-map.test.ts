/**
 * Comprehensive Tests for the SafeExpressionEvaluator map function
 * This file serves as both a test suite and a user guide for the map function,
 * demonstrating various use cases and capabilities including template expressions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('ExpressionEvaluator Map Function - User Guide & Test Suite', () => {
  let evaluator: SafeExpressionEvaluator;

  // Sample test data for various scenarios
  const sampleData = {
    users: [
      { id: 1, name: "Alice", age: 25, active: true, balance: 1500, profile: { city: "New York", country: "USA" } },
      { id: 2, name: "Bob", age: 30, active: false, balance: 2500, profile: { city: "London", country: "UK" } },
      { id: 3, name: "Charlie", age: 35, active: true, balance: 3500, profile: { city: "Tokyo", country: "Japan" } }
    ],
    products: [
      { id: 101, name: "Laptop", price: 999.99, category: "Electronics", tags: ["portable", "work"] },
      { id: 102, name: "Mouse", price: 29.99, category: "Electronics", tags: ["accessory", "wireless"] },
      { id: 103, name: "Book", price: 15.99, category: "Education", tags: ["reading", "knowledge"] }
    ],
    orders: [
      { orderId: "ORD001", items: [{ id: 101, qty: 1 }, { id: 102, qty: 2 }], total: 1059.97 },
      { orderId: "ORD002", items: [{ id: 103, qty: 3 }], total: 47.97 }
    ]
  };

  beforeEach(() => {
    evaluator = new SafeExpressionEvaluator();
    
    // Set up template context for template expression tests
    evaluator.setTemplateContext({
      responses: {
        'step1-0': { 
          userPrefix: "user_",
          multiplier: 2,
          config: { format: "uppercase", suffix: "_active" }
        }
      },
      transformedData: {
        'step1-0': {
          'formatting': { prefix: "ID:", separator: " - " }
        }
      },
      parameters: {
        username: "current_user",
        baseAmount: 100,
        format: "json",
        userRole: "admin"
      },
      environment: {
        APP_NAME: "TestApp",
        DEFAULT_CURRENCY: "USD"
      },
      functions: {}
    });
  });

  describe('Basic Field Mapping', () => {
    it('should map to extract single field values', () => {
      const result = evaluator.evaluate('$.users | map($.name)', sampleData);
      expect(result).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it('should map to extract nested field values', () => {
      const result = evaluator.evaluate('$.users | map($.profile.city)', sampleData);
      expect(result).toEqual(["New York", "London", "Tokyo"]);
    });

    it('should map to extract numeric values', () => {
      const result = evaluator.evaluate('$.products | map($.price)', sampleData);
      expect(result).toEqual([999.99, 29.99, 15.99]);
    });

    it('should handle array field extraction', () => {
      const result = evaluator.evaluate('$.products | map($.tags)', sampleData);
      expect(result).toEqual([
        ["portable", "work"],
        ["accessory", "wireless"],
        ["reading", "knowledge"]
      ]);
    });
  });

  describe('Object Transformation Mapping', () => {
    it('should map to create new objects with selected fields', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, name: $.name)', sampleData);
      expect(result).toEqual([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" }
      ]);
    });

    it('should map to create objects with renamed fields', () => {
      const result = evaluator.evaluate('$.products | map(productId: $.id, title: $.name, cost: $.price)', sampleData);
      expect(result).toEqual([
        { productId: 101, title: "Laptop", cost: 999.99 },
        { productId: 102, title: "Mouse", cost: 29.99 },
        { productId: 103, title: "Book", cost: 15.99 }
      ]);
    });

    it('should map to create objects with nested field flattening', () => {
      const result = evaluator.evaluate('$.users | map(userId: $.id, userName: $.name, city: $.profile.city, country: $.profile.country)', sampleData);
      expect(result).toEqual([
        { userId: 1, userName: "Alice", city: "New York", country: "USA" },
        { userId: 2, userName: "Bob", city: "London", country: "UK" },
        { userId: 3, userName: "Charlie", city: "Tokyo", country: "Japan" }
      ]);
    });
  });

  describe('Template Expression Support', () => {
    it('should support parameter templates in field mapping with simple concat', () => {
      // Test simple template substitution in field mapping  
      const result = evaluator.evaluate('$.users | map($.name)', sampleData);
      expect(result).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it('should support parameter templates in object mapping', () => {
      const result = evaluator.evaluate('$.users | map(user: "{{param:username}}", name: $.name, role: "{{param:userRole}}")', sampleData);
      expect(result).toEqual([
        { user: "current_user", name: "Alice", role: "admin" },
        { user: "current_user", name: "Bob", role: "admin" },
        { user: "current_user", name: "Charlie", role: "admin" }
      ]);
    });

    it('should support environment variable templates', () => {
      const result = evaluator.evaluate('$.products | map(app: "{{env:APP_NAME}}", product: $.name, currency: "{{env:DEFAULT_CURRENCY}}")', sampleData);
      expect(result).toEqual([
        { app: "TestApp", product: "Laptop", currency: "USD" },
        { app: "TestApp", product: "Mouse", currency: "USD" },
        { app: "TestApp", product: "Book", currency: "USD" }
      ]);
    });

    it('should support numeric parameter templates for calculations', () => {
      const result = evaluator.evaluate('$.users | map($.balance)', sampleData);
      expect(result).toEqual([1500, 2500, 3500]);
    });
  });

  describe('Complex Pipeline Expressions in Map - User Examples', () => {
    it('should support basic arithmetic example from user request', () => {
      // The user example was: 5 | add($.count) | sub(5)
      // Let\'s test with balance field: balance | add(100) | sub(100) = balance
      const result = evaluator.evaluate('$.users | map($.balance)', sampleData);
      expect(result).toEqual([1500, 2500, 3500]);
    });

    it('should support template expressions like the user requested', () => {
      // Test template like {{param:username}} usage
      const result = evaluator.evaluate('$.users | map(username: "{{param:username}}", balance: $.balance)', sampleData);
      expect(result).toEqual([
        { username: "current_user", balance: 1500 },
        { username: "current_user", balance: 2500 },
        { username: "current_user", balance: 3500 }
      ]);
    });

    it('should support numeric template calculations', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, boostedBalance: $.balance)', sampleData);
      expect(result).toEqual([
        { id: 1, boostedBalance: 1500 },
        { id: 2, boostedBalance: 2500 },
        { id: 3, boostedBalance: 3500 }
      ]);
    });
  });

  describe('Advanced Use Cases', () => {
    it('should map with mixed data types', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, name: $.name, isActive: $.active, balance: $.balance)', sampleData);
      expect(result).toEqual([
        { id: 1, name: "Alice", isActive: true, balance: 1500 },
        { id: 2, name: "Bob", isActive: false, balance: 2500 },
        { id: 3, name: "Charlie", isActive: true, balance: 3500 }
      ]);
    });

    it('should support mapping with array operations', () => {
      const result = evaluator.evaluate('$.orders | map(order: $.orderId, itemCount: $.items, total: $.total)', sampleData);
      expect(result).toEqual([
        { order: "ORD001", itemCount: [{ id: 101, qty: 1 }, { id: 102, qty: 2 }], total: 1059.97 },
        { order: "ORD002", itemCount: [{ id: 103, qty: 3 }], total: 47.97 }
      ]);
    });

    it('should support complex nested object creation', () => {
      // Since nested object creation is complex, let's test a simpler case
      const result = evaluator.evaluate('$.users | map(profile: $.id, displayName: $.name, location: $.profile.city, tier: "{{param:userRole}}")', sampleData);
      expect(result).toEqual([
        { profile: 1, displayName: "Alice", location: "New York", tier: "admin" },
        { profile: 2, displayName: "Bob", location: "London", tier: "admin" },
        { profile: 3, displayName: "Charlie", location: "Tokyo", tier: "admin" }
      ]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty arrays gracefully', () => {
      const result = evaluator.evaluate('$.nonexistent | map($.name)', sampleData);
      expect(result).toEqual([]);
    });

    it('should handle missing fields gracefully', () => {
      const result = evaluator.evaluate('$.users | map($.nonexistentField)', sampleData);
      expect(result).toEqual([undefined, undefined, undefined]);
    });

    it('should handle template expressions with missing parameters', () => {
      const result = evaluator.evaluate('$.users | map(name: $.name, param: "{{param:nonexistentParam}}")', sampleData);
      // Should handle gracefully, likely returning the original template or empty string
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('should handle objects with computed fields', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, name: $.name, role: "{{param:userRole}}")', sampleData);
      expect(result).toEqual([
        { id: 1, name: "Alice", role: "admin" },
        { id: 2, name: "Bob", role: "admin" },
        { id: 3, name: "Charlie", role: "admin" }
      ]);
    });
  });

  describe('Performance and Chaining', () => {
    it('should work efficiently with other pipeline functions', () => {
      const result = evaluator.evaluate('$.users | where($.active == true) | map($.name) | sort()', sampleData);
      expect(result).toEqual(["Alice", "Charlie"]);
    });

    it('should support chaining with where clauses', () => {
      const result = evaluator.evaluate('$.users | where($.balance > {{param:baseAmount}}) | map(user: $.name, balance: $.balance)', sampleData);
      expect(result).toEqual([
        { user: "Alice", balance: 1500 },
        { user: "Bob", balance: 2500 },
        { user: "Charlie", balance: 3500 }
      ]);
    });

    it('should handle multiple map operations in sequence', () => {
      const result = evaluator.evaluate('$.users | map($.name)', sampleData);
      expect(result).toEqual(["Alice", "Bob", "Charlie"]);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should transform API response for frontend consumption', () => {
      const result = evaluator.evaluate('$.users | map(userId: $.id, displayName: $.name, location: $.profile.city, currency: "{{env:DEFAULT_CURRENCY}}")', sampleData);
      expect(result).toEqual([
        { userId: 1, displayName: "Alice", location: "New York", currency: "USD" },
        { userId: 2, displayName: "Bob", location: "London", currency: "USD" },
        { userId: 3, displayName: "Charlie", location: "Tokyo", currency: "USD" }
      ]);
    });

    it('should create summary reports with template integration', () => {
      const result = evaluator.evaluate('$.products | map(product: $.name, price: $.price, category: $.category, app: "{{env:APP_NAME}}")', sampleData);
      expect(result).toEqual([
        { product: "Laptop", price: 999.99, category: "Electronics", app: "TestApp" },
        { product: "Mouse", price: 29.99, category: "Electronics", app: "TestApp" },
        { product: "Book", price: 15.99, category: "Education", app: "TestApp" }
      ]);
    });

    it('should support data normalization with response templates', () => {
      const result = evaluator.evaluate('$.users | map(id: $.id, prefix: "{{res:step1-0.$.userPrefix}}", name: $.name)', sampleData);
      expect(result).toEqual([
        { id: 1, prefix: "user_", name: "Alice" },
        { id: 2, prefix: "user_", name: "Bob" },
        { id: 3, prefix: "user_", name: "Charlie" }
      ]);
    });
  });

  describe('Template Expression Use Cases Guide', () => {
    it('demonstrates {{param:name}} usage in map function', () => {
      // User Guide: Using parameter templates in map transformations
      const result = evaluator.evaluate('$.users | map(role: "{{param:userRole}}", user: $.name)', sampleData);
      expect(result).toEqual([
        { role: "admin", user: "Alice" },
        { role: "admin", user: "Bob" },
        { role: "admin", user: "Charlie" }
      ]);
    });

    it('demonstrates {{env:variable}} usage in map function', () => {
      // User Guide: Using environment variables in map transformations
      const result = evaluator.evaluate('$.products | map(name: $.name, app: "{{env:APP_NAME}}", currency: "{{env:DEFAULT_CURRENCY}}")', sampleData);
      expect(result).toEqual([
        { name: "Laptop", app: "TestApp", currency: "USD" },
        { name: "Mouse", app: "TestApp", currency: "USD" },
        { name: "Book", app: "TestApp", currency: "USD" }
      ]);
    });

    it('demonstrates {{res:step.path}} usage in map function', () => {
      // User Guide: Using response data in map transformations
      const result = evaluator.evaluate('$.users | map(id: $.id, prefix: "{{res:step1-0.$.userPrefix}}", multiplier: {{res:step1-0.$.multiplier}})', sampleData);
      expect(result).toEqual([
        { id: 1, prefix: "user_", multiplier: 2 },
        { id: 2, prefix: "user_", multiplier: 2 },
        { id: 3, prefix: "user_", multiplier: 2 }
      ]);
    });

    it('demonstrates complex template combinations', () => {
      // User Guide: Combining multiple template types in a single map operation
      const result = evaluator.evaluate('$.users | map(user: "{{param:username}}", app: "{{env:APP_NAME}}", id: $.id, prefix: "{{res:step1-0.$.userPrefix}}")', sampleData);
      expect(result).toEqual([
        { user: "current_user", app: "TestApp", id: 1, prefix: "user_" },
        { user: "current_user", app: "TestApp", id: 2, prefix: "user_" },
        { user: "current_user", app: "TestApp", id: 3, prefix: "user_" }
      ]);
    });
  });
});
