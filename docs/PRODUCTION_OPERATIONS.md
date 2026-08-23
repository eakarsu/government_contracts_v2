# Production operations

The production application fails closed unless OIDC (`AUTH_MODE=oidc`), tenant claims, explicit host/CORS allowlists, durable workers, required malware scanning, encrypted S3-compatible document storage, and notification encryption are configured. TLS terminates at the reverse proxy. Production and test use separate PostgreSQL databases; secrets come only from the deployment secret store.

Bootstrap the first OIDC tenant administrator with `npm run provision:tenant-admin` and the acknowledgement/environment variables documented in `scripts/provision-tenant-admin.js`. Thereafter manage memberships through `/api/tenant-admin`; never create local password users in production. Tenant-owned queries are scoped from the verified OIDC tenant claim.

Test/debug routes are disabled with `ENABLE_TEST_ENDPOINTS=false`. Destructive reset endpoints additionally reject every production request even for administrators.

## Durable workers and protected documents

Run the API and `npm run worker` as separate supervised containers with `PIPELINE_EXECUTION_MODE=durable`. PostgreSQL leases make OCR and vector-index work restart-safe; expired leases are recovered with bounded retries. Monitor failed durable tasks through `/api/operations/tasks` and retry only after correcting the underlying issue.

Production documents use an S3-compatible bucket with versioning and Object Lock enabled. Configure `DOCUMENT_STORAGE_PROVIDER=s3`, server-side encryption/KMS, and retention. Every file is scanned before OCR or external processing. If the scanner is unavailable in required mode, processing stops rather than bypassing the control.

## Backups and recovery

Set `BACKUP_HOST_DIRECTORY` to an access-restricted off-host-backed directory and mount `BACKUP_ENCRYPTION_KEY_HOST_FILE` from the secret store. The supervised `backup` container runs daily, writes encrypted `.dump.enc` files, and verifies that each archive can be decrypted and read by `pg_restore`. When `RESTORE_TEST_DATABASE_URL` names an isolated `restore_test` database, it also performs a real clean restore. Never point restore testing at production.

## Secret rotation

Rotate SAM.gov, OpenRouter, OIDC client, database, S3, backup, notification-encryption, and monitoring credentials in the secret store. Deploy the new value, verify readiness and one authenticated transaction, then revoke the old value. Record only the provider/version fingerprint and expiry through `/api/tenant-admin/secret-rotations`; secret values are never stored there.

## Monitoring and incidents

Scrape `/metrics` with `x-monitoring-token` and send application exceptions to the configured Sentry project. Monitor HTTP 5xx rate, request latency, AI-provider failures, PostgreSQL availability, object storage, disk utilization, failed/expired durable work, dead letters, amendment detections, approval failures, malware scan failures, and backup age. Requeue a corrected item through the operations endpoint rather than editing database state.

Saved searches and notification subscriptions support in-app, SMTP email, Teams/Slack HTTPS webhooks, and calendar messages. Destinations are AES-256-GCM encrypted. Deadline and reviewer notifications remain advisory; the authoritative solicitation deadline and assigned reviewer must be confirmed by a human.

Preserve application, reverse-proxy, OIDC, RFP audit, and infrastructure logs according to the organization's retention policy. RFP approval and audit records are immutable at the database layer.

## Disaster recovery

Document owners for declaration, database recovery, file/object-store recovery, secret issuance, DNS/reverse-proxy recovery, validation, and stakeholder communication. The recovery test must verify authentication, SAM ingestion, attachment extraction, proposal generation, approval gates, package download, and recorded submission without sending a real submission.
