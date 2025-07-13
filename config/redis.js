const { logger } = require('../utils/logger');
const config = require('./env');

let redisClient = null;

const setupRedis = async () => {
  try {
    // Try to use Redis if available, otherwise use in-memory fallback
    if (config.redisUrl) {
      const Redis = require('redis');
      redisClient = Redis.createClient({
        url: config.redisUrl
      });

      redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      await redisClient.connect();
    } else {
      logger.warn('Redis URL not provided, using in-memory cache');
      // Create a simple in-memory cache for development
      const cache = new Map();
      redisClient = {
        get: async (key) => cache.get(key) || null,
        set: async (key, value, options) => {
          cache.set(key, value);
          if (options && options.EX) {
            setTimeout(() => cache.delete(key), options.EX * 1000);
          }
          return 'OK';
        },
        del: async (key) => cache.delete(key) ? 1 : 0,
        exists: async (key) => cache.has(key) ? 1 : 0,
        expire: async (key, seconds) => {
          if (cache.has(key)) {
            setTimeout(() => cache.delete(key), seconds * 1000);
            return 1;
          }
          return 0;
        }
      };
    }
  } catch (error) {
    logger.warn('Redis setup failed, using in-memory fallback:', error.message);
    // Fallback to in-memory cache
    const cache = new Map();
    redisClient = {
      get: async (key) => cache.get(key) || null,
      set: async (key, value) => { cache.set(key, value); return 'OK'; },
      del: async (key) => cache.delete(key) ? 1 : 0,
      exists: async (key) => cache.has(key) ? 1 : 0,
      expire: async (key, seconds) => {
        if (cache.has(key)) {
          setTimeout(() => cache.delete(key), seconds * 1000);
          return 1;
        }
        return 0;
      }
    };
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call setupRedis() first.');
  }
  return redisClient;
};

module.exports = {
  setupRedis,
  getRedisClient
};
