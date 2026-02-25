-- Add missing CampaignStatus enum values
-- Note: PostgreSQL requires adding enum values one at a time in separate transactions
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CONFIRMATION';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'LIVE';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'DRAWN';