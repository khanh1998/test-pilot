/**
 * Tests for the centralized template engine
 */

import { describe, it, expect } from 'vitest';
import {
  hasTemplateExpressions,
  resolveTemplate,
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
        expect(resolveTemplate('{{{res:step1-0.$.id}}}', context)).toBe(123);
        expect(resolveTemplate('{{{res:step1-0.$.items}}}', context)).toEqual([1, 2, 3]);
      });
    });

    describe('transformation expressions', () => {
      it('should resolve transformation aliases', () => {
        expect(resolveTemplate('{{proc:step1-0.$.userInfo.fullName}}', context)).toBe('John Doe');
        expect(resolveTemplate('{{{proc:step1-0.$.userInfo.age}}}', context)).toBe(30);
      });
    });

    describe('parameter expressions', () => {
      it('should resolve parameters', () => {
        expect(resolveTemplate('{{param:userId}}', context)).toBe('456');
        expect(resolveTemplate('{{param:name}}', context)).toBe('Test User');
        expect(resolveTemplate('{{{param:userId}}}', context)).toBe(456);
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
