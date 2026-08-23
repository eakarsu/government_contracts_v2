CREATE TABLE "worker_heartbeat" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "process_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "capabilities" TEXT[] NOT NULL,
    "version" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_heartbeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "worker_heartbeat_worker_id_key" ON "worker_heartbeat"("worker_id");
CREATE INDEX "worker_heartbeat_status_last_seen_at_idx" ON "worker_heartbeat"("status", "last_seen_at");
