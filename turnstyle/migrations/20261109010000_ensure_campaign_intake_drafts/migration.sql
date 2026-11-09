-- Ensure campaign_intake_drafts exists (base + partner packet columns)

CREATE TABLE IF NOT EXISTS "campaign_intake_drafts" (
    "id" TEXT NOT NULL,
    "review_token" TEXT NOT NULL,
    "packet_ref" TEXT,
    "partner_id" TEXT,
    "submitter_name" TEXT,
    "submitter_email" TEXT,
    "submitter_company" TEXT,
    "external_ref" TEXT,
    "idempotency_key" TEXT,
    "from_email" TEXT,
    "subject" TEXT,
    "resend_email_id" TEXT,
    "raw_input" TEXT NOT NULL,
    "intake_json" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_intake_drafts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "packet_ref" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "partner_id" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "submitter_name" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "submitter_email" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "submitter_company" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "external_ref" TEXT;
ALTER TABLE "campaign_intake_drafts" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_intake_drafts_review_token_key" ON "campaign_intake_drafts"("review_token");
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
