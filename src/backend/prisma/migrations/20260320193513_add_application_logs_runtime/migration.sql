-- AlterTable
ALTER TABLE "rss_feed_categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rss_feeds" ALTER COLUMN "updated_at" DROP DEFAULT;
