# Government Contract Lifecycle and Compliance Platform

This service combines government opportunity intelligence with an evidence-backed contract lifecycle and approval-controlled compliance decision workflow. It manages matters from intake through closeout, records the exact policy version and authoritative regulatory source used for consequential evaluations, enforces separation of duties, and exports verifiable append-only audit chains.

Legacy RFP generation, bid prediction, and AI-generated regulatory-checklist endpoints are intentionally unavailable. They return `410` or `501` instead of presenting sample, random, or model-generated content as authoritative output.

## Supported decision journey

1. A policy administrator creates a versioned policy with jurisdiction, effective dates, owner, and structured rules.
2. A regulatory ingestor records an authoritative source with authority, document identifier, HTTPS evidence URL, retrieval date, effective dates, and content hash. Changed content creates a new superseding version; unchanged content is idempotent.
3. An analyst evaluates `AWARD_ACCEPTANCE`, `BID_SUBMISSION`, or `SOLICITATION_RELEASE`, citing the selected source and attaching evidence, obligation owners and statuses, deadlines, risk, and rationale.
4. The creator or accountable owner submits the draft.
5. A different authorized approver approves or rejects it with rationale. Unsatisfied obligations block approval. Advisory AI output is retained only as evidence and cannot approve a decision.
6. The released decision is immutable. Records officers may apply a legal hold, and auditors may export the decision and its verified hash-chained audit manifest.

See [docs/GOVERNANCE_DECISIONS.md](docs/GOVERNANCE_DECISIONS.md) for API requests and acceptance criteria.

## Contract lifecycle journey

The unified lifecycle workspace adds:

- government contract matters linked to SAM.gov notices when applicable;
- parties, UEI/CAGE identifiers, counterparty roles, sanctions status, and risk;
- immutable document versions with source URLs, content digests, privilege labels, and effective dates;
- cited clauses, approved fallback language, human disposition, and AI confidence evidence;
- obligations, milestones, accountable owners, recurrence, deadlines, evidence, and escalation;
- amendments and redlines with price, schedule, clause, and compliance impact;
- independent legal, business, compliance, and security approval evidence;
- option periods, renewal decisions, notice deadlines, and expected value;
- multi-domain risk assessments, advisory AI reviews, and an idempotent integration outbox;
- a separately hash-chained lifecycle audit export.

Lifecycle stages advance only through `INTAKE`, `DILIGENCE`, `NEGOTIATION`, `APPROVAL`, `EXECUTION`, `PERFORMANCE`, `RENEWAL`, and `CLOSEOUT`. Execution requires legal, business, and compliance approvals. AI reviews are always stored as advisory-only evidence and cannot change a lifecycle stage or compliance decision.

See [docs/CONTRACT_LIFECYCLE.md](docs/CONTRACT_LIFECYCLE.md) for the data model, API surface, permissions, and operational boundaries.

## Unified contract intelligence suite

Five deduplicated domain workspaces extend the governed lifecycle without recreating its records: acquisition operations, negotiation intelligence, vendor risk, smart-contract assurance, and sports contracts. Each work item links to an existing contract matter, retains source provenance and evidence, follows a human-controlled status workflow, and stores AI output as structured append-only evidence.

The historical `smart-contract-work` repository remains quarantined. No wallet, provider, credential, ABI, transaction, or source asset from that archive is included. See [docs/CONTRACT_SUITE.md](docs/CONTRACT_SUITE.md) for the feature map, duplicate decisions, API, and safety boundary.

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
npm run seed:lifecycle # optional, idempotent demonstration records
npm run seed:contract-suite # optional; run after lifecycle seed
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

Authorization is permission-based and deny-by-default. The main roles are `policy_admin`, `regulatory_ingestor`, `compliance_analyst`, `compliance_approver`, `contract_manager`, `legal_reviewer`, `contract_viewer`, `records_officer`, and `auditor`; `admin` is the only wildcard role. See [SECURITY.md](SECURITY.md) before deploying or using a clone that predates the credential cleanup.
