# Security and credential handling

## Required operator action

A credential file named `github_token.txt` was previously tracked in this repository and has been removed from the working tree. Treat that credential as compromised: revoke or rotate it in its issuing system and inspect repository history and forks. Removing the file from the current tree does not erase Git history.

The tracked client `.env` file was also removed. Client builds must contain only public browser configuration; server API keys belong in the server's untracked environment or a secret manager.

## Authentication and authorization

- Production accepts OIDC JWTs verified with the configured issuer, audience, JWKS URI, and `RS256` signature.
- Missing or invalid bearer credentials receive `401`; there is no anonymous development user.
- Permissions are enforced on governance, lifecycle read/create/update/submit/approve/AI/export, queue, legacy-write, audit-export, legal-hold, and reset operations.
- A decision creator, owner, or submitter cannot approve that decision.
- Released approval/rejection records and audit events are protected from update or deletion by service logic and database triggers.
- Contract document versions, lifecycle approvals, risk assessments, AI review evidence, and lifecycle audit events are append-only at the database layer.
- Consolidated contract-suite AI analyses are structured, advisory-only, and append-only; only an authenticated human transition can approve a work item.
- Lifecycle execution requires separate legal, business, and compliance approval records; AI cannot satisfy an approval requirement.

## Data and transport

- PostgreSQL TLS verification is enabled when database SSL is configured; certificate verification is never disabled.
- Production CORS must use an explicit origin allowlist.
- Uploaded documents are not exposed through a static public route.
- Authoritative regulatory evidence must use HTTPS and is stored with retrieval/effective dates and a content digest.
- Lifecycle AI prompts are constructed from stored matter evidence. Responses are retained with their model, prompt digest, citations, status, and advisory-only flag for human review.
- The `smart-contract-work` archive is a prohibited quarantine source. Do not import its code, ABIs, credentials, providers, wallets, transactions, build artifacts, or other assets into this application.

## Reporting

Do not open a public issue containing credentials, contract documents, or vulnerability details. Report sensitive findings privately to the repository owner and include the affected revision, reproduction steps, and mitigation if known.
