'use strict';

const config = require('../config/env');
const { prisma } = require('../config/database');
const { permissionsForRoles } = require('./auth');
const { normalizeTenantId, runWithTenant } = require('../services/tenantContext');

function createTenantMiddleware({ configuration = config, prismaClient = prisma } = {}) {
  return async (req, res, next) => {
    if (!req.user) return next();

    const claimedTenant = req.user.tenantId;
    if (configuration.tenantEnforcement === 'required' && configuration.authMode === 'oidc' && !claimedTenant) {
      return res.status(403).json({ error: 'A trusted tenant claim is required' });
    }

    let tenantId;
    try {
      tenantId = normalizeTenantId(claimedTenant || configuration.defaultTenantId);
    } catch {
      return res.status(403).json({ error: 'Invalid tenant context' });
    }

    const membership = await prismaClient.tenantMembership.findFirst({
      where: { tenantId, subject: String(req.user.id), status: 'ACTIVE' },
    });
    if (configuration.tenantEnforcement === 'required' && !membership) {
      return res.status(403).json({ error: 'Active tenant membership is required' });
    }
    if (membership) {
      req.user.roles = membership.roles;
      req.user.permissions = permissionsForRoles(membership.roles);
    }
    req.user.tenantId = tenantId;
    req.tenantId = tenantId;
    return runWithTenant(tenantId, next);
  };
}

module.exports = { createTenantMiddleware, tenantMiddleware: createTenantMiddleware() };
