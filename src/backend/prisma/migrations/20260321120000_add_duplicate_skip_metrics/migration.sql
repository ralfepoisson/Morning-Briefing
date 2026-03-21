ALTER TABLE "snapshot_generation_jobs"
ADD COLUMN "duplicate_skip_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_duplicate_at" TIMESTAMPTZ(6);
