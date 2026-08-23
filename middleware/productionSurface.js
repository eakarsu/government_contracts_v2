'use strict';

const config = require('../config/env');

const TEST_ENDPOINTS = [
  { method: 'GET', pattern: /^\/test-routes$/ },
  { method: 'GET', pattern: /^\/documents\/(?:ping|test)$/ },
  { method: 'POST', pattern: /^\/documents\/(?:download-test|queue\/test|queue\/process-test)$/ },
  { method: 'POST', pattern: /^\/documents\/processing\/test$/ },
];

function createProductionSurfaceMiddleware(configuration = config) {
  return (req, res, next) => {
    if (configuration.enableTestEndpoints) return next();
    const blocked = TEST_ENDPOINTS.some(route => route.method === req.method && route.pattern.test(req.path));
    if (blocked) return res.status(404).json({ error: 'API endpoint not found' });
    return next();
  };
}

module.exports = { TEST_ENDPOINTS, createProductionSurfaceMiddleware };
