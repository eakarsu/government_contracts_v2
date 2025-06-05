// server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Ensure directories exist
const ensureDirectories = () => {
  const dirs = ['uploads', 'documents', 'public'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirectories();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = (process.env.ALLOWED_EXTENSIONS || '.pdf,.doc,.docx').split(',');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`), false);
    }
  }
});

// Utility function to send file to Norshin API
const sendToNorshinAPI = async (filePath, originalName, customPrompt = '', model = 'openai/gpt-4.1') => {
  try {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    
    formData.append('document', blob, originalName);
    if (customPrompt) formData.append('customPrompt', customPrompt);
    if (model) formData.append('model', model);

    const response = await axios.post(process.env.NORSHIN_API_URL, formData, {
      headers: {
        'X-API-Key': process.env.NORSHIN_API_KEY,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 120000 // 2 minutes timeout
    });

    return response.data;
  } catch (error) {
    console.error('Norshin API Error:', error.response?.data || error.message);
    throw error;
  }
};

// Routes

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload and process single document
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    const { customPrompt, model } = req.body;
    
    console.log(`Processing: ${req.file.originalname}`);
    
    // Send to Norshin API
    const result = await sendToNorshinAPI(
      req.file.path, 
      req.file.originalname, 
      customPrompt, 
      model
    );

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      filename: req.file.originalname,
      result: result
    });

  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Processing failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// Upload and process multiple documents
app.post('/api/upload-multiple', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No documents provided' });
    }

    const { customPrompt, model } = req.body;
    const results = [];

    for (const file of req.files) {
      try {
        console.log(`Processing: ${file.originalname}`);
        
        const result = await sendToNorshinAPI(
          file.path, 
          file.originalname, 
          customPrompt, 
          model
        );

        results.push({
          filename: file.originalname,
          success: true,
          result: result
        });

        // Clean up file
        fs.unlinkSync(file.path);

      } catch (error) {
        results.push({
          filename: file.originalname,
          success: false,
          error: error.response?.data?.error || error.message
        });

        // Clean up file on error
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    res.json({
      success: true,
      processed: results.length,
      results: results
    });

  } catch (error) {
    // Clean up all files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      error: 'Batch processing failed',
      details: error.message
    });
  }
});

// Process static documents from documents folder
app.post('/api/process-static', async (req, res) => {
  try {
    const { filename, customPrompt, model } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const filePath = path.join(__dirname, 'documents', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found in documents folder' });
    }

    console.log(`Processing static document: ${filename}`);
    
    const result = await sendToNorshinAPI(filePath, filename, customPrompt, model);

    res.json({
      success: true,
      filename: filename,
      result: result
    });

  } catch (error) {
    res.status(500).json({
      error: 'Processing failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// Get list of static documents
app.get('/api/documents', (req, res) => {
  try {
    const documentsDir = path.join(__dirname, 'documents');
    const allowedExtensions = (process.env.ALLOWED_EXTENSIONS || '.pdf,.doc,.docx').split(',');
    
    if (!fs.existsSync(documentsDir)) {
      return res.json({ documents: [] });
    }

    const files = fs.readdirSync(documentsDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return allowedExtensions.includes(ext);
      })
      .map(file => {
        const filePath = path.join(documentsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          extension: path.extname(file).toLowerCase()
        };
      });

    res.json({ documents: files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    norshinAPI: process.env.NORSHIN_API_URL 
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload folder: ${path.join(__dirname, 'uploads')}`);
  console.log(`📄 Documents folder: ${path.join(__dirname, 'documents')}`);
  console.log(`🌐 Norshin API: ${process.env.NORSHIN_API_URL}`);
});

