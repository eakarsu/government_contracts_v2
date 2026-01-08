const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'govcontracts-ai-secret-key-2026';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      // For development, allow requests without token with a dev user
      if (process.env.NODE_ENV !== 'production') {
        req.user = {
          id: 1,
          email: 'dev@example.com',
          role: 'user'
        };
        return next();
      }
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    req.user = {
      ...user,
      role: 'user'
    };
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true
        }
      });

      if (user && user.isActive) {
        req.user = { ...user, role: 'user' };
      }
    }
    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuth,
  requireRole
};
