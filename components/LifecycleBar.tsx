'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NextStepConfig } from '@/lib/lifecycle'

const LIFECYCLE_STAGES = [
  'DRAFT',
  'CONFIRMED',
  'COMPILED',
  'REVIEW',
  'PENDING',
  'SCHEDULED',
  'LIVE',
  'CLOSED',
  'DRAWN',
  'ARCHIVED',
] as const

export type LifecycleStage = typeof LIFECYCLE_STAGES[number]

const STAGE_COLORS: Record<LifecycleStage, string> = {
  DRAFT:     'rgba(255, 255, 255, 0.4)',
  CONFIRMED: '#00C48C',
  COMPILED:  '#3B82F6',
  REVIEW:    '#F59E0B',
  PENDING:   '#F97316',
  SCHEDULED: '#8B5CF6',
  LIVE:      '#00C48C',
  CLOSED:    'rgba(255, 255, 255, 0.6)',
  DRAWN:     'rgba(255, 255, 255, 0.8)',
  ARCHIVED:  'rgba(255, 255, 255, 0.3)',
}

interface LifecycleBarProps {
  currentStatus: string
  nextStepConfig: NextStepConfig | null
  onAdvance?: (nextStatus: LifecycleStage) => void
  onShare?: () => void
  onDownload?: () => void
  onApproveQuote?: () => void
  disabled?: boolean
  isPrerequisiteMet?: boolean
  prerequisiteMessage?: string
}

export default function LifecycleBar({
  currentStatus,
  nextStepConfig,
  onAdvance,
  onShare,
  onDownload,
  onApproveQuote,
  disabled = false,
  isPrerequisiteMet = true,
  prerequisiteMessage,
}: LifecycleBarProps) {
  const router = useRouter()
  const currentIndex = LIFECYCLE_STAGES.indexOf(currentStatus as LifecycleStage)
  const validIndex = currentIndex >= 0 ? currentIndex : 0
  const nextIndex = validIndex + 1
  const nextStage = nextIndex < LIFECYCLE_STAGES.length ? LIFECYCLE_STAGES[nextIndex] : null
  const currentStage = LIFECYCLE_STAGES[validIndex]
  const currentColor = STAGE_COLORS[currentStage as LifecycleStage]

  const handleNextStep = (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    if (!nextStepConfig || disabled) return
    if (nextStepConfig.type === 'advance' && nextStage && onAdvance) {
      if (nextStepConfig.requiresConfirmation) {
        if (window.confirm(`Are you sure you want to mark this campaign as ${nextStage}?`)) onAdvance(nextStage)
      } else {
        onAdvance(nextStage)
      }
    } else if (nextStepConfig.type === 'share' && onShare) {
      onShare()
    } else if (nextStepConfig.type === 'download' && onDownload) {
      onDownload()
    }
  }

  const renderNextStepButton = () => {
    if (!nextStepConfig) {
      if (currentStatus === 'ARCHIVED') {
        return (
          <div className="flex flex-col items-end gap-1 min-w-[110px]">
            <span className="text-white/30 text-xs uppercase tracking-wider">Status</span>
            <span className="bg-white/10 text-white text-xs font-bold px-3 py-1.5 rounded">Complete</span>
          </div>
        )
      }
      return <div className="min-w-[110px]" />
    }

    const buttonClass = isPrerequisiteMet
      ? 'bg-white text-[#0a0a0f] font-black text-xs px-3 py-1.5 rounded transition-all hover:bg-white/90 whitespace-nowrap'
      : 'bg-amber-500/20 border border-amber-500/40 text-amber-400 font-semibold text-xs px-3 py-1.5 rounded transition-all whitespace-nowrap'

    const isApproveQuote = nextStepConfig.label === 'Approve Quote' || nextStepConfig.label?.includes('Approve Quote')

    if (nextStepConfig.type === 'link' && nextStepConfig.href) {
      if (isApproveQuote && onApproveQuote) {
        return (
          <div className="flex flex-col items-end gap-1 min-w-[110px]">
            <span className="text-white/30 text-xs uppercase tracking-wider">Next Step</span>
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault(); e.stopPropagation()
                try { await onApproveQuote() }
                catch (error) { alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`) }
              }}
              className={buttonClass}
              disabled={disabled}
            >
              {nextStepConfig.label} →
            </button>
          </div>
        )
      }
      return (
        <div className="flex flex-col items-end gap-1 min-w-[110px]">
          <span className="text-white/30 text-xs uppercase tracking-wider">Next Step</span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(nextStepConfig.href!) }}
            className={buttonClass}
          >
            {nextStepConfig.label} →
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-end gap-1 min-w-[110px]">
        <span className="text-white/30 text-xs uppercase tracking-wider">Next Step</span>
        <button
          onClick={handleNextStep}
          disabled={disabled || !isPrerequisiteMet}
          className={buttonClass}
          title={!isPrerequisiteMet ? prerequisiteMessage : undefined}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {nextStepConfig.label} →
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 w-full">

      {/* Mobile: just show current node + label */}
      <div className="flex md:hidden flex-col items-center gap-1.5">
        <div
          className="rounded-full"
          style={{
            width: '18px', height: '18px',
            background: currentColor,
            boxShadow: `0 0 8px ${currentColor}, 0 0 16px ${currentColor}40`,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
          {currentStage}
        </div>
      </div>

      {/* Desktop: full metro map */}
      <div className="hidden md:block flex-1 relative" style={{ height: '52px' }}>

       
       

        {/* Nodes row */}
        <div className="absolute inset-0 flex items-start" style={{ paddingTop: '2px' }}>
          {LIFECYCLE_STAGES.map((stage, index) => {
            const isCompleted = index < validIndex
            const isCurrent = index === validIndex
            const isFuture = index > validIndex
            const color = STAGE_COLORS[stage]

            return (
              <div
                key={stage}
                className="flex-1 flex flex-col items-center"
                style={{ zIndex: 2 }}
              >
                {/* Node */}
                <div
                  className="rounded-full"
                  style={{
                    width: isCurrent ? '18px' : '12px',
                    height: isCurrent ? '18px' : '12px',
                    marginTop: isCurrent ? '0px' : '3px',
                    background: isCompleted || isCurrent ? color : 'transparent',
                    border: isFuture ? '2px solid rgba(255,255,255,0.15)' : 'none',
                    boxShadow: isCurrent ? `0 0 8px ${color}, 0 0 16px ${color}40` : 'none',
                    animation: isCurrent ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />
                {/* Label */}
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '9px',
                    fontWeight: isCurrent ? 700 : 400,
                    color: isCurrent ? '#fff' : isCompleted ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                    textAlign: 'center',
                  }}
                >
                  {stage}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Next Step button */}
      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {renderNextStepButton()}
      </div>

    </div>
  )
}
