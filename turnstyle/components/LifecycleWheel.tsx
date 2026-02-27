'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const LIFECYCLE_STAGES = [
  'DRAFT',
  'CONFIRMATION',
  'REVIEW',
  'PENDING',
  'SCHEDULED',
  'LIVE',
  'CLOSED',
  'DRAWN',
  'ARCHIVED',
] as const

export type LifecycleStage = typeof LIFECYCLE_STAGES[number]

const ITEM_HEIGHT = 20
const VISIBLE_ITEMS = 3
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS

interface LifecycleWheelProps {
  currentStatus: string
  onStatusChange: (newStatus: LifecycleStage) => void
  allowBackward?: boolean
  disabled?: boolean
}

export default function LifecycleWheel({
  currentStatus,
  onStatusChange,
  allowBackward = false,
  disabled = false,
}: LifecycleWheelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = LIFECYCLE_STAGES.indexOf(currentStatus as LifecycleStage)
    return idx >= 0 ? idx : 0
  })

  // Update index when currentStatus prop changes
  useEffect(() => {
    const idx = LIFECYCLE_STAGES.indexOf(currentStatus as LifecycleStage)
    if (idx >= 0 && idx !== currentIndex) {
      setCurrentIndex(idx)
      scrollToIndex(idx, false)
    }
  }, [currentStatus])

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    if (!scrollRef.current) return
    // Calculate scroll position to center the item
    // Item position = top spacer + (index * item height)
    // To center: scroll so item center aligns with viewport center
    const itemTop = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2 + (index * ITEM_HEIGHT)
    const itemCenter = itemTop + (ITEM_HEIGHT / 2)
    const viewportCenter = CONTAINER_HEIGHT / 2
    const targetScroll = itemCenter - viewportCenter
    
    scrollRef.current.scrollTo({
      top: targetScroll,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }, [])

  // Initialize scroll position - center the current status
  useEffect(() => {
    scrollToIndex(currentIndex, false)
  }, [scrollToIndex])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || disabled) return

    const scrollTop = scrollRef.current.scrollTop
    // Account for top spacer when calculating index
    const adjustedScroll = scrollTop + (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2
    const newIndex = Math.round(adjustedScroll / ITEM_HEIGHT)
    const clampedIndex = Math.max(0, Math.min(newIndex, LIFECYCLE_STAGES.length - 1))

    // Enforce forward-only progression (unless allowBackward is true)
    if (!allowBackward && clampedIndex < currentIndex) {
      // Snap back to current index
      scrollToIndex(currentIndex, true)
      return
    }

    if (clampedIndex !== currentIndex) {
      setCurrentIndex(clampedIndex)
      setIsScrolling(true)
    }
  }, [currentIndex, allowBackward, disabled, scrollToIndex])

  const handleScrollEnd = useCallback(() => {
    if (!scrollRef.current || disabled) return

    const scrollTop = scrollRef.current.scrollTop
    // Account for top spacer when calculating index
    const adjustedScroll = scrollTop + (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2
    const newIndex = Math.round(adjustedScroll / ITEM_HEIGHT)
    const clampedIndex = Math.max(0, Math.min(newIndex, LIFECYCLE_STAGES.length - 1))

    // Snap to nearest item
    scrollToIndex(clampedIndex, true)

    // Check if status actually changed
    if (clampedIndex !== LIFECYCLE_STAGES.indexOf(currentStatus as LifecycleStage)) {
      const newStatus = LIFECYCLE_STAGES[clampedIndex]
      if (newStatus) {
        onStatusChange(newStatus)
      }
    }

    setIsScrolling(false)
  }, [currentStatus, onStatusChange, disabled, scrollToIndex])

  // Get the distance from center for perspective effect
  const getItemStyle = (index: number) => {
    const distance = Math.abs(index - currentIndex)
    const maxDistance = Math.floor(VISIBLE_ITEMS / 2)

    if (distance === 0) {
      // Active item
      return {
        opacity: 1,
        fontSize: '10px',
        fontWeight: 900,
        transform: 'scale(1)',
        textShadow: '0 0 4px rgba(255, 255, 255, 0.3)',
      }
    } else if (distance === 1) {
      // Adjacent items
      return {
        opacity: 0.4,
        fontSize: '9px',
        fontWeight: 600,
        transform: `scale(0.85)`,
      }
    } else {
      return {
        opacity: 0.2,
        fontSize: '8px',
        fontWeight: 600,
        transform: `scale(0.7)`,
      }
    }
  }

  return (
    <div className="relative lifecycle-wheel-container inline-block" style={{ height: CONTAINER_HEIGHT, width: '80px', marginTop: '-10px', marginBottom: '-10px' }}>
      {/* Center indicator line */}
      <div
        className="absolute left-0 right-0 z-10 pointer-events-none"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          height: ITEM_HEIGHT,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      />

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchEnd={handleScrollEnd}
        onMouseUp={handleScrollEnd}
        className="overflow-y-scroll"
        style={{
          height: CONTAINER_HEIGHT,
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
        }}
      >
        {/* Top spacer to center first item */}
        <div style={{ height: (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2 }} />
        
        {/* Stage items */}
        {LIFECYCLE_STAGES.map((stage, index) => {
          const style = getItemStyle(index)
          const isActive = index === currentIndex

          return (
            <div
              key={stage}
              className="flex items-center justify-center text-white transition-all duration-200"
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: 'center',
                ...style,
                cursor: disabled ? 'not-allowed' : 'grab',
              }}
            >
              {stage}
            </div>
          )
        })}
        
        {/* Bottom spacer to center last item */}
        <div style={{ height: (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2 }} />
      </div>

    </div>
  )
}
