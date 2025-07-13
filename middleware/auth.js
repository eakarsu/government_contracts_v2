const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      // For development, allow requests without token
      req.user = {
        id: 1,
        email: 'test@example.com',
        role: 'user'
      };
      return next();
    }
    
    // Mock token validation - replace with real JWT verification later
    req.user = {
      id: 1,
      email: 'test@example.com',
      role: 'user'
    };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  requireRole
};
