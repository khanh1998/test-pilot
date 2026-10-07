import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getApiById: vi.fn(),
  deleteApiById: vi.fn(),
  findApiFlowReferences: vi.fn()
}));

vi.mock('$lib/server/repository/db/apis', () => ({
  getApiById: mocks.getApiById,
  deleteApiById: mocks.deleteApiById
}));
vi.mock('./find_api_flow_references', () => ({
  findApiFlowReferences: mocks.findApiFlowReferences
}));

import { deleteApi } from './delete_api';
import { ApiManagementError } from './errors';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getApiById.mockResolvedValue({ id: 3, userId: 1 });
  mocks.findApiFlowReferences.mockResolvedValue([]);
});

describe('deleteApi', () => {
  it('deletes an unused API', async () => {
    const result = await deleteApi({ apiId: 3, userId: 1 });
    expect(mocks.deleteApiById).toHaveBeenCalledWith(3);
    expect(result).toMatchObject({ success: true, affectedFlows: [] });
  });

  it('reports NOT_FOUND and FORBIDDEN', async () => {
    mocks.getApiById.mockResolvedValue(null);
    await expect(deleteApi({ apiId: 3, userId: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    mocks.getApiById.mockResolvedValue({ id: 3, userId: 2 });
    await expect(deleteApi({ apiId: 3, userId: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.deleteApiById).not.toHaveBeenCalled();
  });

  it('blocks deletion when flows use the API and lists them', async () => {
    mocks.findApiFlowReferences.mockResolvedValue([{ id: 9, name: 'Checkout' }]);
    const error = await deleteApi({ apiId: 3, userId: 1 }).catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiManagementError);
    expect(error).toMatchObject({ code: 'IN_USE', affectedFlows: [{ id: 9, name: 'Checkout' }] });
    expect(error.message).toContain('Checkout (id 9)');
    expect(mocks.deleteApiById).not.toHaveBeenCalled();
  });

  it('deletes anyway with force and reports the affected flows', async () => {
    mocks.findApiFlowReferences.mockResolvedValue([{ id: 9, name: 'Checkout' }]);
    const result = await deleteApi({ apiId: 3, userId: 1, force: true });
    expect(mocks.deleteApiById).toHaveBeenCalledWith(3);
    expect(result.affectedFlows).toEqual([{ id: 9, name: 'Checkout' }]);
  });
});
