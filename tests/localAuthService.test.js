const mockDeleteMany = jest.fn();

jest.mock('../config/database', () => ({
  prisma: {
    localAuthSession: { deleteMany: mockDeleteMany },
  },
}));

const crypto = require('node:crypto');
const { logout } = require('../services/localAuthService');

beforeEach(() => mockDeleteMany.mockReset());

test('logout revokes the local session without storing the raw bearer token', async () => {
  mockDeleteMany.mockResolvedValue({ count: 1 });
  await logout('session-secret');

  expect(mockDeleteMany).toHaveBeenCalledWith({
    where: {
      tokenHash: crypto.createHash('sha256').update('session-secret').digest('hex'),
    },
  });
});

test('logout is idempotent when no bearer token is present', async () => {
  await logout(null);
  expect(mockDeleteMany).not.toHaveBeenCalled();
});
