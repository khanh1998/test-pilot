/**
 * Tests for the SafeExpressionEvaluator type casting functions
 * This test validates type casting functionality in both pipeline and direct contexts
 */
import { describe, it, expect } from 'vitest';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

describe('ExpressionEvaluator Type Casting Functions', () => {
  const evaluator = new SafeExpressionEvaluator();

  describe('Integer Casting (int)', () => {
    describe('Direct casting (single values)', () => {
      it('should cast numbers to integers', () => {
        const testData = { value: 3.14 };
        const result = evaluator.evaluate('$.value | int()', testData);
        expect(result).toBe(3);
      });

      it('should cast string numbers to integers', () => {
        const testData = { value: "42" };
        const result = evaluator.evaluate('$.value | int()', testData);
        expect(result).toBe(42);
      });

      it('should cast string numbers with whitespace', () => {
        const testData = { value: "  123  " };
        const result = evaluator.evaluate('$.value | int()', testData);
        expect(result).toBe(123);
      });

      it('should cast booleans to integers', () => {
        const testData1 = { value: true };
        const testData2 = { value: false };
        
        expect(evaluator.evaluate('$.value | int()', testData1)).toBe(1);
        expect(evaluator.evaluate('$.value | int()', testData2)).toBe(0);
      });

      it('should return null for invalid strings', () => {
        const testData = { value: "not_a_number" };
        const result = evaluator.evaluate('$.value | int()', testData);
        expect(result).toBeNull();
      });

      it('should return null for null/undefined', () => {
        const testData1 = { value: null };
        const testData2 = { value: undefined };
        
        expect(evaluator.evaluate('$.value | int()', testData1)).toBeNull();
        expect(evaluator.evaluate('$.value | int()', testData2)).toBeNull();
      });

      it('should use default value when provided', () => {
        const testData = { value: "invalid" };
        const result = evaluator.evaluate('$.value | int(0)', testData);
        expect(result).toBe(0);
      });

      it('should use default value for null', () => {
        const testData = { value: null };
        const result = evaluator.evaluate('$.value | int(-1)', testData);
        expect(result).toBe(-1);
      });
    });

    describe('Array casting with map', () => {
      it('should cast array of mixed values to integers', () => {
        const testData = {
          data: [3.14, "42", true, false, "invalid", null]
        };
        const result = evaluator.evaluate('$.data | map(int())', testData);
        expect(result).toEqual([3, 42, 1, 0, null, null]);
      });

      it('should cast array with default values', () => {
        const testData = {
          data: ["1", "invalid", "3"]
        };
        const result = evaluator.evaluate('$.data | map(int(0))', testData);
        expect(result).toEqual([1, 0, 3]);
      });

      it('should work in complex pipeline', () => {
        const testData = {
          data: [
            { id: "1", value: "10" },
            { id: "2", value: "20" },
            { id: "3", value: "invalid" }
          ]
        };
        const result = evaluator.evaluate('$.data | map(id: $.id | int(), value: $.value | int(0))', testData);
        expect(result).toEqual([
          { id: 1, value: 10 },
          { id: 2, value: 20 },
          { id: 3, value: 0 }
        ]);
      });
    });

    describe('Direct array casting', () => {
      it('should cast entire array when used as pipeline function', () => {
        const testData = {
          data: ["1", "2", "3.5", "invalid"]
        };
        const result = evaluator.evaluate('$.data | int()', testData);
        expect(result).toEqual([1, 2, 3, null]);
      });
    });
  });

  describe('Float Casting (float)', () => {
    describe('Direct casting', () => {
      it('should cast integers to floats', () => {
        const testData = { value: 42 };
        const result = evaluator.evaluate('$.value | float()', testData);
        expect(result).toBe(42.0);
      });

      it('should preserve float precision', () => {
        const testData = { value: 3.14159 };
        const result = evaluator.evaluate('$.value | float()', testData);
        expect(result).toBe(3.14159);
      });

      it('should cast string floats', () => {
        const testData = { value: "3.14" };
        const result = evaluator.evaluate('$.value | float()', testData);
        expect(result).toBe(3.14);
      });

      it('should cast booleans to floats', () => {
        const testData1 = { value: true };
        const testData2 = { value: false };
        
        expect(evaluator.evaluate('$.value | float()', testData1)).toBe(1.0);
        expect(evaluator.evaluate('$.value | float()', testData2)).toBe(0.0);
      });

      it('should return null for invalid values', () => {
        const testData = { value: "not_a_number" };
        const result = evaluator.evaluate('$.value | float()', testData);
        expect(result).toBeNull();
      });

      it('should use default value', () => {
        const testData = { value: "invalid" };
        const result = evaluator.evaluate('$.value | float(0.5)', testData);
        expect(result).toBe(0.5);
      });
    });

    describe('Array operations', () => {
      it('should cast array of values to floats', () => {
        const testData = {
          data: [1, "2.5", true, "invalid"]
        };
        const result = evaluator.evaluate('$.data | map(float())', testData);
        expect(result).toEqual([1.0, 2.5, 1.0, null]);
      });
    });
  });

  describe('String Casting (string)', () => {
    describe('Direct casting', () => {
      it('should preserve strings', () => {
        const testData = { value: "hello" };
        const result = evaluator.evaluate('$.value | string()', testData);
        expect(result).toBe("hello");
      });

      it('should cast numbers to strings', () => {
        const testData = { value: 42 };
        const result = evaluator.evaluate('$.value | string()', testData);
        expect(result).toBe("42");
      });

      it('should cast floats to strings', () => {
        const testData = { value: 3.14 };
        const result = evaluator.evaluate('$.value | string()', testData);
        expect(result).toBe("3.14");
      });

      it('should cast booleans to strings', () => {
        const testData1 = { value: true };
        const testData2 = { value: false };
        
        expect(evaluator.evaluate('$.value | string()', testData1)).toBe("true");
        expect(evaluator.evaluate('$.value | string()', testData2)).toBe("false");
      });

      it('should return null for null/undefined', () => {
        const testData1 = { value: null };
        const testData2 = { value: undefined };
        
        expect(evaluator.evaluate('$.value | string()', testData1)).toBeNull();
        expect(evaluator.evaluate('$.value | string()', testData2)).toBeNull();
      });

      it('should use default value for null', () => {
        const testData = { value: null };
        const result = evaluator.evaluate('$.value | string("default")', testData);
        expect(result).toBe("default");
      });

      it('should stringify objects', () => {
        const testData = { value: { name: "John", age: 30 } };
        const result = evaluator.evaluate('$.value | string()', testData);
        expect(result).toBe('{"name":"John","age":30}');
      });
    });

    describe('Array operations', () => {
      it('should cast array of mixed values to strings', () => {
        const testData = {
          data: [42, true, "hello", null]
        };
        const result = evaluator.evaluate('$.data | map(string("N/A"))', testData);
        expect(result).toEqual(["42", "true", "hello", "N/A"]);
      });
    });
  });

  describe('Boolean Casting (bool)', () => {
    describe('Direct casting', () => {
      it('should preserve booleans', () => {
        const testData1 = { value: true };
        const testData2 = { value: false };
        
        expect(evaluator.evaluate('$.value | bool()', testData1)).toBe(true);
        expect(evaluator.evaluate('$.value | bool()', testData2)).toBe(false);
      });

      it('should cast numbers to booleans', () => {
        const testData1 = { value: 0 };
        const testData2 = { value: 42 };
        const testData3 = { value: -1 };
        
        expect(evaluator.evaluate('$.value | bool()', testData1)).toBe(false);
        expect(evaluator.evaluate('$.value | bool()', testData2)).toBe(true);
        expect(evaluator.evaluate('$.value | bool()', testData3)).toBe(true);
      });

      it('should cast string booleans', () => {
        const testCases = [
          { value: "true", expected: true },
          { value: "TRUE", expected: true },
          { value: "True", expected: true },
          { value: "1", expected: true },
          { value: "false", expected: false },
          { value: "FALSE", expected: false },
          { value: "False", expected: false },
          { value: "0", expected: false },
          { value: "", expected: false },
          { value: "   ", expected: false },
          { value: "yes", expected: true },
          { value: "no", expected: true } // non-empty string is truthy
        ];

        testCases.forEach(({ value, expected }) => {
          const testData = { value };
          const result = evaluator.evaluate('$.value | bool()', testData);
          expect(result).toBe(expected);
        });
      });

      it('should return null for null/undefined', () => {
        const testData1 = { value: null };
        const testData2 = { value: undefined };
        
        expect(evaluator.evaluate('$.value | bool()', testData1)).toBeNull();
        expect(evaluator.evaluate('$.value | bool()', testData2)).toBeNull();
      });

      it('should use default value', () => {
        const testData = { value: null };
        const result = evaluator.evaluate('$.value | bool(true)', testData);
        expect(result).toBe(true);
      });

      it('should handle objects and arrays', () => {
        const testData1 = { value: {} };
        const testData2 = { value: [] };
        const testData3 = { value: { name: "John" } };
        
        expect(evaluator.evaluate('$.value | bool()', testData1)).toBe(true);
        expect(evaluator.evaluate('$.value | bool()', testData2)).toBe(true);
        expect(evaluator.evaluate('$.value | bool()', testData3)).toBe(true);
      });
    });

    describe('Array operations', () => {
      it('should cast array of mixed values to booleans', () => {
        const testData = {
          data: [0, 1, "true", "false", "", "hello", null]
        };
        const result = evaluator.evaluate('$.data | map(bool(false))', testData);
        expect(result).toEqual([false, true, true, false, false, true, false]);
      });
    });
  });

  describe('Integration with other pipeline functions', () => {
    it('should work with where clauses', () => {
      const testData = {
        data: [
          { active: "true", score: "85" },
          { active: "false", score: "92" },
          { active: "1", score: "78" },
          { active: "0", score: "65" }
        ]
      };
      
      const result = evaluator.evaluate(
        '$.data | where($.active == "true" || $.active == "1") | map(score: $.score | int())',
        testData
      );
      
      expect(result).toEqual([
        { score: 85 },
        { score: 78 }
      ]);
    });

    it('should work with boolean casting in where clauses', () => {
      const testData = {
        data: [
          { enabled: "true", count: "10" },
          { enabled: "false", count: "20" },
          { enabled: "1", count: "30" },
          { enabled: "", count: "40" }
        ]
      };
      
      // First map to cast boolean, then filter
      const result = evaluator.evaluate(
        '$.data | map(enabled: $.enabled | bool(), count: $.count | int()) | where($.enabled == true)',
        testData
      );
      
      expect(result).toEqual([
        { enabled: true, count: 10 },
        { enabled: true, count: 30 }
      ]);
    });

    it('should work with sorting', () => {
      const testData = {
        data: [
          { id: "3", value: "30.5" },
          { id: "1", value: "10.2" },
          { id: "2", value: "20.8" }
        ]
      };
      
      const result = evaluator.evaluate(
        '$.data | map(id: $.id | int(), value: $.value | float()) | sort(by: "id")',
        testData
      );
      
      expect(result).toEqual([
        { id: 1, value: 10.2 },
        { id: 2, value: 20.8 },
        { id: 3, value: 30.5 }
      ]);
    });

    it('should work with aggregation functions', () => {
      const testData = {
        data: ["10", "20", "30", "invalid", "40"]
      };
      
      const result = evaluator.evaluate(
        '$.data | map(int(0)) | sum()',
        testData
      );
      
      expect(result).toBe(100); // 10 + 20 + 30 + 0 + 40
    });
  });

  describe('Chained type casting', () => {
    it('should support chaining different type casts', () => {
      const testData = { value: "3.14" };
      
      // String -> Float -> Int
      const result = evaluator.evaluate('$.value | float() | int()', testData);
      expect(result).toBe(3);
    });

    it('should support complex chaining in arrays', () => {
      const testData = {
        data: ["1.5", "2.7", "3.9", "invalid"]
      };
      
      const result = evaluator.evaluate(
        '$.data | map(float(0)) | map(int())',
        testData
      );
      
      expect(result).toEqual([1, 2, 3, 0]);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty arrays', () => {
      const testData = { data: [] };
      
      expect(evaluator.evaluate('$.data | int()', testData)).toEqual([]);
      expect(evaluator.evaluate('$.data | map(int())', testData)).toEqual([]);
    });

    it('should handle non-array data in pipeline functions', () => {
      const testData = { value: "42" };
      
      const result = evaluator.evaluate('$.value | int()', testData);
      expect(result).toBe(42);
    });

    it('should handle nested objects', () => {
      const testData = {
        user: {
          profile: {
            age: "25",
            active: "true"
          }
        }
      };
      
      const result = evaluator.evaluate(
        '$.user.profile | transform(age: $.age | int(), active: $.active | bool())',
        testData
      );
      
      expect(result).toEqual({
        age: 25,
        active: true
      });
    });
  });
});
