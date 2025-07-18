/**
 * Implementation of basic assertion operators
 */
import type { AssertionOperator, AssertionOperatorHandler } from './types';

/**
 * Registry of all available operators and their implementations
 */
const operatorRegistry: Record<AssertionOperator, AssertionOperatorHandler> = {
  // Basic comparison operators
  equals: {
    evaluate: (actual, expected) => actual == expected
  },
  
  not_equals: {
    evaluate: (actual, expected) => actual != expected
  },
  
  contains: {
    evaluate: (actual, expected) => {
      if (typeof actual === 'string') {
        return actual.includes(String(expected));
      } else if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      return false;
    }
  },
  
  exists: {
    evaluate: (actual) => actual !== null && actual !== undefined
  },
  
  greater_than: {
    evaluate: (actual, expected) => 
      typeof actual === 'number' && 
      typeof expected === 'number' && 
      actual > expected
  },
  
  less_than: {
    evaluate: (actual, expected) => 
      typeof actual === 'number' && 
      typeof expected === 'number' && 
      actual < expected
  },

  // Additional string operators
  starts_with: {
    evaluate: (actual, expected) =>
      typeof actual === 'string' &&
      typeof expected === 'string' &&
      actual.startsWith(expected)
  },

  ends_with: {
    evaluate: (actual, expected) =>
      typeof actual === 'string' &&
      typeof expected === 'string' &&
      actual.endsWith(expected)
  },

  matches_regex: {
    evaluate: (actual, expected) => {
      if (typeof actual !== 'string' || typeof expected !== 'string') {
        return false;
      }
      try {
        const regex = new RegExp(expected);
        return regex.test(actual);
      } catch (e) {
        // Invalid regex
        return false;
      }
    }
  },

  not_contains: {
    evaluate: (actual, expected) => {
      if (typeof actual === 'string') {
        return !actual.includes(String(expected));
      } else if (Array.isArray(actual)) {
        return !actual.includes(expected);
      }
      return true;
    }
  },

  is_empty: {
    evaluate: (actual) => {
      if (actual === null || actual === undefined) {
        return true;
      }
      if (typeof actual === 'string' || Array.isArray(actual)) {
        return actual.length === 0;
      }
      if (typeof actual === 'object') {
        return Object.keys(actual as object).length === 0;
      }
      return false;
    }
  },

  is_not_empty: {
    evaluate: (actual) => {
      if (actual === null || actual === undefined) {
        return false;
      }
      if (typeof actual === 'string' || Array.isArray(actual)) {
        return actual.length > 0;
      }
      if (typeof actual === 'object') {
        return Object.keys(actual as object).length > 0;
      }
      return true;
    }
  },

  // Additional numeric operators
  greater_than_or_equal: {
    evaluate: (actual, expected) =>
      typeof actual === 'number' &&
      typeof expected === 'number' &&
      actual >= expected
  },

  less_than_or_equal: {
    evaluate: (actual, expected) =>
      typeof actual === 'number' &&
      typeof expected === 'number' &&
      actual <= expected
  },

  between: {
    evaluate: (actual, expected) => {
      if (typeof actual !== 'number' || !Array.isArray(expected) || expected.length !== 2) {
        return false;
      }
      const [min, max] = expected;
      return typeof min === 'number' && typeof max === 'number' && actual >= min && actual <= max;
    }
  },

  not_between: {
    evaluate: (actual, expected) => {
      if (typeof actual !== 'number' || !Array.isArray(expected) || expected.length !== 2) {
        return false;
      }
      const [min, max] = expected;
      return typeof min === 'number' && typeof max === 'number' && (actual < min || actual > max);
    }
  },

  // Array-specific operators
  has_length: {
    evaluate: (actual, expected) => {
      if (!actual || typeof expected !== 'number') {
        return false;
      }
      if (typeof actual === 'string' || Array.isArray(actual)) {
        return actual.length === expected;
      }
      return false;
    }
  },

  length_greater_than: {
    evaluate: (actual, expected) => {
      if (!actual || typeof expected !== 'number') {
        return false;
      }
      if (typeof actual === 'string' || Array.isArray(actual)) {
        return actual.length > expected;
      }
      return false;
    }
  },

  length_less_than: {
    evaluate: (actual, expected) => {
      if (!actual || typeof expected !== 'number') {
        return false;
      }
      if (typeof actual === 'string' || Array.isArray(actual)) {
        return actual.length < expected;
      }
      return false;
    }
  },

  contains_all: {
    evaluate: (actual, expected) => {
      if (!Array.isArray(actual) || !Array.isArray(expected)) {
        return false;
      }
      return expected.every(item => actual.includes(item));
    }
  },

  contains_any: {
    evaluate: (actual, expected) => {
      if (!Array.isArray(actual) || !Array.isArray(expected)) {
        return false;
      }
      return expected.some(item => actual.includes(item));
    }
  },

  not_contains_any: {
    evaluate: (actual, expected) => {
      if (!Array.isArray(actual) || !Array.isArray(expected)) {
        return false;
      }
      return !expected.some(item => actual.includes(item));
    }
  },

  one_of: {
    evaluate: (actual, expected) => {
      if (!Array.isArray(expected)) {
        return false;
      }
      return expected.includes(actual);
    }
  },

  not_one_of: {
    evaluate: (actual, expected) => {
      if (!Array.isArray(expected)) {
        return false;
      }
      return !expected.includes(actual);
    }
  },

  // Type validation operators
  is_type: {
    evaluate: (actual, expected) => {
      if (typeof expected !== 'string') {
        return false;
      }
      
      switch (expected) {
        case 'string':
          return typeof actual === 'string';
        case 'number':
          return typeof actual === 'number';
        case 'boolean':
          return typeof actual === 'boolean';
        case 'array':
          return Array.isArray(actual);
        case 'object':
          return typeof actual === 'object' && actual !== null && !Array.isArray(actual);
        case 'null':
          return actual === null;
        default:
          return false;
      }
    }
  },

  is_null: {
    evaluate: (actual) => actual === null || actual === undefined
  },

  is_not_null: {
    evaluate: (actual) => actual !== null && actual !== undefined
  }
};

/**
 * Get an operator handler by name
 */
export function getOperator(operator: AssertionOperator): AssertionOperatorHandler {
  const handler = operatorRegistry[operator];
  
  if (!handler) {
    throw new Error(`Unknown operator: ${operator}`);
  }
  
  return handler;
}

/**
 * Check if an operator exists in the registry
 */
export function isValidOperator(operator: string): operator is AssertionOperator {
  return operator in operatorRegistry;
}

/**
 * Get the list of all available operators
 */
export function getAllOperators(): AssertionOperator[] {
  return Object.keys(operatorRegistry) as AssertionOperator[];
}

/**
 * Register a custom operator
 */
export function registerOperator(name: AssertionOperator, handler: AssertionOperatorHandler): void {
  operatorRegistry[name] = handler;
}
