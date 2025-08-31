/**
 * Centralized template engine for Test-Pilot
 * Combines the template processing logic from FlowRunner and assertions
 */

import type { TemplateContext, TemplateResolutionResult, TemplateExpression } from './types';
import { createTemplateFunctions, defaultTemplateFunctions } from './functions';

/**
 * Check if a string contains template expressions
 */
export function hasTemplateExpressions(value: string): boolean {
  return /\{\{[^}]+\}\}/.test(value) || /\{\{\{[^}]+\}\}\}/.test(value);
}

/**
 * Parse template expression to extract source type and path
 */
export function parseTemplateExpression(expression: string): TemplateExpression | null {
  // Handle triple braces (type preservation): {{{source:path}}}
  const tripleMatch = expression.match(/^\{\{\{([^:]+):(.+)\}\}\}$/);
  if (tripleMatch) {
    const [, source, path] = tripleMatch;
    const validSource = validateSource(source);
    if (!validSource) return null;
    
    return {
      source: validSource,
      path: path.trim(),
      preserveType: true
    };
  }

  // Handle double braces (string conversion): {{source:path}}
  const doubleMatch = expression.match(/^\{\{([^:]+):(.+)\}\}$/);
  if (doubleMatch) {
    const [, source, path] = doubleMatch;
    const validSource = validateSource(source);
    if (!validSource) return null;
    
    return {
      source: validSource,
      path: path.trim(),
      preserveType: false
    };
  }

  return null;
}

/**
 * Validate and normalize source type
 */
function validateSource(source: string): 'res' | 'proc' | 'param' | 'func' | 'env' | null {
  const normalized = source.toLowerCase().trim();
  if (normalized === 'res' || normalized === 'response') return 'res';
  if (normalized === 'proc' || normalized === 'process' || normalized === 'transform') return 'proc';
  if (normalized === 'param' || normalized === 'parameter' || normalized === 'var') return 'param';
  if (normalized === 'func' || normalized === 'function') return 'func';
  if (normalized === 'env' || normalized === 'environment') return 'env';
  return null;
}

/**
 * Core template resolution function
 * Processes template expressions and returns resolved values
 */
export function resolveTemplateExpression(
  template: string,
  context: TemplateContext
): TemplateResolutionResult {
  try {
    // If no template expressions, return as-is
    if (!hasTemplateExpressions(template)) {
      return { value: template, success: true };
    }

    const functions = createTemplateFunctions(context);
    
    // Handle single expression cases that should preserve type
    const singleExpressionResult = handleSingleExpression(template, context, functions);
    if (singleExpressionResult) {
      return singleExpressionResult;
    }
    
    // Handle multiple expressions in template
    return handleMultipleExpressions(template, context, functions);
  } catch (error) {
    return {
      value: template,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handle single expression cases that should preserve type
 */
function handleSingleExpression(
  template: string,
  context: TemplateContext,
  functions: Record<string, (...args: unknown[]) => unknown>
): TemplateResolutionResult | null {
  // Check for single double-brace expression: "{{expr}}" or {{expr}}
  const quotedMatch = template.match(/^"\{\{[^}]+\}\}"$/);
  const unquotedMatch = template.match(/^\{\{[^}]+\}\}$/);
  
  if (quotedMatch) {
    // Quoted expression: remove quotes and treat as string context
    return resolveSingleExpression(
      quotedMatch[0].slice(1, -1), // Remove quotes
      template,
      context,
      functions,
      true // forceString
    );
  }
  
  if (unquotedMatch) {
    // Unquoted single expression: preserve original type
    return resolveSingleExpression(
      unquotedMatch[0],
      template,
      context,
      functions,
      false // preserveType
    );
  }
  
  // Check for single quoted triple-brace: "{{{expr}}}"
  const quotedTripleMatch = template.match(/^"\{\{\{[^}]+\}\}\}"$/);
  if (quotedTripleMatch) {
    return resolveSingleExpression(
      quotedTripleMatch[0].slice(1, -1), // Remove quotes
      template,
      context,
      functions,
      false // preserveType for triple braces
    );
  }
  
  return null;
}

/**
 * Resolve a single expression and return result
 */
function resolveSingleExpression(
  expressionStr: string,
  originalTemplate: string,
  context: TemplateContext,
  functions: Record<string, (...args: unknown[]) => unknown>,
  forceString: boolean = false
): TemplateResolutionResult {
  const expression = parseTemplateExpression(expressionStr);
  if (!expression) {
    return { value: originalTemplate, success: true };
  }
  
  try {
    const resolved = resolveExpressionBySource(expression, context, functions);
    
    // Handle string conversion based on context
    if (forceString && typeof resolved !== 'string') {
      return { value: String(resolved), success: true };
    }
    
    // For triple braces or when preserveType is explicitly true, preserve type
    if (expression.preserveType) {
      return { value: resolved, success: true };
    }
    
    // For double braces in single expression context, preserve type
    return { value: resolved, success: true };
  } catch (error) {
    return {
      value: originalTemplate,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handle templates with multiple expressions
 */
function handleMultipleExpressions(
  template: string,
  context: TemplateContext,
  functions: Record<string, (...args: unknown[]) => unknown>
): TemplateResolutionResult {
  let processedTemplate = template;
  
  // First pass: Handle quoted triple-brace expressions
  const quotedResult = processQuotedTripleBraces(processedTemplate, context, functions);
  if (!quotedResult.success) {
    return quotedResult;
  }
  processedTemplate = quotedResult.value as string;
  
  // Second pass: Handle remaining expressions (double braces and unquoted triple braces)
  const remainingResult = processRemainingExpressions(processedTemplate, context, functions);
  if (!remainingResult.success) {
    return { value: template, success: false, error: remainingResult.error };
  }
  processedTemplate = remainingResult.value as string;
  
  // Try to parse JSON if it looks like a JSON string from triple braces
  const finalValue = tryParseJsonResult(processedTemplate, template);
  
  return { value: finalValue, success: true };
}

/**
 * Process quoted triple-brace expressions in template
 */
function processQuotedTripleBraces(
  template: string,
  context: TemplateContext,
  functions: Record<string, (...args: unknown[]) => unknown>
): TemplateResolutionResult {
  const quotedTripleRegex = /"\{\{\{[^}]+\}\}\}"/g;
  let hasError = false;
  let errorMessage = '';
  
  const processed = template.replace(quotedTripleRegex, (match) => {
    const expression = parseTemplateExpression(match.slice(1, -1)); // Remove quotes
    if (!expression?.preserveType) {
      return match;
    }
    
    try {
      const resolved = resolveExpressionBySource(expression, context, functions);
      return JSON.stringify(resolved);
    } catch (error) {
      hasError = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error resolving quoted triple-brace expression ${match}:`, error);
      return match;
    }
  });
  
  if (hasError) {
    return { value: template, success: false, error: errorMessage };
  }
  
  return { value: processed, success: true };
}

/**
 * Process remaining expressions (double braces only)
 */
function processRemainingExpressions(
  template: string,
  context: TemplateContext,
  functions: Record<string, (...args: unknown[]) => unknown>
): TemplateResolutionResult {
  const expressionRegex = /\{\{[^}]+\}\}/g; // Only double braces now
  let hasError = false;
  let errorMessage = '';
  
  const processed = template.replace(expressionRegex, (match) => {
    const expression = parseTemplateExpression(match);
    if (!expression) {
      console.warn(`Invalid template expression: ${match}`);
      return match;
    }

    try {
      const resolved = resolveExpressionBySource(expression, context, functions);
      // Double braces always convert to string
      return resolved !== undefined && resolved !== null ? String(resolved) : '';
    } catch (error) {
      hasError = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error resolving template expression ${match}:`, error);
      return match;
    }
  });
  
  if (hasError) {
    return { value: template, success: false, error: errorMessage };
  }
  
  return { value: processed, success: true };
}

/**
 * Try to parse result as JSON if it looks like it was JSON stringified
 */
function tryParseJsonResult(processedTemplate: string, originalTemplate: string): unknown {
  if (processedTemplate !== originalTemplate && 
      processedTemplate.startsWith('"') && 
      processedTemplate.endsWith('"')) {
    try {
      return JSON.parse(processedTemplate);
    } catch {
      // If parsing fails, just return the string
    }
  }
  return processedTemplate;
}

/**
 * Resolve expression based on its source type
 */
function resolveExpressionBySource(
  expression: TemplateExpression,
  context: TemplateContext,
  functions: Record<string, (...args: unknown[]) => unknown>
): unknown {
  switch (expression.source) {
    case 'res':
      return resolveResponseExpression(expression.path, context);
      
    case 'proc':
      return resolveTransformationExpression(expression.path, context);
      
    case 'param':
      return resolveParameterExpression(expression.path, context);
      
    case 'func':
      return resolveFunctionExpression(expression.path, functions);
      
    case 'env':
      return resolveEnvironmentExpression(expression.path, context);
      
    default:
      throw new Error(`Unknown template source: ${expression.source}`);
  }
}

/**
 * Resolve response template expressions like stepId-endpointIndex.$.path
 */
function resolveResponseExpression(path: string, context: TemplateContext): unknown {
  const firstDotIndex = path.indexOf('.');
  const stepEndpointId = firstDotIndex > 0 ? path.substring(0, firstDotIndex) : path;
  const jsonPathExpr = firstDotIndex > 0 ? path.substring(firstDotIndex + 1) : '$';

  const responseData = context.responses[stepEndpointId];
  if (responseData === undefined) {
    const availableKeys = Object.keys(context.responses);
    throw new Error(`Response data not found for: ${stepEndpointId}. Available keys: ${availableKeys.join(', ')}`);
  }

  if (jsonPathExpr && jsonPathExpr !== '$') {
    const jsonPathFn = defaultTemplateFunctions.jsonPath;
    return jsonPathFn(responseData, jsonPathExpr);
  }

  return responseData;
}

/**
 * Resolve transformation template expressions like stepId-endpointIndex.$.alias.path
 */
function resolveTransformationExpression(path: string, context: TemplateContext): unknown {
  const dotSeparated = path.split('.');
  
  if (dotSeparated.length < 3) {
    throw new Error(`Invalid transformation template: ${path}. Format should be stepId-endpointIndex.$.alias.path`);
  }
  
  const stepEndpointId = dotSeparated[0];
  
  if (dotSeparated[1] !== '$') {
    throw new Error(`Invalid transformation template: ${path}. Format should include $ to indicate JSON path`);
  }
  
  const alias = dotSeparated[2];
  
  if (!context.transformedData[stepEndpointId]) {
    const availableKeys = Object.keys(context.transformedData);
    throw new Error(`Transformation data not found for: ${stepEndpointId}. Available keys: ${availableKeys.join(', ')}`);
  }
  
  const transformedData = context.transformedData[stepEndpointId][alias];
  if (transformedData === undefined) {
    const availableAliases = Object.keys(context.transformedData[stepEndpointId]);
    throw new Error(`Transformation alias not found: ${alias} for step ${stepEndpointId}. Available aliases: ${availableAliases.join(', ')}`);
  }
  
  // If there are more parts, apply JSON path
  if (dotSeparated.length > 3) {
    const jsonPathParts = dotSeparated.slice(3);
    const jsonPath = jsonPathParts.join('.');
    const jsonPathFn = defaultTemplateFunctions.jsonPath;
    return jsonPathFn(transformedData, jsonPath);
  }
  
  return transformedData;
}

/**
 * Resolve parameter expressions
 */
function resolveParameterExpression(parameterName: string, context: TemplateContext): unknown {
  if (!(parameterName in context.parameters)) {
    const availableParams = Object.keys(context.parameters);
    throw new Error(`Parameter not found: ${parameterName}. Available parameters: ${availableParams.join(', ')}`);
  }
  
  return context.parameters[parameterName];
}

/**
 * Resolve environment variable expressions
 */
function resolveEnvironmentExpression(variableName: string, context: TemplateContext): unknown {
  if (!context.environment) {
    throw new Error('Environment context not available for environment variable resolution');
  }
  
  if (!(variableName in context.environment)) {
    const availableVars = Object.keys(context.environment);
    throw new Error(`Environment variable not found: ${variableName}. Available variables: ${availableVars.join(', ')}`);
  }
  
  return context.environment[variableName];
}

/**
 * Resolve function expressions like functionName(arg1,arg2,...)
 */
function resolveFunctionExpression(
  expression: string,
  functions: Record<string, (...args: unknown[]) => unknown>
): unknown {
  const match = expression.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/);
  if (!match) {
    throw new Error(`Invalid function template format: ${expression}`);
  }

  const functionName = match[1];
  const argsString = match[2].trim();

  if (typeof functions[functionName] !== 'function') {
    const availableFunctions = Object.keys(functions);
    throw new Error(`Function not found: ${functionName}. Available functions: ${availableFunctions.join(', ')}`);
  }

  let args: unknown[] = [];

  if (argsString) {
    // Parse comma-separated arguments
    args = argsString.split(',').map((arg) => {
      const trimmed = arg.trim();
      
      // Try to parse as JSON
      try {
        return JSON.parse(trimmed);
      } catch {
        // If not valid JSON, return as string (removing quotes if present)
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      }
    });
  }

  return functions[functionName](...args);
}

/**
 * Convenience function for resolving template expressions with error handling
 */
export function resolveTemplate(template: string, context: TemplateContext): unknown {
  const result = resolveTemplateExpression(template, context);
  if (!result.success) {
    throw new Error(result.error || 'Template resolution failed');
  }
  return result.value;
}
