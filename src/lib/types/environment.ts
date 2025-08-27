/**
 * Environment management types for Test-Pilot
 */

export interface Environment {
  id: number;
  name: string;
  description?: string;
  userId: number;
  config: EnvironmentConfig;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentConfig {
  type: 'environment_set' | 'single_environment';
  environments: Record<string, SubEnvironment>;
  variable_definitions: Record<string, VariableDefinition>;
  linked_apis?: number[];
}

export interface SubEnvironment {
  name: string;
  description?: string;
  variables: Record<string, unknown>;
  api_hosts: Record<string, string>; // Record<apiId, hostUrl>
}

export interface VariableDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required: boolean;
  default_value: unknown;
}

// For creating environments
export interface CreateEnvironmentData {
  name: string;
  description?: string;
  config: EnvironmentConfig;
}

// For updating environments
export interface UpdateEnvironmentData {
  name?: string;
  description?: string;
  config?: EnvironmentConfig;
}

// Environment data prepared for flow execution
export interface EnvironmentData {
  id: number;
  name: string;
  subEnvironmentName: string;          // Selected sub-environment (dev, sit, uat)
  variables: Record<string, unknown>;   // Resolved environment variables (with fallbacks)
  apiHosts: Record<string, string>;     // API host overrides
  environmentConfig: EnvironmentConfig; // Full environment config for advanced resolution
}

// For linking APIs to environments
export interface EnvironmentApiLink {
  environmentId: number;
  apiId: number;
  createdAt: string;
}
