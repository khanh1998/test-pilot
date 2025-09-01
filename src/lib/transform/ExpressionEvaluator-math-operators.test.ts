/**
 * Tests for math operators in SafeExpressionEvaluator
 * Tests both basic arithmetic operators and math functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';
import type { TemplateContext } from '../template/types';

describe('Math Operators in SafeExpressionEvaluator', () => {
  let evaluator: SafeExpressionEvaluator;
  let mockContext: TemplateContext;

  beforeEach(() => {
    evaluator = new SafeExpressionEvaluator();
    mockContext = {
      responses: {
        'step1-0': { total: 100, price: 25.50, quantity: 4 },
        'step2-0': { total: 50, tax: 8.50, discount: 10 }
      },
      transformedData: {
        'step1-0': {
          calculated: { subtotal: 75.25, shipping: 9.99 }
        }
      },
      parameters: {
        taxRate: 0.08,
        quantity: 3,
        basePrice: 20.00
      },
      environment: {
        exchangeRate: 1.25,
        minimumOrder: 50
      },
      functions: {}
    };
    evaluator.setTemplateContext(mockContext);
  });

  describe('Basic Arithmetic Operators', () => {
    it('should handle addition with numbers', () => {
      expect(evaluator.evaluate('10 + 5', {})).toBe(15);
      expect(evaluator.evaluate('10.5 + 5.25', {})).toBe(15.75);
      expect(evaluator.evaluate('0 + 100', {})).toBe(100);
    });

    it('should handle subtraction with numbers', () => {
      expect(evaluator.evaluate('10 - 5', {})).toBe(5);
      expect(evaluator.evaluate('10.5 - 5.25', {})).toBe(5.25);
      expect(evaluator.evaluate('0 - 100', {})).toBe(-100);
    });

    it('should handle multiplication with numbers', () => {
      expect(evaluator.evaluate('10 * 5', {})).toBe(50);
      expect(evaluator.evaluate('10.5 * 2', {})).toBe(21);
      expect(evaluator.evaluate('0 * 100', {})).toBe(0);
    });

    it('should handle division with numbers', () => {
      expect(evaluator.evaluate('10 / 5', {})).toBe(2);
      expect(evaluator.evaluate('21 / 2', {})).toBe(10.5);
      expect(evaluator.evaluate('100 / 1', {})).toBe(100);
    });

    it('should handle modulo with numbers', () => {
      expect(evaluator.evaluate('10 % 3', {})).toBe(1);
      expect(evaluator.evaluate('21 % 5', {})).toBe(1);
      expect(evaluator.evaluate('100 % 10', {})).toBe(0);
    });

    it('should handle division by zero', () => {
      expect(evaluator.evaluate('10 / 0', {})).toBe(Infinity);
      expect(evaluator.evaluate('-10 / 0', {})).toBe(-Infinity);
    });

    it('should handle modulo by zero', () => {
      expect(evaluator.evaluate('10 % 0', {})).toBeNaN();
    });

    it('should handle invalid operands', () => {
      expect(evaluator.evaluate('"hello" + "world"', {})).toBeNaN();
      expect(evaluator.evaluate('true * false', {})).toBe(0);
      expect(evaluator.evaluate('null + undefined', {})).toBeNaN();
    });
  });

  describe('Operator Precedence', () => {
    it('should follow correct precedence for mixed operations', () => {
      expect(evaluator.evaluate('2 + 3 * 4', {})).toBe(14); // Not 20
      expect(evaluator.evaluate('20 - 10 / 2', {})).toBe(15); // Not 5
      expect(evaluator.evaluate('2 * 3 + 4 * 5', {})).toBe(26);
    });

    it('should respect parentheses', () => {
      expect(evaluator.evaluate('(2 + 3) * 4', {})).toBe(20);
      expect(evaluator.evaluate('2 * (3 + 4)', {})).toBe(14);
      expect(evaluator.evaluate('(20 - 10) / 2', {})).toBe(5);
    });

    it('should handle complex nested expressions', () => {
      expect(evaluator.evaluate('((2 + 3) * 4) - (10 / 2)', {})).toBe(15);
      expect(evaluator.evaluate('2 + 3 * 4 - 5 / 5', {})).toBe(13);
    });
  });

  describe('Math Functions', () => {
    it('should handle abs function', () => {
      expect(evaluator.evaluate('abs(-10)', {})).toBe(10);
      expect(evaluator.evaluate('abs(10)', {})).toBe(10);
      expect(evaluator.evaluate('abs(-5.5)', {})).toBe(5.5);
      expect(evaluator.evaluate('abs(0)', {})).toBe(0);
    });

    it('should handle round function', () => {
      expect(evaluator.evaluate('round(10.4)', {})).toBe(10);
      expect(evaluator.evaluate('round(10.6)', {})).toBe(11);
      expect(evaluator.evaluate('round(10.5)', {})).toBe(11);
      expect(evaluator.evaluate('round(-10.6)', {})).toBe(-11);
    });

    it('should support round with precision', () => {
      const result = evaluator.evaluate('round(10.456, 2)', {});
      expect(result).toBe(10.46);
    });

    it('should handle ceil function', () => {
      expect(evaluator.evaluate('ceil(10.1)', {})).toBe(11);
      expect(evaluator.evaluate('ceil(10.9)', {})).toBe(11);
      expect(evaluator.evaluate('ceil(-10.1)', {})).toBe(-10);
      expect(evaluator.evaluate('ceil(10)', {})).toBe(10);
    });

    it('should handle floor function', () => {
      expect(evaluator.evaluate('floor(10.1)', {})).toBe(10);
      expect(evaluator.evaluate('floor(10.9)', {})).toBe(10);
      expect(evaluator.evaluate('floor(-10.1)', {})).toBe(-11);
      expect(evaluator.evaluate('floor(10)', {})).toBe(10);
    });

    it('should handle min function', () => {
      expect(evaluator.evaluate('min(10, 5)', {})).toBe(5);
      expect(evaluator.evaluate('min(-10, -5)', {})).toBe(-10);
      expect(evaluator.evaluate('min(10.5, 10.3)', {})).toBe(10.3);
    });

    it('should handle max function', () => {
      expect(evaluator.evaluate('max(10, 5)', {})).toBe(10);
      expect(evaluator.evaluate('max(-10, -5)', {})).toBe(-5);
      expect(evaluator.evaluate('max(10.5, 10.3)', {})).toBe(10.5);
    });

    it('should handle pow function', () => {
      expect(evaluator.evaluate('pow(2, 3)', {})).toBe(8);
      expect(evaluator.evaluate('pow(10, 2)', {})).toBe(100);
      expect(evaluator.evaluate('pow(5, 0)', {})).toBe(1);
      expect(evaluator.evaluate('pow(2, -1)', {})).toBe(0.5);
    });

    it('should handle invalid function arguments', () => {
      expect(evaluator.evaluate('abs("hello")', {})).toBeNaN();
      expect(evaluator.evaluate('min("a", "b")', {})).toBeNaN();
      expect(evaluator.evaluate('pow(null, undefined)', {})).toBeNaN();
    });
  });

  describe('Template Integration with Math', () => {
    it('should handle basic template math operations', () => {
      const result = evaluator.evaluate('{{res:step1-0.$.total}} + {{res:step2-0.$.total}}', {});
      expect(result).toBe(150); // 100 + 50
    });

    it('should handle template multiplication', () => {
      const result = evaluator.evaluate('{{res:step1-0.$.price}} * {{param:quantity}}', {});
      expect(result).toBe(76.5); // 25.50 * 3
    });

    it('should handle complex template calculations', () => {
      // Calculate total with tax: (price * quantity) + tax
      const result = evaluator.evaluate('({{res:step1-0.$.price}} * {{param:quantity}}) + {{res:step2-0.$.tax}}', {});
      expect(result).toBe(85); // (25.50 * 3) + 8.50 = 76.5 + 8.5 = 85
    });

    it('should handle template with math functions', () => {
      const result = evaluator.evaluate('round({{res:step1-0.$.price}} * {{param:taxRate}}, 2)', {});
      expect(result).toBe(2.04); // round(25.50 * 0.08, 2) = round(2.04, 2) = 2.04
    });

    it('should handle environment variables in calculations', () => {
      const result = evaluator.evaluate('{{param:basePrice}} * {{env:exchangeRate}}', {});
      expect(result).toBe(25); // 20.00 * 1.25
    });

    it('should handle transformed data in calculations', () => {
      const result = evaluator.evaluate('{{proc:step1-0.$.calculated.subtotal}} + {{proc:step1-0.$.calculated.shipping}}', {});
      expect(result).toBe(85.24); // 75.25 + 9.99
    });
  });

  describe('Real-world Use Cases', () => {
    it('should calculate order total with discount', () => {
      // Order total = (price * quantity) - discount + tax
      const expression = '({{res:step1-0.$.price}} * {{res:step1-0.$.quantity}}) - {{res:step2-0.$.discount}} + {{res:step2-0.$.tax}}';
      const result = evaluator.evaluate(expression, {});
      expect(result).toBe(100.5); // (25.50 * 4) - 10 + 8.50 = 102 - 10 + 8.5 = 100.5
    });

    it('should apply percentage discount', () => {
      // Apply 15% discount: price * (1 - 0.15)
      const expression = '{{res:step1-0.$.price}} * (1 - 0.15)';
      const result = evaluator.evaluate(expression, {});
      expect(result).toBe(21.675); // 25.50 * 0.85
    });

    it('should calculate tax amount', () => {
      // Tax = subtotal * tax rate
      const expression = 'round(({{res:step1-0.$.price}} * {{res:step1-0.$.quantity}}) * {{param:taxRate}}, 2)';
      const result = evaluator.evaluate(expression, {});
      expect(result).toBe(8.16); // round((25.50 * 4) * 0.08, 2) = round(8.16, 2)
    });

    it('should check minimum order requirement', () => {
      // Check if order meets minimum: total >= minimum
      const expression = '({{res:step1-0.$.price}} * {{res:step1-0.$.quantity}}) >= {{env:minimumOrder}}';
      const result = evaluator.evaluate(expression, {});
      expect(result).toBe(true); // (25.50 * 4) >= 50 → 102 >= 50 → true
    });

    it('should calculate shipping cost based on weight and distance', () => {
      // Shipping = base rate + (weight * rate_per_unit) + distance_modifier
      const baseRate = 5.99;
      const weight = 2.5;
      const ratePerUnit = 1.50;
      const distanceModifier = 2.00;
      
      const expression = `${baseRate} + (${weight} * ${ratePerUnit}) + ${distanceModifier}`;
      const result = evaluator.evaluate(expression, {});
      expect(result).toBe(11.74); // 5.99 + (2.5 * 1.50) + 2.00 = 5.99 + 3.75 + 2.00
    });

    it('should handle currency conversion with rounding', () => {
      // Convert USD to EUR and round to 2 decimals
      const expression = 'round({{res:step1-0.$.total}} * {{env:exchangeRate}}, 2)';
      const result = evaluator.evaluate(expression, {});
      expect(result).toBe(125); // round(100 * 1.25, 2) = 125.00
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing template values gracefully', () => {
      // If a template resolves to undefined/null, math should return NaN
      const result = evaluator.evaluate('{{res:nonexistent.$.value}} + 10', {});
      expect(result).toBeNaN();
    });

    it('should handle mixed valid and invalid operations', () => {
      // Valid math with one invalid operand should return NaN
      const result = evaluator.evaluate('{{res:step1-0.$.total}} + {{res:nonexistent.$.value}}', {});
      expect(result).toBeNaN();
    });

    it('should handle chained math operations', () => {
      const expression = '{{res:step1-0.$.total}} + {{res:step2-0.$.total}} - {{res:step2-0.$.discount}} * 2';
      const result = evaluator.evaluate(expression, {});
      expect(result).toBe(130); // 100 + 50 - (10 * 2) = 150 - 20 = 130
    });

    it('should handle very large numbers', () => {
      const result = evaluator.evaluate('999999999 * 999999999', {});
      expect(result).toBe(999999998000000001);
    });

    it('should handle very small numbers', () => {
      const result = evaluator.evaluate('0.000001 * 0.000001', {});
      expect(result).toBe(0.000000000001);
    });
  });

  describe('Math with JSONPath', () => {
    it('should handle math with JSONPath expressions', () => {
      const data = {
        orders: [
          { total: 100, quantity: 2 },
          { total: 200, quantity: 3 },
          { total: 150, quantity: 1 }
        ]
      };
      
      const result = evaluator.evaluate('$.orders[0].total + $.orders[1].total', data);
      expect(result).toBe(300); // 100 + 200
    });

    it('should handle math functions with JSONPath', () => {
      const data = {
        measurements: [-5.7, 10.3, -2.1, 8.9]
      };
      
      const result = evaluator.evaluate('abs($.measurements[0]) + abs($.measurements[2])', data);
      expect(result).toBeCloseTo(7.8, 10); // abs(-5.7) + abs(-2.1) = 5.7 + 2.1 = 7.8
    });
  });
});
