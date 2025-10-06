import type { ResolvedFlowExecution } from './types';
import type { TestFlowData, FlowStep, StepEndpoint } from '$lib/components/test-flows/types';
import type { FlowSequenceStep, FlowParameterMapping } from '$lib/types/flow_sequence';
import type { Environment } from '$lib/types/environment';
import type { TestFlow } from '$lib/types/test-flow';
import type { Project } from '$lib/types/project';

export class SequenceParameterResolver {
  
  /**
   * Resolve parameters for a flow based on its parameter mappings and accumulated data
   * This resolves everything to concrete values - no templates are supported in sequence execution
   */
  static resolveFlowParameters(
    flow: TestFlow,
    sequenceStep: FlowSequenceStep,
    accumulatedOutputs: Record<string, unknown>,
    environmentVariables: Record<string, unknown>,
    apiHosts: Record<string, string>,
    onLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void
  ): ResolvedFlowExecution {
    try {
      if (!flow.flowJson) {
        throw new Error(`Flow ${flow.name} (${flow.id}) has no flowJson data`);
      }

      onLog('debug', `Resolving parameters for flow ${flow.name}`);

      const flowData: TestFlowData = {
        settings: {
          api_hosts: Object.fromEntries(
            Object.entries(apiHosts).map(([apiId, url]) => [
              apiId,
              { url }
            ])
          ),
          // All parameters resolved to concrete values, no environment info needed
          environment: undefined,
          linkedEnvironment: undefined
        },
        parameters: flow.flowJson.parameters || [],
        outputs: flow.flowJson.outputs || [],
        steps: (flow.flowJson.steps || []).map((step: any) => ({
          ...step,
          endpoints: (step.endpoints || []).map((endpoint: any) => ({
            ...endpoint,
            pathParams: endpoint.pathParams || {},
            queryParams: endpoint.queryParams || {},
            headers: endpoint.headers || [],
            assertions: endpoint.assertions || [],
            transformations: endpoint.transformations || []
          }))
        })),
        endpoints: (flow as any).endpoints || []
      };

      const resolvedParameters: Record<string, unknown> = {};
      const parameterMappings = sequenceStep.parameter_mappings || [];
      
      onLog('debug', `Processing ${parameterMappings.length} parameter mapping(s) for flow ${flow.name}`);

      // Resolve each flow parameter
      for (const param of flowData.parameters) {
        onLog('debug', `Processing parameter '${param.name}' (required: ${param.required})`);
        
        // Check if there's a mapping for this parameter
        const mapping = parameterMappings.find(m => m.flow_parameter_name === param.name);
        
        if (mapping) {
          onLog('debug', `Found parameter mapping for '${param.name}': ${mapping.source_type} -> ${mapping.source_value}`);
          
          const resolvedValue = this.resolveParameterMapping(
            mapping, 
            accumulatedOutputs, 
            environmentVariables,
            onLog
          );
          
          if (resolvedValue !== undefined) {
            resolvedParameters[param.name] = resolvedValue;
          }
        } else {
          // Use parameter's default value if no mapping is provided
          if (param.defaultValue !== undefined) {
            onLog('debug', `Parameter '${param.name}' using flow default value`, String(param.defaultValue));
            resolvedParameters[param.name] = param.defaultValue;
          } else if (param.required) {
            onLog('warning', `Required parameter '${param.name}' has no mapping and no default value in flow ${flow.name}`);
          }
        }
      }

      onLog('info', `Resolved ${Object.keys(resolvedParameters).length} parameters for flow ${flow.name}`,
        `Parameters: ${Object.keys(resolvedParameters).join(', ')}`);

      return {
        flowData,
        resolvedParameters,
        environmentVariables
      };

    } catch (error) {
      onLog('error', `Failed to resolve parameters for flow ${flow.name}`,
        error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Resolve a single parameter mapping to its actual value
   * No template resolution supported in sequence execution - all values are concrete
   */
  private static resolveParameterMapping(
    mapping: FlowParameterMapping,
    accumulatedOutputs: Record<string, unknown>,
    environmentVariables: Record<string, unknown>,
    onLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void
  ): unknown {
    try {
      switch (mapping.source_type) {
        case 'environment_variable':
          // Directly resolve environment variable
          const envValue = environmentVariables[mapping.source_value];
          if (envValue !== undefined) {
            onLog('debug', `Environment variable '${mapping.source_value}' resolved to value`, String(envValue));
            return envValue;
          } else {
            onLog('warning', `Environment variable '${mapping.source_value}' not found for parameter '${mapping.flow_parameter_name}'`, 
              `Available environment variables: ${Object.keys(environmentVariables).join(', ')}`);
            return undefined;
          }

        case 'previous_output':
          if (!mapping.source_flow_step) {
            throw new Error(`Missing source_flow_step for previous_output mapping of parameter '${mapping.flow_parameter_name}'`);
          }
          
          const outputKey = `flow_${mapping.source_flow_step}`;
          const flowOutputs = accumulatedOutputs[outputKey] as Record<string, unknown>;
          
          if (!flowOutputs) {
            onLog('warning', `No outputs found from flow step ${mapping.source_flow_step} for parameter '${mapping.flow_parameter_name}'`);
            return undefined;
          }

          // Use the source_output_field or source_value to extract the value
          const outputField = mapping.source_output_field || mapping.source_value;
          return this.extractValueFromObject(flowOutputs, outputField, onLog);

        case 'static_value':
          // Convert to appropriate type if specified
          if (mapping.data_type) {
            return this.convertValueToType(mapping.source_value, mapping.data_type);
          }
          
          return mapping.source_value;

        default:
          throw new Error(`Unknown parameter mapping source type: ${mapping.source_type}`);
      }
    } catch (error) {
      onLog('error', `Failed to resolve parameter mapping for '${mapping.flow_parameter_name}'`,
        error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  /**
   * Convert a value to the specified type
   */
  private static convertValueToType(value: string, type: 'string' | 'number' | 'boolean'): unknown {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;
      case 'boolean':
        return value === 'true' || value === '1' || value === 'yes';
      default:
        return value;
    }
  }

  /**
   * Extract value from object using simple property lookup
   * Flow outputs are primitive types only, so just do direct property access
   */
  private static extractValueFromObject(
    obj: Record<string, unknown>, 
    propertyName: string,
    onLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void
  ): unknown {
    try {
      return obj[propertyName];
    } catch (error) {
      onLog('error', `Failed to extract property '${propertyName}' from object`,
        error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  /**
   * Check if a response contains an error indicator
   */
  static hasErrorInResponse(response: Record<string, unknown>): boolean {
    // Check for __error field or other error indicators
    if (response.__error !== undefined && response.__error !== null) {
      return true;
    }

    // Check for standard error fields
    if (response.error !== undefined && response.error !== null) {
      return true;
    }

    if (response.success === false) {
      return true;
    }

    return false;
  }

  /**
   * Extract error message from response
   */
  static getErrorFromResponse(response: Record<string, unknown>): string {
    if (response.__error) {
      return String(response.__error);
    }

    if (response.error) {
      return String(response.error);
    }

    if (response.message) {
      return String(response.message);
    }

    return 'Unknown error from API response';
  }
}
