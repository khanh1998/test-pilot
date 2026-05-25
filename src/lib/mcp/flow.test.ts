import { describe, expect, it } from 'vitest';
import {
  addAssertionToFlow,
  addFlowParameter,
  addStepToFlow,
  addTransformationToFlow,
  createExpectationAssertion,
  createFlowDraft,
  linkEnvironmentToFlow,
  linkStepOutput,
  setBodyField,
  setFlowOutput,
  setHeader,
  setPathParam,
  setQueryParam,
  updateStepInFlow,
  validateFlowDocument
} from './flow';

describe('mcp flow helpers', () => {
  it('creates a draft and appends steps', () => {
    const flow = createFlowDraft({
      name: 'Food ordering smoke test',
      projectId: 12,
      apiIds: [1],
      apiHosts: {
        '1': { url: 'https://api.example.com', name: 'Food API' }
      },
      parameters: [{ name: 'user_id', type: 'number', required: true }]
    });

    const updated = addStepToFlow(flow, {
      label: 'Get user info',
      endpoints: [
        { api_id: 1, endpoint_id: 10, pathParams: {}, queryParams: {}, headers: [], body: null }
      ]
    });

    expect(updated.flowData.steps).toHaveLength(1);
    expect(updated.flowData.steps[0].step_id).toBe('step1');
    expect(updated.projectId).toBe(12);
    expect(updated.apiIds).toEqual([1]);
  });

  it('detects references to unknown parameters', () => {
    const flow = createFlowDraft({
      name: 'Invalid flow',
      apiHosts: {
        '1': { url: 'https://api.example.com', name: 'Food API' }
      }
    });

    const updated = addStepToFlow(flow, {
      label: 'Create order',
      endpoints: [
        {
          api_id: 1,
          endpoint_id: 20,
          pathParams: {},
          queryParams: {},
          headers: [],
          body: {
            userId: '{{param:missing_user_id}}'
          }
        }
      ]
    });

    const result = validateFlowDocument(updated);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('unknown parameter');
  });

  it('does not emit noisy warnings for simple template-based transformations', () => {
    const flow = createFlowDraft({
      name: 'Transform flow',
      apiHosts: {
        '1': { url: 'https://api.example.com', name: 'Food API' }
      }
    });

    const updated = addStepToFlow(flow, {
      label: 'Extract id',
      endpoints: [
        {
          api_id: 1,
          endpoint_id: 20,
          pathParams: {},
          queryParams: {},
          headers: [],
          body: null,
          transformations: [
            {
              alias: 'terminal_id',
              expression: '{{res:step_list_terminals-0.$.data[0].id}}'
            }
          ]
        }
      ]
    });

    const result = validateFlowDocument(updated);
    expect(result.warnings.join(' ')).not.toContain('Could not classify this pipeline stage');
  });

  it('supports patch-style field updates and links', () => {
    const flow = createFlowDraft({
      name: 'Patch flow',
      apiHosts: {
        '1': { url: 'https://api.example.com', name: 'Food API' }
      }
    });

    const withSteps = addStepToFlow(
      addStepToFlow(flow, {
        step_id: 'step_list_terminals',
        label: 'List terminals',
        endpoints: [
          { api_id: 1, endpoint_id: 10, pathParams: {}, queryParams: {}, headers: [], body: null }
        ]
      }),
      {
        step_id: 'step_create_order',
        label: 'Create order',
        endpoints: [
          { api_id: 1, endpoint_id: 20, pathParams: {}, queryParams: {}, headers: [], body: null }
        ]
      }
    );

    const withBodyField = setBodyField(withSteps, {
      stepId: 'step_create_order',
      fieldPath: 'consumer.name',
      value: 'Alice'
    });

    const withQuery = setQueryParam(withBodyField, {
      stepId: 'step_create_order',
      name: 'include',
      value: 'details'
    });

    const linked = linkStepOutput(withQuery, {
      sourceType: 'proc',
      fromStepId: 'step_list_terminals',
      alias: 'terminal_id',
      toStepId: 'step_create_order',
      targetFieldType: 'body',
      fieldName: 'terminalId',
      nestedFieldPath: 'terminal.id',
      preserveType: true
    });

    const withAssertion = addAssertionToFlow(linked.document, {
      stepId: 'step_create_order',
      assertion: {
        id: 'assert-1',
        enabled: true,
        data_source: 'response',
        assertion_type: 'status_code',
        data_id: 'status_code',
        operator: 'between',
        expected_value: [200, 299]
      }
    });

    const body = withAssertion.flowData.steps[1].endpoints[0].body as {
      consumer: { name: string };
      terminal: { id: string };
    };
    expect(body.consumer.name).toBe('Alice');
    expect(withAssertion.flowData.steps[1].endpoints[0].queryParams?.include).toBe('details');
    expect(body.terminal.id).toBe('{{{proc:step_list_terminals-0.$.terminal_id}}}');
    expect(withAssertion.flowData.steps[1].endpoints[0].assertions).toHaveLength(1);
  });

  it('supports parameters and linked environment settings', () => {
    const flow = createFlowDraft({
      name: 'Env-aware flow',
      projectId: 7
    });

    const withParameter = addFlowParameter(flow, {
      name: 'consumer_token',
      type: 'string',
      required: true,
      description: 'Bearer token'
    });

    const withEnvironment = linkEnvironmentToFlow(withParameter, {
      environmentId: 99,
      environmentName: 'Payments Env',
      selectedSubEnvironment: 'uat',
      parameterMappings: {
        consumer_token: 'CONSUMER_TOKEN'
      }
    });

    expect(withEnvironment.flowData.parameters).toHaveLength(1);
    expect(withEnvironment.environmentId).toBe(99);
    expect(withEnvironment.flowData.settings.environment?.subEnvironment).toBe('uat');
    expect(
      withEnvironment.flowData.settings.linkedEnvironment?.parameterMappings.consumer_token
    ).toBe('CONSUMER_TOKEN');
  });

  it('rejects direct environment templates and non-primitive parameters', () => {
    const flow = createFlowDraft({
      name: 'Invalid env flow',
      apiHosts: {
        '1': { url: 'https://api.example.com', name: 'Food API' }
      },
      parameters: [{ name: 'payload', type: 'object', required: true }]
    });

    const updated = addStepToFlow(flow, {
      label: 'Create order',
      endpoints: [
        {
          api_id: 1,
          endpoint_id: 20,
          pathParams: {},
          queryParams: {},
          headers: [{ name: 'Authorization', value: 'Bearer {{env:TOKEN}}', enabled: true }],
          body: null
        }
      ]
    });

    const result = validateFlowDocument(updated);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Invalid environment reference');
    expect(result.errors.join(' ')).toContain('non-primitive type');
  });

  it('rejects triple-brace templates inside transformations', () => {
    const flow = createFlowDraft({
      name: 'Bad transformation',
      parameters: [{ name: 'limit', type: 'number', required: true }],
      apiHosts: {
        '1': { url: 'https://api.example.com', name: 'Food API' }
      }
    });

    const updated = addStepToFlow(flow, {
      label: 'List',
      endpoints: [
        {
          api_id: 1,
          endpoint_id: 20,
          pathParams: {},
          queryParams: {},
          headers: [],
          body: null,
          transformations: [{ alias: 'count', expression: '{{{param:limit}}} | int()' }]
        }
      ]
    });

    const result = validateFlowDocument(updated);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Transformations use {{...}} templates only');
  });

  it('rejects direct function calls inside transformations', () => {
    const flow = createFlowDraft({
      name: 'Direct function transformation',
      apiHosts: {
        '1': { url: 'https://api.example.com', name: 'Food API' }
      }
    });

    const updated = addStepToFlow(flow, {
      label: 'List',
      endpoints: [
        {
          api_id: 1,
          endpoint_id: 20,
          pathParams: {},
          queryParams: {},
          headers: [],
          body: null,
          transformations: [{ alias: 'count', expression: 'length($.items)' }]
        }
      ]
    });

    const result = validateFlowDocument(updated);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Direct function call');
  });

  it('upserts transformations and primitive flow outputs', () => {
    const flow = createFlowDraft({
      name: 'Output flow',
      apiHosts: {
        '1': { url: 'https://api.example.com', name: 'Food API' }
      }
    });

    const withStep = addStepToFlow(flow, {
      step_id: 'step_create',
      label: 'Create',
      endpoints: [
        { api_id: 1, endpoint_id: 20, pathParams: {}, queryParams: {}, headers: [], body: null }
      ]
    });

    const withTransformation = addTransformationToFlow(withStep, {
      stepId: 'step_create',
      alias: 'created_id',
      expression: '$.id'
    });

    const withOutput = setFlowOutput(withTransformation, {
      name: 'created_id',
      value: '{{proc:step_create-0.$.created_id}}',
      isTemplate: true,
      type: 'string'
    });

    const result = validateFlowDocument(withOutput);
    expect(result.valid).toBe(true);
    expect(withOutput.flowData.steps[0].endpoints[0].transformations?.[0].alias).toBe('created_id');
    expect(withOutput.flowData.outputs?.[0].name).toBe('created_id');
  });

  it('rejects steps that use endpoints outside the selected API scope', () => {
    const flow = createFlowDraft({
      name: 'Scoped flow',
      projectId: 3,
      apiIds: [1]
    });

    expect(() =>
      addStepToFlow(flow, {
        label: 'Wrong API',
        endpoints: [
          { api_id: 2, endpoint_id: 10, pathParams: {}, queryParams: {}, headers: [], body: null }
        ]
      })
    ).toThrow(/outside this draft's selected API scope/);
  });

  it('creates safe assertions from expectation input', () => {
    const fieldType = createExpectationAssertion({
      kind: 'field_type',
      jsonPath: '$.token_balance',
      expectedType: 'number'
    });

    const status = createExpectationAssertion({
      kind: 'status_success'
    });

    expect(fieldType.operator).toBe('is_type');
    expect(fieldType.expected_value).toBe('number');
    expect(status.operator).toBe('between');
    expect(status.expected_value).toEqual([200, 299]);
  });

  it('supports updating a step and request field helpers', () => {
    const flow = createFlowDraft({
      name: 'Update flow',
      apiIds: [1]
    });

    const withStep = addStepToFlow(flow, {
      step_id: 'step_lookup',
      label: 'Lookup',
      endpoints: [
        { api_id: 1, endpoint_id: 10, pathParams: {}, queryParams: {}, headers: [], body: null }
      ]
    });

    const updatedStep = updateStepInFlow(withStep, {
      stepId: 'step_lookup',
      label: 'Lookup terminal'
    });

    const withPath = setPathParam(updatedStep, {
      stepId: 'step_lookup',
      name: 'terminalId',
      value: '123'
    });

    const withHeader = setHeader(withPath, {
      stepId: 'step_lookup',
      name: 'Authorization',
      value: 'Bearer token'
    });

    expect(withHeader.flowData.steps[0].label).toBe('Lookup terminal');
    expect(withHeader.flowData.steps[0].endpoints[0].pathParams?.terminalId).toBe('123');
    expect(withHeader.flowData.steps[0].endpoints[0].headers?.[0].name).toBe('Authorization');
  });
});
