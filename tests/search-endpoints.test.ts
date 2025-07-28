import { describe, it, expect, vi } from 'vitest';
import { searchEndpointsByDescription } from '$lib/server/service/api_endpoints/search_endpoints';
import * as apiEndpointsRepo from '$lib/server/repository/db/api-endpoints';

// Mock the repository
vi.mock('$lib/server/repository/db/api-endpoints', () => ({
  searchByTsVector: vi.fn()
}));

describe('searchEndpointsByDescription', () => {
  it('should search endpoints and return formatted results', async () => {
    const mockResults = [
      {
        id: 1,
        apiId: 100,
        path: '/payments',
        method: 'POST',
        operationId: 'createPayment',
        summary: 'Create payment request',
        description: 'Creates a new payment request',
        tags: ['payment'],
        createdAt: new Date('2024-01-01'),
        rank: 0.8
      }
    ];

    vi.mocked(apiEndpointsRepo.searchByTsVector).mockResolvedValue(mockResults);

    const result = await searchEndpointsByDescription({
      query: 'create payment request',
      userId: 1,
      apiId: 100,
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      apiId: 100,
      path: '/payments',
      method: 'POST',
      operationId: 'createPayment',
      summary: 'Create payment request',
      description: 'Creates a new payment request',
      tags: ['payment'],
      createdAt: new Date('2024-01-01'),
      relevanceScore: 0.8
    });

    expect(apiEndpointsRepo.searchByTsVector).toHaveBeenCalledWith({
      query: 'create payment request',
      userId: 1,
      apiId: 100
    });
  });

  it('should throw error for empty query', async () => {
    await expect(searchEndpointsByDescription({
      query: '   ',
      userId: 1,
      limit: 1,
    })).rejects.toThrow('Search query cannot be empty');
  });
});
