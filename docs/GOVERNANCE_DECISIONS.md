# Governance decision workflow

All endpoints below require `Authorization: Bearer <token>`. In production, tokens come from the configured OIDC provider. Request bodies are JSON.

## API sequence

| Step | Endpoint | Required permission | Result |
|---|---|---|---|
| Create policy version | `POST /api/governance/policies` | `policy:create` | Immutable identity for policy key/version, jurisdiction, rules, and effective window |
| Ingest source | `POST /api/governance/sources` | `source:ingest` | Authoritative source version, SHA-256 content hash, provenance, and change result |
| Draft evaluation | `POST /api/governance/evaluations` | `evaluation:create` | Scenario evaluation linked to exact policy/source versions |
| Submit | `POST /api/governance/evaluations/:id/submit` | `evaluation:submit` | Pending approval; only creator or accountable owner may submit |
| Decide | `POST /api/governance/evaluations/:id/decision` | `decision:approve` | Immutable approval or rejection by an independent approver |
| Legal hold | `POST /api/governance/evaluations/:id/legal-hold` | `legal_hold:manage` | Retention override recorded in the audit chain |
| Audit export | `GET /api/governance/evaluations/:id/export` | `audit:export` | Decision, audit events, and a manifest hash after chain verification |

## Required evaluation evidence

An evaluation is rejected unless it contains:

- one supported scenario: `AWARD_ACCEPTANCE`, `BID_SUBMISSION`, or `SOLICITATION_RELEASE`;
- matching jurisdiction and effective dates across evaluation, policy, and regulatory source;
- at least one citation to the selected regulatory source and one HTTPS evidence link;
- at least one obligation with an accountable owner and explicit status;
- risk rating and rationale;
- for bid submission, at least one checked deadline linked to a citation.

Optional `advisoryOutput` may contain model-assisted analysis. It is stored as non-authoritative evidence, cannot move a draft forward, and cannot satisfy approval controls.

## Decision controls

Approval requires every obligation to be `SATISFIED` or `NOT_APPLICABLE`. The approver must not be the creator, owner, or submitter. Both approval and rejection require a substantive rationale. The released record receives an immutable digest, and subsequent attempts to alter its decision fields fail in both the service and PostgreSQL.

Every governance action appends an event that contains the prior event hash. Audit export verifies that chain before returning data and produces a separate manifest digest for the export payload. The default retention period is seven years; a legal hold prevents routine disposition.

## Acceptance coverage

The automated tests cover successful journeys and failure paths for missing provenance, ineffective policy/source dates, unsupported scenarios, missing citations/evidence/obligations/deadlines, invalid obligation status, advisory-only output, unauthorized operations, separation of duties, unsatisfied approval, released-record immutability, retention/legal hold, source change detection, duplicate ingestion, and audit tamper detection.
