-- Promotion operations: documents, draws, campaign ops fields

CREATE TYPE "InvoiceOpsStatus" AS ENUM ('NOT_STARTED', 'REQUIRED', 'ISSUED', 'PAID', 'NOT_APPLICABLE');
CREATE TYPE "OpsDocumentStatus" AS ENUM ('NOT_STARTED', 'REQUIRED', 'WAITING_ON_CLIENT', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'APPROVED', 'LODGED', 'RECEIVED', 'COMPLETE', 'OVERDUE', 'NOT_APPLICABLE');
CREATE TYPE "DrawFileStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'REQUESTED', 'RECEIVED', 'CHECKED', 'READY_FOR_DRAW', 'USED_IN_DRAW', 'ARCHIVED');
CREATE TYPE "DrawCertificateStatus" AS ENUM ('NOT_STARTED', 'GENERATED', 'REVIEWED', 'SENT_TO_CLIENT', 'SAVED_TO_DROPBOX');

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dropbox_folder_url" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "intake_summary" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "preflight_score" INTEGER;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "invoice_ops_status" "InvoiceOpsStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "ops_notes" TEXT;

CREATE TABLE IF NOT EXISTS "promotion_documents" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "folder_label" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "OpsDocumentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "due_date" DATE,
    "dropbox_folder" TEXT,
    "dropbox_file_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_draws" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "draw_name" TEXT NOT NULL,
    "draw_number" INTEGER NOT NULL,
    "draw_date" DATE NOT NULL,
    "draw_time" TEXT,
    "draw_location" TEXT,
    "entry_period_start" DATE,
    "entry_period_end" DATE,
    "entry_file_required" BOOLEAN NOT NULL DEFAULT true,
    "entry_file_status" "DrawFileStatus" NOT NULL DEFAULT 'REQUIRED',
    "entry_file_dropbox_url" TEXT,
    "purerandom_draw_status" TEXT,
    "certificate_status" "DrawCertificateStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "certificate_dropbox_url" TEXT,
    "winner_notify_due" DATE,
    "winner_notify_status" "OpsDocumentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "publication_required" BOOLEAN NOT NULL DEFAULT false,
    "publication_due" DATE,
    "publication_status" "OpsDocumentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "permit_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_draws_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promotion_documents_campaign_id_file_type_key" ON "promotion_documents"("campaign_id", "file_type");
CREATE INDEX IF NOT EXISTS "promotion_documents_campaign_id_idx" ON "promotion_documents"("campaign_id");
CREATE INDEX IF NOT EXISTS "promotion_documents_status_idx" ON "promotion_documents"("status");
CREATE INDEX IF NOT EXISTS "promotion_draws_campaign_id_idx" ON "promotion_draws"("campaign_id");
CREATE INDEX IF NOT EXISTS "promotion_draws_draw_date_idx" ON "promotion_draws"("draw_date");

ALTER TABLE "promotion_documents" DROP CONSTRAINT IF EXISTS "promotion_documents_campaign_id_fkey";
ALTER TABLE "promotion_documents" ADD CONSTRAINT "promotion_documents_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_draws" DROP CONSTRAINT IF EXISTS "promotion_draws_campaign_id_fkey";
ALTER TABLE "promotion_draws" ADD CONSTRAINT "promotion_draws_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
