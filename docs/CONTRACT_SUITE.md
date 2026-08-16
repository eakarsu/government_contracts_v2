# Unified Contract Intelligence Suite

The contract suite consolidates distinct capabilities from the contract-focused projects into `government_contracts_v2`. It does not copy entire applications or create parallel contract, clause, document, approval, renewal, identity, or audit models. Every unique domain work item references an existing governed `ContractMatter` and uses the same permission and lifecycle audit controls.

## Deduplication decisions

| Source project | Disposition | Consolidated result |
| --- | --- | --- |
| `government_contracts_v2` | Destination | Existing opportunity intelligence, RFP, lifecycle, compliance, identity, evidence, and audit capabilities remain authoritative. |
| `AIContractLifecycleManager` | Deduplicated | Existing matter, party, document, clause, obligation, milestone, amendment, approval, renewal, template, risk, AI-review, integration, and audit implementations are retained once. |
| `AIContractNegotiationAssistant` | Unique features merged | Negotiation rounds, redline review, benchmarks, precedents, fallback matrices, playbooks, specialized analysis, regulatory alerts, deal-room controls, and signature readiness. |
| `ai-vendor-contract-risk-monitor` | Unique features merged | Vendor inventory, commercial renewal risk, data-processing terms, AI Act, DORA/NIS2, security commitments, exception controls, and executive briefings. |
| `AISmartContractAuditor` | Unique features merged | Read-only multichain assurance, source audit, vulnerabilities, formal verification, coverage, gas/cost simulation, deployment monitoring, upgrades, oracle risk, and remediation. |
| `AISportsAgentContractAnalyzer` | Unique features merged | Athlete valuation, salary cap, trade, injury/performance, endorsements, league rules, multi-party scenarios, escrow/holdbacks, scouting, and comparables. |
| `government_contracts` | Unique features merged | Acquisition qualification, compliance matrices, proposal planning, past performance, teaming, pricing, flow-downs, registration readiness, Q&A/amendments, color teams, submission, win themes, award handoff, and debrief learning. |
| `smart-contract-work` | Excluded—quarantine | No code, ABIs, credentials, providers, wallet actions, transaction logic, or assets were reused. The source archive's security and provenance boundaries remain controlling. |

## Shared governed model

`ContractCapabilityWorkItem` holds the domain-specific queue record, existing matter link, source provenance, status, priority, risk, accountable owner, optional commercial/scenario metrics, evidence snapshot, and recommendation. `ContractCapabilityAnalysis` is append-only, structured, advisory-only AI evidence. It cannot approve a work item or change its status.

The five supported domains are:

- `ACQUISITION`
- `NEGOTIATION`
- `VENDOR_RISK`
- `SMART_CONTRACT`
- `SPORTS`

Work items follow `OPEN → IN_REVIEW → DECISION_REQUIRED → APPROVED → CLOSED`, with controlled `BLOCKED` branches. Approval records the authenticated human and timestamp. Every create, transition, and AI review is also written to the existing hash-chained lifecycle audit.

## API

- `GET /api/contract-suite/catalog`
- `GET /api/contract-suite/overview`
- `GET /api/contract-suite/work-items?domain=&capability=&status=&search=`
- `GET /api/contract-suite/work-items/:id`
- `POST /api/contract-suite/work-items`
- `POST /api/contract-suite/work-items/:id/transition`
- `POST /api/contract-suite/work-items/:id/ai-review`

Read, create, submit, and AI actions use the existing `lifecycle:*` permissions. AI responses must use the structured report contract: executive summary, cited risk assessment, evidence gaps, recommended actions with owners, and a human-decision statement. Raw Markdown or JSON text is not rendered as the user-facing report.

Each domain workspace includes multiple purpose-built AI actions. Smart-Contract Assurance provides full security audit, formal-verification planning, gas/deployment cost, test coverage, upgrade/oracle risk, and multichain monitoring actions. Selecting an action fills the complete request context before submission: analysis type, objective, audience, risk tolerance, focus areas, assumptions, evidence requirements, jurisdiction/rule set, deadline, financial/materiality threshold, output style, requested sections, and the evidence-grounded question.

New reports are normalized into professional sections even when a provider uses wrapped or snake-case field names. The UI renders executive decision, decision metrics, risks, evidence gaps, control checks, recommended actions, and the required human decision gate. JSON syntax and code fences are never presented as the report.

## Demonstration data

After lifecycle seeding, run:

```sh
npm run seed:contract-suite
```

The idempotent seed adds at least 16 records per domain and one append-only structured analysis per record. It never deletes or resets data.

## Smart-contract boundary

Smart-contract assurance is source-analysis and evidence workflow only. It does not connect wallets, hold private keys, access quarantined credentials, sign or submit transactions, claim economic assurance, or reuse the `smart-contract-work` archive. Any future live-chain capability requires a separately approved clean-room implementation, supported dependencies, legal/provenance approval, security review, segregation of duties, and recovery controls.
