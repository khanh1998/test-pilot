/**
 * Centralized template types for Test-Pilot
 */

/**
 * Context for resolving template expressions
 */
export interface TemplateContext {
  /** Response data from previous steps, keyed by stepId-endpointIndex */
  responses: Record<string, unknown>;
  
  /** Transformed data from previous steps, keyed by stepId-endpointIndex */
  transformedData: Record<string, Record<string, unknown>>;
  
  /** Parameter values for the test flow */
  parameters: Record<string, unknown>;
  
  /** Template functions for utility operations */
  functions?: Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Template resolution result
 */
export interface TemplateResolutionResult {
  /** The resolved value */
  value: unknown;
  
  /** Whether resolution was successful */
  success: boolean;
  
  /** Error message if resolution failed */
  error?: string;
}

/**
 * Template expression types
 */
export type TemplateExpression = {
  /** Source type: res, proc, param, func */
  source: 'res' | 'proc' | 'param' | 'func';
  
  /** Path or expression to resolve */
  path: string;
  
  /** Whether to preserve original type (triple braces) */
  preserveType: boolean;
};
