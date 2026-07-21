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
