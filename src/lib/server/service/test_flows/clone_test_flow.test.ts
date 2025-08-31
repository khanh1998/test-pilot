import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneTestFlow } from './clone_test_flow';
import { getTestFlowById, createTestFlowApis, createTestFlow, getTestFlowApiIds } from '../../repository/db/test-flows';

// Mock the dependencies
vi.mock('../../repository/db/test-flows');

describe('cloneTestFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clone a test flow with new name and description', async () => {
    // Mock data
    const originalTestFlowId = 1;
    const userId = 100;
    const originalFlow = {
      id: 1,
      name: 'Original Flow',
      description: 'Original description',
      flowJson: { settings: {}, steps: [] },
      userId: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      apis: [{ id: 1, name: 'API 1' }, { id: 2, name: 'API 2' }]
    };

    const newTestFlow = {
      id: 2,
      name: 'Copy of Original Flow',
      description: 'New description',
      flowJson: { settings: {}, steps: [] },
      userId: 100,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mock implementation
    vi.mocked(getTestFlowById).mockResolvedValue(originalFlow);
    vi.mocked(createTestFlow).mockResolvedValue(newTestFlow);
    vi.mocked(getTestFlowApiIds).mockResolvedValue([1, 2]);
    vi.mocked(createTestFlowApis).mockResolvedValue();

    // Execute
    const result = await cloneTestFlow(originalTestFlowId, userId, {
      name: 'Copy of Original Flow',
      description: 'New description'
    });

    // Verify
    expect(getTestFlowById).toHaveBeenCalledWith(originalTestFlowId, userId);
    expect(createTestFlow).toHaveBeenCalledWith({
      name: 'Copy of Original Flow',
      description: 'New description',
      userId: 100,
      flowJson: { settings: {}, steps: [] }
    });
    expect(getTestFlowApiIds).toHaveBeenCalledWith(originalTestFlowId);
    expect(createTestFlowApis).toHaveBeenCalledWith(2, [1, 2]);
    expect(result.testFlow.name).toBe('Copy of Original Flow');
    expect(result.testFlow.description).toBe('New description');
    expect(result.testFlow.apis).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('should throw error if original test flow not found', async () => {
    const originalTestFlowId = 999;
    const userId = 100;

    vi.mocked(getTestFlowById).mockResolvedValue(null);

    await expect(
      cloneTestFlow(originalTestFlowId, userId, {
        name: 'Clone Name'
      })
    ).rejects.toThrow('Test flow not found or does not belong to the user');
  });
});
