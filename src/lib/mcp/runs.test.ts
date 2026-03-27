import { describe, expect, it } from 'vitest';
import { createFlowRun, getFlowRunTtlMs } from './runs';

describe('mcp runs', () => {
  it('applies a default ttl to runs', () => {
    const run = createFlowRun(1, {});
    expect(run.expiresAt - run.startedAt).toBe(getFlowRunTtlMs());
  });
});
