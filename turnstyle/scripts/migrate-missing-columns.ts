import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const statements = [
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS draw_dataset_uploaded_at TIMESTAMPTZ`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS winners_confirmed_at TIMESTAMPTZ`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS thread_message_id TEXT`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS permit_nsw TEXT`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS permit_sa TEXT`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS permit_act TEXT`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS permit_loa_signed BOOLEAN DEFAULT false`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS mechanic_type TEXT DEFAULT 'OTHER'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS promoter_id TEXT`,
    `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`,
    `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_by_id TEXT`,
  ]
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql)
      console.log('✓', sql)
    } catch (e: any) {
      console.log('✗', e.message)
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
