import type {
  ResolvedFlowExecution,
  SequenceLoopExecutionContext,
  SequenceResolvedLoop
} from './types';
import type { TestFlowData, FlowStep, StepEndpoint } from '$lib/components/test-flows/types';
import type {
  FlowLoopDefinition,
  FlowLoopSource,
  FlowSequenceStep,
  FlowParameterMapping
} from '$lib/types/flow_sequence';
import { normalizeFlowLoopConfig } from '$lib/types/flow_sequence';
import type { Environment } from '$lib/types/environment';
import type { TestFlow } from '$lib/types/test-flow';
import type { Project } from '$lib/types/project';
import { defaultTemplateFunctions } from '$lib/template/functions';

export class SequenceParameterResolver {
  static isPrimitiveLoopValue(value: unknown): value is string | number | boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  /**
   * Build concrete environment variables for sequence execution.
   * Sub-environment values override variable definition defaults when present.
   */
  static getEnvironmentVariables(
    selectedEnvironment: Environment,
    selectedSubEnvironment: string
  ): Record<string, unknown> {
    const variableDefinitions = selectedEnvironment.config.variable_definitions || {};
    const variables: Record<string, unknown> = {};

    for (const [name, definition] of Object.entries(variableDefinitions)) {
      if (definition.default_value !== undefined) {
        variables[name] = definition.default_value;
      }
    }

    const subEnvironmentVariables =
      selectedEnvironment.config.environments[selectedSubEnvironment]?.variables || {};

    for (const [name, value] of Object.entries(subEnvironmentVariables)) {
      variables[name] = value;
    }

    return variables;
  }

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
    onLog: (
      level: 'info' | 'debug' | 'error' | 'warning',
      message: string,
      details?: string
    ) => void,
    loopContext?: SequenceLoopExecutionContext
  ): ResolvedFlowExecution {
    try {
      if (!flow.flowJson) {
        throw new Error(`Flow ${flow.name} (${flow.id}) has no flowJson data`);
      }

      onLog('debug', `Resolving parameters for flow ${flow.name}`);

      const flowData: TestFlowData = {
        settings: {
          api_hosts: Object.fromEntries(
            Object.entries(apiHosts).map(([apiId, url]) => [apiId, { url }])
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

      onLog(
        'debug',
        `Processing ${parameterMappings.length} parameter mapping(s) for flow ${flow.name}`
      );

      // Resolve each flow parameter
      for (const param of flowData.parameters) {
        onLog('debug', `Processing parameter '${param.name}' (required: ${param.required})`);

        // Check if there's a mapping for this parameter
        const mapping = parameterMappings.find((m) => m.flow_parameter_name === param.name);

        if (mapping) {
          onLog(
            'debug',
            `Found parameter mapping for '${param.name}': ${mapping.source_type} -> ${mapping.source_value}`
          );

          const resolvedValue = this.resolveParameterMapping(
            mapping,
            accumulatedOutputs,
            environmentVariables,
            onLog,
            loopContext
          );

          if (resolvedValue !== undefined) {
            resolvedParameters[param.name] = resolvedValue;
          }
        } else {
          // Use parameter's default value if no mapping is provided
          if (param.defaultValue !== undefined) {
            onLog(
              'debug',
              `Parameter '${param.name}' using flow default value`,
              String(param.defaultValue)
            );
            resolvedParameters[param.name] = param.defaultValue;
          } else if (param.required) {
            onLog(
              'warning',
              `Required parameter '${param.name}' has no mapping and no default value in flow ${flow.name}`
            );
          }
        }
      }

      onLog(
        'info',
        `Resolved ${Object.keys(resolvedParameters).length} parameters for flow ${flow.name}`,
        `Parameters: ${Object.keys(resolvedParameters).join(', ')}`
      );

      return {
        flowData,
        resolvedParameters,
        environmentVariables
      };
    } catch (error) {
      onLog(
        'error',
        `Failed to resolve parameters for flow ${flow.name}`,
        error instanceof Error ? error.message : String(error)
      );
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
    onLog: (
      level: 'info' | 'debug' | 'error' | 'warning',
      message: string,
      details?: string
    ) => void,
    loopContext?: SequenceLoopExecutionContext
  ): unknown {
    try {
      switch (mapping.source_type) {
        case 'environment_variable':
          // Directly resolve environment variable
          const envValue = environmentVariables[mapping.source_value];
          if (envValue !== undefined) {
            onLog(
              'debug',
              `Environment variable '${mapping.source_value}' resolved to value`,
              String(envValue)
            );
            return envValue;
          } else {
            onLog(
              'warning',
              `Environment variable '${mapping.source_value}' not found for parameter '${mapping.flow_parameter_name}'`,
              `Available environment variables: ${Object.keys(environmentVariables).join(', ')}`
            );
            return undefined;
          }

        case 'previous_output':
          if (!mapping.source_flow_step) {
            throw new Error(
              `Missing source_flow_step for previous_output mapping of parameter '${mapping.flow_parameter_name}'`
            );
          }

          const outputKey = `flow_${mapping.source_flow_step}`;
          const flowOutputs = accumulatedOutputs[outputKey] as Record<string, unknown>;

          if (!flowOutputs) {
            onLog(
              'warning',
              `No outputs found from flow step ${mapping.source_flow_step} for parameter '${mapping.flow_parameter_name}'`
            );
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

        case 'loop_value':
          let loopId = mapping.loop_id;
          let loopSourceId = mapping.loop_source_id;
          if (!loopId || !loopSourceId) {
            const loopIds = Object.keys(loopContext?.valuesByLoopId ?? {});
            const fallbackLoopId = loopIds.length === 1 ? loopIds[0] : undefined;
            const sourceIds = fallbackLoopId
              ? Object.keys(loopContext?.valuesByLoopId[fallbackLoopId]?.valuesBySourceId ?? {})
              : [];
            loopId = fallbackLoopId;
            loopSourceId = sourceIds.length === 1 ? sourceIds[0] : undefined;
          }

          if (!loopId || !loopSourceId) {
            onLog(
              'warning',
              `Loop value mapping for parameter '${mapping.flow_parameter_name}' is missing loop_id or loop_source_id`
            );
            return undefined;
          }

          const loopValue = loopContext?.valuesByLoopId[loopId]?.valuesBySourceId[loopSourceId];
          if (loopValue !== undefined) {
            onLog('debug', `Loop value resolved for parameter '${mapping.flow_parameter_name}'`);
            return loopValue;
          }

          onLog(
            'warning',
            `Loop value requested for parameter '${mapping.flow_parameter_name}', but no matching loop value is available`
          );
          return undefined;

        case 'function':
          // Execute template function
          try {
            onLog('debug', `Executing function: ${mapping.source_value}`);
            const result = this.executeTemplateFunction(mapping.source_value, onLog);
            onLog('debug', `Function '${mapping.source_value}' returned:`, String(result));
            return result;
          } catch (error) {
            onLog(
              'error',
              `Failed to execute function '${mapping.source_value}'`,
              error instanceof Error ? error.message : String(error)
            );
            return undefined;
          }

        default:
          throw new Error(`Unknown parameter mapping source type: ${mapping.source_type}`);
      }
    } catch (error) {
      onLog(
        'error',
        `Failed to resolve parameter mapping for '${mapping.flow_parameter_name}'`,
        error instanceof Error ? error.message : String(error)
      );
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
    onLog: (
      level: 'info' | 'debug' | 'error' | 'warning',
      message: string,
      details?: string
    ) => void
  ): unknown {
    try {
      return obj[propertyName];
    } catch (error) {
      onLog(
        'error',
        `Failed to extract property '${propertyName}' from object`,
        error instanceof Error ? error.message : String(error)
      );
      return undefined;
    }
  }

  static resolveLoopPlan(
    sequenceStep: FlowSequenceStep,
    accumulatedOutputs: Record<string, unknown>,
    environmentVariables: Record<string, unknown>,
    onLog: (
      level: 'info' | 'debug' | 'error' | 'warning',
      message: string,
      details?: string
    ) => void
  ): SequenceResolvedLoop | null {
    const loopConfig = normalizeFlowLoopConfig(sequenceStep.loop_config);

    if (!loopConfig?.enabled || !loopConfig.root) {
      return null;
    }

    return this.resolveLoopDefinition(
      loopConfig.root,
      accumulatedOutputs,
      environmentVariables,
      onLog
    );
  }

  private static resolveLoopDefinition(
    loop: FlowLoopDefinition,
    accumulatedOutputs: Record<string, unknown>,
    environmentVariables: Record<string, unknown>,
    onLog: (
      level: 'info' | 'debug' | 'error' | 'warning',
      message: string,
      details?: string
    ) => void
  ): SequenceResolvedLoop {
    if (!loop.sources?.length) {
      throw new Error(`Loop '${loop.name}' must have at least one source`);
    }

    const resolvedSources = loop.sources.map((source) => ({
      source,
      values: this.resolveLoopSource(source, accumulatedOutputs, environmentVariables, onLog)
    }));
    const expectedLength = resolvedSources[0].values.length;

    for (const { source, values } of resolvedSources.slice(1)) {
      if (values.length !== expectedLength) {
        throw new Error(
          `Loop '${loop.name}' zip source '${source.alias}' has ${values.length} value(s), expected ${expectedLength}`
        );
      }
    }

    const rows = Array.from({ length: expectedLength }, (_, index) => ({
      loopId: loop.id,
      loopName: loop.name,
      index,
      valuesBySourceId: Object.fromEntries(
        resolvedSources.map(({ source, values }) => [source.id, values[index]])
      ),
      sourceAliases: Object.fromEntries(loop.sources.map((source) => [source.id, source.alias]))
    }));

    return {
      loopId: loop.id,
      loopName: loop.name,
      rows,
      children: (loop.children ?? []).map((child) =>
        this.resolveLoopDefinition(child, accumulatedOutputs, environmentVariables, onLog)
      )
    };
  }

  private static resolveLoopSource(
    loopSource: FlowLoopSource,
    accumulatedOutputs: Record<string, unknown>,
    environmentVariables: Record<string, unknown>,
    onLog: (
      level: 'info' | 'debug' | 'error' | 'warning',
      message: string,
      details?: string
    ) => void
  ): Array<string | number | boolean> {
    switch (loopSource.source_type) {
      case 'fixed_count': {
        const count = Number(loopSource.count);
        if (!Number.isInteger(count) || count < 1) {
          throw new Error(`Loop source '${loopSource.alias}' count must be a positive integer`);
        }

        return Array.from({ length: count }, (_, index) => index);
      }

      case 'environment_variable_array': {
        if (!loopSource.source_value) {
          throw new Error(`Loop source '${loopSource.alias}' environment variable is required`);
        }

        const value = environmentVariables[loopSource.source_value];
        return this.validatePrimitiveArray(
          value,
          `environment variable '${loopSource.source_value}'`
        );
      }

      case 'previous_output_array': {
        if (!loopSource.source_flow_step) {
          throw new Error(`Loop source '${loopSource.alias}' source flow step is required`);
        }

        const outputKey = `flow_${loopSource.source_flow_step}`;
        const flowOutputs = accumulatedOutputs[outputKey] as Record<string, unknown> | undefined;

        if (!flowOutputs) {
          throw new Error(`No outputs found from flow step ${loopSource.source_flow_step}`);
        }

        const outputField = loopSource.source_output_field || loopSource.source_value;
        if (!outputField) {
          throw new Error(`Loop source '${loopSource.alias}' output field is required`);
        }

        const value = this.extractValueFromObject(flowOutputs, outputField, onLog);
        return this.validatePrimitiveArray(
          value,
          `output '${outputField}' from step ${loopSource.source_flow_step}`
        );
      }

      default:
        throw new Error(`Unknown loop source type: ${loopSource.source_type}`);
    }
  }

  private static validatePrimitiveArray(
    value: unknown,
    sourceDescription: string
  ): Array<string | number | boolean> {
    if (!Array.isArray(value)) {
      throw new Error(`Loop source ${sourceDescription} must be an array`);
    }

    const invalidIndex = value.findIndex((item) => !this.isPrimitiveLoopValue(item));
    if (invalidIndex !== -1) {
      throw new Error(
        `Loop source ${sourceDescription} must contain only string, number, or boolean values`
      );
    }

    return value;
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
   * Execute a template function expression
   * Supports simple function calls like uuid(), dateISO(), etc.
   */
  private static executeTemplateFunction(
    expression: string,
    onLog: (
      level: 'info' | 'debug' | 'error' | 'warning',
      message: string,
      details?: string
    ) => void
  ): unknown {
    try {
      // Simple validation - must be a function call pattern
      const functionPattern = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)\s*$/;
      const match = expression.trim().match(functionPattern);

      if (!match) {
        throw new Error(
          `Invalid function expression: ${expression}. Expected format: functionName(args)`
        );
      }

      const [, functionName, argsString] = match;

      // Check if function exists in our template functions
      const templateFunction = defaultTemplateFunctions[functionName];
      if (!templateFunction) {
        throw new Error(
          `Unknown function: ${functionName}. Available functions: ${Object.keys(defaultTemplateFunctions).join(', ')}`
        );
      }

      // Parse arguments
      const args = this.parseArgumentsString(argsString);

      // Execute the function
      const result = templateFunction(...args);

      onLog(
        'debug',
        `Function ${functionName} executed successfully with ${args.length} argument(s)`
      );

      return result;
    } catch (error) {
      onLog(
        'error',
        `Failed to execute template function '${expression}'`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Parse function arguments from string
   * Supports: strings ('text', "text"), numbers (123, 1.5), booleans (true, false), null
   */
  private static parseArgumentsString(argsString: string): unknown[] {
    if (!argsString.trim()) {
      return [];
    }

    const args: unknown[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    let parenDepth = 0;

    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];

      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
          current += char;
        } else if (char === '(') {
          parenDepth++;
          current += char;
        } else if (char === ')') {
          parenDepth--;
          current += char;
        } else if (char === ',' && parenDepth === 0) {
          // End of argument
          args.push(this.parseArgument(current.trim()));
          current = '';
        } else {
          current += char;
        }
      } else {
        current += char;
        if (char === stringChar && (i === 0 || argsString[i - 1] !== '\\')) {
          inString = false;
        }
      }
    }

    // Add the last argument
    if (current.trim()) {
      args.push(this.parseArgument(current.trim()));
    }

    return args;
  }

  /**
   * Parse a single argument value
   */
  private static parseArgument(arg: string): unknown {
    arg = arg.trim();

    // String literals
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
      return arg.slice(1, -1); // Remove quotes
    }

    // Number literals
    if (/^-?\d+(\.\d+)?$/.test(arg)) {
      const num = Number(arg);
      return isNaN(num) ? arg : num;
    }

    // Boolean literals
    if (arg === 'true') return true;
    if (arg === 'false') return false;

    // Null literal
    if (arg === 'null') return null;

    // Default to string
    return arg;
  }
}
