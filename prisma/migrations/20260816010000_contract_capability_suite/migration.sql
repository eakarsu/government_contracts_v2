CREATE TABLE "contract_capability_work_item" (
  "id" TEXT NOT NULL,
  "matter_id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "source_project" TEXT NOT NULL,
  "source_record_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "risk_level" TEXT NOT NULL DEFAULT 'MEDIUM',
  "owner_id" TEXT NOT NULL,
  "counterparty" TEXT,
  "monetary_value" DOUBLE PRECISION,
  "probability" DOUBLE PRECISION,
  "due_date" TIMESTAMP(3),
  "jurisdiction" TEXT,
  "chain_id" TEXT,
  "league" TEXT,
  "evidence" JSONB NOT NULL,
  "recommendation" TEXT NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_capability_work_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_capability_work_item_domain_check" CHECK ("domain" IN ('ACQUISITION', 'NEGOTIATION', 'VENDOR_RISK', 'SMART_CONTRACT', 'SPORTS')),
  CONSTRAINT "contract_capability_work_item_status_check" CHECK ("status" IN ('OPEN', 'IN_REVIEW', 'BLOCKED', 'DECISION_REQUIRED', 'APPROVED', 'CLOSED')),
  CONSTRAINT "contract_capability_work_item_priority_check" CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT "contract_capability_work_item_risk_check" CHECK ("risk_level" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT "contract_capability_work_item_probability_check" CHECK ("probability" IS NULL OR ("probability" >= 0 AND "probability" <= 1)),
  CONSTRAINT "contract_capability_work_item_approval_check" CHECK (("status" <> 'APPROVED') OR ("approved_by" IS NOT NULL AND "approved_at" IS NOT NULL))
);

CREATE TABLE "contract_capability_analysis" (
  "id" TEXT NOT NULL,
  "work_item_id" TEXT NOT NULL,
  "analysis_type" TEXT NOT NULL,
  "input_digest" TEXT NOT NULL,
  "output" JSONB NOT NULL,
  "model" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "advisory_only" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING_HUMAN_REVIEW',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_capability_analysis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_capability_analysis_advisory_check" CHECK ("advisory_only" = true),
  CONSTRAINT "contract_capability_analysis_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  CONSTRAINT "contract_capability_analysis_status_check" CHECK ("status" IN ('PENDING_HUMAN_REVIEW', 'ACCEPTED', 'REJECTED', 'SUPERSEDED'))
);

CREATE UNIQUE INDEX "contract_capability_work_item_source_project_source_record_key_key" ON "contract_capability_work_item"("source_project", "source_record_key");
CREATE INDEX "contract_capability_work_item_domain_capability_status_idx" ON "contract_capability_work_item"("domain", "capability", "status");
CREATE INDEX "contract_capability_work_item_matter_id_risk_level_idx" ON "contract_capability_work_item"("matter_id", "risk_level");
CREATE INDEX "contract_capability_work_item_owner_id_due_date_idx" ON "contract_capability_work_item"("owner_id", "due_date");
CREATE INDEX "contract_capability_analysis_work_item_id_created_at_idx" ON "contract_capability_analysis"("work_item_id", "created_at");

ALTER TABLE "contract_capability_work_item" ADD CONSTRAINT "contract_capability_work_item_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "contract_matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_capability_analysis" ADD CONSTRAINT "contract_capability_analysis_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "contract_capability_work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_contract_capability_analysis_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'contract capability analysis evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "contract_capability_analysis_append_only"
BEFORE UPDATE OR DELETE ON "contract_capability_analysis"
FOR EACH ROW EXECUTE FUNCTION prevent_contract_capability_analysis_mutation();
