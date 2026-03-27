import { describe, expect, it } from 'vitest';
import { explainAssertion, explainTemplateExpression, explainTransformationExpression, suggestTemplateExpression } from './explain';

describe('mcp explain helpers', () => {
  it('explains response template expressions in plain english', () => {
    const result = explainTemplateExpression('{{res:step3-0.$.ref_id}}');

    expect(result.valid).toBe(true);
    expect(result.summary).toBe('Response reference');
    expect(result.plainEnglish).toContain('step3-0');
    expect(result.dependencies).toEqual([{ kind: 'response', reference: 'step3-0' }]);
  });

  it('explains transformation pipelines', () => {
    const result = explainTransformationExpression('$.data[0].steps | map($.approvers[0].user_id) | count()');

    expect(result.valid).toBe(true);
    expect(result.plainEnglish).toContain('extracts data');
    expect(result.plainEnglish).toContain('reshapes each item');
    expect(result.outputType).toBe('number');
  });

  it('explains assertion objects', () => {
    const result = explainAssertion({
      id: 'a1',
      enabled: true,
      data_source: 'response',
      assertion_type: 'status_code',
      data_id: 'status_code',
      operator: 'between',
      expected_value: [200, 299]
    });

    expect(result.plainEnglish).toContain('HTTP status code');
    expect(result.plainEnglish).toContain('[200,299]');
  });

  it('suggests canonical transformation references', () => {
    const result = suggestTemplateExpression({
      source: 'proc',
      preserveType: true,
      stepEndpointRef: 'step2',
      alias: 'approver_ids'
    });

    expect(result.expression).toBe('{{{proc:step2-0.$.approver_ids}}}');
    expect(result.explanation.plainEnglish).toContain('approver_ids');
  });

  it('suggests missing endpoint index in warnings', () => {
    const result = explainTemplateExpression('{{proc:step_list_terminals.$.terminal_id}}');

    expect(result.warnings.join(' ')).toContain('Step references require a -<endpointIndex> suffix');
    expect(result.warnings.join(' ')).toContain('step_list_terminals-0');
  });
});
