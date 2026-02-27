'use client'

import { useState, useEffect } from 'react'
import LifecycleWheel, { LifecycleStage } from './LifecycleWheel'

interface CampaignLifecycleWheelProps {
  campaignId: string
  currentStatus: string
  allowBackward?: boolean
  onStatusUpdated?: (newStatus: string) => void
}

export default function CampaignLifecycleWheel({
  campaignId,
  currentStatus,
  allowBackward = false,
  onStatusUpdated,
}: CampaignLifecycleWheelProps) {
  const [status, setStatus] = useState(currentStatus)
  const [isUpdating, setIsUpdating] = useState(false)

  // Update status when prop changes
  useEffect(() => {
    setStatus(currentStatus)
  }, [currentStatus])

  const handleStatusChange = async (newStatus: LifecycleStage) => {
    // Optimistic update
    const previousStatus = status
    setStatus(newStatus)
    setIsUpdating(true)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          role: allowBackward ? 'SUPER_ADMIN' : 'USER', // TODO: Get actual user role
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update status')
      }

      // Success - status is already updated optimistically
      const updated = await res.json()
      setStatus(updated.status)
      
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

  return (
    <div className="relative">
      <LifecycleWheel
        currentStatus={status}
        onStatusChange={handleStatusChange}
        allowBackward={allowBackward}
        disabled={isUpdating}
      />
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/80 z-30">
          <div className="text-white/60 text-xs">Updating...</div>
        </div>
      )}
    </div>
  )
}
