-- CreateEnum
CREATE TYPE "DashboardBriefingStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "dashboard_widgets"
ADD COLUMN "include_in_briefing_override" BOOLEAN;

-- CreateTable
CREATE TABLE "dashboard_briefing_preferences" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_generate" BOOLEAN NOT NULL DEFAULT false,
    "target_duration_seconds" INTEGER NOT NULL DEFAULT 75,
    "tone" TEXT NOT NULL DEFAULT 'calm, concise, professional',
    "language" TEXT NOT NULL DEFAULT 'en-GB',
    "voice_name" TEXT NOT NULL DEFAULT 'default',
    "include_widget_types_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboard_briefing_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_briefings" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "status" "DashboardBriefingStatus" NOT NULL DEFAULT 'PENDING',
    "source_snapshot_hash" TEXT NOT NULL,
    "generated_at" TIMESTAMPTZ(6),
    "model_name" TEXT NOT NULL DEFAULT '',
    "prompt_version" TEXT NOT NULL DEFAULT 'dashboard-briefing-v1',
    "script_text" TEXT NOT NULL DEFAULT '',
    "script_json" JSONB,
    "estimated_duration_seconds" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboard_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_briefing_audio" (
    "id" UUID NOT NULL,
    "dashboard_briefing_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "voice_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "generated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboard_briefing_audio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_briefing_preferences_dashboard_id_key" ON "dashboard_briefing_preferences"("dashboard_id");

-- CreateIndex
CREATE INDEX "dashboard_briefings_dashboard_id_created_at_idx" ON "dashboard_briefings"("dashboard_id", "created_at");

-- CreateIndex
CREATE INDEX "dashboard_briefings_dashboard_id_source_snapshot_hash_idx" ON "dashboard_briefings"("dashboard_id", "source_snapshot_hash");

-- CreateIndex
CREATE INDEX "dashboard_briefing_audio_dashboard_briefing_id_created_at_idx" ON "dashboard_briefing_audio"("dashboard_briefing_id", "created_at");

-- AddForeignKey
ALTER TABLE "dashboard_briefing_preferences" ADD CONSTRAINT "dashboard_briefing_preferences_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_briefings" ADD CONSTRAINT "dashboard_briefings_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_briefing_audio" ADD CONSTRAINT "dashboard_briefing_audio_dashboard_briefing_id_fkey" FOREIGN KEY ("dashboard_briefing_id") REFERENCES "dashboard_briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
