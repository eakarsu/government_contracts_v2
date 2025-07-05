-- CreateTable
CREATE TABLE "contract" (
    "id" SERIAL NOT NULL,
    "notice_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "agency" TEXT,
    "naics_code" TEXT,
    "classification_code" TEXT,
    "posted_date" TIMESTAMP(3),
    "set_aside_code" TEXT,
    "resource_links" JSONB,
    "indexed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexing_job" (
    "id" SERIAL NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "records_processed" INTEGER,
    "errors_count" INTEGER,
    "error_details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "indexing_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_query" (
    "id" SERIAL NOT NULL,
    "query_text" TEXT NOT NULL,
    "results_count" INTEGER NOT NULL,
    "response_time" DOUBLE PRECISION NOT NULL,
    "user_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "password" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_application" (
    "id" SERIAL NOT NULL,
    "contract_notice_id" TEXT NOT NULL,
    "company_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_template" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template" TEXT NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_processing_queue" (
    "id" SERIAL NOT NULL,
    "contract_notice_id" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "description" TEXT,
    "local_file_path" TEXT,
    "filename" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "processed_data" TEXT,
    "error_message" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_processing_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_notice_id_key" ON "contract"("notice_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
