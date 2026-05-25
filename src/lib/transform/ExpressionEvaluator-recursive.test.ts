import { beforeEach, describe, expect, it } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('Recursive transformation expression grammar', () => {
  let evaluator: SafeExpressionEvaluator;

  const data = {
    data: [
      { id: '3', status: 'inactive', amount: '3050', price: 30, qty: 2, fee: '1.25', tags: ['z'] },
      {
        id: '1',
        status: 'active',
        amount: '1020',
        price: 10,
        qty: 4,
        fee: '2.5',
        tags: ['a', 'b']
      },
      { id: '2', status: 'active', amount: '2080', price: 20, qty: 3, fee: null, tags: [] }
    ],
    meta: {
      defaultLimit: '2'
    }
  };

  beforeEach(() => {
    evaluator = new SafeExpressionEvaluator();
    evaluator.setTemplateContext({
      responses: {
        'step1-0': {
          limit: '1',
          extraFee: 4
        }
      },
      transformedData: {
        'step1-0': {
          config: {
            status: 'active',
            limit: '2'
          }
        }
      },
      parameters: {
        limit: '2',
        status: 'active',
        fallbackFee: '0'
      },
      functions: {}
    });
  });

  it('parses JSONPath, templates, constants, object literals, array literals, and pipelines recursively', () => {
    const result = evaluator.evaluate(
      '$.data | where($.status == "{{param:status}}") | map({ id: $.id | int(), total: $.price | mul($.qty), flags: [$.status, true, null] })',
      data
    );

    expect(result).toEqual([
      { id: 1, total: 40, flags: ['active', true, null] },
      { id: 2, total: 60, flags: ['active', true, null] }
    ]);
  });

  it('supports legacy named map shorthand as object mapping', () => {
    const result = evaluator.evaluate(
      '$.data | map(id: $.id | int(), normalized: $.amount | float() | div(100))',
      data
    );

    expect(result).toEqual([
      { id: 3, normalized: 30.5 },
      { id: 1, normalized: 10.2 },
      { id: 2, normalized: 20.8 }
    ]);
  });

  it('supports recursive function arguments from templates, JSONPath, constants, and nested pipelines', () => {
    const result = evaluator.evaluate(
      '$.data | where($.status == {{proc:step1-0.$.config.status}}) | sort(by: $.id | int()) | take({{param:limit}} | int(10)) | map(id: $.id | int(), fee: $.fee | float({{param:fallbackFee}} | int(0)), adjusted: $.price | add(($.fee | float(0))))',
      data
    );

    expect(result).toEqual([
      { id: 1, fee: 2.5, adjusted: 12.5 },
      { id: 2, fee: 0, adjusted: 20 }
    ]);
  });

  it('keeps $ scoped to each item inside where, map, and sort', () => {
    const result = evaluator.evaluate(
      '$.data | sort(by: $.id | int()) | map(id: $.id | int(), firstTag: $.tags | first())',
      data
    );

    expect(result).toEqual([
      { id: 1, firstTag: 'a' },
      { id: 2, firstTag: undefined },
      { id: 3, firstTag: 'z' }
    ]);
  });

  it('supports value functions only as pipeline stages', () => {
    const result = evaluator.evaluate(
      '$.data | map(tagCount: $.tags | length(), hasA: $.tags | contains("a"), activePrefix: $.status | startsWith("act"), activeSuffix: $.status | endsWith("ive"), statusMatches: $.status | matches("^act"), rounded: ($.price * $.qty) | round(1), emptyTags: $.tags | empty())',
      data
    );

    expect(result).toEqual([
      {
        tagCount: 1,
        hasA: false,
        activePrefix: false,
        activeSuffix: true,
        statusMatches: false,
        rounded: 60,
        emptyTags: false
      },
      {
        tagCount: 2,
        hasA: true,
        activePrefix: true,
        activeSuffix: true,
        statusMatches: true,
        rounded: 40,
        emptyTags: false
      },
      {
        tagCount: 0,
        hasA: false,
        activePrefix: true,
        activeSuffix: true,
        statusMatches: true,
        rounded: 60,
        emptyTags: true
      }
    ]);
  });

  it('rejects direct transformation function calls', () => {
    expect(() => evaluator.evaluate('length($.data)', data)).toThrow('Direct function call');
    expect(() => evaluator.evaluate('contains($.status, "active")', data)).toThrow(
      'Direct function call'
    );
    expect(() => evaluator.evaluate('$.data | map(int())', data)).toThrow('Direct function call');
  });

  it('supports member access after template values for compatibility', () => {
    const result = evaluator.evaluate('{{proc:step1-0.$.config}}.limit | int(0)', data);
    expect(result).toBe(2);
  });

  it('throws on direct env templates in transformations', () => {
    expect(() => evaluator.evaluate('$.data | take({{env:LIMIT}})', data)).toThrow(
      'Template source "env" is not supported in transformations'
    );
  });

  it('throws on triple-brace templates in transformations', () => {
    expect(() => evaluator.evaluate('$.data | take({{{param:limit}}})', data)).toThrow(
      'Transformations use {{...}} templates only'
    );
  });

  it('throws clear parse errors for malformed recursive syntax', () => {
    expect(() => evaluator.evaluate('$.data | map({ id: $.id ', data)).toThrow('Expected');
    expect(() => evaluator.evaluate('$.data | | map($.id)', data)).toThrow(
      'Expected identifier but found "|"'
    );
    expect(() => evaluator.evaluate('$.data | map(id: $.id, id: $.status)', data)).toThrow(
      'Duplicate named argument "id"'
    );
  });
});
