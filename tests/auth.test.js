const {
  createAuthMiddleware,
  hasPermission,
  requirePermission,
  userFromClaims,
} = require('../middleware/auth');

function response() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

test('fails closed without or with an invalid bearer token', async () => {
  const middleware = createAuthMiddleware({ publicRoutes: [], verifyToken: async () => { throw new Error('invalid'); } });
  const missingResponse = response();
  await middleware({ get: () => undefined, method: 'GET', path: '/contracts' }, missingResponse, jest.fn());
  expect(missingResponse.statusCode).toBe(401);

  const invalidResponse = response();
  await middleware({ get: () => 'Bearer invalid', method: 'GET', path: '/contracts' }, invalidResponse, jest.fn());
  expect(invalidResponse.statusCode).toBe(401);
});

test('maps trusted identity roles to least-privilege permissions', async () => {
  const claims = { email: 'analyst@example.gov', roles: ['compliance_analyst', 'unknown'], sub: 'person-1' };
  const user = userFromClaims(claims);
  expect(user.roles).toEqual(['compliance_analyst']);
  expect(hasPermission(user, 'evaluation:create')).toBe(true);
  expect(hasPermission(user, 'decision:approve')).toBe(false);

  const middleware = createAuthMiddleware({ publicRoutes: [], verifyToken: async () => claims });
  const req = { get: () => 'Bearer good', method: 'GET', path: '/governance' };
  const next = jest.fn();
  await middleware(req, response(), next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(req.user.id).toBe('person-1');
});

test('enforces permissions independently of authentication', () => {
  const denied = response();
  requirePermission('decision:approve')(
    { user: userFromClaims({ roles: ['compliance_analyst'], sub: 'person-1' }) },
    denied,
    jest.fn()
  );
  expect(denied.statusCode).toBe(403);

  const next = jest.fn();
  requirePermission('decision:approve')(
    { user: userFromClaims({ roles: ['compliance_approver'], sub: 'person-2' }) },
    response(),
    next
  );
  expect(next).toHaveBeenCalledTimes(1);
});
