'use client'

import { useState, useRef, useEffect } from 'react'

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYYYYMMDD(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isBefore(a: Date, b: Date): boolean {
  const t1 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const t2 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return t1 < t2
}

function isAfter(a: Date, b: Date): boolean {
  return isBefore(b, a)
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month, getLastDayOfMonth(year, month))
  const days: Date[] = []
  const d = new Date(first)
  while (d <= last) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function getCalendarWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month, getLastDayOfMonth(year, month))
  const startDow = first.getDay() // 0 Sun .. 6 Sat
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = []
  // leading empty cells
  for (let i = 0; i < startDow; i++) week.push(null)
  const d = new Date(first)
  while (d <= last) {
    week.push(new Date(d))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    d.setDate(d.getDate() + 1)
  }
  if (week.length) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface DatePickerFieldProps {
  value: string
  onChange: (value: string) => void
  minDate?: string // YYYY-MM-DD
  maxDate?: string
  placeholder?: string
  label?: string
  id?: string
  inputClassName?: string
  labelClassName?: string
  /** Optional formatter for the displayed value (e.g. long date "Wednesday 23rd June 2026") */
  formatDisplay?: (value: string) => string
}

export default function DatePickerField({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date',
  label,
  id,
  inputClassName = 'w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30',
  labelClassName = 'block text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5',
  formatDisplay,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    const v = parseYYYYMMDD(value)
    if (v) return v
    const min = minDate ? parseYYYYMMDD(minDate) : null
    if (min) return min
    return new Date()
  })
  const rootRef = useRef<HTMLDivElement>(null)

  const min = minDate ? parseYYYYMMDD(minDate) : null
  const max = maxDate ? parseYYYYMMDD(maxDate) : null
  const selected = value ? parseYYYYMMDD(value) : null

  useEffect(() => {
    if (!open) return
    const v = value ? parseYYYYMMDD(value) : (min || new Date())
    if (v) setViewDate(v)
  }, [open, value, minDate])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()
  const weeks = getCalendarWeeks(viewYear, viewMonth)

  function goPrevMonth() {
    setViewDate(new Date(viewYear, viewMonth - 1, 1))
  }
  function goNextMonth() {
    setViewDate(new Date(viewYear, viewMonth + 1, 1))
  }

  function isDisabled(d: Date): boolean {
    if (min && isBefore(d, min)) return true
    if (max && isAfter(d, max)) return true
    return false
  }

  function pick(d: Date) {
    if (isDisabled(d)) return
    onChange(toYYYYMMDD(d))
    setOpen(false)
  }

  const displayValue = value
    ? (formatDisplay ? formatDisplay(value) : (() => {
        const d = parseYYYYMMDD(value)
        if (!d) return value
        return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      })())
    : ''

  return (
    <div ref={rootRef} className="relative">
      {label && (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      )}
      <button
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        className={inputClassName + ' text-left cursor-pointer flex items-center justify-between'}
      >
        <span className={value ? 'text-white' : 'text-white/30'}>{displayValue || placeholder}</span>
        <span className="text-white/40 text-lg leading-none">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 left-0 mt-1 min-w-[320px] bg-[#1a1a2e] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={goPrevMonth} className="p-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all" aria-label="Previous month">
                ‹
              </button>
              <span className="text-white font-semibold text-sm">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button type="button" onClick={goNextMonth} className="p-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all" aria-label="Next month">
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DOW.map(day => (
                <div key={day} className="py-1 text-white/40 text-[10px] font-semibold uppercase tracking-wider">
                  {day}
                </div>
              ))}
              {weeks.flat().map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />
                const disabled = isDisabled(d)
                const isSelected = selected && isSameDay(d, selected)
                return (
                  <button
                    key={d.getTime()}
                    type="button"
                    onClick={() => pick(d)}
                    disabled={disabled}
                    className={`
                      aspect-square rounded-lg text-sm font-medium transition-all
                      ${disabled ? 'text-white/20 cursor-not-allowed' : 'text-white hover:bg-white/15 cursor-pointer'}
                      ${isSelected ? 'bg-white text-[#0a0a0f] hover:bg-white' : ''}
                    `}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
