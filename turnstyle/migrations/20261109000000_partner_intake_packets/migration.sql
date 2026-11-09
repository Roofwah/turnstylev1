-- Partner Intake API: packet metadata + partner credentials

ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "packet_ref" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "partner_id" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "submitter_name" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "submitter_email" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "submitter_company" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "external_ref" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_intake_drafts_packet_ref_key" ON "campaign_intake_drafts"("packet_ref");
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_intake_drafts_partner_id_idempotency_key_key" ON "campaign_intake_drafts"("partner_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "campaign_intake_drafts_partner_id_idx" ON "campaign_intake_drafts"("partner_id");
CREATE INDEX IF NOT EXISTS "campaign_intake_drafts_submitter_email_idx" ON "campaign_intake_drafts"("submitter_email");

CREATE TABLE IF NOT EXISTS "partner_api_credentials" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "api_key_prefix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_api_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_api_credentials_partner_id_key" ON "partner_api_credentials"("partner_id");
