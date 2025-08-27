/**
 * Environment variable resolution service
 */

import type { EnvironmentConfig, EnvironmentData } from '$lib/types/environment';

export class EnvironmentResolutionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EnvironmentResolutionError';
  }
}

/**
 * Resolve environment variables for a specific sub-environment
 */
export function resolveEnvironmentVariables(
  environmentId: number,
  environmentName: string,
  subEnvironmentName: string,
  config: EnvironmentConfig
): EnvironmentData {
  const subEnv = config.environments[subEnvironmentName];
  
  if (!subEnv) {
    const availableEnvs = Object.keys(config.environments);
    throw new EnvironmentResolutionError(
      `Sub-environment "${subEnvironmentName}" not found. Available: ${availableEnvs.join(', ')}`,
      'SUB_ENVIRONMENT_NOT_FOUND'
    );
  }

  // Resolve variables with fallback to defaults
  const resolvedVariables: Record<string, unknown> = {};
  const variableDefinitions = config.variable_definitions || {};

  // For each variable definition, get the value from sub-environment or use default
  Object.keys(variableDefinitions).forEach(varName => {
    const varDef = variableDefinitions[varName];
    
    if (subEnv.variables?.[varName] !== undefined) {
      // Use sub-environment specific value
      resolvedVariables[varName] = subEnv.variables[varName];
    } else if (varDef.default_value !== undefined) {
      // Use default value from definition
      resolvedVariables[varName] = varDef.default_value;
    } else if (varDef.required) {
      // Required variable without value or default
      throw new EnvironmentResolutionError(
        `Required variable "${varName}" has no value in sub-environment "${subEnvironmentName}" and no default value defined`,
        'MISSING_REQUIRED_VARIABLE'
      );
    }
    // If not required and no value/default, the variable will be undefined
  });

  return {
    id: environmentId,
    name: environmentName,
    subEnvironmentName,
    variables: resolvedVariables,
    apiHosts: subEnv.api_hosts || {},
    environmentConfig: config
  };
}

/**
 * Get available sub-environments for an environment
 */
export function getAvailableSubEnvironments(config: EnvironmentConfig): string[] {
  return Object.keys(config.environments);
}

/**
 * Validate that a sub-environment exists
 */
export function validateSubEnvironmentExists(
  config: EnvironmentConfig,
  subEnvironmentName: string
): boolean {
  return subEnvironmentName in config.environments;
}
