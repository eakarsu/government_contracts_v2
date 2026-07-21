CREATE TABLE "governance_policy" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "policy_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "rules" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "governance_policy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "governance_policy_effective_window" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")
);

CREATE TABLE "regulatory_source" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "source_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "document_identifier" TEXT NOT NULL,
    "evidence_url" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "content_hash" TEXT NOT NULL,
    "ingested_by" TEXT NOT NULL,
    "supersedes_id" TEXT,
    CONSTRAINT "regulatory_source_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "regulatory_source_effective_window" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
    CONSTRAINT "regulatory_source_https" CHECK ("evidence_url" LIKE 'https://%')
);

CREATE TABLE "compliance_evaluation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "policy_key" TEXT NOT NULL,
    "policy_version" INTEGER NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_content_hash" TEXT NOT NULL,
    "citations" JSONB NOT NULL,
    "evidence_links" JSONB NOT NULL,
    "obligations" JSONB NOT NULL,
    "deadlines" JSONB NOT NULL,
    "risk_rating" TEXT NOT NULL,
    "risk_rationale" TEXT NOT NULL,
    "advisory_output" JSONB,
    "owner_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "submitted_by" TEXT,
    "approved_by" TEXT,
    "decision_rationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "evaluated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "immutable_hash" TEXT,
    "retention_until" TIMESTAMP(3) NOT NULL,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "legal_hold_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "compliance_evaluation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compliance_evaluation_scenario" CHECK ("scenario" IN ('AWARD_ACCEPTANCE', 'BID_SUBMISSION', 'SOLICITATION_RELEASE')),
    CONSTRAINT "compliance_evaluation_risk" CHECK ("risk_rating" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT "compliance_evaluation_status" CHECK ("status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    CONSTRAINT "compliance_evaluation_sod" CHECK ("approved_by" IS NULL OR ("approved_by" <> "created_by" AND "approved_by" <> "owner_id" AND "approved_by" <> "submitted_by"))
);

CREATE TABLE "governance_audit_event" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "previous_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    CONSTRAINT "governance_audit_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "governance_policy_policy_key_version_key" ON "governance_policy"("policy_key", "version");
CREATE INDEX "governance_policy_jurisdiction_effective_from_idx" ON "governance_policy"("jurisdiction", "effective_from");
CREATE UNIQUE INDEX "regulatory_source_source_key_version_key" ON "regulatory_source"("source_key", "version");
CREATE INDEX "regulatory_source_jurisdiction_effective_from_idx" ON "regulatory_source"("jurisdiction", "effective_from");
CREATE INDEX "regulatory_source_content_hash_idx" ON "regulatory_source"("content_hash");
CREATE UNIQUE INDEX "compliance_evaluation_immutable_hash_key" ON "compliance_evaluation"("immutable_hash");
CREATE INDEX "compliance_evaluation_contract_id_scenario_idx" ON "compliance_evaluation"("contract_id", "scenario");
CREATE INDEX "compliance_evaluation_status_owner_id_idx" ON "compliance_evaluation"("status", "owner_id");
CREATE INDEX "compliance_evaluation_retention_until_legal_hold_idx" ON "compliance_evaluation"("retention_until", "legal_hold");
CREATE UNIQUE INDEX "governance_audit_event_hash_key" ON "governance_audit_event"("hash");
CREATE UNIQUE INDEX "governance_audit_event_aggregate_id_sequence_key" ON "governance_audit_event"("aggregate_id", "sequence");
CREATE INDEX "governance_audit_event_aggregate_type_occurred_at_idx" ON "governance_audit_event"("aggregate_type", "occurred_at");

ALTER TABLE "regulatory_source" ADD CONSTRAINT "regulatory_source_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "regulatory_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compliance_evaluation" ADD CONSTRAINT "compliance_evaluation_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("notice_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compliance_evaluation" ADD CONSTRAINT "compliance_evaluation_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "governance_policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compliance_evaluation" ADD CONSTRAINT "compliance_evaluation_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "regulatory_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_released_decision_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('APPROVED', 'REJECTED') AND
     (to_jsonb(NEW) - ARRAY['legal_hold', 'legal_hold_reason', 'updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['legal_hold', 'legal_hold_reason', 'updated_at']) THEN
    RAISE EXCEPTION 'released compliance decisions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compliance_evaluation_immutable
BEFORE UPDATE ON "compliance_evaluation"
FOR EACH ROW EXECUTE FUNCTION prevent_released_decision_mutation();

CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'governance audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER governance_audit_event_no_update
BEFORE UPDATE OR DELETE ON "governance_audit_event"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
