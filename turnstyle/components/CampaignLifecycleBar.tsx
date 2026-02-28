'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LifecycleBar, { LifecycleStage } from './LifecycleBar'
import { getNextStepConfig, NextStepConfig } from '@/lib/lifecycle'
import { confirmQuote } from '@/app/actions/confirmQuote'
import { useNotify } from '@/components/useNotify'

interface CampaignLifecycleBarProps {
  campaignId: string
  currentStatus: string
  campaign?: any
  onStatusUpdated?: (newStatus: string) => void
  compact?: boolean
  hideButton?: boolean
}

export default function CampaignLifecycleBar({
  campaignId,
  currentStatus,
  campaign: campaignProp,
  onStatusUpdated,
  compact = false,
  hideButton = false,
}: CampaignLifecycleBarProps) {
  const router = useRouter()
  const { toast, modal } = useNotify()
  const [status, setStatus] = useState(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)
  const [campaign, setCampaign] = useState(campaignProp)
  const [nextStepConfig, setNextStepConfig] = useState<NextStepConfig | null>(null)
  const [isPrerequisiteMet, setIsPrerequisiteMet] = useState(true)
  const [prerequisiteMessage, setPrerequisiteMessage] = useState<string>('')

  useEffect(() => {
    if (!campaignProp) {
      fetch(`/api/campaigns/${campaignId}`)
        .then(res => res.json())
        .then(data => setCampaign(data))
        .catch(err => console.error('Failed to fetch campaign:', err))
    }
  }, [campaignId, campaignProp])

  useEffect(() => {
    if (campaign) {
      const config = getNextStepConfig({ ...campaign, status })
      setNextStepConfig(config)
      checkPrerequisites(status, campaign)
    }
  }, [campaign, status])

  const checkPrerequisites = (currentStatus: string, camp: any) => {
    if (!camp) { setIsPrerequisiteMet(true); setPrerequisiteMessage(''); return }
    let met = true
    let message = ''
    switch (currentStatus) {
      case 'DRAFT': met = true; message = ''; break
      case 'CONFIRMED':
        if (!camp.termsDrafts?.length) { met = false; message = 'Terms must be built before advancing' }
        break
      case 'COMPILED':
        if (!camp.termsDrafts?.some((d: any) => d.shareToken)) { met = false; message = 'Terms must be shared before advancing' }
        break
      case 'REVIEW':
        if (!camp.termsDrafts?.some((d: any) => d.approvals?.some((a: any) => a.status === 'APPROVED'))) { met = false; message = 'Terms must be approved before advancing' }
        break
    }
    setIsPrerequisiteMet(met)
    setPrerequisiteMessage(message)
  }

  const handleAdvance = async (nextStatus: LifecycleStage) => {
    const previousStatus = status
    setStatus(nextStatus)
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) })
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Failed to update status') }
      const updated = await res.json()
      setStatus(updated.status); setCampaign(updated)
      if (onStatusUpdated) onStatusUpdated(updated.status)
      toast(`Campaign moved to ${updated.status}`)
    } catch (error) {
      setStatus(previousStatus)
      toast(error instanceof Error ? error.message : 'Failed to update status', 'error')
    } finally { setIsUpdating(false) }
  }

  const handleShare = async () => {
    if (!campaign?.termsDrafts?.length) { toast('No terms draft found', 'error'); return }
    const latestDraft = campaign.termsDrafts[0]
    if (!latestDraft.shareToken) { toast('Terms draft has not been shared yet', 'error'); return }
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'REVIEW' }) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to advance status') }
      const updated = await res.json()
      setStatus(updated.status); setCampaign(updated)
      if (onStatusUpdated) onStatusUpdated(updated.status)
      modal({ title: 'Terms Shared — In Review', message: 'Campaign has moved to Review. Share this link with the promoter.', copyText: `${window.location.origin}/review/${latestDraft.shareToken}` })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to share terms', 'error')
    } finally { setIsUpdating(false) }
  }

  const handleDownload = async () => { toast('Download functionality coming soon', 'info') }

  const handleApproveQuote = async () => {
    if (isUpdating) return
    setIsUpdating(true)
    try {
      await confirmQuote(campaignId)
      await new Promise(resolve => setTimeout(resolve, 300))
      const updated = await fetch(`/api/campaigns/${campaignId}?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(res => res.json())
      setCampaign(updated); setStatus(updated.status)
      if (onStatusUpdated) onStatusUpdated(updated.status)
      toast('Quote approved — campaign confirmed')
      router.refresh()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to approve quote', 'error')
    } finally { setIsUpdating(false) }
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
      compact={compact}
      hideButton={hideButton}
    />
  )
}
