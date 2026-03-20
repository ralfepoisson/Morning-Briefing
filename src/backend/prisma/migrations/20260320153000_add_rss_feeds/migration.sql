CREATE TABLE "rss_feed_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rss_feed_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rss_feeds" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rss_feeds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rss_feed_categories_tenant_id_normalized_name_key" ON "rss_feed_categories"("tenant_id", "normalized_name");
CREATE INDEX "rss_feed_categories_tenant_id_sort_order_idx" ON "rss_feed_categories"("tenant_id", "sort_order");
CREATE INDEX "rss_feeds_category_id_idx" ON "rss_feeds"("category_id");

ALTER TABLE "rss_feed_categories"
ADD CONSTRAINT "rss_feed_categories_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rss_feeds"
ADD CONSTRAINT "rss_feeds_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "rss_feed_categories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
