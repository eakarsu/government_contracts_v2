const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const config = require('../config/env');
const { login } = require('../services/localAuthService');

const router = express.Router();

router.get('/config', (req, res) => {
  res.json({
    audience: config.oidcAudience || null,
    issuer: config.oidcIssuer || null,
    mode: config.authMode,
  });
});

router.get('/demo-credentials', (_req, res) => {
  if (config.nodeEnv === 'production') return res.status(404).json({ error: 'Not found' });
  const email = process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
  const password = process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return res.status(503).json({ error: 'Demo credentials unavailable' });
  res.set('Cache-Control', 'no-store');
  return res.json({ email, password });
});

router.post('/login', async (req, res) => {
  if (config.authMode !== 'local') return res.status(410).json({ error: 'Password login is disabled outside explicitly configured local auth.' });
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Email and password are required' });
  const session = await login(email, password);
  return session ? res.json(session) : res.status(401).json({ error: 'Invalid credentials' });
});

router.post('/register', (req, res) => {
  res.status(410).json({
    error: 'Public registration is disabled. Authenticate through the configured provider.',
  });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
