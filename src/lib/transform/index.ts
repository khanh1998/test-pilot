/**
 * Transformation Module
 * Exports functionality for transforming API responses
 */

import { SafeJSONPathEvaluator } from './JSONPathEvaluator';
import { SafeExpressionEvaluator } from './ExpressionEvaluator';

export { SafeJSONPathEvaluator, SafeExpressionEvaluator };

/**
 * Transform a response using an expression
 * @param response - The API response to transform
 * @param expression - The transformation expression
 * @returns The transformed result
 */
export function transformResponse(response: unknown, expression: string): unknown {
  const evaluator = new SafeExpressionEvaluator();
  try {
    return evaluator.evaluate(expression, response);
  } catch (error) {
    console.error('Error transforming response:', error);
    return null;
  }
}

/**
 * Apply JSONPath to extract data from a response
 * @param response - The response object
 * @param path - JSONPath expression
 * @returns The extracted data
 */
export function extractWithJsonPath(response: unknown, path: string): unknown {
  const evaluator = new SafeJSONPathEvaluator();
  try {
    return evaluator.evaluate(path, response);
  } catch (error) {
    console.error('Error extracting with JSONPath:', error);
    return null;
  }
}
