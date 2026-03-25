CREATE TABLE "news_article_selections" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "dashboard_widget_id" UUID NOT NULL,
  "snapshot_date" DATE NOT NULL,
  "article_key" TEXT NOT NULL,
  "category_name" TEXT NOT NULL,
  "category_description" TEXT NOT NULL DEFAULT '',
  "title" TEXT NOT NULL,
  "article_url" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "source_name" TEXT NOT NULL DEFAULT '',
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "news_article_selections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "news_article_selections_dashboard_widget_id_snapshot_date_article_key_key"
ON "news_article_selections"("dashboard_widget_id", "snapshot_date", "article_key");

CREATE INDEX "news_article_selections_dashboard_widget_id_snapshot_date_idx"
ON "news_article_selections"("dashboard_widget_id", "snapshot_date");

CREATE INDEX "news_article_selections_dashboard_widget_id_article_key_idx"
ON "news_article_selections"("dashboard_widget_id", "article_key");

CREATE INDEX "news_article_selections_tenant_id_idx"
ON "news_article_selections"("tenant_id");

ALTER TABLE "news_article_selections"
ADD CONSTRAINT "news_article_selections_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_article_selections"
ADD CONSTRAINT "news_article_selections_dashboard_widget_id_fkey"
FOREIGN KEY ("dashboard_widget_id") REFERENCES "dashboard_widgets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
