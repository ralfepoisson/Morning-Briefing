-- CreateTable
CREATE TABLE "reference_cities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "geoname_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ascii_name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "admin_name_1" TEXT,
    "timezone" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "population" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reference_cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reference_cities_geoname_id_key" ON "reference_cities"("geoname_id");

-- CreateIndex
CREATE INDEX "reference_cities_name_idx" ON "reference_cities"("name");

-- CreateIndex
CREATE INDEX "reference_cities_ascii_name_idx" ON "reference_cities"("ascii_name");

-- CreateIndex
CREATE INDEX "reference_cities_country_code_name_idx" ON "reference_cities"("country_code", "name");

-- AddForeignKey
ALTER TABLE "reference_cities" ADD CONSTRAINT "reference_cities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
