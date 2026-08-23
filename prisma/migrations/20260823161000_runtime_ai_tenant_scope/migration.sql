CREATE TABLE IF NOT EXISTS "runtime_ai_results" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "user_id" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "output" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "provider_response_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "runtime_ai_results_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "runtime_ai_results" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS "runtime_ai_results_user_created_idx" ON "runtime_ai_results"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "runtime_ai_results_tenant_user_created_idx" ON "runtime_ai_results"("tenant_id", "user_id", "created_at");
