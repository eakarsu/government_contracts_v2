'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config/env');
const { prisma } = require('../config/database');
const { currentTenantId } = require('./tenantContext');
const { scanFile } = require('./malwareScanner');

function safeSegment(value) {
  return String(value || 'document').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
}

class DocumentStorageService {
  constructor(options = {}) {
    this.prisma = options.prisma || prisma;
    this.config = options.config || config;
    this.s3 = options.s3 || null;
  }

  async client() {
    if (this.s3) return this.s3;
    const { S3Client } = require('@aws-sdk/client-s3');
    this.s3 = new S3Client({
      endpoint: this.config.s3Endpoint,
      region: this.config.s3Region,
      forcePathStyle: this.config.s3ForcePathStyle,
      credentials: { accessKeyId: this.config.s3AccessKeyId, secretAccessKey: this.config.s3SecretAccessKey },
    });
    return this.s3;
  }

  async secureFile(filePath, metadata = {}) {
    const stat = await fs.stat(filePath);
    const bytes = await fs.readFile(filePath);
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    const malware = await scanFile(filePath, this.config);
    const tenantId = currentTenantId() || metadata.tenantId || this.config.defaultTenantId;
    const originalFilename = metadata.originalFilename || path.basename(filePath);
    const objectKey = `${safeSegment(tenantId)}/${new Date().toISOString().slice(0, 10)}/${checksum}-${safeSegment(originalFilename)}`;
    const retentionUntil = new Date(Date.now() + this.config.s3RetentionDays * 86400000);
    let versionId = null;
    let bucket = null;
    let provider = 'filesystem';
    let encryption = 'FILESYSTEM';

    if (this.config.storageProvider === 's3') {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      bucket = this.config.s3Bucket;
      const uploaded = await (await this.client()).send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: metadata.contentType || 'application/octet-stream',
        ChecksumSHA256: Buffer.from(checksum, 'hex').toString('base64'),
        ServerSideEncryption: this.config.s3KmsKeyId ? 'aws:kms' : 'AES256',
        ...(this.config.s3KmsKeyId ? { SSEKMSKeyId: this.config.s3KmsKeyId } : {}),
        ObjectLockMode: 'GOVERNANCE',
        ObjectLockRetainUntilDate: retentionUntil,
        Metadata: { tenant: tenantId, checksum },
      }));
      versionId = uploaded.VersionId || null;
      provider = 's3';
      encryption = this.config.s3KmsKeyId ? 'SSE_KMS' : 'SSE_S3';
    }

    const persistedKey = provider === 'filesystem' ? path.resolve(filePath) : objectKey;
    const existing = await this.prisma.storedDocument.findFirst({ where: { checksum, objectKey: persistedKey } });
    if (existing) return existing;
    return this.prisma.storedDocument.create({
      data: {
        tenantId,
        queueDocumentId: metadata.queueDocumentId || null,
        storageProvider: provider,
        bucket,
        objectKey: persistedKey,
        storageVersionId: versionId,
        originalFilename,
        contentType: metadata.contentType || 'application/octet-stream',
        byteSize: stat.size,
        checksum,
        encryption,
        malwareStatus: malware.status,
        malwareEngine: malware.engine,
        malwareScannedAt: malware.status === 'SKIPPED' ? null : new Date(),
        retentionUntil: provider === 's3' ? retentionUntil : null,
        createdBy: String(metadata.createdBy || 'pipeline-worker'),
      },
    });
  }

  async materializeForQueue(queueDocumentId, targetPath) {
    const record = await this.prisma.storedDocument.findFirst({ where: { queueDocumentId: Number(queueDocumentId), malwareStatus: 'CLEAN', storageProvider: 's3' }, orderBy: { createdAt: 'desc' } });
    if (!record) return null;
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const response = await (await this.client()).send(new GetObjectCommand({ Bucket: record.bucket, Key: record.objectKey, ...(record.storageVersionId ? { VersionId: record.storageVersionId } : {}) }));
    const bytes = Buffer.from(await response.Body.transformToByteArray());
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    if (checksum !== record.checksum) throw new Error('Stored document checksum verification failed');
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, bytes, { mode: 0o600 });
    return targetPath;
  }

  async releaseLocalCache(filePath) {
    if (this.config.storageProvider !== 's3' || !filePath) return false;
    const resolved = path.resolve(filePath);
    const roots = ['downloaded_documents', this.config.uploadDir, this.config.documentsDir].map(value => path.resolve(value));
    if (!roots.some(root => resolved.startsWith(`${root}${path.sep}`))) return false;
    await fs.rm(resolved, { force: true });
    return true;
  }
}

module.exports = { DocumentStorageService };
