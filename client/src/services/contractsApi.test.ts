import { describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./api', () => ({ default: { get } }));
import { ContractsApiService } from './contractsApi';

describe('contract list payloads', () => {
  it('loads all 16 records from the project demo opportunity shape', async () => {
    const records = Array.from({ length: 16 }, (_, index) => ({
      noticeId: `AI-DEMO-${String(index + 1).padStart(3, '0')}`,
      title: `Demo opportunity ${index + 1}`,
    }));
    get.mockResolvedValueOnce({ data: { success: true, contracts: records, pagination: { page: 1, limit: 20, total: 16, totalPages: 1 } } });
    const result = await new ContractsApiService().getContracts();
    expect(result.data).toHaveLength(16);
    expect(result.data[0].noticeId).toBe('AI-DEMO-001');
    expect(result.data[15].noticeId).toBe('AI-DEMO-016');
  });

  it('uses a genuine contracts array if an unrelated data object is present', async () => {
    get.mockResolvedValueOnce({ data: { success: true, data: { page: 1 }, contracts: [{ noticeId: 'AI-DEMO-001' }], pagination: {} } });
    expect((await new ContractsApiService().getContracts()).data).toHaveLength(1);
  });

  it('reports a malformed record list instead of passing it to a view', async () => {
    get.mockResolvedValueOnce({ data: { success: true, data: { page: 1 }, pagination: {} } });
    await expect(new ContractsApiService().getContracts()).rejects.toThrow('did not return a record list');
  });
});
