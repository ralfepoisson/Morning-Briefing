CREATE TABLE "tenant_ai_configurations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "openai_api_key" TEXT,
  "openai_model" TEXT NOT NULL DEFAULT 'gpt-5-mini',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_ai_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_ai_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tenant_ai_configurations_tenant_id_key" ON "tenant_ai_configurations"("tenant_id");
