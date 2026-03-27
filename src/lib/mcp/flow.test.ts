import { describe, expect, it } from 'vitest';
import { addAssertionToFlow, addFlowParameter, addStepToFlow, createFlowDraft, linkEnvironmentToFlow, linkStepOutput, setBodyField, setQueryParam, validateFlowDocument } from './flow';

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
      endpoints: [{ api_id: 1, endpoint_id: 10, pathParams: {}, queryParams: {}, headers: [], body: null }]
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
        endpoints: [{ api_id: 1, endpoint_id: 10, pathParams: {}, queryParams: {}, headers: [], body: null }]
      }),
      {
        step_id: 'step_create_order',
        label: 'Create order',
        endpoints: [{ api_id: 1, endpoint_id: 20, pathParams: {}, queryParams: {}, headers: [], body: null }]
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

    expect((withAssertion.flowData.steps[1].endpoints[0].body as any).consumer.name).toBe('Alice');
    expect(withAssertion.flowData.steps[1].endpoints[0].queryParams?.include).toBe('details');
    expect((withAssertion.flowData.steps[1].endpoints[0].body as any).terminal.id).toBe('{{{proc:step_list_terminals-0.$.terminal_id}}}');
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
    expect(withEnvironment.flowData.settings.linkedEnvironment?.parameterMappings.consumer_token).toBe('CONSUMER_TOKEN');
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
        endpoints: [{ api_id: 2, endpoint_id: 10, pathParams: {}, queryParams: {}, headers: [], body: null }]
      })
    ).toThrow(/outside this draft's selected API scope/);
  });
});
