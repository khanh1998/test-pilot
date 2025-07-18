/**
 * Assertion system for API response validation
 */
export * from './types';
export * from './operators';
export * from './engine';

// Re-export the main functions for easier imports
import { runAssertions, evaluateAssertion, extractAssertionValue } from './engine';
import { getOperator, isValidOperator, getAllOperators, registerOperator } from './operators';

export default {
  runAssertions,
  evaluateAssertion,
  extractAssertionValue,
  getOperator,
  isValidOperator,
  getAllOperators,
  registerOperator
};
