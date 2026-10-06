import { describe, expect, it } from 'vitest';
import {
  CreateTestFlowRequest,
  UpdateTestFlowRequest,
  TestFlowListResponse,
  RunTestFlowRequest
} from './test-flows';
import { UpdateSequenceRequest } from './sequences';
import { TestFlowJson } from './flow-data';
import { ListApisQuery } from './apis';
import { SearchEndpointsQuery } from './endpoints';
import { ListProjectsQuery } from './projects';

describe('REST request compatibility', () => {
  it('accepts default flows without parameters', () => {
    expect(
      CreateTestFlowRequest.parse({
        name: 'Flow',
        apiIds: [1],
        flowJson: { steps: [], settings: { api_hosts: {} } }
      }).flowJson
    ).toEqual({ steps: [], settings: { api_hosts: {} } });
  });
  it('preserves endpoint snapshots, settings, templates and extension fields when saving', () => {
    const flowJson = {
      steps: [
        {
          step_id: 'step-1',
          label: 'Create user',
          endpoints: [
            {
              endpoint_id: 1,
              api_id: '2',
              body: { email: '{{email}}' },
              queryParams: { tags: ['one', 'two'] }
            }
          ],
          clearCookiesBeforeExecution: true
        }
      ],
      parameters: [{ name: 'email', type: 'string', required: true, value: 'a@example.com' }],
      outputs: [{ name: 'id', value: '{{steps.step-1.id}}' }],
      settings: {
        api_hosts: {},
        environment: { environmentId: null, subEnvironment: null },
        extra: 'preserve me'
      },
      endpoints: [
        { id: 1, apiId: 2, path: '/users', method: 'POST', requestSchema: { type: 'object' } }
      ],
      extension: { savedBy: 'editor' }
    };
    expect(UpdateTestFlowRequest.parse({ name: 'Flow', flowJson }).flowJson).toEqual(flowJson);
  });
  it('rejects malformed steps and invalid execution preferences', () => {
    expect(TestFlowJson.safeParse({ steps: ['not a step'] }).success).toBe(false);
    expect(
      RunTestFlowRequest.safeParse({ preferences: { timeout: -1, stopOnError: 'false' } }).success
    ).toBe(false);
  });
  it('retains nested loops and legacy loop configurations', () => {
    const root = {
      id: 'loop',
      name: 'Users',
      sources: [{ id: 'source', alias: 'user', source_type: 'fixed_count', count: 2 }],
      children: [{ id: 'child', name: 'Items', sources: [] }]
    };
    for (const loop_config of [
      { enabled: true, root },
      { enabled: true, source_type: 'fixed_count', count: 2 }
    ]) {
      const body = {
        sequenceConfig: {
          steps: [
            { id: 'step', test_flow_id: 1, step_order: 1, parameter_mappings: [], loop_config }
          ]
        }
      };
      expect(UpdateSequenceRequest.parse(body)).toEqual(body);
    }
  });
  it('validates query filters instead of silently dropping invalid ones', () => {
    expect(ListApisQuery.safeParse({ projectId: 'bad' }).success).toBe(false);
    expect(ListProjectsQuery.safeParse({ limit: '-1' }).success).toBe(false);
    expect(SearchEndpointsQuery.parse({ query: ' users ', apiIds: ['1', '2'] })).toMatchObject({
      query: 'users',
      apiIds: [1, 2]
    });
  });
  it('matches the list service response, including nested pagination and summary rows', () => {
    const response = {
      testFlows: [
        {
          id: 1,
          name: 'Flow',
          description: null,
          createdAt: '2026-06-17T00:00:00.000Z',
          updatedAt: '2026-06-17T00:00:00.000Z'
        }
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false }
    };
    expect(TestFlowListResponse.parse(response)).toEqual(response);
  });
});
