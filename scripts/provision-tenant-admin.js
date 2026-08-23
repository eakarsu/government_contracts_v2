'use strict';

const { prisma } = require('../config/database');
const { normalizeTenantId } = require('../services/tenantContext');

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'provision-tenant-admin') {
    throw new Error('BOOTSTRAP_ACKNOWLEDGEMENT=provision-tenant-admin is required');
  }
  const tenantId = normalizeTenantId(process.env.TENANT_ID);
  const slug = normalizeTenantId(process.env.TENANT_SLUG || tenantId).toLowerCase();
  const name = String(process.env.TENANT_NAME || '').trim();
  const subject = String(process.env.TENANT_ADMIN_SUBJECT || '').trim();
  const email = String(process.env.TENANT_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!name || !subject || !email.includes('@')) throw new Error('TENANT_NAME, TENANT_ADMIN_SUBJECT, and TENANT_ADMIN_EMAIL are required');

  await prisma.tenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId, slug, name },
    update: { name, status: 'ACTIVE' },
  });
  const membership = await prisma.tenantMembership.upsert({
    where: { tenantId_subject: { tenantId, subject } },
    create: { tenantId, subject, email, roles: ['tenant_admin'], status: 'ACTIVE' },
    update: { email, roles: ['tenant_admin'], status: 'ACTIVE' },
  });
  console.log(JSON.stringify({ event: 'tenant_admin_provisioned', tenantId, membershipId: membership.id }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
