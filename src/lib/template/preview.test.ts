import { describe, expect, it } from 'vitest';
import { buildTemplatePreviewContext, previewTemplateValue } from './preview';
import type { TemplateContext } from './types';

describe('template preview context', () => {
  const baseContext: TemplateContext = {
    responses: {},
    transformedData: {},
    parameters: {
      token: 'flow-token'
    }
  };

  it('keeps real execution responses for preview resolution', () => {
    const context = buildTemplatePreviewContext({
      baseContext,
      executionState: {
        'login-0': {
          response: {
            body: {
              token: 'real-token'
            }
          }
        }
      }
    });

    expect(context.responses['login-0']).toEqual({ token: 'real-token' });
    expect(context.responseSources['login-0']?.source).toBe('latest-run');

    const realPreview = previewTemplateValue('{{res:login-0.$.token}}', context);
    expect(realPreview).toMatchObject({
      success: true,
      value: 'real-token'
    });
    expect(realPreview.sources[0]?.source).toBe('latest-run');
  });

  it('returns a template error when no real response exists', () => {
    const context = buildTemplatePreviewContext({
      baseContext,
      executionState: {}
    });

    const preview = previewTemplateValue('{{res:missing-0.$.id}}', context);

    expect(preview.success).toBe(false);
    expect(preview.error).toContain('Response data not found');
  });
});
