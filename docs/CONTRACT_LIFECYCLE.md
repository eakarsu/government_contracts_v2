# Governed Contract Lifecycle

## Purpose

The lifecycle module brings the general contract-management capabilities from `AIContractLifecycleManager` into the stronger government-contract governance boundary in this repository. The government compliance decision remains authoritative; lifecycle and AI records cannot approve an award, bid submission, solicitation release, signature, or government commitment.

## Workflow

| Stage | Primary evidence | Exit control |
| --- | --- | --- |
| Intake | Matter, agency, parties, notice linkage | Accountable owner assigned |
| Diligence | Documents, clauses, citations, risk findings | Evidence gaps dispositioned |
| Negotiation | Amendments, fallback language, commercial impact | Redline and authority review |
| Approval | Legal, business, compliance, security decisions | Legal, business, and compliance approval required |
| Execution | Signed/versioned documents and provider receipt | Human-authorized execution evidence |
| Performance | Obligations, milestones, deliverables, exceptions | Evidence-linked performance review |
| Renewal | Option periods, notice dates, value, recommendation | Contracting authority decision |
| Closeout | Final deliverables, records, retention, legal hold | Audit-ready closeout package |

Only the next adjacent stage is permitted. Skipped and reverse transitions fail closed. Adjustments are represented as new evidence instead of rewriting document, approval, risk, AI, or audit history.

## API

- `GET /api/lifecycle/catalog` — available lifecycle workspaces.
- `GET /api/lifecycle/overview` — counts and actionable risk metrics.
- `GET /api/lifecycle/:resource` — searchable governed records.
- `POST /api/lifecycle/matters` — open a matter.
- `POST /api/lifecycle/:resource` — add a supported matter record.
- `POST /api/lifecycle/matters/:id/transition` — advance one controlled stage.
- `POST /api/lifecycle/matters/:id/approvals` — append an independent approval.
- `POST /api/lifecycle/matters/:id/ai-review` — run and retain advisory analysis.
- `GET /api/lifecycle/matters/:id/export` — verify and export the lifecycle evidence and audit chain.

The resource catalog includes matters, parties, document versions, clauses, obligations, milestones, amendments, approvals, renewals, risk assessments, templates, AI reviews, and the integration outbox.

## Permissions

- `lifecycle:read` — view lifecycle workspaces.
- `lifecycle:create` — create matters and supported linked records.
- `lifecycle:update` — maintain mutable operational records.
- `lifecycle:submit` — advance lifecycle stages.
- `lifecycle:approve` — record independent approval evidence.
- `lifecycle:ai` — request advisory AI analysis.
- `lifecycle:export` — verify and export the evidence package.

`contract_manager` manages the operational journey but cannot approve it. `legal_reviewer` can record an independent approval but is still subject to creator/owner segregation. `auditor` and `records_officer` can export but cannot mutate the lifecycle.

## Demonstration data

`npm run seed:lifecycle` non-destructively creates at least 16 linked records in every lifecycle table. It uses stable keys and does not delete or replace existing records. Demonstration AI results are clearly labeled `seeded-advisory-example`; they are not represented as provider output.

## External boundaries

Provider actions are written to an idempotent outbox. Production delivery still requires approved adapters, credentials, webhook verification, reconciliation, and failure monitoring for systems such as SAM.gov, e-signature, CRM, ERP, document/OCR, and notification providers. Legal conclusions and FAR/DFARS interpretations require qualified acquisition and legal reviewers using current authoritative sources.
