import type {
  FlowParameter,
  TestFlowData,
  EnvironmentMapping
} from '$lib/components/test-flows/types';

export interface ResolvedFlowParameter {
  name: string;
  value: unknown;
  source: 'environment' | 'default';
  sourceName?: string;
}

export interface ParameterManagerContext {
  flowData: TestFlowData;
  environmentVariables: Record<string, unknown>;
  selectedEnvironment: import('$lib/types/environment').Environment | null;
  addLog: (
    level: 'info' | 'debug' | 'error' | 'warning',
    message: string,
    details?: string
  ) => void;
}

export class ParameterManager {
  private context: ParameterManagerContext;

  constructor(context: ParameterManagerContext) {
    this.context = context;
  }

  prepareParameters(): Record<string, unknown> {
    const selectedEnvMapping = this.getSelectedEnvironmentMapping();
    const parameterMappings = selectedEnvMapping?.parameterMappings ?? {};
    const resolvedParameters = resolveFlowParameterValues(
      this.context.flowData,
      this.context.environmentVariables
    );

    this.context.addLog(
      'debug',
      `Evaluating parameters for execution. Environment mapping: ${
        selectedEnvMapping
          ? `${selectedEnvMapping.environmentName} (${Object.keys(parameterMappings).length} mappings)`
          : 'None'
      }`
    );

    const parameterValues: Record<string, unknown> = {};
    const resolvedByName = new Map(
      resolvedParameters.map((parameter) => [parameter.name, parameter])
    );

    this.context.flowData.parameters.forEach((parameter) => {
      const envVariableName = parameterMappings[parameter.name];
      const resolvedParameter = resolvedByName.get(parameter.name);

      if (envVariableName && resolvedParameter?.source !== 'environment') {
        this.context.addLog(
          'warning',
          `Environment variable '${envVariableName}' not found for parameter '${parameter.name}', falling back to default value`
        );
      }

      if (resolvedParameter?.source === 'environment') {
        this.context.addLog(
          'debug',
          `Parameter '${parameter.name}' resolved from environment variable '${resolvedParameter.sourceName}'`,
          formatParameterValueForLog(parameter.name, resolvedParameter.value)
        );
      } else if (resolvedParameter?.source === 'default') {
        this.context.addLog(
          'debug',
          `Parameter '${parameter.name}' using default value`,
          formatParameterValueForLog(parameter.name, parameter.defaultValue)
        );
      }

      if (resolvedParameter) {
        parameterValues[parameter.name] = resolvedParameter.value;
        const source =
          resolvedParameter.source === 'environment'
            ? `environment variable '${resolvedParameter.sourceName}'`
            : 'default value';
        this.context.addLog(
          'info',
          `Parameter '${parameter.name}' = ${formatParameterValueForLog(parameter.name, resolvedParameter.value)} (from ${source})`
        );
      } else {
        this.context.addLog(
          'warning',
          `Parameter '${parameter.name}' has no value - will be treated as missing if required`
        );
      }
    });

    this.context.addLog(
      'debug',
      'Final ephemeral parameter values for this execution',
      JSON.stringify(sanitizeParameterValuesForLog(parameterValues), null, 2)
    );
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
          this.context.addLog(
            'warning',
            `Required parameter '${parameter.name}' is missing value after environment/default evaluation`
          );
        }
      }
    });

    if (parametersWithMissingValues.length > 0) {
      this.context.addLog(
        'info',
        `${parametersWithMissingValues.length} required parameters need manual input: ${parametersWithMissingValues.map((p) => p.name).join(', ')}`
      );
    }

    return parametersWithMissingValues;
  }

  updateParameterValues(
    parametersWithMissingValues: FlowParameter[],
    parameterValues: Record<string, unknown>
  ): Record<string, unknown> {
    const updatedValues = { ...parameterValues };

    parametersWithMissingValues.forEach((parameter) => {
      if (parameter.value !== undefined && parameter.value !== null) {
        updatedValues[parameter.name] = parameter.value;
        this.context.addLog(
          'info',
          `User provided value for required parameter '${parameter.name}'`,
          formatParameterValueForLog(parameter.name, parameter.value)
        );
      }
    });

    return updatedValues;
  }

  private getSelectedEnvironmentMapping(): EnvironmentMapping | null {
    if (
      !this.context.flowData.settings.linkedEnvironment ||
      !this.context.flowData.settings.environment
    ) {
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

const REDACTED_LOG_VALUE = '[REDACTED]';
const SENSITIVE_PARAMETER_NAME_PATTERN =
  /(^|[_\-.])(auth|authorization|cookie|credential|key|pass|password|secret|session|token)([_\-.]|$)|api[_\-.]?key/i;

function isSensitiveParameterName(name: string): boolean {
  return SENSITIVE_PARAMETER_NAME_PATTERN.test(name);
}

function formatParameterValueForLog(name: string, value: unknown): string {
  if (isSensitiveParameterName(name)) {
    return REDACTED_LOG_VALUE;
  }

  return JSON.stringify(value);
}

function sanitizeParameterValuesForLog(
  parameterValues: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(parameterValues).map(([name, value]) => [
      name,
      isSensitiveParameterName(name) ? REDACTED_LOG_VALUE : value
    ])
  );
}

export function resolveFlowParameterValues(
  flowData: Pick<TestFlowData, 'parameters' | 'settings'>,
  environmentVariables: Record<string, unknown>
): ResolvedFlowParameter[] {
  const selectedEnvMapping = getSelectedEnvironmentMapping(flowData);
  const resolvedParameters: ResolvedFlowParameter[] = [];
  const parameterMappings = selectedEnvMapping?.parameterMappings ?? {};

  for (const parameter of flowData.parameters || []) {
    const envVariableName = parameterMappings[parameter.name];
    const envValue = envVariableName ? environmentVariables[envVariableName] : undefined;

    if (envValue !== undefined && envValue !== null) {
      resolvedParameters.push({
        name: parameter.name,
        value: envValue,
        source: 'environment',
        sourceName: envVariableName
      });
      continue;
    }

    if (parameter.defaultValue !== undefined && parameter.defaultValue !== null) {
      resolvedParameters.push({
        name: parameter.name,
        value: parameter.defaultValue,
        source: 'default'
      });
    }
  }

  return resolvedParameters;
}

function getSelectedEnvironmentMapping(
  flowData: Pick<TestFlowData, 'settings'>
): EnvironmentMapping | null {
  if (!flowData.settings.linkedEnvironment || !flowData.settings.environment) {
    return null;
  }

  const selectedEnvId = flowData.settings.environment.environmentId;
  if (flowData.settings.linkedEnvironment.environmentId === selectedEnvId) {
    return flowData.settings.linkedEnvironment;
  }
  return null;
}
