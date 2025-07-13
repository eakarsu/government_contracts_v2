const express = require('express');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Mock authentication - replace with real auth logic
    if (email && password) {
      const token = 'mock-jwt-token';
      const user = {
        id: 1,
        email,
        name: 'Test User'
      };
      
      res.json({
        success: true,
        token,
        user
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Mock registration
    const user = {
      id: Date.now(),
      email,
      name
    };
    
    res.json({
      success: true,
      user,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const user = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User'
    };
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
});

module.exports = router;
