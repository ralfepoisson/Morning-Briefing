ALTER TABLE "connectors"
ADD COLUMN "owner_user_id" UUID;

CREATE INDEX "connectors_owner_user_id_idx" ON "connectors"("owner_user_id");

ALTER TABLE "connectors"
ADD CONSTRAINT "connectors_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "app_users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "connectors" AS c
SET "owner_user_id" = usage.owner_user_id
FROM (
  SELECT DISTINCT ON (wc."connector_id")
    wc."connector_id",
    d."owner_user_id"
  FROM "widget_connectors" AS wc
  INNER JOIN "dashboard_widgets" AS dw ON dw."id" = wc."dashboard_widget_id"
  INNER JOIN "dashboards" AS d ON d."id" = dw."dashboard_id"
  ORDER BY wc."connector_id", d."owner_user_id"
) AS usage
WHERE c."id" = usage."connector_id"
  AND c."owner_user_id" IS NULL;
