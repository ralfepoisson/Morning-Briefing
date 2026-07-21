ALTER TABLE "snapshot_generation_jobs"
ADD COLUMN "lease_expires_at" TIMESTAMPTZ(6);

CREATE TABLE "dashboard_briefing_generation_jobs" (
  "id" UUID NOT NULL,
  "dashboard_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "status" "SnapshotJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "duplicate_skip_count" INTEGER NOT NULL DEFAULT 0,
  "last_message_id" TEXT,
  "last_error" TEXT,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "lease_expires_at" TIMESTAMPTZ(6),
  "last_duplicate_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "dashboard_briefing_generation_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dashboard_briefing_generation_jobs_dashboard_id_fkey"
    FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dashboard_briefing_generation_jobs_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "dashboard_briefing_generation_jobs_idempotency_key_key"
ON "dashboard_briefing_generation_jobs"("idempotency_key");

CREATE INDEX "dashboard_briefing_generation_jobs_dashboard_id_created_at_idx"
ON "dashboard_briefing_generation_jobs"("dashboard_id", "created_at");

CREATE INDEX "dashboard_briefing_generation_jobs_owner_user_id_created_at_idx"
ON "dashboard_briefing_generation_jobs"("owner_user_id", "created_at");
