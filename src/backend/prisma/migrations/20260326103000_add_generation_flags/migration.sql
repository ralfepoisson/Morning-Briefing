ALTER TABLE dashboards
ADD COLUMN is_generating BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE dashboard_widgets
ADD COLUMN is_generating BOOLEAN NOT NULL DEFAULT false;
