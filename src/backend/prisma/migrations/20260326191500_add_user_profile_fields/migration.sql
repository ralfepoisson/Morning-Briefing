ALTER TABLE "app_users"
ADD COLUMN "phonetic_name" TEXT,
ADD COLUMN "avatar_url" TEXT,
ADD COLUMN "telegram_chat_id" TEXT,
ADD COLUMN "telegram_delivery_enabled" BOOLEAN NOT NULL DEFAULT false;
