ALTER TABLE "document_processing_queue"
  ADD COLUMN "source_checksum" TEXT,
  ADD COLUMN "content_checksum" TEXT,
  ADD COLUMN "last_attempt_at" TIMESTAMP(3),
  ADD COLUMN "next_retry_at" TIMESTAMP(3),
  ADD COLUMN "dead_lettered_at" TIMESTAMP(3);

ALTER TABLE "rfp_versions" ADD COLUMN "snapshot" TEXT;

CREATE TABLE "rfp_requirement" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER NOT NULL,
  "requirement_key" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_locator" TEXT NOT NULL,
  "evidence_refs" JSONB NOT NULL,
  "mapped_section_id" TEXT,
  "coverage_status" TEXT NOT NULL DEFAULT 'UNMAPPED',
  "review_status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfp_requirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfp_requirement_coverage" CHECK ("coverage_status" IN ('UNMAPPED','PARTIAL','COVERED','NOT_APPLICABLE')),
  CONSTRAINT "rfp_requirement_review" CHECK ("review_status" IN ('PENDING','VERIFIED','REJECTED'))
);

CREATE TABLE "rfp_collaborator" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "assigned_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfp_collaborator_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfp_collaborator_role" CHECK ("role" IN ('viewer','author','reviewer','approver'))
);

CREATE TABLE "rfp_approval" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER NOT NULL,
  "gate" TEXT NOT NULL,
  "reviewer_email" TEXT NOT NULL,
  "decision" TEXT NOT NULL DEFAULT 'PENDING',
  "rationale" TEXT,
  "assigned_by" TEXT NOT NULL,
  "decided_by" TEXT,
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfp_approval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfp_approval_gate" CHECK ("gate" IN ('CONTENT','COMPLIANCE','EXECUTIVE','SUBMISSION')),
  CONSTRAINT "rfp_approval_decision" CHECK ("decision" IN ('PENDING','APPROVED','REJECTED'))
);

CREATE TABLE "rfp_submission_checklist_item" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER NOT NULL,
  "item_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "evidence_url" TEXT,
  "completed_by" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfp_submission_checklist_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfp_checklist_evidence_https" CHECK ("evidence_url" IS NULL OR "evidence_url" LIKE 'https://%')
);

CREATE TABLE "rfp_submission" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER NOT NULL,
  "destination" TEXT NOT NULL,
  "submission_method" TEXT NOT NULL,
  "tracking_number" TEXT,
  "receipt" JSONB,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "submitted_by" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rfp_submission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfp_submission_status" CHECK ("status" IN ('RECORDED','CONFIRMED','REJECTED','WITHDRAWN'))
);

CREATE TABLE "rfp_outcome" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER NOT NULL,
  "outcome" TEXT NOT NULL,
  "award_value" DOUBLE PRECISION,
  "competitor" TEXT,
  "debrief" TEXT,
  "lessons_learned" JSONB,
  "recorded_by" TEXT NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rfp_outcome_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfp_outcome_value" CHECK ("award_value" IS NULL OR "award_value" >= 0),
  CONSTRAINT "rfp_outcome_value_set" CHECK ("outcome" IN ('WON','LOST','WITHDRAWN','NO_BID'))
);

CREATE TABLE "rfp_bid_scoring_model" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
  "training_sample_size" INTEGER NOT NULL,
  "metrics" JSONB NOT NULL,
  "feature_schema" JSONB NOT NULL,
  "validated_by" TEXT,
  "validated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rfp_bid_scoring_model_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfp_bid_model_status" CHECK ("status" IN ('CANDIDATE','VALIDATED','RETIRED')),
  CONSTRAINT "rfp_bid_model_samples" CHECK ("training_sample_size" >= 0)
);

CREATE TABLE "rfp_bid_score" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER,
  "contract_id" TEXT NOT NULL,
  "model_id" TEXT,
  "probability" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "advisory_only" BOOLEAN NOT NULL DEFAULT true,
  "features" JSONB NOT NULL,
  "factors" JSONB NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rfp_bid_score_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfp_bid_score_probability" CHECK ("probability" BETWEEN 0 AND 100),
  CONSTRAINT "rfp_bid_score_confidence" CHECK ("confidence" BETWEEN 0 AND 100)
);

CREATE TABLE "rfp_amendment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "contract_id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "previous_snapshot" JSONB NOT NULL,
  "current_snapshot" JSONB NOT NULL,
  "changes" JSONB NOT NULL,
  "affected_sections" JSONB NOT NULL,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_by" TEXT,
  "acknowledged_at" TIMESTAMP(3),
  CONSTRAINT "rfp_amendment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rfp_audit_event" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "previous_hash" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  CONSTRAINT "rfp_audit_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rfp_comment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "rfp_response_id" INTEGER NOT NULL,
  "section_id" TEXT,
  "body" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rfp_comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_processing_queue_status_next_retry_at_idx" ON "document_processing_queue"("status", "next_retry_at");
CREATE INDEX "document_processing_queue_source_checksum_idx" ON "document_processing_queue"("source_checksum");
CREATE UNIQUE INDEX "rfp_requirement_rfp_response_id_requirement_key_key" ON "rfp_requirement"("rfp_response_id", "requirement_key");
CREATE INDEX "rfp_requirement_rfp_response_id_coverage_status_idx" ON "rfp_requirement"("rfp_response_id", "coverage_status");
CREATE UNIQUE INDEX "rfp_collaborator_rfp_response_id_email_key" ON "rfp_collaborator"("rfp_response_id", "email");
CREATE INDEX "rfp_collaborator_email_role_idx" ON "rfp_collaborator"("email", "role");
CREATE UNIQUE INDEX "rfp_approval_rfp_response_id_gate_key" ON "rfp_approval"("rfp_response_id", "gate");
CREATE INDEX "rfp_approval_reviewer_email_decision_idx" ON "rfp_approval"("reviewer_email", "decision");
CREATE UNIQUE INDEX "rfp_submission_checklist_item_rfp_response_id_item_key_key" ON "rfp_submission_checklist_item"("rfp_response_id", "item_key");
CREATE UNIQUE INDEX "rfp_submission_rfp_response_id_key" ON "rfp_submission"("rfp_response_id");
CREATE UNIQUE INDEX "rfp_outcome_rfp_response_id_key" ON "rfp_outcome"("rfp_response_id");
CREATE INDEX "rfp_outcome_outcome_recorded_at_idx" ON "rfp_outcome"("outcome", "recorded_at");
CREATE UNIQUE INDEX "rfp_bid_scoring_model_name_version_key" ON "rfp_bid_scoring_model"("name", "version");
CREATE INDEX "rfp_bid_scoring_model_status_created_at_idx" ON "rfp_bid_scoring_model"("status", "created_at");
CREATE INDEX "rfp_bid_score_contract_id_created_at_idx" ON "rfp_bid_score"("contract_id", "created_at");
CREATE INDEX "rfp_bid_score_model_id_created_at_idx" ON "rfp_bid_score"("model_id", "created_at");
CREATE UNIQUE INDEX "rfp_amendment_contract_id_fingerprint_key" ON "rfp_amendment"("contract_id", "fingerprint");
CREATE INDEX "rfp_amendment_contract_id_detected_at_idx" ON "rfp_amendment"("contract_id", "detected_at");
CREATE UNIQUE INDEX "rfp_audit_event_hash_key" ON "rfp_audit_event"("hash");
CREATE UNIQUE INDEX "rfp_audit_event_rfp_response_id_sequence_key" ON "rfp_audit_event"("rfp_response_id", "sequence");
CREATE INDEX "rfp_audit_event_rfp_response_id_occurred_at_idx" ON "rfp_audit_event"("rfp_response_id", "occurred_at");
CREATE INDEX "rfp_comment_rfp_response_id_resolved_created_at_idx" ON "rfp_comment"("rfp_response_id", "resolved", "created_at");

ALTER TABLE "rfp_requirement" ADD CONSTRAINT "rfp_requirement_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfp_collaborator" ADD CONSTRAINT "rfp_collaborator_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfp_approval" ADD CONSTRAINT "rfp_approval_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfp_submission_checklist_item" ADD CONSTRAINT "rfp_submission_checklist_item_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfp_submission" ADD CONSTRAINT "rfp_submission_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfp_outcome" ADD CONSTRAINT "rfp_outcome_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfp_bid_score" ADD CONSTRAINT "rfp_bid_score_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rfp_bid_score" ADD CONSTRAINT "rfp_bid_score_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "rfp_bid_scoring_model"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rfp_amendment" ADD CONSTRAINT "rfp_amendment_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("notice_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfp_audit_event" ADD CONSTRAINT "rfp_audit_event_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rfp_comment" ADD CONSTRAINT "rfp_comment_rfp_response_id_fkey" FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "rfp_submission_checklist_item" ("id", "rfp_response_id", "item_key", "label", "required", "updated_at")
SELECT gen_random_uuid(), response."id", checklist."key", checklist."label", true, CURRENT_TIMESTAMP
FROM "rfp_responses" response
CROSS JOIN (VALUES
  ('content_review', 'All proposal sections completed and reviewed'),
  ('requirements_verified', 'Solicitation requirements matrix verified'),
  ('pricing_approved', 'Pricing and representations approved'),
  ('attachments_confirmed', 'Required attachments included'),
  ('destination_verified', 'Submission destination and deadline verified')
) AS checklist("key", "label")
ON CONFLICT DO NOTHING;

CREATE FUNCTION prevent_rfp_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RFP audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfp_audit_event_no_update
BEFORE UPDATE OR DELETE ON "rfp_audit_event"
FOR EACH ROW EXECUTE FUNCTION prevent_rfp_audit_mutation();

CREATE FUNCTION prevent_rfp_approval_rewrite() RETURNS trigger AS $$
BEGIN
  IF OLD.decision IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'released RFP approvals are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfp_approval_immutable
BEFORE UPDATE OR DELETE ON "rfp_approval"
FOR EACH ROW EXECUTE FUNCTION prevent_rfp_approval_rewrite();
