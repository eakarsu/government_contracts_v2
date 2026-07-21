# Security and credential handling

## Required operator action

A credential file named `github_token.txt` was previously tracked in this repository and has been removed from the working tree. Treat that credential as compromised: revoke or rotate it in its issuing system and inspect repository history and forks. Removing the file from the current tree does not erase Git history.

The tracked client `.env` file was also removed. Client builds must contain only public browser configuration; server API keys belong in the server's untracked environment or a secret manager.

## Authentication and authorization

- Production accepts OIDC JWTs verified with the configured issuer, audience, JWKS URI, and `RS256` signature.
- Missing or invalid bearer credentials receive `401`; there is no anonymous development user.
- Permissions are enforced on governance, queue, legacy-write, audit-export, legal-hold, and reset operations.
- A decision creator, owner, or submitter cannot approve that decision.
- Released approval/rejection records and audit events are protected from update or deletion by service logic and database triggers.

## Data and transport

- PostgreSQL TLS verification is enabled when database SSL is configured; certificate verification is never disabled.
- Production CORS must use an explicit origin allowlist.
- Uploaded documents are not exposed through a static public route.
- Authoritative regulatory evidence must use HTTPS and is stored with retrieval/effective dates and a content digest.

## Reporting

Do not open a public issue containing credentials, contract documents, or vulnerability details. Report sensitive findings privately to the repository owner and include the affected revision, reproduction steps, and mitigation if known.
