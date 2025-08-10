/**
 * Template expression utilities for assertions
 * Uses the centralized template engine from $lib/template
 */

import { resolveTemplate, hasTemplateExpressions } from '$lib/template';
import type { TemplateContext } from '$lib/template';

// Re-export for backward compatibility
export { hasTemplateExpressions, type TemplateContext };

/**
 * Resolve template expressions in assertion expected values
 * This uses the centralized template engine
 */
export function resolveAssertionExpectedValue(
  expectedValue: unknown,
  context: TemplateContext
): unknown {
  if (typeof expectedValue !== 'string') {
    return expectedValue;
  }

  if (!hasTemplateExpressions(expectedValue)) {
    return expectedValue;
  }

  try {
    return resolveTemplate(expectedValue, context);
  } catch (error) {
    throw new Error(`Template resolution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate template expression syntax
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAssertionExpectedValue(expectedValue: unknown, isTemplateExpression: boolean): ValidationResult {
  if (!isTemplateExpression) {
    return { valid: true };
  }

  if (typeof expectedValue !== 'string') {
    return {
      valid: false,
      error: 'Template expressions must be strings'
    };
  }

  // Basic template syntax validation
  const templateRegex = /\{\{[^}]+\}\}|\{\{\{[^}]+\}\}\}/g;
  const matches = expectedValue.match(templateRegex);
  
  if (!matches) {
    return {
      valid: false,
      error: 'No valid template expressions found'
    };
  }

  // Validate each template expression
  for (const match of matches) {
    const result = validateTemplateExpression(match);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Validate a single template expression
 */
function validateTemplateExpression(expression: string): ValidationResult {
  // Remove outer braces
  const inner = expression.replace(/^\{\{\{?|\}\}\}?$/g, '');
  
  if (!inner.includes(':')) {
    return {
      valid: false,
      error: `Template expression missing source prefix: ${expression}`
    };
  }

  const [source] = inner.split(':');
  
  if (!['res', 'proc', 'param', 'func'].includes(source)) {
    return {
      valid: false,
      error: `Unknown template source: ${source}`
    };
  }

  return { valid: true };
}
