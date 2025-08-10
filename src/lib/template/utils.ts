/**
 * Utilities for converting between different context formats
 * to maintain backward compatibility during the migration
 */

import type { TemplateContext } from './types';

/**
 * Convert FlowRunner's stored data format to centralized TemplateContext
 */
export function createTemplateContextFromFlowRunner(
  storedResponses: Record<string, unknown>,
  storedTransformations: Record<string, Record<string, unknown>>,
  parameterValues: Record<string, unknown>,
  templateFunctions?: Record<string, (...args: unknown[]) => unknown>
): TemplateContext {
  return {
    responses: storedResponses,
    transformedData: storedTransformations,
    parameters: parameterValues,
    functions: templateFunctions
  };
}

/**
 * Convert Map-based context (from assertions) to centralized TemplateContext
 */
export function createTemplateContextFromMaps(
  responses: Map<string, unknown>,
  transformedData: Map<string, unknown>,
  parameters: Record<string, unknown>
): TemplateContext {
  const responsesRecord: Record<string, unknown> = {};
  const transformedDataRecord: Record<string, Record<string, unknown>> = {};
  
  responses.forEach((value, key) => {
    responsesRecord[key] = value;
  });
  
  transformedData.forEach((value, key) => {
    if (typeof value === 'object' && value !== null) {
      transformedDataRecord[key] = value as Record<string, unknown>;
    }
  });
  
  return {
    responses: responsesRecord,
    transformedData: transformedDataRecord,
    parameters
  };
}
