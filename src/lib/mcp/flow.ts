import { randomUUID } from 'node:crypto';
import { FlowValidator } from '$lib/flow-runner/validator';
import type {
  TestFlowData,
  FlowStep,
  StepEndpoint,
  FlowParameter,
  EnvironmentMapping,
  FlowOutput
} from '$lib/components/test-flows/types';
import type { Assertion } from '$lib/assertions/types';
import {
  explainAssertion,
  explainTemplateExpression,
  explainTransformationExpression
} from './explain';
import { suggestTemplateExpression } from './explain';

export interface FlowDocument {
  sourceFlowId?: number;
  name: string;
  description?: string;
  projectId?: number;
  apiIds?: number[];
  environmentId?: number;
  flowData: TestFlowData;
}

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const primitiveTypes = new Set(['string', 'number', 'boolean', 'null']);

function isPrimitiveType(type: string | undefined): boolean {
  return !type || primitiveTypes.has(type);
}

function templateExpressions(input: string): string[] {
  return input.match(/\{\{\{[^}]+\}\}\}|\{\{[^}]+\}\}/g) ?? [];
}

export interface ExpectationInput {
  kind: 'status_success' | 'field_exists' | 'field_type' | 'equals' | 'response_time_under';
  source?: 'response' | 'transformed_data';
  jsonPath?: string;
  headerName?: string;
  expectedType?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  expectedValue?: unknown;
  maxMs?: number;
  id?: string;
  enabled?: boolean;
}

export interface AddStepInput {
  step_id?: string;
  label: string;
  endpoints?: StepEndpoint[];
  timeout?: number;
  clearCookiesBeforeExecution?: boolean;
}

export interface UpdateStepInput {
  stepId: string;
  label?: string;
  endpoints?: StepEndpoint[];
  timeout?: number;
  clearCookiesBeforeExecution?: boolean;
}

export function createFlowDraft(input: {
  name: string;
  description?: string;
  projectId?: number;
  apiIds?: number[];
  environmentId?: number;
  subEnvironment?: string;
  apiHosts?: TestFlowData['settings']['api_hosts'];
  parameters?: TestFlowData['parameters'];
  outputs?: TestFlowData['outputs'];
  endpoints?: TestFlowData['endpoints'];
}): FlowDocument {
  return {
    name: input.name,
    description: input.description,
    projectId: input.projectId,
    apiIds: input.apiIds,
    environmentId: input.environmentId,
    flowData: {
      settings: {
        api_hosts: input.apiHosts ?? {},
        environment:
          input.environmentId !== undefined
            ? {
                environmentId: input.environmentId,
                subEnvironment: input.subEnvironment ?? null
              }
            : undefined
      },
      parameters: input.parameters ?? [],
      outputs: input.outputs ?? [],
      steps: [],
      endpoints: input.endpoints ?? []
    }
  };
}

export function addStepToFlow(document: FlowDocument, input: AddStepInput): FlowDocument {
  if (document.apiIds?.length && input.endpoints?.length) {
    for (const endpoint of input.endpoints) {
      const apiId = typeof endpoint.api_id === 'string' ? Number(endpoint.api_id) : endpoint.api_id;
      if (typeof apiId === 'number' && !Number.isNaN(apiId) && !document.apiIds.includes(apiId)) {
        throw new Error(
          `Endpoint ${endpoint.endpoint_id} uses api_id ${apiId}, which is outside this draft's selected API scope (${document.apiIds.join(', ')}).`
        );
      }
    }
  }

  const nextIndex = document.flowData.steps.length + 1;
  const nextStep: FlowStep = {
    step_id: input.step_id ?? `step${nextIndex}`,
    label: input.label,
    endpoints: input.endpoints ?? [],
    timeout: input.timeout,
    clearCookiesBeforeExecution: input.clearCookiesBeforeExecution
  };

  return {
    ...document,
    flowData: {
      ...document.flowData,
      steps: [...document.flowData.steps, nextStep]
    }
  };
}

export function updateStepInFlow(document: FlowDocument, input: UpdateStepInput): FlowDocument {
  const next = cloneDocument(document);
  const stepIndex = next.flowData.steps.findIndex((step) => step.step_id === input.stepId);
  if (stepIndex < 0) {
    throw new Error(`Step ${input.stepId} was not found.`);
  }

  if (document.apiIds?.length && input.endpoints?.length) {
    for (const endpoint of input.endpoints) {
      const apiId = typeof endpoint.api_id === 'string' ? Number(endpoint.api_id) : endpoint.api_id;
      if (typeof apiId === 'number' && !Number.isNaN(apiId) && !document.apiIds.includes(apiId)) {
        throw new Error(
          `Endpoint ${endpoint.endpoint_id} uses api_id ${apiId}, which is outside this draft's selected API scope (${document.apiIds.join(', ')}).`
        );
      }
    }
  }

  const current = next.flowData.steps[stepIndex];
  next.flowData.steps[stepIndex] = {
    ...current,
    label: input.label ?? current.label,
    endpoints: input.endpoints ?? current.endpoints,
    timeout: input.timeout ?? current.timeout,
    clearCookiesBeforeExecution:
      input.clearCookiesBeforeExecution ?? current.clearCookiesBeforeExecution
  };

  return next;
}

function cloneDocument(document: FlowDocument): FlowDocument {
  return {
    ...document,
    flowData: structuredClone(document.flowData)
  };
}

function getStep(document: FlowDocument, stepId: string): FlowStep {
  const step = document.flowData.steps.find((item) => item.step_id === stepId);
  if (!step) {
    throw new Error(`Step ${stepId} was not found.`);
  }
  return step;
}

function getEndpoint(document: FlowDocument, stepId: string, endpointIndex = 0): StepEndpoint {
  const step = getStep(document, stepId);
  const endpoint = step.endpoints[endpointIndex];
  if (!endpoint) {
    throw new Error(`Endpoint index ${endpointIndex} was not found on step ${stepId}.`);
  }
  return endpoint;
}

function setByPath(target: Record<string, unknown>, fieldPath: string, value: unknown): void {
  const segments = fieldPath.split('.').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('fieldPath is required');
  }

  let current: Record<string, unknown> = target;
  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
}

export function setBodyField(
  document: FlowDocument,
  input: {
    stepId: string;
    endpointIndex?: number;
    fieldPath: string;
    value: unknown;
  }
): FlowDocument {
  const next = cloneDocument(document);
  const endpoint = getEndpoint(next, input.stepId, input.endpointIndex ?? 0);
  const body =
    endpoint.body && typeof endpoint.body === 'object' && !Array.isArray(endpoint.body)
      ? (endpoint.body as Record<string, unknown>)
      : {};
  setByPath(body, input.fieldPath, input.value);
  endpoint.body = body;
  return next;
}

export function setQueryParam(
  document: FlowDocument,
  input: {
    stepId: string;
    endpointIndex?: number;
    name: string;
    value: string | string[];
  }
): FlowDocument {
  const next = cloneDocument(document);
  const endpoint = getEndpoint(next, input.stepId, input.endpointIndex ?? 0);
  endpoint.queryParams = endpoint.queryParams ?? {};
  endpoint.queryParams[input.name] = input.value;
  return next;
}

export function setPathParam(
  document: FlowDocument,
  input: {
    stepId: string;
    endpointIndex?: number;
    name: string;
    value: string;
  }
): FlowDocument {
  const next = cloneDocument(document);
  const endpoint = getEndpoint(next, input.stepId, input.endpointIndex ?? 0);
  endpoint.pathParams = endpoint.pathParams ?? {};
  endpoint.pathParams[input.name] = input.value;
  return next;
}

export function setHeader(
  document: FlowDocument,
  input: {
    stepId: string;
    endpointIndex?: number;
    name: string;
    value: string;
    enabled?: boolean;
  }
): FlowDocument {
  const next = cloneDocument(document);
  const endpoint = getEndpoint(next, input.stepId, input.endpointIndex ?? 0);
  const headers = endpoint.headers ?? [];
  const filtered = headers.filter(
    (header) => header.name.toLowerCase() !== input.name.toLowerCase()
  );
  filtered.push({
    name: input.name,
    value: input.value,
    enabled: input.enabled ?? true
  });
  endpoint.headers = filtered;
  return next;
}

export function addAssertionToFlow(
  document: FlowDocument,
  input: {
    stepId: string;
    endpointIndex?: number;
    assertion: Assertion;
  }
): FlowDocument {
  const next = cloneDocument(document);
  const endpoint = getEndpoint(next, input.stepId, input.endpointIndex ?? 0);
  endpoint.assertions = [...(endpoint.assertions ?? []), input.assertion];
  return next;
}

function slugifyExpectationId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export function createExpectationAssertion(input: ExpectationInput): Assertion {
  const enabled = input.enabled ?? true;

  if (input.kind === 'status_success') {
    return {
      id: input.id ?? 'assert_status_success',
      enabled,
      data_source: 'response',
      assertion_type: 'status_code',
      data_id: 'status_code',
      operator: 'between',
      expected_value: [200, 299]
    };
  }

  if (input.kind === 'response_time_under') {
    if (typeof input.maxMs !== 'number' || Number.isNaN(input.maxMs)) {
      throw new Error('response_time_under expectations require maxMs.');
    }

    return {
      id: input.id ?? `assert_response_time_under_${input.maxMs}`,
      enabled,
      data_source: 'response',
      assertion_type: 'response_time',
      data_id: 'response_time',
      operator: 'less_than_or_equal',
      expected_value: input.maxMs
    };
  }

  const dataSource = input.source ?? 'response';
  const dataId =
    input.kind === 'equals' && input.headerName
      ? input.headerName
      : (input.jsonPath ?? input.headerName);

  if (!dataId) {
    throw new Error(`${input.kind} expectations require jsonPath or headerName.`);
  }

  const assertionType = input.headerName ? 'header' : 'json_body';

  if (input.kind === 'field_exists') {
    return {
      id: input.id ?? `assert_${slugifyExpectationId(dataId)}_exists`,
      enabled,
      data_source: dataSource,
      assertion_type: assertionType,
      data_id: dataId,
      operator: 'exists',
      expected_value: true
    };
  }

  if (input.kind === 'field_type') {
    if (!input.expectedType) {
      throw new Error('field_type expectations require expectedType.');
    }

    return {
      id: input.id ?? `assert_${slugifyExpectationId(dataId)}_type`,
      enabled,
      data_source: dataSource,
      assertion_type: assertionType,
      data_id: dataId,
      operator: 'is_type',
      expected_value: input.expectedType
    };
  }

  if (input.kind === 'equals') {
    return {
      id:
        input.id ??
        `assert_${slugifyExpectationId(dataId)}_equals_${slugifyExpectationId(String(input.expectedValue ?? 'value')) || randomUUID()}`,
      enabled,
      data_source: dataSource,
      assertion_type: assertionType,
      data_id: dataId,
      operator: 'equals',
      expected_value: input.expectedValue
    };
  }

  throw new Error(`Unsupported expectation kind: ${input.kind}`);
}

export function addFlowParameter(document: FlowDocument, parameter: FlowParameter): FlowDocument {
  const next = cloneDocument(document);
  const existingIndex = next.flowData.parameters.findIndex((item) => item.name === parameter.name);

  if (existingIndex >= 0) {
    next.flowData.parameters[existingIndex] = parameter;
  } else {
    next.flowData.parameters.push(parameter);
  }

  return next;
}

export function addTransformationToFlow(
  document: FlowDocument,
  input: {
    stepId: string;
    endpointIndex?: number;
    alias: string;
    expression: string;
  }
): FlowDocument {
  const next = cloneDocument(document);
  const endpoint = getEndpoint(next, input.stepId, input.endpointIndex ?? 0);
  const transformations = endpoint.transformations ?? [];
  const existingIndex = transformations.findIndex((item) => item.alias === input.alias);
  const transformation = {
    alias: input.alias,
    expression: input.expression
  };

  if (existingIndex >= 0) {
    transformations[existingIndex] = transformation;
  } else {
    transformations.push(transformation);
  }

  endpoint.transformations = transformations;
  return next;
}

export function setFlowOutput(document: FlowDocument, output: FlowOutput): FlowDocument {
  const next = cloneDocument(document);
  const outputs = next.flowData.outputs ?? [];
  const existingIndex = outputs.findIndex((item) => item.name === output.name);

  if (existingIndex >= 0) {
    outputs[existingIndex] = output;
  } else {
    outputs.push(output);
  }

  next.flowData.outputs = outputs;
  return next;
}

export function linkEnvironmentToFlow(
  document: FlowDocument,
  input: {
    environmentId: number;
    environmentName: string;
    selectedSubEnvironment?: string;
    parameterMappings?: Record<string, string>;
  }
): FlowDocument {
  const next = cloneDocument(document);
  next.environmentId = input.environmentId;
  next.flowData.settings.environment = {
    environmentId: input.environmentId,
    subEnvironment: input.selectedSubEnvironment ?? null
  };
  const linkedEnvironment: EnvironmentMapping = {
    environmentId: input.environmentId,
    environmentName: input.environmentName,
    selectedSubEnvironment: input.selectedSubEnvironment,
    parameterMappings: input.parameterMappings ?? {}
  };
  next.flowData.settings.linkedEnvironment = linkedEnvironment;
  return next;
}

export function linkStepOutput(
  document: FlowDocument,
  input: {
    sourceType: 'res' | 'proc';
    fromStepId: string;
    fromEndpointIndex?: number;
    alias?: string;
    jsonPath?: string;
    preserveType?: boolean;
    toStepId: string;
    toEndpointIndex?: number;
    targetFieldType: 'body' | 'queryParams' | 'pathParams' | 'headers';
    fieldName: string;
    nestedFieldPath?: string;
    headerEnabled?: boolean;
  }
): { document: FlowDocument; expression: string } {
  const expression = suggestTemplateExpression({
    source: input.sourceType,
    preserveType: input.preserveType,
    stepEndpointRef: input.fromStepId,
    endpointIndex: input.fromEndpointIndex ?? 0,
    alias: input.alias,
    jsonPath: input.jsonPath
  }).expression;

  const next = cloneDocument(document);
  const endpoint = getEndpoint(next, input.toStepId, input.toEndpointIndex ?? 0);

  if (input.targetFieldType === 'body') {
    const body =
      endpoint.body && typeof endpoint.body === 'object' && !Array.isArray(endpoint.body)
        ? (endpoint.body as Record<string, unknown>)
        : {};
    setByPath(body, input.nestedFieldPath ?? input.fieldName, expression);
    endpoint.body = body;
  } else if (input.targetFieldType === 'queryParams') {
    endpoint.queryParams = endpoint.queryParams ?? {};
    endpoint.queryParams[input.fieldName] = expression;
  } else if (input.targetFieldType === 'pathParams') {
    endpoint.pathParams = endpoint.pathParams ?? {};
    endpoint.pathParams[input.fieldName] = expression;
  } else {
    const existingHeaders = endpoint.headers ?? [];
    const nextHeaders = existingHeaders.filter(
      (header) => header.name.toLowerCase() !== input.fieldName.toLowerCase()
    );
    nextHeaders.push({
      name: input.fieldName,
      value: expression,
      enabled: input.headerEnabled ?? true
    });
    endpoint.headers = nextHeaders;
  }

  return { document: next, expression };
}

function collectStrings(
  value: unknown,
  path: string,
  results: Array<{ path: string; value: string }>
): void {
  if (typeof value === 'string') {
    results.push({ path, value });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, results));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      collectStrings(nested, path ? `${path}.${key}` : key, results);
    }
  }
}

function stepOrder(flowData: TestFlowData): Record<string, number> {
  return Object.fromEntries(flowData.steps.map((step, index) => [step.step_id, index]));
}

function getTransformationAliases(endpoint: StepEndpoint): Set<string> {
  return new Set((endpoint.transformations ?? []).map((item) => item.alias));
}

function validateTemplateReference(
  currentStepId: string,
  expression: string,
  flowData: TestFlowData
): FlowValidationResult {
  const explanation = explainTemplateExpression(expression);
  const errors: string[] = [];
  const warnings = [...explanation.warnings];

  if (!explanation.valid) {
    errors.push(`Invalid template at ${currentStepId}: ${expression} (${explanation.summary})`);
    return { valid: false, errors, warnings };
  }

  const order = stepOrder(flowData);
  const currentIndex = order[currentStepId] ?? Number.MAX_SAFE_INTEGER;

  for (const dependency of explanation.dependencies) {
    if (dependency.kind === 'response') {
      const stepId = dependency.reference.split('-').slice(0, -1).join('-');
      const dependencyIndex = order[stepId];
      if (dependencyIndex === undefined) {
        errors.push(`Template ${expression} references unknown step ${stepId}.`);
      } else if (dependencyIndex >= currentIndex) {
        errors.push(
          `Template ${expression} references ${dependency.reference}, which does not run before ${currentStepId}.`
        );
      }
    }

    if (dependency.kind === 'transformation') {
      const [stepEndpointRef, alias] = dependency.reference.split(':');
      const stepId = stepEndpointRef.split('-').slice(0, -1).join('-');
      const dependencyIndex = order[stepId];
      if (dependencyIndex === undefined) {
        errors.push(`Transformation template ${expression} references unknown step ${stepId}.`);
      } else if (dependencyIndex >= currentIndex) {
        errors.push(
          `Transformation template ${expression} references ${stepEndpointRef}, which does not run before ${currentStepId}.`
        );
      } else {
        const step = flowData.steps.find((item) => item.step_id === stepId);
        const endpointIndex = Number(stepEndpointRef.split('-').pop());
        const endpoint = step?.endpoints?.[endpointIndex];
        if (!endpoint || !getTransformationAliases(endpoint).has(alias)) {
          errors.push(
            `Transformation template ${expression} references missing alias "${alias}" on ${stepEndpointRef}.`
          );
        }
      }
    }

    if (dependency.kind === 'parameter') {
      const hasParameter = flowData.parameters.some((item) => item.name === dependency.reference);
      if (!hasParameter) {
        errors.push(
          `Template ${expression} references unknown parameter "${dependency.reference}".`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateOutputTemplateReference(
  expression: string,
  flowData: TestFlowData
): FlowValidationResult {
  const explanation = explainTemplateExpression(expression);
  const errors: string[] = [];
  const warnings = [...explanation.warnings];

  if (!explanation.valid) {
    errors.push(`Invalid output template: ${expression} (${explanation.summary})`);
    return { valid: false, errors, warnings };
  }

  const order = stepOrder(flowData);

  for (const dependency of explanation.dependencies) {
    if (dependency.kind === 'response') {
      const stepId = dependency.reference.split('-').slice(0, -1).join('-');
      if (order[stepId] === undefined) {
        errors.push(`Output template ${expression} references unknown step ${stepId}.`);
      }
    }

    if (dependency.kind === 'transformation') {
      const [stepEndpointRef, alias] = dependency.reference.split(':');
      const stepId = stepEndpointRef.split('-').slice(0, -1).join('-');
      if (order[stepId] === undefined) {
        errors.push(`Output template ${expression} references unknown step ${stepId}.`);
      } else {
        const step = flowData.steps.find((item) => item.step_id === stepId);
        const endpointIndex = Number(stepEndpointRef.split('-').pop());
        const endpoint = step?.endpoints?.[endpointIndex];
        if (!endpoint || !getTransformationAliases(endpoint).has(alias)) {
          errors.push(
            `Output template ${expression} references missing alias "${alias}" on ${stepEndpointRef}.`
          );
        }
      }
    }

    if (dependency.kind === 'parameter') {
      const hasParameter = flowData.parameters.some((item) => item.name === dependency.reference);
      if (!hasParameter) {
        errors.push(
          `Output template ${expression} references unknown parameter "${dependency.reference}".`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateFlowDocument(document: FlowDocument): FlowValidationResult {
  const validator = FlowValidator.validateFlow(document.flowData);
  const errors = [...validator.errors];
  const warnings: string[] = [];

  for (const parameter of document.flowData.parameters) {
    if (!isPrimitiveType(parameter.type)) {
      errors.push(
        `Flow parameter "${parameter.name}" has non-primitive type "${parameter.type}". MCP-authored flow parameters must be string, number, boolean, or null.`
      );
    }
  }

  if (!FlowValidator.validateApiHosts(document.flowData)) {
    warnings.push('No API hosts are configured yet. Execution will require at least one host.');
  }

  for (const step of document.flowData.steps) {
    for (const endpoint of step.endpoints) {
      const stepTemplates: Array<{ path: string; value: string }> = [];
      collectStrings(endpoint.pathParams, `${step.step_id}.pathParams`, stepTemplates);
      collectStrings(endpoint.queryParams, `${step.step_id}.queryParams`, stepTemplates);
      collectStrings(endpoint.body, `${step.step_id}.body`, stepTemplates);
      collectStrings(endpoint.headers, `${step.step_id}.headers`, stepTemplates);

      for (const item of stepTemplates) {
        const templates = templateExpressions(item.value);
        for (const template of templates) {
          const result = validateTemplateReference(step.step_id, template, document.flowData);
          errors.push(...result.errors.map((message) => `${item.path}: ${message}`));
          warnings.push(...result.warnings.map((message) => `${item.path}: ${message}`));
        }
      }

      for (const transformation of endpoint.transformations ?? []) {
        for (const template of templateExpressions(transformation.expression)) {
          if (template.startsWith('{{{')) {
            errors.push(
              `${step.step_id}.transformations.${transformation.alias}: Transformations use {{...}} templates only; {{{...}}} is only for JSON request bodies.`
            );
          }
          const result = validateTemplateReference(step.step_id, template, document.flowData);
          errors.push(
            ...result.errors.map(
              (message) => `${step.step_id}.transformations.${transformation.alias}: ${message}`
            )
          );
          warnings.push(
            ...result.warnings.map(
              (message) => `${step.step_id}.transformations.${transformation.alias}: ${message}`
            )
          );
        }

        const explanation = explainTransformationExpression(transformation.expression);
        const transformationMessages = explanation.warnings
          .filter((message) => !message.includes('Could not classify this pipeline stage'))
          .map((message) => `${step.step_id}.transformations.${transformation.alias}: ${message}`);
        if (explanation.valid) {
          warnings.push(...transformationMessages);
        } else {
          errors.push(...transformationMessages);
        }
      }

      for (const assertion of endpoint.assertions ?? []) {
        const explanation = explainAssertion(assertion);
        warnings.push(
          ...explanation.warnings.map(
            (message) => `${step.step_id}.assertions.${assertion.id}: ${message}`
          )
        );

        if (typeof assertion.expected_value === 'string') {
          const templates = templateExpressions(assertion.expected_value);
          for (const template of templates) {
            const result = validateTemplateReference(step.step_id, template, document.flowData);
            errors.push(
              ...result.errors.map(
                (message) => `${step.step_id}.assertions.${assertion.id}: ${message}`
              )
            );
            warnings.push(
              ...result.warnings.map(
                (message) => `${step.step_id}.assertions.${assertion.id}: ${message}`
              )
            );
          }
        }
      }
    }
  }

  for (const output of document.flowData.outputs ?? []) {
    if (!isPrimitiveType(output.type)) {
      errors.push(
        `Flow output "${output.name}" has non-primitive type "${output.type}". Flow outputs must be string, number, boolean, or null.`
      );
    }

    if (output.isTemplate) {
      const result = validateOutputTemplateReference(output.value, document.flowData);
      errors.push(...result.errors.map((message) => `outputs.${output.name}: ${message}`));
      warnings.push(...result.warnings.map((message) => `outputs.${output.name}: ${message}`));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function explainFlowDocument(document: FlowDocument): {
  summary: string;
  inputs: string[];
  outputs: string[];
  steps: string[];
  dependencies: string[];
  warnings: string[];
  sequenceReady: boolean;
} {
  const validation = validateFlowDocument(document);
  const inputs = document.flowData.parameters.map((parameter) => {
    const required = parameter.required ? 'required' : 'optional';
    const type = parameter.type ?? 'unknown';
    return `${parameter.name}: ${type}, ${required}`;
  });
  const outputs = (document.flowData.outputs ?? []).map((output) => {
    const type = output.type ?? 'unknown';
    const source = output.isTemplate ? output.value : JSON.stringify(output.value);
    return `${output.name}: ${type} from ${source}`;
  });
  const steps = document.flowData.steps.map((step) => {
    const endpointCount = step.endpoints.length;
    return `${step.step_id}: ${step.label} (${endpointCount} endpoint${endpointCount === 1 ? '' : 's'})`;
  });

  const dependencies: string[] = [];
  const warnings: string[] = [];

  for (const step of document.flowData.steps) {
    for (const endpoint of step.endpoints) {
      const strings: Array<{ path: string; value: string }> = [];
      collectStrings(endpoint.pathParams, `${step.step_id}.pathParams`, strings);
      collectStrings(endpoint.queryParams, `${step.step_id}.queryParams`, strings);
      collectStrings(endpoint.body, `${step.step_id}.body`, strings);
      collectStrings(endpoint.headers, `${step.step_id}.headers`, strings);

      for (const item of strings) {
        const templates = item.value.match(/\{\{\{[^}]+\}\}\}|\{\{[^}]+\}\}/g) ?? [];
        for (const template of templates) {
          const explanation = explainTemplateExpression(template);
          dependencies.push(`${item.path}: ${explanation.plainEnglish}`);
          warnings.push(...explanation.warnings.map((warning) => `${item.path}: ${warning}`));
        }
      }

      for (const transformation of endpoint.transformations ?? []) {
        const explanation = explainTransformationExpression(transformation.expression);
        dependencies.push(
          `${step.step_id}.transformations.${transformation.alias}: ${explanation.plainEnglish}`
        );
        warnings.push(
          ...explanation.warnings.map(
            (warning) => `${step.step_id}.transformations.${transformation.alias}: ${warning}`
          )
        );
      }

      for (const assertion of endpoint.assertions ?? []) {
        const explanation = explainAssertion(assertion);
        dependencies.push(
          `${step.step_id}.assertions.${assertion.id}: ${explanation.plainEnglish}`
        );
        warnings.push(
          ...explanation.warnings.map(
            (warning) => `${step.step_id}.assertions.${assertion.id}: ${warning}`
          )
        );
      }
    }
  }

  return {
    summary: `${document.name} has ${document.flowData.steps.length} step${document.flowData.steps.length === 1 ? '' : 's'}, ${inputs.length} input${inputs.length === 1 ? '' : 's'}, and ${outputs.length} output${outputs.length === 1 ? '' : 's'}.`,
    inputs,
    outputs,
    steps,
    dependencies,
    warnings: [...warnings, ...validation.warnings],
    sequenceReady:
      validation.valid &&
      document.flowData.parameters.every((parameter) => isPrimitiveType(parameter.type)) &&
      (document.flowData.outputs ?? []).every((output) => isPrimitiveType(output.type))
  };
}
