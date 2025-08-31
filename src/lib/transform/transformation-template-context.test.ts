import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';
import { transformResponse } from './index';
import type { TemplateContext } from '$lib/template/types';

describe('Transformation with Template Context', () => {
  it('should resolve parameter templates in transformation expressions', () => {
    const response = { 
      data: [
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' },
        { id: 3, status: 'active' }
      ]
    };

    const templateContext: TemplateContext = {
      responses: {},
      transformedData: {},
      parameters: {
        targetStatus: 'active'
      },
      environment: {},
      functions: {}
    };

    // Test directly with SafeExpressionEvaluator
    const evaluator = new SafeExpressionEvaluator();
    evaluator.setTemplateContext(templateContext);

    // Expression that uses a parameter in a where clause
    const expression = '$.data | where(status == "{{{param:targetStatus}}}")';
    
    const result = evaluator.evaluate(expression, response);
    
    expect(result).toEqual([
      { id: 1, status: 'active' },
      { id: 3, status: 'active' }
    ]);
  });

  it('should resolve response references in transformation expressions', () => {
    const currentResponse = { 
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]
    };

    const templateContext: TemplateContext = {
      responses: {
        'step1-0': { targetId: 1 }
      },
      transformedData: {},
      parameters: {},
      environment: {},
      functions: {}
    };

    // Test directly with SafeExpressionEvaluator
    const evaluator = new SafeExpressionEvaluator();
    evaluator.setTemplateContext(templateContext);

    // Expression that references a previous response using template with JSONPath syntax
    const expression = '$.users | where(id == "{{{res:step1-0.$.targetId}}}")';
    
    const result = evaluator.evaluate(expression, currentResponse);
    
    expect(result).toEqual([
      { id: 1, name: 'Alice' }
    ]);
  });

  it('should resolve environment variables in transformation expressions', () => {
    const response = { 
      items: [
        { name: 'item1', category: 'electronics' },
        { name: 'item2', category: 'books' },
        { name: 'item3', category: 'electronics' }
      ]
    };

    const templateContext: TemplateContext = {
      responses: {},
      transformedData: {},
      parameters: {},
      environment: {
        filterCategory: 'electronics'
      },
      functions: {}
    };

    // Test directly with SafeExpressionEvaluator
    const evaluator = new SafeExpressionEvaluator();
    evaluator.setTemplateContext(templateContext);

    // Expression that uses an environment variable
    const expression = '$.items | where(category == "{{{env:filterCategory}}}")';
    
    const result = evaluator.evaluate(expression, response);
    
    expect(result).toEqual([
      { name: 'item1', category: 'electronics' },
      { name: 'item3', category: 'electronics' }
    ]);
  });

  it('should resolve parameters in pipeline functions', () => {
    const response = { 
      data: [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 },
        { id: 4, value: 40 },
        { id: 5, value: 50 }
      ]
    };

    const templateContext: TemplateContext = {
      responses: {},
      transformedData: {},
      parameters: {
        limit: 3
      },
      environment: {},
      functions: {}
    };

    // Test directly with SafeExpressionEvaluator
    const evaluator = new SafeExpressionEvaluator();
    evaluator.setTemplateContext(templateContext);

    // Expression that uses a parameter in take() function
    const expression = '$.data | take("{{{param:limit}}}")';
    
    const result = evaluator.evaluate(expression, response);
    
    expect(result).toEqual([
      { id: 1, value: 10 },
      { id: 2, value: 20 },
      { id: 3, value: 30 }
    ]);
  });

  it('should work without template context (backward compatibility)', () => {
    const response = { 
      data: [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 }
      ]
    };

    // Simple expression without templates - test transformResponse function
    const expression = '$.data | where(value > 15) | map(id)';
    
    const result = transformResponse(response, expression);
    
    expect(result).toEqual([2, 3]);
  });

  it('should work with transformResponse function and template context', () => {
    const response = { 
      data: [
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' },
        { id: 3, status: 'active' }
      ]
    };

    const templateContext: TemplateContext = {
      responses: {},
      transformedData: {},
      parameters: {
        targetStatus: 'active'
      },
      environment: {},
      functions: {}
    };

    // Test the transformResponse function with template context
    const expression = '$.data | where(status == "{{{param:targetStatus}}}")';
    
    const result = transformResponse(response, expression, templateContext);
    
    expect(result).toEqual([
      { id: 1, status: 'active' },
      { id: 3, status: 'active' }
    ]);
  });
});
