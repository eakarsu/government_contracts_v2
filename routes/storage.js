'use strict';

const fs = require('fs-extra');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const config = require('../config/env');
const { prisma } = require('../config/database');
const { requirePermission } = require('../middleware/auth');
const { DocumentStorageService } = require('../services/documentStorageService');

const router = express.Router();
const storageService = new DocumentStorageService({ prisma });
const upload = multer({
  storage: multer.diskStorage({ destination: config.uploadDir, filename: (_req, file, callback) => callback(null, `${Date.now()}-${path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_')}`) }),
  limits: { fileSize: config.maxFileSize },
  fileFilter: (_req, file, callback) => callback(null, config.allowedExtensions.includes(path.extname(file.originalname).toLowerCase())),
});

router.post('/documents', requirePermission('rfp:author'), upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'An allowed proposal document is required' });
  try {
    const document = await storageService.secureFile(req.file.path, { originalFilename: req.file.originalname, contentType: req.file.mimetype, createdBy: req.user.email || req.user.id });
    if (config.storageProvider === 's3') await fs.remove(req.file.path);
    return res.status(201).json({ document: { id: document.id, originalFilename: document.originalFilename, checksum: document.checksum, malwareStatus: document.malwareStatus, storageProvider: document.storageProvider } });
  } catch (error) {
    await fs.remove(req.file.path).catch(() => {});
    return res.status(error.code === 'MALWARE_DETECTED' ? 422 : 500).json({ error: error.message });
  }
});

module.exports = router;
