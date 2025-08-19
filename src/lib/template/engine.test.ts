/**
 * Tests for the centralized template engine
 */

import { describe, it, expect } from 'vitest';
import {
  hasTemplateExpressions,
  resolveTemplate,
  resolveTemplateExpression,
  parseTemplateExpression
} from './engine';
import { createTemplateContextFromFlowRunner } from './utils';
import type { TemplateContext } from './types';

describe('Centralized Template Engine', () => {
  describe('hasTemplateExpressions', () => {
    it('should detect double brace expressions', () => {
      expect(hasTemplateExpressions('{{res:step1.data}}')).toBe(true);
      expect(hasTemplateExpressions('Hello {{param:name}}')).toBe(true);
      expect(hasTemplateExpressions('No templates here')).toBe(false);
    });

    it('should detect triple brace expressions', () => {
      expect(hasTemplateExpressions('{{{res:step1.data}}}')).toBe(true);
      expect(hasTemplateExpressions('Value: {{{param:count}}}')).toBe(true);
    });
  });

  describe('parseTemplateExpression', () => {
    it('should parse double brace expressions', () => {
      const result = parseTemplateExpression('{{res:step1-0.$.data}}');
      expect(result).toEqual({
        source: 'res',
        path: 'step1-0.$.data',
        preserveType: false
      });
    });

    it('should parse triple brace expressions', () => {
      const result = parseTemplateExpression('{{{param:userId}}}');
      expect(result).toEqual({
        source: 'param',
        path: 'userId',
        preserveType: true
      });
    });

    it('should normalize source aliases', () => {
      expect(parseTemplateExpression('{{response:step1.data}}')?.source).toBe('res');
      expect(parseTemplateExpression('{{var:userId}}')?.source).toBe('param');
      expect(parseTemplateExpression('{{function:uuid()}}')?.source).toBe('func');
      expect(parseTemplateExpression('{{transform:step1.$.alias}}')?.source).toBe('proc');
    });

    it('should return null for invalid expressions', () => {
      expect(parseTemplateExpression('{{invalid}}')).toBeNull();
      expect(parseTemplateExpression('{{unknown:path}}')).toBeNull();
      expect(parseTemplateExpression('not a template')).toBeNull();
    });
  });

  describe('resolveTemplateExpression', () => {
    const context: TemplateContext = {
      responses: {
        'step1-0': { id: 123, name: 'John', active: true, items: [1, 2, 3], score: 85.5 },
        'step2-0': { status: 'success', count: 0, data: null }
      },
      transformedData: {
        'step1-0': {
          'userInfo': { fullName: 'John Doe', age: 30, isAdmin: false }
        }
      },
      parameters: {
        userId: 456,
        name: 'Test User',
        isEnabled: true,
        version: 2.1
      }
    };

    describe('quoted triple-brace expressions', () => {
      it('should handle single quoted triple-brace expression', () => {
        const result = resolveTemplateExpression('"{{{res:step1-0.$.id}}}"', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe(123); // Number, not string
      });

      it('should handle multiple quoted triple-brace expressions', () => {
        const template = '{"count": "{{{res:step1-0.$.id}}}", "active": "{{{res:step1-0.$.active}}}"}';
        const result = resolveTemplateExpression(template, context);
        expect(result.success).toBe(true);
        // Should be a valid JSON string that can be parsed
        const parsed = JSON.parse(result.value as string);
        expect(parsed).toEqual({ count: 123, active: true });
      });

      it('should preserve different data types', () => {
        // Number
        let result = resolveTemplateExpression('"{{{res:step1-0.$.id}}}"', context);
        expect(result.value).toBe(123);
        expect(typeof result.value).toBe('number');

        // Boolean
        result = resolveTemplateExpression('"{{{res:step1-0.$.active}}}"', context);
        expect(result.value).toBe(true);
        expect(typeof result.value).toBe('boolean');

        // Array
        result = resolveTemplateExpression('"{{{res:step1-0.$.items}}}"', context);
        expect(result.value).toEqual([1, 2, 3]);
        expect(Array.isArray(result.value)).toBe(true);

        // Null
        result = resolveTemplateExpression('"{{{res:step2-0.$.data}}}"', context);
        expect(result.value).toBe(null);

        // Float
        result = resolveTemplateExpression('"{{{res:step1-0.$.score}}}"', context);
        expect(result.value).toBe(85.5);
      });

      it('should handle quoted triple-braces with parameters', () => {
        const result = resolveTemplateExpression('"{{{param:userId}}}"', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe(456);
      });

      it('should handle quoted triple-braces with transformations', () => {
        const result = resolveTemplateExpression('"{{{proc:step1-0.$.userInfo.age}}}"', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe(30);
      });

      it('should handle error in quoted triple-brace gracefully', () => {
        const result = resolveTemplateExpression('"{{{res:nonexistent.data}}}"', context);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.value).toBe('"{{{res:nonexistent.data}}}"'); // Returns original template
      });
    });

    describe('regular double-brace expressions', () => {
      it('should convert values to strings', () => {
        const result = resolveTemplateExpression('User ID: {{res:step1-0.$.id}}', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe('User ID: 123');
      });

      it('should handle multiple double-brace expressions', () => {
        const template = 'Hello {{param:name}}, your ID is {{res:step1-0.$.id}}';
        const result = resolveTemplateExpression(template, context);
        expect(result.success).toBe(true);
        expect(result.value).toBe('Hello Test User, your ID is 123');
      });

      it('should handle boolean values', () => {
        const result = resolveTemplateExpression('Active: {{res:step1-0.$.active}}', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe('Active: true');
      });

      it('should handle null/undefined values', () => {
        const result = resolveTemplateExpression('Data: {{res:step2-0.$.data}}', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe('Data: '); // null becomes empty string
      });
    });

    describe('mixed expressions', () => {
      it('should handle mix of quoted and unquoted expressions', () => {
        const template = '{"id": "{{{res:step1-0.$.id}}}", "name": "{{res:step1-0.$.name}}", "items": "{{{res:step1-0.$.items}}}"}';
        const result = resolveTemplateExpression(template, context);
        expect(result.success).toBe(true);
        
        const parsed = JSON.parse(result.value as string);
        expect(parsed).toEqual({
          id: 123,           // Number (quoted triple-brace)
          name: 'John',      // String (double-brace)
          items: [1, 2, 3]   // Array (quoted triple-brace)
        });
      });

      it('should handle complex JSON template', () => {
        const template = `{
          "user": {
            "id": "{{{param:userId}}}",
            "name": "{{param:name}}",
            "active": "{{{res:step1-0.$.active}}}"
          },
          "score": "{{{res:step1-0.$.score}}}",
          "message": "User {{param:name}} has score {{res:step1-0.$.score}}"
        }`;
        
        const result = resolveTemplateExpression(template, context);
        expect(result.success).toBe(true);
        
        const parsed = JSON.parse(result.value as string);
        expect(parsed).toEqual({
          user: {
            id: 456,
            name: 'Test User',
            active: true
          },
          score: 85.5,
          message: 'User Test User has score 85.5'
        });
      });
    });

    describe('edge cases', () => {
      it('should return original value when no template expressions', () => {
        const result = resolveTemplateExpression('Plain text with no templates', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe('Plain text with no templates');
      });

      it('should handle empty string', () => {
        const result = resolveTemplateExpression('', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe('');
      });

      it('should handle malformed expressions gracefully', () => {
        const result = resolveTemplateExpression('{{invalid}}', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe('{{invalid}}'); // Returns original on parse failure
      });

      it('should handle JSON parsing failure for triple-brace results', () => {
        // This tests the fallback when JSON.parse fails on the final result
        const result = resolveTemplateExpression('"{{{param:name}}}"', context);
        expect(result.success).toBe(true);
        expect(result.value).toBe('Test User'); // String value returned directly
      });
    });

    describe('error handling', () => {
      it('should return error result for missing response', () => {
        const result = resolveTemplateExpression('{{res:missing.data}}', context);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Response data not found');
        expect(result.value).toBe('{{res:missing.data}}');
      });

      it('should return error result for missing parameter', () => {
        const result = resolveTemplateExpression('{{param:missing}}', context);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Parameter not found');
        expect(result.value).toBe('{{param:missing}}');
      });

      it('should catch and handle general errors', () => {
        // Force an error by using invalid source type (this will throw during parsing)
        const result = resolveTemplateExpression('{{invalidSource:step1-0.data}}', context);
        expect(result.success).toBe(true); // parseTemplateExpression returns null, so it stays as-is
        expect(result.value).toBe('{{invalidSource:step1-0.data}}'); // Returns original on parse failure
      });
    });
  });

  describe('resolveTemplate', () => {
    const context: TemplateContext = {
      responses: {
        'step1-0': { id: 123, name: 'John', items: [1, 2, 3] }
      },
      transformedData: {
        'step1-0': {
          'userInfo': { fullName: 'John Doe', age: 30 }
        }
      },
      parameters: {
        userId: 456,
        name: 'Test User'
      }
    };

    describe('response expressions', () => {
      it('should resolve simple response paths', () => {
        expect(resolveTemplate('{{res:step1-0.$.id}}', context)).toBe('123');
        expect(resolveTemplate('{{res:step1-0.$.name}}', context)).toBe('John');
      });

      it('should resolve array access', () => {
        expect(resolveTemplate('{{res:step1-0.$.items[0]}}', context)).toBe('1');
        expect(resolveTemplate('{{res:step1-0.$.items[2]}}', context)).toBe('3');
      });

      it('should preserve types with triple braces', () => {
        expect(resolveTemplate('"{{{res:step1-0.$.id}}}"', context)).toBe(123);
        expect(resolveTemplate('"{{{res:step1-0.$.items}}}"', context)).toEqual([1, 2, 3]);
      });
    });

    describe('transformation expressions', () => {
      it('should resolve transformation aliases', () => {
        expect(resolveTemplate('{{proc:step1-0.$.userInfo.fullName}}', context)).toBe('John Doe');
        expect(resolveTemplate('"{{{proc:step1-0.$.userInfo.age}}}"', context)).toBe(30);
      });
    });

    describe('parameter expressions', () => {
      it('should resolve parameters', () => {
        expect(resolveTemplate('{{param:userId}}', context)).toBe('456');
        expect(resolveTemplate('{{param:name}}', context)).toBe('Test User');
        expect(resolveTemplate('"{{{param:userId}}}"', context)).toBe(456);
      });
    });

    describe('function expressions', () => {
      it('should call template functions', () => {
        const result = resolveTemplate('{{func:uuid()}}', context);
        expect(typeof result).toBe('string');
        expect(result).toHaveLength(36); // UUID length
      });

      it('should call functions with arguments', () => {
        expect(resolveTemplate('{{func:randomInt(10, 20)}}', context)).toBeDefined();
        expect(resolveTemplate('{{func:randomString(5)}}', context)).toBeDefined();
      });
    });

    describe('mixed templates', () => {
      it('should resolve multiple expressions in one template', () => {
        const result = resolveTemplate('User {{param:name}} has ID {{res:step1-0.$.id}}', context);
        expect(result).toBe('User Test User has ID 123');
      });

      it('should handle templates without expressions', () => {
        expect(resolveTemplate('Plain text', context)).toBe('Plain text');
      });
    });

    describe('error handling', () => {
      it('should handle missing response data gracefully', () => {
        expect(() => resolveTemplate('{{res:nonexistent.data}}', context)).toThrow();
      });

      it('should handle missing parameter gracefully', () => {
        expect(() => resolveTemplate('{{param:missing}}', context)).toThrow();
      });

      it('should handle invalid function calls gracefully', () => {
        expect(() => resolveTemplate('{{func:nonexistentFunction()}}', context)).toThrow();
      });
    });
  });

  describe('createTemplateContextFromFlowRunner', () => {
    it('should convert FlowRunner data to TemplateContext', () => {
      const storedResponses = { 'step1-0': { id: 123 } };
      const storedTransformations = { 'step1-0': { alias: { name: 'John' } } };
      const parameterValues = { userId: 456 };
      const functions = { customFunc: () => 'test' };

      const context = createTemplateContextFromFlowRunner(
        storedResponses,
        storedTransformations,
        parameterValues,
        functions
      );

      expect(context).toEqual({
        responses: storedResponses,
        transformedData: storedTransformations,
        parameters: parameterValues,
        functions
      });
    });
  });
});
