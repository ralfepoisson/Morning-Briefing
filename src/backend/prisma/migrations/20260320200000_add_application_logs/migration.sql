CREATE TYPE "ApplicationLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

CREATE TABLE "application_log_events" (
  "id" TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ(6) NOT NULL,
  "level" "ApplicationLogLevel" NOT NULL,
  "scope" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "context_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "application_log_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_log_events_timestamp_idx" ON "application_log_events"("timestamp");
CREATE INDEX "application_log_events_level_timestamp_idx" ON "application_log_events"("level", "timestamp");
