-- DropIndex
DROP INDEX IF EXISTS "local_auth_session_expires_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_requirement_rfp_response_id_coverage_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_collaborator_email_role_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_approval_reviewer_email_decision_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_outcome_outcome_recorded_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_bid_scoring_model_status_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_bid_scoring_model_name_version_key";

-- DropIndex
DROP INDEX IF EXISTS "rfp_bid_score_contract_id_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_bid_score_model_id_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_amendment_contract_id_detected_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_amendment_contract_id_fingerprint_key";

-- DropIndex
DROP INDEX IF EXISTS "rfp_audit_event_rfp_response_id_occurred_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "rfp_comment_rfp_response_id_resolved_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "governance_policy_jurisdiction_effective_from_idx";

-- DropIndex
DROP INDEX IF EXISTS "governance_policy_policy_key_version_key";

-- DropIndex
DROP INDEX IF EXISTS "regulatory_source_jurisdiction_effective_from_idx";

-- DropIndex
DROP INDEX IF EXISTS "regulatory_source_content_hash_idx";

-- DropIndex
DROP INDEX IF EXISTS "regulatory_source_source_key_version_key";

-- DropIndex
DROP INDEX IF EXISTS "compliance_evaluation_contract_id_scenario_idx";

-- DropIndex
DROP INDEX IF EXISTS "compliance_evaluation_status_owner_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "compliance_evaluation_retention_until_legal_hold_idx";

-- DropIndex
DROP INDEX IF EXISTS "governance_audit_event_aggregate_type_occurred_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "governance_audit_event_aggregate_id_sequence_key";

-- DropIndex
DROP INDEX IF EXISTS "contract_matter_matter_number_key";

-- DropIndex
DROP INDEX IF EXISTS "contract_matter_stage_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_matter_owner_id_updated_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_party_matter_id_party_type_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_document_version_matter_id_document_type_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_clause_matter_id_risk_level_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_obligation_status_due_date_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_milestone_status_due_date_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_amendment_status_effective_date_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_approval_matter_id_resource_type_resource_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_renewal_status_notice_deadline_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_risk_assessment_overall_rating_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_template_status_contract_type_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_template_template_key_version_key";

-- DropIndex
DROP INDEX IF EXISTS "contract_ai_review_matter_id_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_integration_outbox_status_next_attempt_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_lifecycle_audit_event_aggregate_id_occurred_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_lifecycle_audit_event_aggregate_id_sequence_key";

-- DropIndex
DROP INDEX IF EXISTS "contract_capability_work_item_domain_capability_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_capability_work_item_matter_id_risk_level_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_capability_work_item_owner_id_due_date_idx";

-- DropIndex
DROP INDEX IF EXISTS "contract_capability_work_item_source_project_source_record__key";

-- DropIndex
DROP INDEX IF EXISTS "contract_capability_analysis_work_item_id_created_at_idx";

-- AlterTable
ALTER TABLE "search_query" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "local_auth_session" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_application" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "ai_template" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_templates" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "company_profiles" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_responses" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_versions" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_requirement" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_collaborator" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_approval" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_submission_checklist_item" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_submission" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_outcome" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_bid_scoring_model" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_bid_score" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_amendment" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_audit_event" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "rfp_comment" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "governance_policy" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "regulatory_source" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "compliance_evaluation" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "governance_audit_event" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_matter" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_party" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_document_version" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_clause" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_obligation" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_milestone" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_amendment" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_approval" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_renewal" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_risk_assessment" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_template" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_ai_review" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_integration_outbox" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_lifecycle_audit_event" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_capability_work_item" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "contract_capability_analysis" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- Backfill every existing record into the compatibility tenant.
INSERT INTO "tenant" ("id", "slug", "name", "status", "settings", "created_at", "updated_at")
VALUES ('default', 'default', 'Default Organization', 'ACTIVE', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- CreateTable
CREATE TABLE "tenant_membership" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY['contract_viewer']::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secret_rotation_record" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "secret_name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "version_fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rotated_by" TEXT NOT NULL,
    "rotated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "secret_rotation_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "durable_task" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "task_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leased_by" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),
    "idempotency_key" TEXT,
    "result" JSONB,
    "error" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "durable_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_document" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "queue_document_id" INTEGER,
    "storage_provider" TEXT NOT NULL,
    "bucket" TEXT,
    "object_key" TEXT NOT NULL,
    "storage_version_id" TEXT,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "encryption" TEXT NOT NULL DEFAULT 'PROVIDER_MANAGED',
    "malware_status" TEXT NOT NULL DEFAULT 'PENDING',
    "malware_engine" TEXT,
    "malware_scanned_at" TIMESTAMP(3),
    "retention_until" TIMESTAMP(3),
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_search" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'DAILY',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_subscription" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "owner_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "event_types" TEXT[],
    "encrypted_destination" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_event" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "subscription_id" TEXT,
    "event_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_enrichment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "company_profile_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "evidence_url" TEXT NOT NULL,
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "content_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VERIFIED_SOURCE',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_enrichment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_package_artifact" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "rfp_response_id" INTEGER NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "file_name" TEXT,
    "stored_document_id" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "signature_required" BOOLEAN NOT NULL DEFAULT false,
    "signature_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "validation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "validation_findings" JSONB NOT NULL DEFAULT '[]',
    "portal_instructions" JSONB,
    "completed_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_package_artifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "tenant_status_created_at_idx" ON "tenant"("status", "created_at");

-- CreateIndex
CREATE INDEX "tenant_membership_subject_status_idx" ON "tenant_membership"("subject", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_membership_tenant_id_subject_key" ON "tenant_membership"("tenant_id", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_membership_tenant_id_email_key" ON "tenant_membership"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "secret_rotation_record_tenant_id_secret_name_rotated_at_idx" ON "secret_rotation_record"("tenant_id", "secret_name", "rotated_at");

-- CreateIndex
CREATE INDEX "durable_task_status_available_at_priority_idx" ON "durable_task"("status", "available_at", "priority");

-- CreateIndex
CREATE INDEX "durable_task_tenant_id_status_created_at_idx" ON "durable_task"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "durable_task_tenant_id_idempotency_key_key" ON "durable_task"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "stored_document_tenant_id_malware_status_created_at_idx" ON "stored_document"("tenant_id", "malware_status", "created_at");

-- CreateIndex
CREATE INDEX "stored_document_queue_document_id_idx" ON "stored_document"("queue_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "stored_document_tenant_id_object_key_storage_version_id_key" ON "stored_document"("tenant_id", "object_key", "storage_version_id");

-- CreateIndex
CREATE INDEX "saved_search_enabled_next_run_at_idx" ON "saved_search"("enabled", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_search_tenant_id_owner_id_name_key" ON "saved_search"("tenant_id", "owner_id", "name");

-- CreateIndex
CREATE INDEX "notification_subscription_tenant_id_owner_id_enabled_idx" ON "notification_subscription"("tenant_id", "owner_id", "enabled");

-- CreateIndex
CREATE INDEX "notification_event_tenant_id_owner_id_status_created_at_idx" ON "notification_event"("tenant_id", "owner_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notification_event_status_scheduled_at_idx" ON "notification_event"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "company_enrichment_tenant_id_company_profile_id_source_retr_idx" ON "company_enrichment"("tenant_id", "company_profile_id", "source", "retrieved_at");

-- CreateIndex
CREATE UNIQUE INDEX "company_enrichment_tenant_id_company_profile_id_source_exte_key" ON "company_enrichment"("tenant_id", "company_profile_id", "source", "external_id", "content_hash");

-- CreateIndex
CREATE INDEX "submission_package_artifact_tenant_id_rfp_response_id_valid_idx" ON "submission_package_artifact"("tenant_id", "rfp_response_id", "validation_status");

-- CreateIndex
CREATE UNIQUE INDEX "submission_package_artifact_tenant_id_rfp_response_id_artif_key" ON "submission_package_artifact"("tenant_id", "rfp_response_id", "artifact_type");

-- CreateIndex
CREATE INDEX "search_query_tenant_id_created_at_idx" ON "search_query"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "local_auth_session_tenant_id_expires_at_idx" ON "local_auth_session"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "company_tenant_id_name_idx" ON "company"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "contract_application_tenant_id_status_idx" ON "contract_application"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "ai_template_tenant_id_is_active_idx" ON "ai_template"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "rfp_templates_tenant_id_updated_at_idx" ON "rfp_templates"("tenant_id", "updated_at");

-- CreateIndex
CREATE INDEX "company_profiles_tenant_id_updated_at_idx" ON "company_profiles"("tenant_id", "updated_at");

-- CreateIndex
CREATE INDEX "rfp_responses_tenant_id_status_updated_at_idx" ON "rfp_responses"("tenant_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "rfp_versions_tenant_id_rfp_response_id_created_at_idx" ON "rfp_versions"("tenant_id", "rfp_response_id", "created_at");

-- CreateIndex
CREATE INDEX "rfp_requirement_tenant_id_rfp_response_id_coverage_status_idx" ON "rfp_requirement"("tenant_id", "rfp_response_id", "coverage_status");

-- CreateIndex
CREATE INDEX "rfp_collaborator_tenant_id_email_role_idx" ON "rfp_collaborator"("tenant_id", "email", "role");

-- CreateIndex
CREATE INDEX "rfp_approval_tenant_id_reviewer_email_decision_idx" ON "rfp_approval"("tenant_id", "reviewer_email", "decision");

-- CreateIndex
CREATE INDEX "rfp_submission_checklist_item_tenant_id_rfp_response_id_com_idx" ON "rfp_submission_checklist_item"("tenant_id", "rfp_response_id", "completed");

-- CreateIndex
CREATE INDEX "rfp_submission_tenant_id_submitted_at_idx" ON "rfp_submission"("tenant_id", "submitted_at");

-- CreateIndex
CREATE INDEX "rfp_outcome_tenant_id_outcome_recorded_at_idx" ON "rfp_outcome"("tenant_id", "outcome", "recorded_at");

-- CreateIndex
CREATE INDEX "rfp_bid_scoring_model_tenant_id_status_created_at_idx" ON "rfp_bid_scoring_model"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rfp_bid_scoring_model_tenant_id_name_version_key" ON "rfp_bid_scoring_model"("tenant_id", "name", "version");

-- CreateIndex
CREATE INDEX "rfp_bid_score_tenant_id_contract_id_created_at_idx" ON "rfp_bid_score"("tenant_id", "contract_id", "created_at");

-- CreateIndex
CREATE INDEX "rfp_bid_score_tenant_id_model_id_created_at_idx" ON "rfp_bid_score"("tenant_id", "model_id", "created_at");

-- CreateIndex
CREATE INDEX "rfp_amendment_tenant_id_contract_id_detected_at_idx" ON "rfp_amendment"("tenant_id", "contract_id", "detected_at");

-- CreateIndex
CREATE UNIQUE INDEX "rfp_amendment_tenant_id_contract_id_fingerprint_key" ON "rfp_amendment"("tenant_id", "contract_id", "fingerprint");

-- CreateIndex
CREATE INDEX "rfp_audit_event_tenant_id_rfp_response_id_occurred_at_idx" ON "rfp_audit_event"("tenant_id", "rfp_response_id", "occurred_at");

-- CreateIndex
CREATE INDEX "rfp_comment_tenant_id_rfp_response_id_resolved_created_at_idx" ON "rfp_comment"("tenant_id", "rfp_response_id", "resolved", "created_at");

-- CreateIndex
CREATE INDEX "governance_policy_tenant_id_jurisdiction_effective_from_idx" ON "governance_policy"("tenant_id", "jurisdiction", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "governance_policy_tenant_id_policy_key_version_key" ON "governance_policy"("tenant_id", "policy_key", "version");

-- CreateIndex
CREATE INDEX "regulatory_source_tenant_id_jurisdiction_effective_from_idx" ON "regulatory_source"("tenant_id", "jurisdiction", "effective_from");

-- CreateIndex
CREATE INDEX "regulatory_source_tenant_id_content_hash_idx" ON "regulatory_source"("tenant_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_source_tenant_id_source_key_version_key" ON "regulatory_source"("tenant_id", "source_key", "version");

-- CreateIndex
CREATE INDEX "compliance_evaluation_tenant_id_contract_id_scenario_idx" ON "compliance_evaluation"("tenant_id", "contract_id", "scenario");

-- CreateIndex
CREATE INDEX "compliance_evaluation_tenant_id_status_owner_id_idx" ON "compliance_evaluation"("tenant_id", "status", "owner_id");

-- CreateIndex
CREATE INDEX "compliance_evaluation_tenant_id_retention_until_legal_hold_idx" ON "compliance_evaluation"("tenant_id", "retention_until", "legal_hold");

-- CreateIndex
CREATE INDEX "governance_audit_event_tenant_id_aggregate_type_occurred_at_idx" ON "governance_audit_event"("tenant_id", "aggregate_type", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "governance_audit_event_tenant_id_aggregate_id_sequence_key" ON "governance_audit_event"("tenant_id", "aggregate_id", "sequence");

-- CreateIndex
CREATE INDEX "contract_matter_tenant_id_stage_status_idx" ON "contract_matter"("tenant_id", "stage", "status");

-- CreateIndex
CREATE INDEX "contract_matter_tenant_id_owner_id_updated_at_idx" ON "contract_matter"("tenant_id", "owner_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "contract_matter_tenant_id_matter_number_key" ON "contract_matter"("tenant_id", "matter_number");

-- CreateIndex
CREATE INDEX "contract_party_tenant_id_matter_id_party_type_idx" ON "contract_party"("tenant_id", "matter_id", "party_type");

-- CreateIndex
CREATE INDEX "contract_document_version_tenant_id_matter_id_document_type_idx" ON "contract_document_version"("tenant_id", "matter_id", "document_type");

-- CreateIndex
CREATE INDEX "contract_clause_tenant_id_matter_id_risk_level_status_idx" ON "contract_clause"("tenant_id", "matter_id", "risk_level", "status");

-- CreateIndex
CREATE INDEX "contract_obligation_tenant_id_status_due_date_idx" ON "contract_obligation"("tenant_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "contract_milestone_tenant_id_status_due_date_idx" ON "contract_milestone"("tenant_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "contract_amendment_tenant_id_status_effective_date_idx" ON "contract_amendment"("tenant_id", "status", "effective_date");

-- CreateIndex
CREATE INDEX "contract_approval_tenant_id_matter_id_resource_type_resourc_idx" ON "contract_approval"("tenant_id", "matter_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "contract_renewal_tenant_id_status_notice_deadline_idx" ON "contract_renewal"("tenant_id", "status", "notice_deadline");

-- CreateIndex
CREATE INDEX "contract_risk_assessment_tenant_id_overall_rating_created_a_idx" ON "contract_risk_assessment"("tenant_id", "overall_rating", "created_at");

-- CreateIndex
CREATE INDEX "contract_template_tenant_id_status_contract_type_idx" ON "contract_template"("tenant_id", "status", "contract_type");

-- CreateIndex
CREATE UNIQUE INDEX "contract_template_tenant_id_template_key_version_key" ON "contract_template"("tenant_id", "template_key", "version");

-- CreateIndex
CREATE INDEX "contract_ai_review_tenant_id_matter_id_created_at_idx" ON "contract_ai_review"("tenant_id", "matter_id", "created_at");

-- CreateIndex
CREATE INDEX "contract_integration_outbox_tenant_id_status_next_attempt_a_idx" ON "contract_integration_outbox"("tenant_id", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "contract_lifecycle_audit_event_tenant_id_aggregate_id_occur_idx" ON "contract_lifecycle_audit_event"("tenant_id", "aggregate_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "contract_lifecycle_audit_event_tenant_id_aggregate_id_seque_key" ON "contract_lifecycle_audit_event"("tenant_id", "aggregate_id", "sequence");

-- CreateIndex
CREATE INDEX "contract_capability_work_item_tenant_id_domain_capability_s_idx" ON "contract_capability_work_item"("tenant_id", "domain", "capability", "status");

-- CreateIndex
CREATE INDEX "contract_capability_work_item_tenant_id_matter_id_risk_leve_idx" ON "contract_capability_work_item"("tenant_id", "matter_id", "risk_level");

-- CreateIndex
CREATE INDEX "contract_capability_work_item_tenant_id_owner_id_due_date_idx" ON "contract_capability_work_item"("tenant_id", "owner_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "contract_capability_work_item_tenant_id_source_project_sour_key" ON "contract_capability_work_item"("tenant_id", "source_project", "source_record_key");

-- CreateIndex
CREATE INDEX "contract_capability_analysis_tenant_id_work_item_id_created_idx" ON "contract_capability_analysis"("tenant_id", "work_item_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_membership" ADD CONSTRAINT "tenant_membership_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

