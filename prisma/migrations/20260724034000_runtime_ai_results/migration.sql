CREATE TABLE "runtime_ai_results" (
  "id" UUID NOT NULL,
  "user_id" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "output" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "provider_response_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "runtime_ai_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "runtime_ai_results_user_created_idx" ON "runtime_ai_results"("user_id", "created_at");
