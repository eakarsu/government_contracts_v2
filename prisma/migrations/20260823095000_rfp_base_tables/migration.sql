-- These four RFP tables predate the Prisma migration history. Existing
-- installations created them with `prisma db push`, while later migrations
-- depend on them. `IF NOT EXISTS` makes this bridge safe for those databases
-- and creates the missing foundation on a fresh database.

CREATE TABLE IF NOT EXISTS "rfp_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "agency" TEXT,
    "description" TEXT,
    "sections" TEXT NOT NULL,
    "evaluation_criteria" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfp_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_profiles" (
    "id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "profile_data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "rfp_responses" (
    "id" SERIAL NOT NULL,
    "contract_id" TEXT NOT NULL,
    "template_id" INTEGER,
    "company_profile_id" INTEGER,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "response_data" TEXT NOT NULL,
    "compliance_status" TEXT NOT NULL,
    "predicted_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfp_responses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rfp_responses_company_profile_id_fkey"
        FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "rfp_responses_contract_id_fkey"
        FOREIGN KEY ("contract_id") REFERENCES "contract"("notice_id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "rfp_responses_template_id_fkey"
        FOREIGN KEY ("template_id") REFERENCES "rfp_templates"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "rfp_versions" (
    "id" SERIAL NOT NULL,
    "rfp_response_id" INTEGER NOT NULL,
    "version_number" INTEGER NOT NULL,
    "changes" TEXT NOT NULL,
    "comment" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfp_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rfp_versions_rfp_response_id_fkey"
        FOREIGN KEY ("rfp_response_id") REFERENCES "rfp_responses"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
