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
    selectedEnvironment: Environment | null,
    selectedSubEnvironment: string | null,
    project: Project | null,
    onLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void
  ): ResolvedFlowExecution {
    try {
      if (!flow.flowJson) {
        throw new Error(`Flow ${flow.name} (${flow.id}) has no flowJson data`);
      }

      onLog('debug', `Resolving parameters for flow ${flow.name}`, 
        `Selected environment: ${selectedEnvironment?.name || 'None'}, Sub-env: ${selectedSubEnvironment || 'None'}`);

      const flowData: TestFlowData = {
        settings: {
          api_hosts: project ? this.resolveApiHosts(selectedEnvironment, selectedSubEnvironment, project, onLog) : {},
          // All parameters resolved to concrete values, no environment info needed
          environment: undefined,
          linkedEnvironments: undefined
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
            selectedEnvironment,
            project,
            onLog
          );
          
          if (resolvedValue !== undefined) {
            resolvedParameters[param.name] = resolvedValue;
          }
        } else {
          onLog('debug', `No parameter mapping found for '${param.name}', checking for project variable match`);
          
          // Check if this parameter name matches a project variable
          if (project?.projectJson?.variables) {
            const matchingProjectVar = project.projectJson.variables.find(v => v.name === param.name);
            if (matchingProjectVar) {
              onLog('debug', `Parameter '${param.name}' matches project variable, resolving as project variable`);
              const resolvedValue = this.resolveProjectVariable(
                param.name,
                environmentVariables,
                selectedEnvironment,
                project,
                onLog
              );
              
              if (resolvedValue !== undefined) {
                resolvedParameters[param.name] = resolvedValue;
                continue;
              }
            }
          }
          
          // Use parameter's default value if no mapping is provided and no project variable match
          if (param.defaultValue !== undefined) {
            onLog('debug', `Parameter '${param.name}' using flow default value`, String(param.defaultValue));
            resolvedParameters[param.name] = param.defaultValue;
          } else if (param.required) {
            onLog('warning', `Required parameter '${param.name}' has no mapping, no project variable match, and no default value in flow ${flow.name}`);
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
    selectedEnvironment: Environment | null,
    project: Project | null,
    onLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void
  ): unknown {
    try {
      switch (mapping.source_type) {
        case 'project_variable':
          // Resolve project variable with proper chaining: project variable -> environment variable
          return this.resolveProjectVariable(
            mapping.source_value,
            environmentVariables,
            selectedEnvironment,
            project,
            onLog
          );

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

  /**
   * Resolve project variable with proper environment variable chaining
   */
  private static resolveProjectVariable(
    projectVariableName: string,
    environmentVariables: Record<string, unknown>,
    selectedEnvironment: Environment | null,
    project: Project | null,
    onLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void
  ): unknown {
    try {
      // Step 1: Find the project variable definition
      if (!project || !project.projectJson || !project.projectJson.variables) {
        onLog('warning', `No project variables found for project variable '${projectVariableName}'`);
        return undefined;
      }

      const projectVariable = project.projectJson.variables.find(v => v.name === projectVariableName);
      if (!projectVariable) {
        onLog('warning', `Project variable '${projectVariableName}' not found in project configuration`);
        return undefined;
      }

      onLog('debug', `Found project variable '${projectVariableName}' with default value`, String(projectVariable.default_value));

      // Step 2: Check if there's an environment mapping for this project variable
      if (selectedEnvironment) {
        onLog('debug', `Checking environment mappings for environment ID ${selectedEnvironment.id}`);
        
        if (project.projectJson.environment_mappings) {
          onLog('debug', `Project has ${project.projectJson.environment_mappings.length} environment mapping(s)`);
          
          const environmentMapping = project.projectJson.environment_mappings.find(
            m => m.environment_id === selectedEnvironment.id
          );

          if (environmentMapping) {
            onLog('debug', `Found environment mapping for environment ${selectedEnvironment.id}`, 
              `Available variable mappings: ${Object.keys(environmentMapping.variable_mappings).join(', ')}`);
            
            if (environmentMapping.variable_mappings[projectVariableName]) {
              // There's a mapping from project variable to environment variable
              const envVariableName = environmentMapping.variable_mappings[projectVariableName];
              onLog('debug', `Project variable '${projectVariableName}' mapped to environment variable '${envVariableName}'`);
              
              const envValue = environmentVariables[envVariableName];

              if (envValue !== undefined) {
                onLog('debug', `Project variable '${projectVariableName}' resolved from environment variable '${envVariableName}'`, String(envValue));
                onLog('info', `Parameter '${projectVariableName}' = ${JSON.stringify(envValue)} (from environment variable '${envVariableName}')`);
                return envValue;
              } else {
                onLog('warning', `Environment variable '${envVariableName}' not found for project variable '${projectVariableName}', falling back to default value`, 
                  `Available environment variables: ${Object.keys(environmentVariables).join(', ')}`);
              }
            } else {
              onLog('debug', `No mapping found for project variable '${projectVariableName}' in environment mapping`);
            }
          } else {
            onLog('debug', `No environment mapping found for environment ID ${selectedEnvironment.id}`);
          }
        } else {
          onLog('debug', `Project has no environment_mappings configuration`);
        }
      } else {
        onLog('debug', `No environment selected for project variable resolution`);
      }

      // Step 3: Fall back to project variable's default value
      if (projectVariable.default_value !== undefined && projectVariable.default_value !== null) {
        onLog('debug', `Project variable '${projectVariableName}' using default value`, String(projectVariable.default_value));
        onLog('info', `Parameter '${projectVariableName}' = ${JSON.stringify(projectVariable.default_value)} (from default value)`);
        return projectVariable.default_value;
      }

      onLog('warning', `Project variable '${projectVariableName}' has no environment mapping and no default value`);
      return undefined;

    } catch (error) {
      onLog('error', `Failed to resolve project variable '${projectVariableName}'`,
        error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  /**
   * Resolve API hosts based on environment selection with fallback to project defaults
   */
  static resolveApiHosts(
    selectedEnvironment: Environment | null,
    selectedSubEnvironment: string | null,
    project: Project | null,
    onLog: (level: 'info' | 'debug' | 'error', message: string, details?: string) => void
  ): Record<string | number, { url: string; name?: string; description?: string }> {
    const apiHosts: Record<string | number, { url: string; name?: string; description?: string }> = {};

    // Add project default API hosts first (as fallback)
    if (project?.projectJson?.api_hosts) {
      Object.entries(project.projectJson.api_hosts).forEach(([key, apiHostConfig]) => {
        const apiId = String(apiHostConfig.api_id);
        apiHosts[apiId] = {
          url: apiHostConfig.default_host,
          name: apiHostConfig.name,
          description: 'Project default host'
        };
      });
      onLog('debug', `Added ${Object.keys(project.projectJson.api_hosts).length} project default API host(s)`, 
        `Host URLs: ${Object.values(project.projectJson.api_hosts).map(h => h.default_host).join(', ')}`);
    } else {
      onLog('debug', 'No project API hosts found in project configuration');
    }

    // If environment is selected and has API hosts, override project defaults
    if (selectedEnvironment?.config?.environments && selectedSubEnvironment) {
      // Check for environment-specific API hosts in the selected sub-environment
      const subEnv = selectedEnvironment.config.environments[selectedSubEnvironment];
      if (subEnv?.api_hosts && Object.keys(subEnv.api_hosts).length > 0) {
        let envApiHostsFound = 0;
        Object.entries(subEnv.api_hosts).forEach(([apiId, hostUrl]) => {
          // Override project default with environment-specific host
          apiHosts[apiId] = {
            url: hostUrl,
            name: apiHosts[apiId]?.name || `API ${apiId}`,
            description: `Environment ${selectedEnvironment.name} (${selectedSubEnvironment}) host`
          };
          envApiHostsFound++;
        });
        
        if (envApiHostsFound > 0) {
          onLog('debug', `Overrode ${envApiHostsFound} API host(s) with environment-specific hosts`, 
            `Environment: ${selectedEnvironment.name} (${selectedSubEnvironment})`);
        }
      } else {
        onLog('debug', `No API hosts found in selected sub-environment`, 
          `Environment: ${selectedEnvironment.name} (${selectedSubEnvironment})`);
      }
    }

    // Log final API host count
    const totalApiHosts = Object.keys(apiHosts).length;
    if (totalApiHosts === 0) {
      onLog('error', 'No API hosts configured', 
        'Either configure project default API hosts or environment-specific API hosts');
    } else {
      onLog('info', `Resolved ${totalApiHosts} API host(s) for flow execution`, 
        `APIs: ${Object.keys(apiHosts).join(', ')}`);
    }

    return apiHosts;
  }
}
