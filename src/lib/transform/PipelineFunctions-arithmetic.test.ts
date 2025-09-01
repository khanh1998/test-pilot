/**
 * Tests for arithmetic pipeline functions (add, sub, mul, div, mod)
 * Tests both direct usage and template expression integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';
import type { TemplateContext } from '../template/types';

describe('Arithmetic Pipeline Functions', () => {
  let evaluator: SafeExpressionEvaluator;
  let mockContext: TemplateContext;

  beforeEach(() => {
    evaluator = new SafeExpressionEvaluator();
    mockContext = {
      responses: {
        'step1-0': { 
          user_id: 123, 
          total: 100, 
          price: 25.50, 
          quantity: 4,
          discount: 10.5,
          tax_rate: 0.08
        },
        'step2-0': { 
          bonus: 15,
          multiplier: 1.2,
          divisor: 2.5,
          offset: 7.25,
          mod_value: 3
        }
      },
      transformedData: {
        'step1-0': {
          calculated: { 
            subtotal: 75.25, 
            shipping: 9.99,
            fees: 5.00
          }
        }
      },
      parameters: {
        taxRate: 0.08,
        quantity: 3,
        basePrice: 20.00,
        increment: 2.5,
        factor: 1.15
      },
      environment: {
        exchangeRate: 1.25,
        serviceFee: 3.50,
        baseAmount: 100
      },
      functions: {}
    };
    evaluator.setTemplateContext(mockContext);
  });

  describe('add() function', () => {
    it('should add a number to pipeline data', () => {
      const result = evaluator.evaluate('10 | add(5)', {});
      expect(result).toBe(15);
    });

    it('should add decimal numbers', () => {
      const result = evaluator.evaluate('10.5 | add(2.25)', {});
      expect(result).toBe(12.75);
    });

    it('should add zero', () => {
      const result = evaluator.evaluate('10 | add(0)', {});
      expect(result).toBe(10);
    });

    it('should add negative numbers', () => {
      const result = evaluator.evaluate('10 | add(-3)', {});
      expect(result).toBe(7);
    });

    it('should return undefined when adding invalid data', () => {
      const result = evaluator.evaluate('10 | add("invalid")', {});
      expect(result).toBeUndefined();
    });

    it('should return undefined when adding string numbers', () => {
      const result = evaluator.evaluate('10 | add("5")', {});
      expect(result).toBeUndefined();
    });

    it('should work with type casting', () => {
      const result = evaluator.evaluate('10 | add("5" | int())', {});
      expect(result).toBe(15);
    });

    it('should work with type casting float', () => {
      const result = evaluator.evaluate('10.1 | add("5.5" | float())', {});
      expect(result).toBe(15.6);
    });

    it('should return undefined when pipeline data is invalid', () => {
      const result = evaluator.evaluate('"invalid" | add(5)', {});
      expect(result).toBeUndefined();
    });

    it('should work with template expressions', () => {
      const result = evaluator.evaluate('100 | add({{res:step1-0.$.user_id}})', {});
      expect(result).toBe(223); // 100 + 123
    });

    it('should work with parameter templates', () => {
      const result = evaluator.evaluate('{{param:basePrice}} | add({{param:increment}})', {});
      expect(result).toBe(22.5); // 20.00 + 2.5
    });

    it('should work with environment templates', () => {
      const result = evaluator.evaluate('{{env:baseAmount}} | add({{env:serviceFee}})', {});
      expect(result).toBe(103.5); // 100 + 3.5
    });

    it('should work with transformed data templates', () => {
      const result = evaluator.evaluate('{{proc:step1-0.$.calculated.subtotal}} | add({{proc:step1-0.$.calculated.shipping}})', {});
      expect(result).toBe(85.24); // 75.25 + 9.99
    });
  });

  describe('sub() function', () => {
    it('should subtract a number from pipeline data', () => {
      const result = evaluator.evaluate('10 | sub(5)', {});
      expect(result).toBe(5);
    });

    it('should subtract decimal numbers', () => {
      const result = evaluator.evaluate('10.5 | sub(2.25)', {});
      expect(result).toBe(8.25);
    });

    it('should subtract zero', () => {
      const result = evaluator.evaluate('10 | sub(0)', {});
      expect(result).toBe(10);
    });

    it('should subtract negative numbers (effectively adding)', () => {
      const result = evaluator.evaluate('10 | sub(-3)', {});
      expect(result).toBe(13);
    });

    it('should return undefined when subtracting string numbers', () => {
      const result = evaluator.evaluate('10 | sub("3")', {});
      expect(result).toBeUndefined();
    });

    it('should return undefined when subtracting invalid data', () => {
      const result = evaluator.evaluate('10 | sub("invalid")', {});
      expect(result).toBeUndefined();
    });

    it('should work with template expressions', () => {
      const result = evaluator.evaluate('{{res:step1-0.$.total}} | sub({{res:step1-0.$.discount}})', {});
      expect(result).toBe(89.5); // 100 - 10.5
    });

    it('should work with parameter templates', () => {
      const result = evaluator.evaluate('{{param:basePrice}} | sub({{param:increment}})', {});
      expect(result).toBe(17.5); // 20.00 - 2.5
    });
  });

  describe('mul() function', () => {
    it('should multiply pipeline data by a number', () => {
      const result = evaluator.evaluate('10 | mul(5)', {});
      expect(result).toBe(50);
    });

    it('should multiply decimal numbers', () => {
      const result = evaluator.evaluate('10.5 | mul(2)', {});
      expect(result).toBe(21);
    });

    it('should multiply by zero', () => {
      const result = evaluator.evaluate('10 | mul(0)', {});
      expect(result).toBe(0);
    });

    it('should multiply by one', () => {
      const result = evaluator.evaluate('10 | mul(1)', {});
      expect(result).toBe(10);
    });

    it('should multiply by negative numbers', () => {
      const result = evaluator.evaluate('10 | mul(-2)', {});
      expect(result).toBe(-20);
    });

    it('should return undefined when multiplying string numbers', () => {
      const result = evaluator.evaluate('10 | mul("3")', {});
      expect(result).toBeUndefined();
    });

    it('should work with template expressions', () => {
      const result = evaluator.evaluate('{{res:step1-0.$.price}} | mul({{res:step1-0.$.quantity}})', {});
      expect(result).toBe(102); // 25.50 * 4
    });

    it('should work with parameter templates', () => {
      const result = evaluator.evaluate('{{param:basePrice}} | mul({{param:factor}})', {});
      expect(result).toBe(23); // 20.00 * 1.15
    });

    it('should work with environment templates', () => {
      const result = evaluator.evaluate('{{env:baseAmount}} | mul({{env:exchangeRate}})', {});
      expect(result).toBe(125); // 100 * 1.25
    });
  });

  describe('div() function', () => {
    it('should divide pipeline data by a number', () => {
      const result = evaluator.evaluate('10 | div(2)', {});
      expect(result).toBe(5);
    });

    it('should divide decimal numbers', () => {
      const result = evaluator.evaluate('21 | div(2)', {});
      expect(result).toBe(10.5);
    });

    it('should divide by one', () => {
      const result = evaluator.evaluate('10 | div(1)', {});
      expect(result).toBe(10);
    });

    it('should handle division by zero', () => {
      const result = evaluator.evaluate('10 | div(0)', {});
      expect(result).toBe(Infinity);
    });

    it('should handle negative division by zero', () => {
      const result = evaluator.evaluate('-10 | div(0)', {});
      expect(result).toBe(-Infinity);
    });

    it('should divide by negative numbers', () => {
      const result = evaluator.evaluate('10 | div(-2)', {});
      expect(result).toBe(-5);
    });

    it('should return undefined when dividing by string numbers', () => {
      const result = evaluator.evaluate('15 | div("3")', {});
      expect(result).toBeUndefined();
    });

    it('should work with template expressions', () => {
      const result = evaluator.evaluate('{{res:step1-0.$.total}} | div({{res:step2-0.$.divisor}})', {});
      expect(result).toBe(40); // 100 / 2.5
    });

    it('should work with parameter templates', () => {
      const result = evaluator.evaluate('{{param:basePrice}} | div({{param:quantity}})', {});
      expect(result).toBeCloseTo(6.67, 2); // 20.00 / 3
    });
  });

  describe('mod() function', () => {
    it('should calculate modulo of pipeline data', () => {
      const result = evaluator.evaluate('10 | mod(3)', {});
      expect(result).toBe(1);
    });

    it('should calculate modulo with larger divisor', () => {
      const result = evaluator.evaluate('5 | mod(10)', {});
      expect(result).toBe(5);
    });

    it('should calculate modulo with same number', () => {
      const result = evaluator.evaluate('10 | mod(10)', {});
      expect(result).toBe(0);
    });

    it('should handle modulo by zero', () => {
      const result = evaluator.evaluate('10 | mod(0)', {});
      expect(result).toBeUndefined();
    });

    it('should handle decimal modulo', () => {
      const result = evaluator.evaluate('10.5 | mod(3)', {});
      expect(result).toBe(1.5);
    });

    it('should handle negative numbers', () => {
      const result = evaluator.evaluate('-10 | mod(3)', {});
      expect(result).toBe(-1);
    });

    it('should return undefined when using string numbers', () => {
      const result = evaluator.evaluate('10 | mod("3")', {});
      expect(result).toBeUndefined();
    });

    it('should work with template expressions', () => {
      const result = evaluator.evaluate('{{res:step1-0.$.user_id}} | mod({{res:step2-0.$.mod_value}})', {});
      expect(result).toBe(0); // 123 % 3 = 0
    });

    it('should work with parameter templates', () => {
      const result = evaluator.evaluate('{{param:basePrice}} | mod({{param:quantity}})', {});
      expect(result).toBe(2); // 20 % 3 = 2
    });
  });

  describe('Chained arithmetic operations', () => {
    it('should chain multiple arithmetic operations', () => {
      const result = evaluator.evaluate('10 | add(5) | mul(2) | sub(10)', {});
      expect(result).toBe(20); // ((10 + 5) * 2) - 10 = 30 - 10 = 20
    });

    it('should chain with division and modulo', () => {
      const result = evaluator.evaluate('100 | div(3) | mod(10)', {});
      expect(result).toBeCloseTo(3.33, 2); // (100 / 3) % 10 ≈ 33.33 % 10 ≈ 3.33
    });

    it('should chain with template expressions', () => {
      const result = evaluator.evaluate('{{param:basePrice}} | mul({{param:quantity}}) | add({{env:serviceFee}}) | sub({{res:step1-0.$.discount}})', {});
      expect(result).toBe(53); // (20 * 3) + 3.5 - 10.5 = 60 + 3.5 - 10.5 = 53
    });

    it('should handle complex calculation pipeline', () => {
      // Calculate order total: (price * quantity) + tax + shipping - discount
      const result = evaluator.evaluate('{{res:step1-0.$.price}} | mul({{res:step1-0.$.quantity}}) | add({{proc:step1-0.$.calculated.shipping}}) | sub({{res:step1-0.$.discount}})', {});
      expect(result).toBeCloseTo(101.49, 2); // (25.5 * 4) + 9.99 - 10.5 = 102 + 9.99 - 10.5 = 101.49
    });
  });

  describe('Integration with other pipeline functions', () => {
    it('should work with sum and arithmetic', () => {
      const data = {
        items: [
          { price: 10 },
          { price: 20 },
          { price: 30 }
        ]
      };
      
      const result = evaluator.evaluate('$.items | sum($.price) | add({{env:serviceFee}}) | mul({{env:exchangeRate}})', data);
      expect(result).toBe(79.375); // (60 + 3.5) * 1.25 = 63.5 * 1.25 = 79.375
    });

    it('should work with count and arithmetic', () => {
      const data = {
        items: [1, 2, 3, 4, 5]
      };
      
      const result = evaluator.evaluate('$.items | count() | mul({{param:basePrice}}) | div({{param:quantity}})', data);
      expect(result).toBeCloseTo(33.33, 2); // (5 * 20) / 3 = 100 / 3 ≈ 33.33
    });

    it('should work with first/last and arithmetic', () => {
      const data = {
        values: [5, 10, 15, 20, 25]
      };
      
      const result1 = evaluator.evaluate('$.values | first() | add({{param:increment}})', data);
      expect(result1).toBe(7.5); // 5 + 2.5
      
      const result2 = evaluator.evaluate('$.values | last() | sub({{param:increment}})', data);
      expect(result2).toBe(22.5); // 25 - 2.5
    });

    it('should work with at() and arithmetic', () => {
      const data = {
        prices: [10.00, 15.50, 20.75, 30.25]
      };
      
      const result = evaluator.evaluate('$.prices | at(2) | mul({{param:factor}}) | add({{env:serviceFee}})', data);
      expect(result).toBeCloseTo(27.36, 2); // (20.75 * 1.15) + 3.5 = 23.8625 + 3.5 = 27.3625
    });
  });

  describe('Real-world use cases with templates', () => {
    it('should calculate order total with tax', () => {
      // Total = (price * quantity) * (1 + tax_rate) + shipping - discount
      const expression = '{{res:step1-0.$.price}} | mul({{res:step1-0.$.quantity}}) | mul({{res:step1-0.$.tax_rate}} | add(1)) | add({{proc:step1-0.$.calculated.shipping}}) | sub({{res:step1-0.$.discount}})';
      const result = evaluator.evaluate(expression, {});
      expect(result).toBeCloseTo(109.65, 2); // ((25.5 * 4) * 1.08) + 9.99 - 10.5 = 110.16 + 9.99 - 10.5 = 109.65
    });

    it('should calculate percentage-based discount', () => {
      // Apply 15% discount: price * (1 - 0.15)
      const result = evaluator.evaluate('{{res:step1-0.$.price}} | mul(0.85)', {});
      expect(result).toBe(21.675); // 25.5 * 0.85
    });

    it('should calculate compound interest', () => {
      // A = P * (1 + r)^t - simplified to one period
      const result = evaluator.evaluate('{{env:baseAmount}} | mul({{res:step1-0.$.tax_rate}} | add(1))', {});
      expect(result).toBe(108); // 100 * (0.08 + 1) = 100 * 1.08 = 108
    });

    it('should calculate currency conversion with fees', () => {
      // Convert amount and add service fee
      const result = evaluator.evaluate('{{res:step1-0.$.total}} | mul({{env:exchangeRate}}) | add({{env:serviceFee}})', {});
      expect(result).toBe(128.5); // (100 * 1.25) + 3.5 = 125 + 3.5 = 128.5
    });

    it('should calculate shipping cost based on weight tiers', () => {
      // Base shipping + weight multiplier
      const result = evaluator.evaluate('{{proc:step1-0.$.calculated.shipping}} | add({{proc:step1-0.$.calculated.fees}} | mul({{res:step2-0.$.multiplier}})))', {});
      expect(result).toBe(15.99); // 9.99 + (5.00 * 1.2) = 9.99 + 6.00 = 15.99
    });

    it('should calculate bulk discount tiers', () => {
      // Quantity-based discount
      const result = evaluator.evaluate('{{res:step1-0.$.quantity}} | div(10) | mul({{res:step1-0.$.price}}) | sub({{res:step1-0.$.discount}})', {});
      expect(result).toBeCloseTo(-0.3, 2); // (4 / 10) * 25.5 - 10.5 = 0.4 * 25.5 - 10.5 = 10.2 - 10.5 = -0.3
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing template values gracefully', () => {
      const result = evaluator.evaluate('10 | add({{res:nonexistent.$.value}})', {});
      expect(result).toBeUndefined(); // Should return undefined when template fails
    });

    it('should handle null/undefined in templates', () => {
      // Add null response for testing
      evaluator.setTemplateContext({
        ...mockContext,
        responses: {
          ...mockContext.responses,
          'null-step': { value: null }
        }
      });
      
      const result = evaluator.evaluate('10 | add({{res:null-step.$.value}})', {});
      expect(result).toBeUndefined(); // null is not a number, so should return undefined
    });

    it('should handle very large numbers', () => {
      const result = evaluator.evaluate('999999999 | mul(999999999)', {});
      expect(result).toBe(999999998000000001);
    });

    it('should handle very small numbers', () => {
      const result = evaluator.evaluate('0.000001 | mul(0.000001)', {});
      expect(result).toBe(0.000000000001);
    });

    it('should handle boolean to number conversion', () => {
      const result1 = evaluator.evaluate('true | add(5)', {});
      expect(result1).toBeUndefined(); // booleans are not numbers
      
      const result2 = evaluator.evaluate('false | add(5)', {});
      expect(result2).toBeUndefined(); // booleans are not numbers
    });

    it('should handle array to number conversion', () => {
      const result = evaluator.evaluate('[1,2,3] | add(5)', {});
      expect(result).toBeUndefined(); // Array is not a valid number
    });

    it('should handle object to number conversion', () => {
      const result = evaluator.evaluate('{} | add(5)', {});
      expect(result).toBeUndefined(); // Object is not a valid number
    });
  });

  describe('Template evaluation contexts', () => {
    it('should evaluate templates in arithmetic context correctly', () => {
      // Test that templates are evaluated before arithmetic operations
      const result = evaluator.evaluate('{{res:step1-0.$.user_id}} | add({{res:step2-0.$.bonus}}) | mul({{param:factor}})', {});
      expect(result).toBeCloseTo(158.7, 1); // (123 + 15) * 1.15 = 138 * 1.15 = 158.7
    });

    it('should handle nested template references', () => {
      // Use transformed data that references response data
      const result = evaluator.evaluate('{{proc:step1-0.$.calculated.subtotal}} | add({{res:step1-0.$.user_id}} | div(10))', {});
      expect(result).toBeCloseTo(87.55, 2); // 75.25 + (123 / 10) = 75.25 + 12.3 = 87.55
    });

    it('should maintain template context through pipeline', () => {
      // Complex pipeline that uses multiple template sources
      const expression = '{{param:basePrice}} | mul({{param:quantity}}) | add({{env:serviceFee}}) | mul({{env:exchangeRate}}) | sub({{res:step1-0.$.discount}}) | div({{res:step2-0.$.divisor}})';
      const result = evaluator.evaluate(expression, {});
      expect(result).toBeCloseTo(27.55, 2); // ((((20 * 3) + 3.5) * 1.25) - 10.5) / 2.5 = ((63.5 * 1.25) - 10.5) / 2.5 = (79.375 - 10.5) / 2.5 = 68.875 / 2.5 = 27.55
    });
  });
});
