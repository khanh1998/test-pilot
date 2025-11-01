import type { ProjectModule } from './project.js';

export type { ProjectModule };

export interface FlowSequence {
  id: number;
  moduleId: number;
  name: string;
  description?: string;
  sequenceConfig: FlowSequenceConfig;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  // Include related data when needed
  module?: {
    id: number;
    name: string;
    projectId: number;
  };
}

export interface FlowSequenceConfig {
  steps: FlowSequenceStep[];
  global_settings?: {
    timeout?: number;
    continue_on_error?: boolean;
    parallel_execution?: boolean;
  };
}

export interface FlowSequenceStep {
  id: string; // Unique step identifier
  test_flow_id: number;
  step_order: number;
  parameter_mappings: FlowParameterMapping[];
  conditions?: ExecutionCondition[]; // Optional: conditional execution
  retry_config?: RetryConfig; // Optional: retry settings
  expects_error?: boolean; // Whether this step is expected to fail (default: false)
}

export interface FlowParameterMapping {
  flow_parameter_name: string;
  source_type: 'environment_variable' | 'previous_output' | 'static_value' | 'function';
  source_value: string; // For environment_variable: variable name, for previous_output: output field name, for static_value: the actual value, for function: function call expression
  data_type?: 'string' | 'number' | 'boolean'; // Only used for static_value
  source_flow_step?: number; // Only used for previous_output
  source_output_field?: string; // Only used for previous_output
}

export interface ExecutionCondition {
  type: 'success' | 'failure' | 'always' | 'custom';
  expression?: string; // For custom conditions
}

export interface RetryConfig {
  max_attempts: number;
  delay_ms: number;
  backoff_multiplier?: number;
}

// Request/Response types for API
export interface CreateModuleRequest {
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateModuleRequest {
  name?: string;
  description?: string;
  displayOrder?: number;
}

export interface CreateSequenceRequest {
  name: string;
  description?: string;
  sequenceConfig?: FlowSequenceConfig;
  displayOrder?: number;
}

export interface UpdateSequenceRequest {
  name?: string;
  description?: string;
  sequenceConfig?: FlowSequenceConfig;
  displayOrder?: number;
}

export interface AddFlowToSequenceRequest {
  test_flow_id: number;
  step_order: number;
  parameter_mappings: FlowParameterMapping[];
}

export interface ReorderSequenceFlowsRequest {
  flow_orders: Array<{
    step_id: string;
    new_order: number;
  }>;
}

export interface ModuleListResponse {
  modules: ProjectModule[];
  total: number;
}

export interface SequenceListResponse {
  sequences: FlowSequence[];
  total: number;
}
