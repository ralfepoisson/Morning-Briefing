-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DashboardType" AS ENUM ('PERSONAL', 'SHARED', 'CONTEXTUAL');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "ConnectorAuthType" AS ENUM ('NONE', 'API_KEY', 'OAUTH', 'BASIC');

-- CreateEnum
CREATE TYPE "WidgetRefreshMode" AS ENUM ('SNAPSHOT', 'LIVE', 'HYBRID');

-- CreateEnum
CREATE TYPE "SnapshotGenerationStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "WidgetSnapshotStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "tenant_slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dashboard_type" "DashboardType" NOT NULL DEFAULT 'PERSONAL',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activation_rule_json" JSONB,
    "theme_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "widget_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position_x" INTEGER NOT NULL,
    "position_y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "min_width" INTEGER NOT NULL DEFAULT 1,
    "min_height" INTEGER NOT NULL DEFAULT 1,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "refresh_mode" "WidgetRefreshMode" NOT NULL DEFAULT 'SNAPSHOT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connectors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "connector_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "auth_type" "ConnectorAuthType" NOT NULL DEFAULT 'NONE',
    "base_url" TEXT,
    "config_json" JSONB,
    "secret_ref" TEXT,
    "last_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_connectors" (
    "id" UUID NOT NULL,
    "dashboard_widget_id" UUID NOT NULL,
    "connector_id" UUID NOT NULL,
    "usage_role" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "widget_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generation_status" "SnapshotGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "summary_json" JSONB,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "briefing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_snapshots" (
    "id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "dashboard_widget_id" UUID NOT NULL,
    "widget_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_json" JSONB,
    "content_hash" TEXT,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "WidgetSnapshotStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,

    CONSTRAINT "widget_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_tenant_slug_key" ON "tenants"("tenant_slug");

-- CreateIndex
CREATE INDEX "app_users_tenant_id_idx" ON "app_users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_tenant_id_email_key" ON "app_users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "dashboards_tenant_id_idx" ON "dashboards"("tenant_id");

-- CreateIndex
CREATE INDEX "dashboards_owner_user_id_idx" ON "dashboards"("owner_user_id");

-- CreateIndex
CREATE INDEX "dashboard_widgets_tenant_id_idx" ON "dashboard_widgets"("tenant_id");

-- CreateIndex
CREATE INDEX "dashboard_widgets_dashboard_id_idx" ON "dashboard_widgets"("dashboard_id");

-- CreateIndex
CREATE INDEX "connectors_tenant_id_idx" ON "connectors"("tenant_id");

-- CreateIndex
CREATE INDEX "widget_connectors_connector_id_idx" ON "widget_connectors"("connector_id");

-- CreateIndex
CREATE UNIQUE INDEX "widget_connectors_dashboard_widget_id_connector_id_usage_ro_key" ON "widget_connectors"("dashboard_widget_id", "connector_id", "usage_role");

-- CreateIndex
CREATE INDEX "briefing_snapshots_tenant_id_idx" ON "briefing_snapshots"("tenant_id");

-- CreateIndex
CREATE INDEX "briefing_snapshots_dashboard_id_idx" ON "briefing_snapshots"("dashboard_id");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_snapshots_user_id_dashboard_id_snapshot_date_key" ON "briefing_snapshots"("user_id", "dashboard_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "widget_snapshots_snapshot_id_idx" ON "widget_snapshots"("snapshot_id");

-- CreateIndex
CREATE INDEX "widget_snapshots_dashboard_widget_id_idx" ON "widget_snapshots"("dashboard_widget_id");

-- AddForeignKey
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_connectors" ADD CONSTRAINT "widget_connectors_dashboard_widget_id_fkey" FOREIGN KEY ("dashboard_widget_id") REFERENCES "dashboard_widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_connectors" ADD CONSTRAINT "widget_connectors_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_snapshots" ADD CONSTRAINT "briefing_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_snapshots" ADD CONSTRAINT "briefing_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_snapshots" ADD CONSTRAINT "briefing_snapshots_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_snapshots" ADD CONSTRAINT "widget_snapshots_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "briefing_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_snapshots" ADD CONSTRAINT "widget_snapshots_dashboard_widget_id_fkey" FOREIGN KEY ("dashboard_widget_id") REFERENCES "dashboard_widgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
