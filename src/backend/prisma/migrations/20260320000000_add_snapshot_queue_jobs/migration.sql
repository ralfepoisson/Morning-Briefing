ALTER TABLE "dashboard_widgets"
ADD COLUMN "config_hash" TEXT;

CREATE TYPE "SnapshotJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

ALTER TABLE "widget_snapshots"
ADD CONSTRAINT "widget_snapshots_snapshot_id_dashboard_widget_id_key"
UNIQUE ("snapshot_id", "dashboard_widget_id");

CREATE TABLE "snapshot_generation_jobs" (
  "id" UUID NOT NULL,
  "widget_id" UUID NOT NULL,
  "dashboard_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "snapshot_date" DATE NOT NULL,
  "trigger_source" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "requested_config_version" INTEGER NOT NULL,
  "requested_config_hash" TEXT NOT NULL,
  "status" "SnapshotJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_message_id" TEXT,
  "last_error" TEXT,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "snapshot_generation_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "snapshot_generation_jobs_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "snapshot_generation_jobs_widget_id_fkey"
    FOREIGN KEY ("widget_id") REFERENCES "dashboard_widgets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "snapshot_generation_jobs_widget_id_snapshot_date_idx"
ON "snapshot_generation_jobs"("widget_id", "snapshot_date");

CREATE INDEX "snapshot_generation_jobs_dashboard_id_snapshot_date_idx"
ON "snapshot_generation_jobs"("dashboard_id", "snapshot_date");

CREATE INDEX "snapshot_generation_jobs_user_id_snapshot_date_idx"
ON "snapshot_generation_jobs"("user_id", "snapshot_date");
