const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') throw new Error('BOOTSTRAP_ACKNOWLEDGEMENT=create-initial-admin is required');
  const email = String(process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PROVISION_ADMIN_PASSWORD || '');
  const name = String(process.env.PROVISION_ADMIN_NAME || '').trim();
  if (!email.includes('@') || password.length < 12 || !name) throw new Error('Valid PROVISION_ADMIN_* environment is required');
  const [firstName, ...last] = name.split(/\s+/);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, firstName, lastName: last.join(' ') || null, password: await bcrypt.hash(password, 12) },
    update: { firstName, lastName: last.join(' ') || null, password: await bcrypt.hash(password, 12), isActive: true },
  });
  const tenantId = String(process.env.DEFAULT_TENANT_ID || 'default');
  await prisma.tenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId, slug: tenantId, name: process.env.DEFAULT_TENANT_NAME || 'Default workspace' },
    update: {},
  });
  await prisma.tenantMembership.upsert({
    where: { tenantId_subject: { tenantId, subject: String(user.id) } },
    create: { tenantId, subject: String(user.id), email, roles: ['admin'] },
    update: { email, roles: ['admin'], status: 'ACTIVE' },
  });
  console.log(JSON.stringify({ event: 'runtime_admin_provisioned', userId: user.id }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
