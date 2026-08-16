CREATE TABLE "contract_matter" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "contract_notice_id" TEXT, "matter_number" TEXT NOT NULL,
  "title" TEXT NOT NULL, "agency" TEXT NOT NULL, "contract_type" TEXT NOT NULL, "jurisdiction" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'INTAKE', "status" TEXT NOT NULL DEFAULT 'ACTIVE', "owner_id" TEXT NOT NULL,
  "created_by" TEXT NOT NULL, "legal_hold" BOOLEAN NOT NULL DEFAULT false, "retention_until" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_matter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_matter_stage" CHECK ("stage" IN ('INTAKE','DILIGENCE','NEGOTIATION','APPROVAL','EXECUTION','PERFORMANCE','RENEWAL','CLOSEOUT')),
  CONSTRAINT "contract_matter_status" CHECK ("status" IN ('ACTIVE','ON_HOLD','COMPLETED','TERMINATED'))
);
CREATE UNIQUE INDEX "contract_matter_matter_number_key" ON "contract_matter"("matter_number");
CREATE INDEX "contract_matter_stage_status_idx" ON "contract_matter"("stage","status");
CREATE INDEX "contract_matter_owner_id_updated_at_idx" ON "contract_matter"("owner_id","updated_at");
ALTER TABLE "contract_matter" ADD CONSTRAINT "contract_matter_contract_notice_id_fkey" FOREIGN KEY ("contract_notice_id") REFERENCES "contract"("notice_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "contract_party" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "name" TEXT NOT NULL, "party_type" TEXT NOT NULL,
  "contract_role" TEXT NOT NULL, "uei" TEXT, "cage_code" TEXT, "risk_rating" TEXT NOT NULL DEFAULT 'LOW',
  "sanctions_status" TEXT NOT NULL DEFAULT 'CLEAR', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "contract_party_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contract_party_matter_id_party_type_idx" ON "contract_party"("matter_id","party_type");
CREATE UNIQUE INDEX "contract_party_matter_name_role_key" ON "contract_party"("matter_id","name","contract_role");

CREATE TABLE "contract_document_version" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "document_type" TEXT NOT NULL, "title" TEXT NOT NULL,
  "version" INTEGER NOT NULL, "source_url" TEXT, "content_hash" TEXT NOT NULL, "privilege" TEXT NOT NULL DEFAULT 'BUSINESS_CONFIDENTIAL',
  "effective_date" TIMESTAMP(3), "uploaded_by" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_document_version_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_document_version_matter_title_version_key" ON "contract_document_version"("matter_id","title","version");
CREATE INDEX "contract_document_version_matter_type_idx" ON "contract_document_version"("matter_id","document_type");

CREATE TABLE "contract_clause" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "document_version_id" TEXT, "clause_key" TEXT NOT NULL,
  "title" TEXT NOT NULL, "category" TEXT NOT NULL, "text" TEXT NOT NULL, "citation" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL DEFAULT 'LOW', "status" TEXT NOT NULL DEFAULT 'IDENTIFIED', "fallback_text" TEXT,
  "ai_confidence" DOUBLE PRECISION, "reviewed_by" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "contract_clause_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_clause_matter_clause_key_key" ON "contract_clause"("matter_id","clause_key");
CREATE INDEX "contract_clause_matter_risk_status_idx" ON "contract_clause"("matter_id","risk_level","status");

CREATE TABLE "contract_obligation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "clause_id" TEXT, "reference" TEXT NOT NULL,
  "description" TEXT NOT NULL, "owner_id" TEXT NOT NULL, "due_date" TIMESTAMP(3), "recurrence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN', "evidence_url" TEXT, "escalation_level" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_obligation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_obligation_matter_reference_key" ON "contract_obligation"("matter_id","reference");
CREATE INDEX "contract_obligation_status_due_date_idx" ON "contract_obligation"("status","due_date");

CREATE TABLE "contract_milestone" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "reference" TEXT NOT NULL, "name" TEXT NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'UPCOMING', "owner_id" TEXT NOT NULL, "evidence_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_milestone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_milestone_matter_reference_key" ON "contract_milestone"("matter_id","reference");
CREATE INDEX "contract_milestone_status_due_date_idx" ON "contract_milestone"("status","due_date");

CREATE TABLE "contract_amendment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "document_version_id" TEXT,
  "amendment_number" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "effective_date" TIMESTAMP(3) NOT NULL,
  "price_delta" DOUBLE PRECISION NOT NULL DEFAULT 0, "impact_summary" TEXT NOT NULL, "risk_level" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "created_by" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "contract_amendment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_amendment_matter_number_key" ON "contract_amendment"("matter_id","amendment_number");
CREATE INDEX "contract_amendment_status_effective_date_idx" ON "contract_amendment"("status","effective_date");

CREATE TABLE "contract_approval" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL, "step" TEXT NOT NULL, "decision" TEXT NOT NULL, "rationale" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_approval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contract_approval_matter_resource_idx" ON "contract_approval"("matter_id","resource_type","resource_id");

CREATE TABLE "contract_renewal" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "option_period" TEXT NOT NULL,
  "notice_deadline" TIMESTAMP(3) NOT NULL, "exercise_deadline" TIMESTAMP(3) NOT NULL, "estimated_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'MONITORING', "recommendation" TEXT NOT NULL, "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_renewal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_renewal_matter_option_key" ON "contract_renewal"("matter_id","option_period");
CREATE INDEX "contract_renewal_status_notice_idx" ON "contract_renewal"("status","notice_deadline");

CREATE TABLE "contract_risk_assessment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "assessment_key" TEXT NOT NULL,
  "legal_score" INTEGER NOT NULL, "financial_score" INTEGER NOT NULL, "operational_score" INTEGER NOT NULL,
  "cybersecurity_score" INTEGER NOT NULL, "compliance_score" INTEGER NOT NULL, "overall_rating" TEXT NOT NULL,
  "findings" JSONB NOT NULL, "assessed_by" TEXT NOT NULL, "source_digest" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "contract_risk_assessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_risk_assessment_matter_key_key" ON "contract_risk_assessment"("matter_id","assessment_key");
CREATE INDEX "contract_risk_assessment_rating_created_idx" ON "contract_risk_assessment"("overall_rating","created_at");

CREATE TABLE "contract_template" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "template_key" TEXT NOT NULL, "version" INTEGER NOT NULL, "name" TEXT NOT NULL,
  "agency" TEXT, "contract_type" TEXT NOT NULL, "content" TEXT NOT NULL, "playbook_rules" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "approved_by" TEXT, "effective_from" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "contract_template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_template_key_version_key" ON "contract_template"("template_key","version");
CREATE INDEX "contract_template_status_type_idx" ON "contract_template"("status","contract_type");

CREATE TABLE "contract_ai_review" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "review_type" TEXT NOT NULL,
  "prompt_digest" TEXT NOT NULL, "output" TEXT NOT NULL, "model" TEXT NOT NULL, "citations" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION, "advisory_only" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING_HUMAN_REVIEW', "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "contract_ai_review_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contract_ai_review_matter_created_idx" ON "contract_ai_review"("matter_id","created_at");

CREATE TABLE "contract_integration_outbox" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "matter_id" TEXT NOT NULL, "provider" TEXT NOT NULL, "operation" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL, "payload" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "receipt" JSONB, "last_error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_integration_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_integration_outbox_idempotency_key" ON "contract_integration_outbox"("idempotency_key");
CREATE INDEX "contract_integration_outbox_status_next_idx" ON "contract_integration_outbox"("status","next_attempt_at");

CREATE TABLE "contract_lifecycle_audit_event" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "aggregate_id" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
  "action" TEXT NOT NULL, "actor_id" TEXT NOT NULL, "occurred_at" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL, "previous_hash" TEXT NOT NULL, "hash" TEXT NOT NULL,
  CONSTRAINT "contract_lifecycle_audit_event_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contract_lifecycle_audit_hash_key" ON "contract_lifecycle_audit_event"("hash");
CREATE UNIQUE INDEX "contract_lifecycle_audit_aggregate_sequence_key" ON "contract_lifecycle_audit_event"("aggregate_id","sequence");
CREATE INDEX "contract_lifecycle_audit_aggregate_occurred_idx" ON "contract_lifecycle_audit_event"("aggregate_id","occurred_at");

ALTER TABLE "contract_party" ADD CONSTRAINT "contract_party_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_document_version" ADD CONSTRAINT "contract_document_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_clause" ADD CONSTRAINT "contract_clause_document_fkey" FOREIGN KEY ("document_version_id") REFERENCES "contract_document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_obligation" ADD CONSTRAINT "contract_obligation_clause_fkey" FOREIGN KEY ("clause_id") REFERENCES "contract_clause"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_milestone" ADD CONSTRAINT "contract_milestone_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_amendment" ADD CONSTRAINT "contract_amendment_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_amendment" ADD CONSTRAINT "contract_amendment_document_fkey" FOREIGN KEY ("document_version_id") REFERENCES "contract_document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_approval" ADD CONSTRAINT "contract_approval_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_renewal" ADD CONSTRAINT "contract_renewal_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_risk_assessment" ADD CONSTRAINT "contract_risk_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_ai_review" ADD CONSTRAINT "contract_ai_review_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_integration_outbox" ADD CONSTRAINT "contract_outbox_matter_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION prevent_contract_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'contract lifecycle evidence is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER contract_document_version_append_only BEFORE UPDATE OR DELETE ON "contract_document_version" FOR EACH ROW EXECUTE FUNCTION prevent_contract_evidence_mutation();
CREATE TRIGGER contract_approval_append_only BEFORE UPDATE OR DELETE ON "contract_approval" FOR EACH ROW EXECUTE FUNCTION prevent_contract_evidence_mutation();
CREATE TRIGGER contract_risk_assessment_append_only BEFORE UPDATE OR DELETE ON "contract_risk_assessment" FOR EACH ROW EXECUTE FUNCTION prevent_contract_evidence_mutation();
CREATE TRIGGER contract_ai_review_append_only BEFORE UPDATE OR DELETE ON "contract_ai_review" FOR EACH ROW EXECUTE FUNCTION prevent_contract_evidence_mutation();
CREATE TRIGGER contract_lifecycle_audit_append_only BEFORE UPDATE OR DELETE ON "contract_lifecycle_audit_event" FOR EACH ROW EXECUTE FUNCTION prevent_contract_evidence_mutation();
