import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding known promoters...')
  
  await prisma.promoter.createMany({
    data: [
      {
        name: 'Repco Parts Pty Ltd',
        abn: '97 097 993 283',
        address: { street: '22 Enterprise Drive', city: 'Rowville', state: 'VIC', postcode: '3175' },
      },
      {
        name: 'Rheem Australia Pty Limited',
        abn: '21 098 823 511',
        address: { street: '1 Alan Street', city: 'Rydalmere', state: 'NSW', postcode: '2116' },
      },
      {
        name: 'Samsung Electronics Australia Pty Limited',
        abn: '63 002 915 648',
        address: { street: '3 Murray Rose Avenue', city: 'Sydney Olympic Park', state: 'NSW', postcode: '2127' },
      },
    ],
    skipDuplicates: true,
  })

  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())