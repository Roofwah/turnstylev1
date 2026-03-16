'use server'

import { prisma } from '@/lib/prisma'
import { runPreflight } from '@/lib/preflight'
import { mapCampaignToBuilder } from '@/lib/preflight/mapper'

export async function preflightCampaign(
  campaignId: string,
  renderedTerms: string,
  gapAnswers: Record<string, unknown> = {}
) {
  // 1. Fetch campaign with promoter relation
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { promoter: true },
  })

  // 2. Use live gap answers from the wizard — not from the DB
  // DB gapAnswers may be stale or empty for new campaigns
  const draftForMapper = {
    content: renderedTerms,
    gapAnswers,
  }

  // 3. Map campaign data to builder input
  const builder = mapCampaignToBuilder(campaign, draftForMapper)

  // 4. Run preflight against the live rendered terms text
  const report = await runPreflight(builder, renderedTerms)

  return { report }
}
