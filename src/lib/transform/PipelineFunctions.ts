/**
 * Pipeline Functions and Operators for SafeExpressionEvaluator
 * Contains all the pipeline functions and operators used in data transformations
 */

// Pipeline function signature
export type PipelineFunction = (data: unknown, ...args: unknown[]) => unknown;

/**
 * Helper functions for pipeline operations
 */
export class PipelineHelpers {
  /**
   * Get a nested value from an object using dot notation
   * @param obj - Object to extract value from
   * @param path - Path to the value using dot notation
   * @returns The value at the specified path
   */
  static getNestedValue(obj: unknown, path: string): unknown {
    if (obj === null || obj === undefined) {
      return undefined;
    }
    
    const pathParts = path.split('.');
    let current: unknown = obj;
    
    for (const part of pathParts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }

  /**
   * Safely compare numeric values
   * @param a - First value
   * @param b - Second value
   * @param compareFn - Comparison function
   * @returns Boolean result of the comparison
   */
  static safeNumericCompare(a: unknown, b: unknown, compareFn: (a: number, b: number) => boolean): boolean {
    const numA = Number(a);
    const numB = Number(b);
    if (isNaN(numA) || isNaN(numB)) return false;
    return compareFn(numA, numB);
  }

  /**
   * Safely match a string against a regex pattern
   * @param str - String to test
   * @param pattern - Regex pattern
   * @returns Whether the string matches the pattern
   */
  static safeRegexMatch(str: unknown, pattern: unknown): boolean {
    // Convert inputs to strings
    const stringValue = String(str);
    const patternString = String(pattern);
    
    // Only allow safe regex patterns
    if (PipelineHelpers.isUnsafeRegex(patternString)) {
      return false;
    }
    
    try {
      return new RegExp(patternString).test(stringValue);
    } catch {
      return false;
    }
  }

  /**
   * Check if a regex pattern might be unsafe
   * @param pattern - Regex pattern to check
   * @returns Whether the pattern is potentially unsafe
   */
  static isUnsafeRegex(pattern: string): boolean {
    // Check for potentially dangerous regex patterns
    const dangerousPatterns = [
      /\(\?=/,    // Positive lookahead
      /\*\*+/,     // Nested quantifiers
      /\{,?\d+,\d*\}/  // Complex repetition
    ];
    
    return dangerousPatterns.some(dangerous => dangerous.test(pattern));
  }

  /**
   * Cast value to integer
   * @param value - Value to cast
   * @param defaultValue - Default value if casting fails
   * @returns Integer value or null/default
   */
  static castToInt(value: unknown, defaultValue?: unknown): number | null {
    if (value === null || value === undefined) {
      return defaultValue !== undefined ? Number(defaultValue) : null;
    }
    
    if (typeof value === 'number') {
      return Math.floor(value);
    }
    
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    
    if (typeof value === 'string') {
      const parsed = parseInt(value.trim(), 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    
    // Casting failed
    return defaultValue !== undefined ? Number(defaultValue) : null;
  }

  /**
   * Cast value to float
   * @param value - Value to cast
   * @param defaultValue - Default value if casting fails
   * @returns Float value or null/default
   */
  static castToFloat(value: unknown, defaultValue?: unknown): number | null {
    if (value === null || value === undefined) {
      return defaultValue !== undefined ? Number(defaultValue) : null;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'boolean') {
      return value ? 1.0 : 0.0;
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value.trim());
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    
    // Casting failed
    return defaultValue !== undefined ? Number(defaultValue) : null;
  }

  /**
   * Cast value to string
   * @param value - Value to cast
   * @param defaultValue - Default value if casting fails
   * @returns String value or null/default
   */
  static castToString(value: unknown, defaultValue?: unknown): string | null {
    if (value === null || value === undefined) {
      return defaultValue !== undefined ? String(defaultValue) : null;
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return defaultValue !== undefined ? String(defaultValue) : null;
      }
    }
    
    return String(value);
  }

  /**
   * Cast value to boolean
   * @param value - Value to cast
   * @param defaultValue - Default value if casting fails
   * @returns Boolean value or null/default
   */
  static castToBool(value: unknown, defaultValue?: unknown): boolean | null {
    if (value === null || value === undefined) {
      return defaultValue !== undefined ? Boolean(defaultValue) : null;
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'number') {
      return value !== 0;
    }
    
    if (typeof value === 'string') {
      const lowered = value.toLowerCase().trim();
      if (lowered === 'true' || lowered === '1') {
        return true;
      }
      if (lowered === 'false' || lowered === '0' || lowered === '') {
        return false;
      }
      // Non-empty strings are truthy
      return value.trim().length > 0;
    }
    
    // Default JavaScript truthiness for other types
    return Boolean(value);
  }
}

/**
 * Creates operators available in expressions
 * @param evaluateConditionWithContext - Function to evaluate conditions with context
 * @param evaluateWithContext - Function to evaluate expressions with context
 * @returns Object containing all operators
 */
export function createOperators(
  evaluateConditionWithContext: (condition: string, context: unknown) => boolean,
  evaluateWithContext: (expression: string, context: unknown) => unknown
): Record<string, (...args: unknown[]) => unknown> {
  return {
    // Comparison
    '==': (a: unknown, b: unknown): boolean => a === b,
    '!=': (a: unknown, b: unknown): boolean => a !== b,
    '>': (a: unknown, b: unknown): boolean => PipelineHelpers.safeNumericCompare(a, b, (x, y) => x > y),
    '<': (a: unknown, b: unknown): boolean => PipelineHelpers.safeNumericCompare(a, b, (x, y) => x < y),
    '>=': (a: unknown, b: unknown): boolean => PipelineHelpers.safeNumericCompare(a, b, (x, y) => x >= y),
    '<=': (a: unknown, b: unknown): boolean => PipelineHelpers.safeNumericCompare(a, b, (x, y) => x <= y),
    
    // Logical
    '&&': (a: unknown, b: unknown): boolean => Boolean(a) && Boolean(b),
    '||': (a: unknown, b: unknown): boolean => Boolean(a) || Boolean(b),
    '!': (a: unknown): boolean => !Boolean(a),
    
    // String operations
    'contains': (a: unknown, b: unknown): boolean => String(a).includes(String(b)),
    'startsWith': (a: unknown, b: unknown): boolean => String(a).startsWith(String(b)),
    'endsWith': (a: unknown, b: unknown): boolean => String(a).endsWith(String(b)),
    'matches': (a: unknown, b: unknown): boolean => PipelineHelpers.safeRegexMatch(a, b),
    
    // Utility
    'empty': (a: unknown): boolean => a === '' || a === null || a === undefined || 
      (Array.isArray(a) && a.length === 0) ||
      (typeof a === 'object' && a !== null && Object.keys(a).length === 0),
    'length': (a: unknown): number => Array.isArray(a) ? a.length : 
      (typeof a === 'string' ? a.length : 0),
    
    // Type casting functions
    'int': (a: unknown, defaultValue?: unknown): number | null => PipelineHelpers.castToInt(a, defaultValue),
    'float': (a: unknown, defaultValue?: unknown): number | null => PipelineHelpers.castToFloat(a, defaultValue),
    'string': (a: unknown, defaultValue?: unknown): string | null => PipelineHelpers.castToString(a, defaultValue),
    'bool': (a: unknown, defaultValue?: unknown): boolean | null => PipelineHelpers.castToBool(a, defaultValue)
  };
}

/**
 * Creates pipeline functions for transformations
 * @param evaluateConditionWithContext - Function to evaluate conditions with context
 * @param evaluateWithContext - Function to evaluate expressions with context
 * @returns Object containing all pipeline functions
 */
export function createPipelineFunctions(
  evaluateConditionWithContext: (condition: string, context: unknown) => boolean,
  evaluateWithContext: (expression: string, context: unknown) => unknown
): Record<string, PipelineFunction> {
  const pipelineFunctions: Record<string, PipelineFunction> = {
    // Filtering
    'where': (data: unknown, condition: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      const conditionStr = String(condition);
      
      return data.filter(item => {
        try {
          return Boolean(evaluateConditionWithContext(conditionStr, item));
        } catch {
          return false;
        }
      });
    },
    
    'select': (data: unknown, condition: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      // We cast data to unknown[] since we already checked it's an array
      return pipelineFunctions.where(data, condition) as unknown[];
    },
    
    // Transformation
    'map': (data: unknown, transformer: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      
      if (typeof transformer === 'string') {
        // Simple mapping like map(item => item.name)
        return data.map(item => {
          try {
            return evaluateWithContext(transformer, item);
          } catch {
            return null;
          }
        });
      } else if (typeof transformer === 'object' && transformer !== null) {
        // Object mapping like map(name: item.name, age: item.age)
        const transformMap = transformer as Record<string, unknown>;
        return data.map(item => {
          const result: Record<string, unknown> = {};
          
          for (const [key, expr] of Object.entries(transformMap)) {
            try {
              if (typeof expr === 'string') {
                result[key] = evaluateWithContext(expr, item);
              } else {
                result[key] = expr;
              }
            } catch {
              result[key] = null;
            }
          }
          
          return result;
        });
      }
      
      return [];
    },
    
    'transform': (data: unknown, transforms: unknown): unknown => {
      if (Array.isArray(data)) {
        return pipelineFunctions.map(data, transforms);
      }
      
      if (typeof transforms !== 'object' || transforms === null) {
        return data;
      }
      
      // Single object transform
      const result: Record<string, unknown> = {};
      const transformMap = transforms as Record<string, unknown>;
      
      for (const [key, expr] of Object.entries(transformMap)) {
        try {
          if (typeof expr === 'string') {
            result[key] = evaluateWithContext(expr, data);
          } else {
            result[key] = expr;
          }
        } catch {
          result[key] = null;
        }
      }
      
      return result;
    },
    
    // Aggregation
    'sum': (data: unknown, field?: unknown): number => {
      if (!Array.isArray(data)) return 0;
      const fieldStr = field !== undefined ? String(field) : undefined;
      
      return data.reduce((acc: number, item) => {
        let value = fieldStr ? PipelineHelpers.getNestedValue(item, fieldStr) : item;
        const numValue = Number(value);
        return acc + (isNaN(numValue) ? 0 : numValue);
      }, 0);
    },
    
    'count': (data: unknown): number => {
      return Array.isArray(data) ? data.length : 0;
    },
    
    'first': (data: unknown): unknown => {
      return Array.isArray(data) && data.length > 0 ? data[0] : undefined;
    },
    
    'last': (data: unknown): unknown => {
      return Array.isArray(data) && data.length > 0 ? data[data.length - 1] : undefined;
    },
    
    // Sorting and slicing
    'sort': (data: unknown, options?: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      
      let by: string | undefined;
      let desc = false;
      
      if (typeof options === 'object' && options !== null) {
        const optionsMap = options as Record<string, unknown>;
        by = optionsMap.by !== undefined ? String(optionsMap.by) : undefined;
        desc = Boolean(optionsMap.desc);
      }
      
      return [...data].sort((a, b) => {
        let valueA = by ? PipelineHelpers.getNestedValue(a, by) : a;
        let valueB = by ? PipelineHelpers.getNestedValue(b, by) : b;
        
        if (valueA === valueB) return 0;
        
        // Handle null/undefined values - treat them as distinct but both come first
        if (valueA === null && valueB === null) return 0;
        if (valueA === undefined && valueB === undefined) return 0;
        if (valueA === null && valueB === undefined) return desc ? 1 : -1;
        if (valueA === undefined && valueB === null) return desc ? -1 : 1;
        if (valueA === null || valueA === undefined) return desc ? 1 : -1;
        if (valueB === null || valueB === undefined) return desc ? -1 : 1;
        
        // Try numeric comparison first
        const numA = Number(valueA);
        const numB = Number(valueB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          // Both are valid numbers - use numeric comparison
          const result = numA - numB;
          return desc ? -result : result;
        }
        
        // Fall back to string comparison
        const strA = String(valueA);
        const strB = String(valueB);
        
        const result = strA.localeCompare(strB);
        return desc ? -result : result;
      });
    },
    
    'take': (data: unknown, n: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      const count = Number(n);
      if (isNaN(count)) return data;
      return data.slice(0, count);
    },
    
    'skip': (data: unknown, n: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      const count = Number(n);
      if (isNaN(count)) return data;
      return data.slice(count);
    },
    
    'at': (data: unknown, index: unknown): unknown => {
      if (!Array.isArray(data)) return undefined;
      
      // Handle null/undefined indices
      if (index === null || index === undefined) return undefined;
      
      const idx = Number(index);
      if (isNaN(idx)) return undefined;
      
      // Convert float to integer by truncating
      const intIdx = Math.floor(idx);
      
      // Handle negative indices (e.g., -1 for last element)
      if (intIdx < 0) {
        return data[data.length + intIdx];
      }
      
      return data[intIdx];
    },
    
    // Utility
    'flatten': (data: unknown, depth?: unknown): unknown[] => {
      if (!Array.isArray(data)) return [];
      const flattenDepth = depth !== undefined ? Number(depth) : 1;
      if (isNaN(flattenDepth) || flattenDepth <= 0) return data;
      
      // Simple flatten implementation
      const flatten = (arr: unknown[], currentDepth: number): unknown[] => {
        if (currentDepth <= 0) return arr;
        
        const result: unknown[] = [];
        for (const item of arr) {
          if (Array.isArray(item)) {
            result.push(...flatten(item, currentDepth - 1));
          } else {
            result.push(item);
          }
        }
        return result;
      };
      
      return flatten(data, flattenDepth);
    },
    
    'pick': (obj: unknown, keys: unknown): Record<string, unknown> => {
      if (typeof obj !== 'object' || obj === null) return {};
      if (!Array.isArray(keys)) return {};
      
      const result: Record<string, unknown> = {};
      const objMap = obj as Record<string, unknown>;
      
      for (const key of keys) {
        const keyStr = String(key);
        if (Object.prototype.hasOwnProperty.call(objMap, keyStr)) {
          result[keyStr] = objMap[keyStr];
        }
      }
      return result;
    },
    
    // Type casting pipeline functions
    'int': (data: unknown, defaultValue?: unknown): unknown => {
      if (Array.isArray(data)) {
        return data.map(item => PipelineHelpers.castToInt(item, defaultValue));
      }
      return PipelineHelpers.castToInt(data, defaultValue);
    },
    
    'float': (data: unknown, defaultValue?: unknown): unknown => {
      if (Array.isArray(data)) {
        return data.map(item => PipelineHelpers.castToFloat(item, defaultValue));
      }
      return PipelineHelpers.castToFloat(data, defaultValue);
    },
    
    'string': (data: unknown, defaultValue?: unknown): unknown => {
      if (Array.isArray(data)) {
        return data.map(item => PipelineHelpers.castToString(item, defaultValue));
      }
      return PipelineHelpers.castToString(data, defaultValue);
    },
    
    'bool': (data: unknown, defaultValue?: unknown): unknown => {
      // For boolean casting, we typically want to cast the value itself to boolean
      // rather than mapping over arrays, since booleans are used for truthiness
      return PipelineHelpers.castToBool(data, defaultValue);
    }
  };

  return pipelineFunctions;
}
