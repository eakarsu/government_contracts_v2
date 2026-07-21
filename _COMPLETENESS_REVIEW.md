# Completeness Review: government_contracts_v2

**Review date:** 2026-07-18

## Assessment basis

Static inspection of project-owned source and configuration only; no dependency installation, build, database migration, external-service call, or runtime launch was performed. The scan considered 187 project files (126 source files), 2 manifest(s), 0 test-like file(s), and 0 CI workflow(s), excluding dependency/generated directories.

## Classification

**Functional but incomplete**

This is a substantive but unfinished governance/compliance application, not just an empty scaffold. Inspection found 126 source files across `client/`, `services/`, `routes/`, `utils/` using Next.js, React, Express, Prisma, Python; however, the checked-in workflow and delivery controls do not yet demonstrate a complete, production-operable product.

## Why it is not complete

- Mock, demo, sample, fixture, or placeholder behavior remains in executable/product paths.
- No recognizable project-owned automated tests were found for the main workflow.
- No checked-in CI workflow proves builds, tests, migrations, and security checks on every change.

## Needed features

1. Replace advisory-only AI output with versioned policies, evidence links, accountable owners, approvals, and immutable decisions.
2. Add authoritative regulatory/contract ingestion with source provenance, effective dates, jurisdiction, and change detection.
3. Implement SSO, least-privilege RBAC, segregation of duties, retention/legal holds, and exportable audit logs.
4. Build scenario-specific evaluations so citations, obligations, deadlines, and risk ratings are checked before release.
5. Add risk-based unit, integration, and end-to-end tests in CI, including migration and failure-path coverage.

## Risks or launch blockers

- Credential/configuration exposure: environment files are present in the repository tree and must be checked against Git history and rotated if real.
- Weak/fallback secret patterns can permit forged sessions or accidental insecure deployments.
- TLS certificate verification is disabled in inspected code.
- Automation contains destructive process, filesystem, or database operations; do not run it on a shared machine without review.

## Evidence inspected

- `config/database.js:6`
- `config/env.js:13`
- `server.js`
- `middleware/auth.js`
- `package.json`
- `start.sh`

## Recommended next action

Choose one real governance/compliance journey, define acceptance criteria and external contracts, then close its persistence, permission, integration, failure, and test gaps before expanding features.

## Implementation progress (2026-07-19)

Implemented the recommended governed compliance-decision journey and its production controls:

- Added versioned policies and authoritative regulatory-source ingestion with authority/document identifiers, HTTPS provenance, jurisdiction/effective windows, retrieval dates, SHA-256 content hashes, idempotency, supersession, and change detection.
- Added persisted evaluations for award acceptance, bid submission, and solicitation release. The workflow validates exact effective policy/source versions, citations, evidence, obligation owners/statuses, deadlines, risk, and rationale; AI output is explicitly advisory and cannot approve a decision.
- Added creator/owner submission, independent approval or rejection, unsatisfied-obligation blocking, seven-year retention, legal holds, immutable released decisions, and hash-chained JSON audit exports. PostgreSQL constraints and triggers independently enforce decision and audit immutability.
- Replaced anonymous/mock authentication with fail-closed OIDC JWT verification and least-privilege permissions. Added separation of duties, protected legacy writes/queue/reset operations, explicit production CORS, trusted-host checks, verified database TLS, and private upload storage.
- Removed the tracked GitHub token and client environment file, added safe examples/ignore rules and rotation guidance, removed weak secret/database fallbacks, and gated destructive local reset tools behind an exact confirmation plus environment/host checks.
- Disabled legacy RFP, bid-prediction, and AI regulatory endpoints that returned sample, random, or non-authoritative results. Replaced the vulnerable PDF parser, updated the local vector implementation and model runtime, migrated the client from Create React App to Vite, and reduced both server and client production dependency audits to zero findings.
- Added committed Prisma migration, locked server/client dependency trees, Docker migration ordering, deployment/security/workflow documentation, and CI on Node 22 with a fresh PostgreSQL 15 service.
- Added unit, HTTP journey, authorization, safety, vector-index, and opt-in real-PostgreSQL integration tests covering success, missing evidence/provenance, source changes, ineffective dates, invalid scenarios/obligations/deadlines, segregation of duties, immutable release, legal hold, audit tampering, and database triggers.

Verification completed: `npm ci`; `npm run ci` (22 non-database tests, with the database suite skipped outside CI); fresh-database `prisma migrate deploy`; the enabled Prisma/PostgreSQL integration suite; server module load without listening; JavaScript syntax checks; client `npm ci`, `npm test`, and `npm run build`; `npm audit --omit=dev` in both packages (zero findings); `docker compose config`; and `git diff --check`. Docker image execution was not tested locally because no Docker daemon was available; CI and Compose now exercise the same committed migrations and locked installs.

Operator follow-up: revoke/rotate the previously tracked GitHub credential and assess Git history/forks. Working-tree deletion cannot invalidate or erase a previously exposed credential.

## Runtime acceptance (2026-07-20)

The non-suite validator passed the complete disposable runtime journey on
PostgreSQL `55653`, API `6110`, and UI `6111`; the final repaired-state run at
`2026-07-20T21:15:33Z` recorded `API_VERIFIED / startup_login_session_api`.
Two diagnostic attempts are retained in the shard TSV: replacing the unsafe
launcher initially dropped its executable bit, then startup correctly rejected
the wildcard CORS value in the existing local environment. The final launcher
requires explicit ports/database configuration and never writes `.env`,
installs packages, opens a browser, or selects a default port. Environment-only
admin provisioning, bcrypt credentials, opaque token hashing, expiry, and
database revalidation proved real login, session, and authenticated API access.
The validator-visible legacy schema is now additive and no longer deletes rows
or inserts a repository credential.
