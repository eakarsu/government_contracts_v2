const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const config = require('../config/env');
const { verifySession } = require('../services/localAuthService');

const ROLE_PERMISSIONS = Object.freeze({
  admin: ['*'],
  auditor: ['audit:export', 'audit:read', 'governance:read', 'lifecycle:export', 'lifecycle:read', 'operations:read', 'rfp:read'],
  compliance_analyst: ['evaluation:create', 'evaluation:submit', 'governance:read', 'lifecycle:ai', 'lifecycle:create', 'lifecycle:read', 'lifecycle:submit', 'lifecycle:update', 'rfp:read', 'rfp:review'],
  compliance_approver: ['decision:approve', 'governance:read', 'lifecycle:approve', 'lifecycle:read', 'rfp:approve', 'rfp:read'],
  contract_manager: ['governance:read', 'lifecycle:ai', 'lifecycle:create', 'lifecycle:delete', 'lifecycle:export', 'lifecycle:read', 'lifecycle:submit', 'lifecycle:update', 'rfp:author', 'rfp:outcome', 'rfp:read', 'rfp:submit'],
  contract_viewer: ['governance:read', 'lifecycle:read', 'rfp:read'],
  document_operator: ['legacy:write', 'queue:admin', 'queue:write', 'lifecycle:create', 'lifecycle:read', 'lifecycle:update'],
  legal_reviewer: ['governance:read', 'lifecycle:ai', 'lifecycle:approve', 'lifecycle:read', 'lifecycle:update', 'rfp:read', 'rfp:review'],
  policy_admin: ['governance:read', 'policy:create', 'lifecycle:read'],
  records_officer: ['audit:export', 'governance:read', 'legal_hold:manage', 'lifecycle:export', 'lifecycle:read', 'operations:read'],
  regulatory_ingestor: ['governance:read', 'source:ingest'],
  proposal_author: ['rfp:author', 'rfp:read'],
  proposal_reviewer: ['rfp:read', 'rfp:review'],
  proposal_approver: ['rfp:approve', 'rfp:read', 'rfp:submit'],
  capture_manager: ['rfp:author', 'rfp:model:validate', 'rfp:outcome', 'rfp:read', 'rfp:submit'],
});

function bearerToken(request) {
  const header = request.get ? request.get('Authorization') : request.headers.authorization;
  const match = typeof header === 'string' && header.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : null;
}

function rolesFromClaims(claims) {
  const candidates = [
    ...(Array.isArray(claims.roles) ? claims.roles : claims.roles ? [claims.roles] : []),
    ...(claims.realm_access && Array.isArray(claims.realm_access.roles) ? claims.realm_access.roles : []),
  ];
  return [...new Set(candidates.filter(role => ROLE_PERMISSIONS[role]))];
}

function userFromClaims(claims) {
  if (!claims.sub) throw new Error('Token subject is required');
  const roles = rolesFromClaims(claims);
  const permissions = [...new Set(roles.flatMap(role => ROLE_PERMISSIONS[role]))];
  return { email: claims.email, id: claims.sub, permissions, roles };
}

function createTokenVerifier(configuration = config) {
  if (configuration.authMode === 'local') {
    return verifySession;
  }

  const client = jwksRsa({ cache: true, jwksRequestsPerMinute: 5, jwksUri: configuration.oidcJwksUri, rateLimit: true });
  const signingKey = (header, callback) => {
    if (!header.kid) return callback(new Error('Token key id is required'));
    client.getSigningKey(header.kid, (error, key) => {
      callback(error, key && key.getPublicKey());
    });
  };
  return token =>
    new Promise((resolve, reject) => {
      jwt.verify(
        token,
        signingKey,
        {
          algorithms: ['RS256'],
          audience: configuration.oidcAudience,
          issuer: configuration.oidcIssuer,
        },
        (error, decoded) => (error ? reject(error) : resolve(decoded))
      );
    });
}

function createAuthMiddleware({ configuration = config, publicRoutes = [{ method: 'GET', path: '/health' }], verifyToken } = {}) {
  const verify = verifyToken || createTokenVerifier(configuration);
  return async (req, res, next) => {
    if (publicRoutes.some(route => route.method === req.method && route.path === req.path)) return next();
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Bearer token required' });
    try {
      req.user = userFromClaims(await verify(token));
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired bearer token' });
    }
  };
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.some(role => req.user.roles.includes(role))) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    return next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || (!req.user.permissions.includes('*') && !req.user.permissions.includes(permission))) {
      return res.status(403).json({ error: 'Insufficient permission' });
    }
    return next();
  };
}

function hasPermission(user, permission) {
  return Boolean(user && (user.permissions.includes('*') || user.permissions.includes(permission)));
}

module.exports = {
  ROLE_PERMISSIONS,
  authMiddleware: createAuthMiddleware(),
  bearerToken,
  createAuthMiddleware,
  createTokenVerifier,
  hasPermission,
  requirePermission,
  requireRole,
  rolesFromClaims,
  userFromClaims,
};
