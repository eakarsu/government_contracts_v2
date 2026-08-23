const rateLimit = require('express-rate-limit');
const config = require('../config/env');

function requestPath(req) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

function isDashboardPollingRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = requestPath(req);

  if (method === 'OPTIONS') return true;
  if (method === 'POST' && path === '/api/ai/opportunity-predictions') return true;
  if (!['GET', 'HEAD'].includes(method)) return false;

  return path === '/api/status'
    || path === '/api/config'
    || path === '/api/health'
    || path === '/api/ai/health'
    || path === '/api/documents/queue/status'
    || path === '/api/jobs'
    || path.startsWith('/api/jobs/');
}

function isNonGenerativeAiRequest(req) {
  const path = requestPath(req);
  return path === '/api/ai/health' || path === '/api/ai/opportunity-predictions';
}

// General API limiter. Static frontend assets never enter this bucket, while
// high-frequency dashboard polling is handled by statusRateLimiter below.
const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  skip: isDashboardPollingRequest,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for auth endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI endpoints rate limiter (more restrictive due to cost)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.aiRateLimitMaxRequests,
  skip: isNonGenerativeAiRequest,
  message: {
    error: 'Too many AI requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Status/polling endpoints rate limiter (very permissive for dashboard updates)
const statusRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.statusRateLimitMaxRequests,
  message: {
    error: 'Too many status requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  rateLimiter,
  authRateLimiter,
  aiRateLimiter,
  statusRateLimiter,
  isDashboardPollingRequest,
  isNonGenerativeAiRequest,
};
