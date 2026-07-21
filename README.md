# Government Contracts Compliance Platform

This service provides an evidence-backed, approval-controlled compliance decision workflow for government-contract scenarios. It records the exact policy version and authoritative regulatory source used for each evaluation, enforces separation of duties, and exports a verifiable append-only audit chain.

Legacy RFP generation, bid prediction, and AI-generated regulatory-checklist endpoints are intentionally unavailable. They return `410` or `501` instead of presenting sample, random, or model-generated content as authoritative output.

## Supported decision journey

1. A policy administrator creates a versioned policy with jurisdiction, effective dates, owner, and structured rules.
2. A regulatory ingestor records an authoritative source with authority, document identifier, HTTPS evidence URL, retrieval date, effective dates, and content hash. Changed content creates a new superseding version; unchanged content is idempotent.
3. An analyst evaluates `AWARD_ACCEPTANCE`, `BID_SUBMISSION`, or `SOLICITATION_RELEASE`, citing the selected source and attaching evidence, obligation owners and statuses, deadlines, risk, and rationale.
4. The creator or accountable owner submits the draft.
5. A different authorized approver approves or rejects it with rationale. Unsatisfied obligations block approval. Advisory AI output is retained only as evidence and cannot approve a decision.
6. The released decision is immutable. Records officers may apply a legal hold, and auditors may export the decision and its verified hash-chained audit manifest.

See [docs/GOVERNANCE_DECISIONS.md](docs/GOVERNANCE_DECISIONS.md) for API requests and acceptance criteria.

## Configuration

Copy `.env.example` to `.env` for local development and set every required value. Do not commit `.env` files.

Production requires:

- `DATABASE_URL` and TLS-enabled database settings (`DATABASE_SSL=true`; optionally `DATABASE_SSL_CA`)
- OIDC authentication: `AUTH_MODE=oidc`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URI`
- an explicit `CORS_ORIGINS` allowlist

`AUTH_MODE=local` is test/development only and requires a JWT secret of at least 32 characters. Startup rejects local authentication in production, wildcard production CORS, and incomplete identity-provider configuration.

## Database and startup

Apply committed migrations before starting an application release:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm start
```

The local Docker Compose stack requires `POSTGRES_PASSWORD` plus the OIDC and CORS values above, and runs the migration job before the API:

```sh
POSTGRES_PASSWORD='replace-me' docker compose up --build
```

The API health endpoint is `GET /api/health`. Uploaded files are not exposed as a public static directory.

## Verification

```sh
npm ci
npm run prisma:validate
npm test

cd client
npm ci
npm test
npm run build
```

CI repeats schema validation, applies migrations to a fresh PostgreSQL service, runs the server tests, and builds the client.

## Destructive operations

Reset utilities and reset administration endpoints are denied unless all of the following hold: the runtime is not production, the database host is local, and `ALLOW_DESTRUCTIVE_RESET=DELETE_LOCAL_GOVERNANCE_DATA` is supplied exactly. Reset administration also requires the `system:reset` permission.

## Security

Authorization is permission-based and deny-by-default. The main roles are `policy_admin`, `regulatory_ingestor`, `compliance_analyst`, `compliance_approver`, `records_officer`, and `auditor`; `admin` is the only wildcard role. See [SECURITY.md](SECURITY.md) before deploying or using a clone that predates the credential cleanup.
