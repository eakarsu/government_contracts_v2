ALTER TABLE "contract_matter"
  ADD CONSTRAINT "contract_matter_retention" CHECK ("retention_until" > "created_at");

ALTER TABLE "contract_party"
  ADD CONSTRAINT "contract_party_risk" CHECK ("risk_rating" IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD CONSTRAINT "contract_party_sanctions" CHECK ("sanctions_status" IN ('CLEAR','PENDING_REVIEW','MATCH','BLOCKED'));

ALTER TABLE "contract_document_version"
  ADD CONSTRAINT "contract_document_digest" CHECK ("content_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "contract_document_source_https" CHECK ("source_url" IS NULL OR "source_url" LIKE 'https://%'),
  ADD CONSTRAINT "contract_document_version_positive" CHECK ("version" > 0);

ALTER TABLE "contract_clause"
  ADD CONSTRAINT "contract_clause_risk" CHECK ("risk_level" IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD CONSTRAINT "contract_clause_confidence" CHECK ("ai_confidence" IS NULL OR ("ai_confidence" >= 0 AND "ai_confidence" <= 1));

ALTER TABLE "contract_obligation"
  ADD CONSTRAINT "contract_obligation_status" CHECK ("status" IN ('OPEN','IN_PROGRESS','SATISFIED','AT_RISK','WAIVED')),
  ADD CONSTRAINT "contract_obligation_evidence_https" CHECK ("evidence_url" IS NULL OR "evidence_url" LIKE 'https://%'),
  ADD CONSTRAINT "contract_obligation_escalation" CHECK ("escalation_level" BETWEEN 0 AND 5);

ALTER TABLE "contract_milestone"
  ADD CONSTRAINT "contract_milestone_status" CHECK ("status" IN ('UPCOMING','IN_PROGRESS','COMPLETED','AT_RISK','WAIVED')),
  ADD CONSTRAINT "contract_milestone_evidence_https" CHECK ("evidence_url" IS NULL OR "evidence_url" LIKE 'https://%');

ALTER TABLE "contract_amendment"
  ADD CONSTRAINT "contract_amendment_risk" CHECK ("risk_level" IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD CONSTRAINT "contract_amendment_status" CHECK ("status" IN ('DRAFT','UNDER_REVIEW','APPROVED','REJECTED','EXECUTED'));

ALTER TABLE "contract_approval"
  ADD CONSTRAINT "contract_approval_step" CHECK ("step" IN ('LEGAL','BUSINESS','COMPLIANCE','SECURITY')),
  ADD CONSTRAINT "contract_approval_decision" CHECK ("decision" IN ('APPROVED','REJECTED'));

ALTER TABLE "contract_renewal"
  ADD CONSTRAINT "contract_renewal_status" CHECK ("status" IN ('MONITORING','RECOMMENDED','DECISION_REQUIRED','EXERCISED','DECLINED')),
  ADD CONSTRAINT "contract_renewal_deadlines" CHECK ("exercise_deadline" >= "notice_deadline"),
  ADD CONSTRAINT "contract_renewal_value" CHECK ("estimated_value" >= 0);

ALTER TABLE "contract_risk_assessment"
  ADD CONSTRAINT "contract_risk_scores" CHECK (
    "legal_score" BETWEEN 0 AND 100 AND "financial_score" BETWEEN 0 AND 100 AND
    "operational_score" BETWEEN 0 AND 100 AND "cybersecurity_score" BETWEEN 0 AND 100 AND
    "compliance_score" BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT "contract_risk_rating" CHECK ("overall_rating" IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ADD CONSTRAINT "contract_risk_digest" CHECK ("source_digest" ~ '^[a-f0-9]{64}$');

ALTER TABLE "contract_template"
  ADD CONSTRAINT "contract_template_status" CHECK ("status" IN ('DRAFT','APPROVED','RETIRED')),
  ADD CONSTRAINT "contract_template_version_positive" CHECK ("version" > 0);

ALTER TABLE "contract_ai_review"
  ADD CONSTRAINT "contract_ai_advisory_only" CHECK ("advisory_only" = true),
  ADD CONSTRAINT "contract_ai_prompt_digest" CHECK ("prompt_digest" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "contract_ai_confidence" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  ADD CONSTRAINT "contract_ai_status" CHECK ("status" IN ('PENDING_HUMAN_REVIEW','ACCEPTED','REJECTED','SUPERSEDED'));

ALTER TABLE "contract_integration_outbox"
  ADD CONSTRAINT "contract_outbox_status" CHECK ("status" IN ('PENDING','PROCESSING','RETRY','DELIVERED','DEAD_LETTER')),
  ADD CONSTRAINT "contract_outbox_attempts" CHECK ("attempts" >= 0);
