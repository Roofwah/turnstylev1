'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LifecycleBar, { LifecycleStage } from './LifecycleBar'
import { getNextStepConfig, NextStepConfig } from '@/lib/lifecycle'
import { confirmQuote } from '@/app/actions/confirmQuote'

interface CampaignLifecycleBarProps {
  campaignId: string
  currentStatus: string
  campaign?: any // Optional campaign data - if not provided, will fetch
  onStatusUpdated?: (newStatus: string) => void
}

export default function CampaignLifecycleBar({
  campaignId,
  currentStatus,
  campaign: campaignProp,
  onStatusUpdated,
}: CampaignLifecycleBarProps) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)
  const [campaign, setCampaign] = useState(campaignProp)
  const [nextStepConfig, setNextStepConfig] = useState<NextStepConfig | null>(null)
  const [isPrerequisiteMet, setIsPrerequisiteMet] = useState(true)
  const [prerequisiteMessage, setPrerequisiteMessage] = useState<string>('')

  // Fetch campaign data if not provided
  useEffect(() => {
    if (!campaignProp) {
      fetch(`/api/campaigns/${campaignId}`)
        .then(res => res.json())
        .then(data => {
          setCampaign(data)
        })
        .catch(err => console.error('Failed to fetch campaign:', err))
    }
  }, [campaignId, campaignProp])

  // Update next step config when campaign or status changes
  useEffect(() => {
    if (campaign) {
      const config = getNextStepConfig({ ...campaign, status })
      setNextStepConfig(config)
      
      // Check prerequisites
      checkPrerequisites(status, campaign)
    }
  }, [campaign, status])

  const checkPrerequisites = (currentStatus: string, camp: any) => {
    if (!camp) {
      setIsPrerequisiteMet(true)
      setPrerequisiteMessage('')
      return
    }

    let met = true
    let message = ''

    switch (currentStatus) {
      case 'DRAFT':
        // DRAFT → CONFIRMED: No prerequisites - the next step IS to approve the quote
        // If status is DRAFT, quote is NOT approved (they're mutually exclusive)
        // Button should always be enabled for DRAFT status
        met = true
        message = ''
        break
      case 'CONFIRMED':
        // Check if TermsDraft exists
        const hasTermsDraft = camp.termsDrafts && Array.isArray(camp.termsDrafts) && camp.termsDrafts.length > 0
        if (!hasTermsDraft) {
          met = false
          message = 'Terms must be built before advancing'
        }
        break
      case 'COMPILED':
        // Check if shareToken exists
        const hasShareToken = camp.termsDrafts?.some((d: any) => d.shareToken)
        if (!hasShareToken) {
          met = false
          message = 'Terms must be shared before advancing'
        }
        break
      case 'REVIEW':
        // Check if at least one approval exists
        const hasApproval = camp.termsDrafts?.some((d: any) => 
          d.approvals && Array.isArray(d.approvals) && d.approvals.some((a: any) => a.status === 'APPROVED')
        )
        if (!hasApproval) {
          met = false
          message = 'Terms must be approved before advancing'
        }
        break
      case 'CLOSED':
        // Check if draw dataset uploaded (placeholder - need to check actual implementation)
        // For now, assume it's met if we have a way to check
        break
      case 'DRAWN':
        // Check if winners confirmed (placeholder)
        break
    }

    setIsPrerequisiteMet(met)
    setPrerequisiteMessage(message)
  }

  const handleAdvance = async (nextStatus: LifecycleStage) => {
    // Optimistic update
    const previousStatus = status
    setStatus(nextStatus)
    setIsUpdating(true)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update status')
      }

      // Success - status is already updated optimistically
      const updated = await res.json()
      setStatus(updated.status)
      
      // Update campaign data
      if (updated) {
        setCampaign(updated)
      }
      
      // Notify parent component
      if (onStatusUpdated) {
        onStatusUpdated(updated.status)
      }
    } catch (error) {
      // Revert on error
      console.error('Failed to update campaign status:', error)
      setStatus(previousStatus)
      alert(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleShare = async () => {
    // Find the latest terms draft and copy share link
    if (!campaign?.termsDrafts || campaign.termsDrafts.length === 0) {
      alert('No terms draft found')
      return
    }

    const latestDraft = campaign.termsDrafts[0]
    if (!latestDraft.shareToken) {
      alert('Terms draft has not been shared yet')
      return
    }

    const shareLink = `${window.location.origin}/review/${latestDraft.shareToken}`
    await navigator.clipboard.writeText(shareLink)
    alert('Share link copied to clipboard!')
  }

  const handleDownload = async () => {
    // TODO: Implement download approved terms PDF
    alert('Download functionality coming soon')
  }

  const handleApproveQuote = async () => {
    console.log('🚀 handleApproveQuote CALLED', { campaignId, isUpdating, currentStatus: status })
    if (isUpdating) {
      console.log('⚠️ Already updating, ignoring click')
      return
    }
    setIsUpdating(true)
    try {
      console.log('📞 Calling confirmQuote server action...', { campaignId })
      const result = await confirmQuote(campaignId)
      console.log('✅ confirmQuote returned:', result)
      
      // Wait for cache invalidation
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Fetch fresh campaign data (bypass cache with timestamp)
      const updated = await fetch(`/api/campaigns/${campaignId}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      }).then(res => res.json())
      
      console.log('Updated campaign data:', { 
        status: updated.status, 
        expected: 'CONFIRMED',
        matches: updated.status === 'CONFIRMED',
      })
      
      // Update state with actual server data
      setCampaign(updated)
      setStatus(updated.status)
      
      // Notify parent
      if (onStatusUpdated) {
        onStatusUpdated(updated.status)
      }
      
      // Refresh server components to show updated status
      router.refresh()
    } catch (error) {
      console.error('Failed to approve quote:', error)
      alert(error instanceof Error ? error.message : 'Failed to approve quote')
    } finally {
      setIsUpdating(false)
    }
  }


  return (
    <LifecycleBar
      currentStatus={status}
      nextStepConfig={nextStepConfig}
      onAdvance={handleAdvance}
      onShare={handleShare}
      onDownload={handleDownload}
      onApproveQuote={handleApproveQuote}
      disabled={isUpdating}
      isPrerequisiteMet={isPrerequisiteMet}
      prerequisiteMessage={prerequisiteMessage}
    />
  )
}
