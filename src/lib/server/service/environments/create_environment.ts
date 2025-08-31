/**
 * Environment creation service
 */

import { createEnvironmentRecord, checkEnvironmentNameExists } from '$lib/server/repository/db/environment';
import { linkApiToEnvironment } from '$lib/server/repository/db/environment_api';
import type { CreateEnvironmentData, Environment } from '$lib/types/environment';

export class EnvironmentCreationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EnvironmentCreationError';
  }
}

export class EnvironmentValidationError extends EnvironmentCreationError {
  constructor(message: string, public field: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

/**
 * Create a new environment with validation
 */
export async function createEnvironment(
  userId: number,
  data: CreateEnvironmentData
): Promise<Environment> {
  // Validate input data
  validateEnvironmentData(data);
  
  // Check if environment name already exists for this user
  const nameExists = await checkEnvironmentNameExists(data.name, userId);
  if (nameExists) {
    throw new EnvironmentValidationError(
      `Environment with name "${data.name}" already exists`,
      'name'
    );
  }

  // Validate environment configuration
  validateEnvironmentConfig(data.config);

  // Create the environment
  const environment = await createEnvironmentRecord({
    name: data.name,
    description: data.description,
    userId,
    config: data.config
  });

  // Link APIs if specified
  if (data.config.linked_apis && data.config.linked_apis.length > 0) {
    for (const apiId of data.config.linked_apis) {
      try {
        await linkApiToEnvironment(environment.id, apiId);
      } catch (error) {
        console.warn(`Failed to link API ${apiId} to environment ${environment.id}:`, error);
        // Continue with other APIs, don't fail the entire creation
      }
    }
  }

  return environment;
}

/**
 * Validate basic environment data
 */
function validateEnvironmentData(data: CreateEnvironmentData): void {
  if (!data.name || data.name.trim().length === 0) {
    throw new EnvironmentValidationError('Environment name is required', 'name');
  }

  if (data.name.length > 255) {
    throw new EnvironmentValidationError('Environment name must be 255 characters or less', 'name');
  }

  if (!data.config) {
    throw new EnvironmentValidationError('Environment configuration is required', 'config');
  }
}

/**
 * Validate environment configuration structure
 */
function validateEnvironmentConfig(config: any): void {
  if (!config.type || !['environment_set', 'single_environment'].includes(config.type)) {
    throw new EnvironmentValidationError(
      'Environment type must be either "environment_set" or "single_environment"',
      'config.type'
    );
  }

  if (!config.environments || typeof config.environments !== 'object') {
    throw new EnvironmentValidationError(
      'Environment configuration must include environments object',
      'config.environments'
    );
  }

  // Validate each sub-environment
  for (const [envName, subEnv] of Object.entries(config.environments)) {
    validateSubEnvironment(envName, subEnv as any);
  }

  // Validate variable definitions if present
  if (config.variable_definitions) {
    validateVariableDefinitions(config.variable_definitions);
  }

  // Validate linked APIs if present
  if (config.linked_apis) {
    validateLinkedApis(config.linked_apis);
  }
}

/**
 * Validate sub-environment structure
 */
function validateSubEnvironment(envName: string, subEnv: any): void {
  if (!subEnv || typeof subEnv !== 'object') {
    throw new EnvironmentValidationError(
      `Sub-environment "${envName}" must be an object`,
      `config.environments.${envName}`
    );
  }

  if (!subEnv.name || typeof subEnv.name !== 'string') {
    throw new EnvironmentValidationError(
      `Sub-environment "${envName}" must have a name`,
      `config.environments.${envName}.name`
    );
  }

  if (subEnv.variables && typeof subEnv.variables !== 'object') {
    throw new EnvironmentValidationError(
      `Sub-environment "${envName}" variables must be an object`,
      `config.environments.${envName}.variables`
    );
  }

  if (subEnv.api_hosts && typeof subEnv.api_hosts !== 'object') {
    throw new EnvironmentValidationError(
      `Sub-environment "${envName}" api_hosts must be an object`,
      `config.environments.${envName}.api_hosts`
    );
  }

  // Validate API hosts format
  if (subEnv.api_hosts) {
    for (const [apiId, hostUrl] of Object.entries(subEnv.api_hosts)) {
      if (typeof hostUrl !== 'string' || !isValidUrl(hostUrl as string)) {
        throw new EnvironmentValidationError(
          `Invalid URL for API ${apiId} in sub-environment "${envName}"`,
          `config.environments.${envName}.api_hosts.${apiId}`
        );
      }
    }
  }
}

/**
 * Validate variable definitions
 */
function validateVariableDefinitions(variableDefinitions: any): void {
  if (typeof variableDefinitions !== 'object') {
    throw new EnvironmentValidationError(
      'Variable definitions must be an object',
      'config.variable_definitions'
    );
  }

  for (const [varName, varDef] of Object.entries(variableDefinitions)) {
    validateVariableDefinition(varName, varDef as any);
  }
}

/**
 * Validate a single variable definition
 */
function validateVariableDefinition(varName: string, varDef: any): void {
  if (!varDef || typeof varDef !== 'object') {
    throw new EnvironmentValidationError(
      `Variable definition for "${varName}" must be an object`,
      `config.variable_definitions.${varName}`
    );
  }

  const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
  if (!varDef.type || !validTypes.includes(varDef.type)) {
    throw new EnvironmentValidationError(
      `Variable "${varName}" must have a valid type: ${validTypes.join(', ')}`,
      `config.variable_definitions.${varName}.type`
    );
  }

  if (typeof varDef.required !== 'boolean') {
    throw new EnvironmentValidationError(
      `Variable "${varName}" required field must be a boolean`,
      `config.variable_definitions.${varName}.required`
    );
  }
}

/**
 * Validate linked APIs
 */
function validateLinkedApis(linkedApis: any): void {
  if (!Array.isArray(linkedApis)) {
    throw new EnvironmentValidationError(
      'Linked APIs must be an array of API IDs',
      'config.linked_apis'
    );
  }

  for (const apiId of linkedApis) {
    if (!Number.isInteger(apiId) || apiId <= 0) {
      throw new EnvironmentValidationError(
        'Each linked API ID must be a positive integer',
        'config.linked_apis'
      );
    }
  }
}

/**
 * Basic URL validation
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
