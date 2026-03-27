import { describe, expect, it } from 'vitest';
import { createDraft, getDraftTtlMs } from './drafts';

describe('mcp drafts', () => {
  it('applies a default ttl to drafts', () => {
    const draft = createDraft(1, {
      name: 'Draft',
      flowData: {
        settings: {},
        parameters: [],
        steps: []
      }
    });

    expect(draft.expiresAt - draft.createdAt).toBe(getDraftTtlMs());
  });
});
