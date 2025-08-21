/**
 * Debug test to understand the wildcard issue
 */
import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from '../src/lib/transform/ExpressionEvaluator';

describe('Debug wildcard issue', () => {
  const evaluator = new SafeExpressionEvaluator();

  const testData = {
    data: [
      {
        code: 'fusion-cafe',
        terminals: [
          { id: 2, name: 'Terminal 1' },
          { id: 3, name: 'Terminal 2' }
        ]
      },
      {
        code: 'other-cafe',
        terminals: [
          { id: 4, name: 'Terminal 3' }
        ]
      }
    ]
  };

  it('should work with [0] index', () => {
    console.log('\n--- Testing $.data | where($.code == \'fusion-cafe\') | map($.terminals[0].id) ---');
    const result = evaluator.evaluate('$.data | where($.code == \'fusion-cafe\') | map($.terminals[0].id)', testData);
    console.log('Result:', result);
    expect(result).toEqual([2]);
  });

  it('should work with [*] wildcard', () => {
    console.log('\n--- Testing $.data | where($.code == \'fusion-cafe\') | map($.terminals[*].id) ---');
    const result = evaluator.evaluate('$.data | where($.code == \'fusion-cafe\') | map($.terminals[*].id)', testData);
    console.log('Result:', result);
    expect(result).toEqual([[2, 3]]); // This should be an array of arrays
  });

  it('should test intermediate steps', () => {
    console.log('\n--- Testing intermediate step: $.data | where($.code == \'fusion-cafe\') ---');
    const intermediate = evaluator.evaluate('$.data | where($.code == \'fusion-cafe\')', testData);
    console.log('Intermediate result:', JSON.stringify(intermediate, null, 2));
    expect(intermediate).toEqual([{
      code: 'fusion-cafe',
      terminals: [
        { id: 2, name: 'Terminal 1' },
        { id: 3, name: 'Terminal 2' }
      ]
    }]);

    console.log('\n--- Testing JSONPath directly: $.terminals[0].id on filtered item ---');
    const directResult1 = evaluator.evaluate('$.terminals[0].id', (intermediate as any[])[0]);
    console.log('Direct result [0]:', directResult1);
    expect(directResult1).toBe(2);

    console.log('\n--- Testing JSONPath directly: $.terminals[*].id on filtered item ---');
    const directResult2 = evaluator.evaluate('$.terminals[*].id', (intermediate as any[])[0]);
    console.log('Direct result [*]:', directResult2);
    // This should return [2, 3] but might be returning null
  });

  it('should handle edge cases with wildcards', () => {
    // Test empty array
    const emptyData = { items: [] };
    const emptyResult = evaluator.evaluate('$.items[*].id', emptyData);
    expect(emptyResult).toEqual([]);

    // Test missing property after wildcard
    const missingPropResult = evaluator.evaluate('$.terminals[*].nonexistent', testData.data[0]);
    expect(missingPropResult).toEqual([undefined, undefined]);

    // Test nested wildcards
    const nestedData = {
      groups: [
        { items: [{ value: 1 }, { value: 2 }] },
        { items: [{ value: 3 }, { value: 4 }] }
      ]
    };
    const nestedResult = evaluator.evaluate('$.groups[*].items', nestedData);
    expect(nestedResult).toEqual([
      [{ value: 1 }, { value: 2 }],
      [{ value: 3 }, { value: 4 }]
    ]);
  });

  it('should handle object wildcards', () => {
    const objData = {
      config: {
        setting1: { value: 'a' },
        setting2: { value: 'b' },
        setting3: { value: 'c' }
      }
    };
    const objResult = evaluator.evaluate('$.config[*].value', objData);
    expect(objResult).toEqual(['a', 'b', 'c']);
  });
});
