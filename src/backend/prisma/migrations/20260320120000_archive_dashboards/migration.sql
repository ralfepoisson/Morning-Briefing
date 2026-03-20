ALTER TABLE "dashboards"
ADD COLUMN "archived_at" TIMESTAMPTZ(6);

ALTER TABLE "dashboard_widgets"
ADD COLUMN "archived_at" TIMESTAMPTZ(6);
