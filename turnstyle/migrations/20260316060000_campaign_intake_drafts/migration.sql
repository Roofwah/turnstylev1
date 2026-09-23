-- CreateTable
CREATE TABLE "campaign_intake_drafts" (
    "id" TEXT NOT NULL,
    "review_token" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "campaign_intake_drafts_review_token_key" ON "campaign_intake_drafts"("review_token");
