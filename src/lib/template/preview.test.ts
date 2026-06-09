import { describe, expect, it } from 'vitest';
import { buildTemplatePreviewContext, previewTemplateObject, previewTemplateValue } from './preview';
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

  it('resolves triple-brace proc templates inside JSON body strings', () => {
    const context = buildTemplatePreviewContext({
      baseContext: {
        ...baseContext,
        transformedData: {
          'step-search-user-0': {
            member_user_id: 'user-123'
          }
        }
      },
      executionState: {}
    });

    const preview = previewTemplateObject(
      `{
        "user_ids": [
          "{{{proc:step-search-user-0.$.member_user_id}}}"
        ]
      }`,
      context
    );

    expect(preview).toMatchObject({
      success: true,
      value: {
        user_ids: ['user-123']
      }
    });
    expect(preview.sources[0]).toMatchObject({
      source: 'static',
      key: 'step-search-user-0'
    });
  });

  it('resolves triple-brace response and parameter templates inside JSON body strings', () => {
    const context = buildTemplatePreviewContext({
      baseContext: {
        ...baseContext,
        responses: {
          'step1-0': {
            message: 'created',
            count: 2
          }
        },
        parameters: {
          ...baseContext.parameters,
          wallet_id: 12345
        }
      },
      executionState: {}
    });

    const preview = previewTemplateObject(
      `{
        "message": "{{{res:step1-0.$.message}}}",
        "count": "{{{res:step1-0.$.count}}}",
        "wallet_id": "{{{param:wallet_id}}}"
      }`,
      context
    );

    expect(preview).toMatchObject({
      success: true,
      value: {
        message: 'created',
        count: 2,
        wallet_id: 12345
      }
    });
  });
});
