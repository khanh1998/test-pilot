import type { FlowParameter, TestFlowData, EnvironmentMapping } from '$lib/components/test-flows/types';

export interface ParameterManagerContext {
  flowData: TestFlowData;
  environmentVariables: Record<string, unknown>;
  selectedEnvironment: import('$lib/types/environment').Environment | null;
  addLog: (level: 'info' | 'debug' | 'error' | 'warning', message: string, details?: string) => void;
}

export class ParameterManager {
  private context: ParameterManagerContext;

  constructor(context: ParameterManagerContext) {
    this.context = context;
  }

  prepareParameters(): Record<string, unknown> {
    const parameterValues: Record<string, unknown> = {};
    const selectedEnvMapping = this.getSelectedEnvironmentMapping();

    this.context.addLog('debug', `Evaluating parameters for execution. Environment mapping: ${selectedEnvMapping ? 
      `${selectedEnvMapping.environmentName} (${Object.keys(selectedEnvMapping.parameterMappings).length} mappings)` : 'None'}`);

    this.context.flowData.parameters.forEach((parameter) => {
      let resolvedValue = null;
      let source = 'none';

      // Priority 1: Check if this parameter is mapped to an environment variable
      if (selectedEnvMapping && selectedEnvMapping.parameterMappings[parameter.name]) {
        const envVariableName = selectedEnvMapping.parameterMappings[parameter.name];
        const envValue = this.context.environmentVariables[envVariableName];
        
        if (envValue !== undefined && envValue !== null) {
          resolvedValue = envValue;
          source = `environment variable '${envVariableName}'`;
          this.context.addLog('debug', `Parameter '${parameter.name}' resolved from environment variable '${envVariableName}'`, String(envValue));
        } else {
          this.context.addLog('warning', `Environment variable '${envVariableName}' not found for parameter '${parameter.name}', falling back to default value`);
        }
      }

      // Priority 2: Use default value if no environment value was found
      if (resolvedValue === null && parameter.defaultValue !== undefined && parameter.defaultValue !== null) {
        resolvedValue = parameter.defaultValue;
        source = 'default value';
        this.context.addLog('debug', `Parameter '${parameter.name}' using default value`, String(parameter.defaultValue));
      }

      // Store the resolved value (ephemeral - not saved to database)
      if (resolvedValue !== null) {
        parameterValues[parameter.name] = resolvedValue;
        this.context.addLog('info', `Parameter '${parameter.name}' = ${JSON.stringify(resolvedValue)} (from ${source})`);
      } else {
        this.context.addLog('warning', `Parameter '${parameter.name}' has no value - will be treated as missing if required`);
      }
    });

    this.context.addLog('debug', 'Final ephemeral parameter values for this execution', JSON.stringify(parameterValues, null, 2));
    return parameterValues;
  }

  checkRequiredParameters(parameterValues: Record<string, unknown>): FlowParameter[] {
    const parametersWithMissingValues: FlowParameter[] = [];

    this.context.flowData.parameters.forEach((parameter) => {
      if (parameter.required) {
        const resolvedValue = parameterValues[parameter.name];
        
        if (resolvedValue === undefined || resolvedValue === null) {
          parametersWithMissingValues.push({ 
            ...parameter,
            value: null
          });
          this.context.addLog('warning', `Required parameter '${parameter.name}' is missing value after environment/default evaluation`);
        }
      }
    });

    if (parametersWithMissingValues.length > 0) {
      this.context.addLog('info', `${parametersWithMissingValues.length} required parameters need manual input: ${parametersWithMissingValues.map(p => p.name).join(', ')}`);
    }

    return parametersWithMissingValues;
  }

  updateParameterValues(parametersWithMissingValues: FlowParameter[], parameterValues: Record<string, unknown>): Record<string, unknown> {
    const updatedValues = { ...parameterValues };

    parametersWithMissingValues.forEach((parameter) => {
      if (parameter.value !== undefined && parameter.value !== null) {
        updatedValues[parameter.name] = parameter.value;
        this.context.addLog('info', `User provided value for required parameter '${parameter.name}'`, String(parameter.value));
      }
    });

    return updatedValues;
  }

  private getSelectedEnvironmentMapping(): EnvironmentMapping | null {
    if (!this.context.flowData.settings.linkedEnvironment || !this.context.flowData.settings.environment) {
      return null;
    }

    const selectedEnvId = this.context.flowData.settings.environment.environmentId;
    // Since we only have one environment per project now, check if it matches
    if (this.context.flowData.settings.linkedEnvironment.environmentId === selectedEnvId) {
      return this.context.flowData.settings.linkedEnvironment;
    }
    return null;
  }
}
