import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS draw_dataset_uploaded_at TIMESTAMPTZ;
  `)
  console.log('Migration complete')
}
main().catch(console.error).finally(() => prisma.$disconnect())
