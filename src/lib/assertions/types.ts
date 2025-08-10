/**
 * Types for the assertion system
 */

/**
 * Supported operator types for assertions
 */
export type AssertionOperator = 
  // Basic comparison
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'exists'
  | 'greater_than'
  | 'less_than'
  // Additional string operators
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  // Additional numeric operators
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'not_between'
  // Array-specific operators
  | 'has_length'
  | 'length_greater_than'
  | 'length_less_than'
  | 'contains_all'
  | 'contains_any'
  | 'not_contains_any'
  | 'one_of'
  | 'not_one_of'
  // Type validation operators
  | 'is_type'
  | 'is_null'
  | 'is_not_null';

/**
 * Data sources for assertions
 */
export type AssertionDataSource = 'response' | 'transformed_data';

/**
 * Assertion types - what part of the response we're validating
 */
export type AssertionType = 'status_code' | 'response_time' | 'header' | 'json_body';

/**
 * A single assertion configuration
 */
export interface Assertion {
  id: string;
  data_source: AssertionDataSource;
  assertion_type: AssertionType;
  data_id: string;
  operator: AssertionOperator;
  expected_value: unknown;
  enabled: boolean;
  // Add field to indicate if expected_value contains template expressions
  is_template_expression?: boolean;
}

/**
 * Interface for implementing assertion operators
 */
export interface AssertionOperatorHandler {
  /**
   * Evaluates if the actual value meets the condition defined by the operator
   * 
   * @param actualValue The value extracted from the response
   * @param expectedValue The value to compare against
   * @returns Whether the assertion passes or fails
   */
  evaluate(actualValue: unknown, expectedValue: unknown): boolean;
}

/**
 * Result of an assertion evaluation
 */
export interface AssertionResult {
  passed: boolean;
  actualValue: unknown;
  expectedValue: unknown;
  originalExpectedValue?: unknown; // Store original template for reference
  message?: string;
  error?: string;
}
