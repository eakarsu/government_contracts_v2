# Production operations

The production application requires OIDC (`AUTH_MODE=oidc`), explicit host and CORS allowlists, TLS at the reverse proxy, separate production and test PostgreSQL databases, and secrets supplied by the deployment secret store. Never commit API keys or database credentials.

## Backups and recovery

Set `BACKUP_DIRECTORY` to an encrypted, access-restricted volume and schedule `scripts/backup-production.sh` daily. Copy encrypted backups off-host. Alert when `GET /api/operations/readiness` reports stale backups. Test a restore into an isolated recovery database at least quarterly with `pg_restore --clean --if-exists --dbname="$RECOVERY_DATABASE_URL" backup.dump`; never test restoration against production.

## Secret rotation

Rotate SAM.gov, OpenRouter, OIDC client, database, and session-signing credentials in the secret store. Deploy the new value, verify readiness and one authenticated transaction, then revoke the old value. The readiness endpoint reports only whether keys are configured and never returns their values.

## Monitoring and incidents

Monitor HTTP 5xx rate, request latency, AI-provider failures, PostgreSQL availability, disk utilization, queue dead letters, stale processing leases, amendment detections, failed approval checks, and backup age. The queue maintenance task runs every `PIPELINE_MAINTENANCE_INTERVAL_MS` and moves exhausted items to the dead-letter queue. Requeue a corrected item through the admin endpoint rather than editing database state.

Preserve application, reverse-proxy, OIDC, RFP audit, and infrastructure logs according to the organization's retention policy. RFP approval and audit records are immutable at the database layer.

## Disaster recovery

Document owners for declaration, database recovery, file/object-store recovery, secret issuance, DNS/reverse-proxy recovery, validation, and stakeholder communication. The recovery test must verify authentication, SAM ingestion, attachment extraction, proposal generation, approval gates, package download, and recorded submission without sending a real submission.
