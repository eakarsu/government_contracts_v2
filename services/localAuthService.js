const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function login(rawEmail, password) {
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  const roles = ['admin'];
  await prisma.localAuthSession.create({
    data: { tokenHash: hashToken(token), userId: user.id, roles, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
  });
  return { token, user: { id: String(user.id), email: user.email, roles, role: roles[0] } };
}

async function verifySession(token) {
  const session = await prisma.localAuthSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) throw new Error('Invalid or expired session');
  await prisma.localAuthSession.update({ where: { tokenHash: session.tokenHash }, data: { lastSeenAt: new Date() } });
  return { sub: String(session.user.id), email: session.user.email, roles: session.roles };
}

module.exports = { login, verifySession };
