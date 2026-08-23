ALTER TABLE "rfp_approval" ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "rfp_approval_rfp_response_id_gate_key";
CREATE UNIQUE INDEX "rfp_approval_rfp_response_id_gate_cycle_key" ON "rfp_approval"("rfp_response_id", "gate", "cycle");
