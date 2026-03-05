'use client'
import { useState, useEffect } from 'react'
import { generateDrawSchedule, DrawEvent } from '@/lib/draw-schedule'

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DrawScheduleTab({ campaign, onSave }: { campaign: any; onSave: (schedule: DrawEvent[]) => Promise<void> }) {
  const [schedule, setSchedule] = useState<DrawEvent[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (campaign.drawSchedule && Array.isArray(campaign.drawSchedule)) {
      setSchedule(campaign.drawSchedule)
    } else if (campaign.promoStart && campaign.promoEnd) {
      const generated = generateDrawSchedule(campaign.promoStart, campaign.promoEnd, campaign.drawFrequency || 'at_conclusion')
      setSchedule(generated)
      setDirty(true)
    }
  }, [campaign])

  function updateRow(id: string, field: keyof DrawEvent, value: any) {
    setSchedule(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
    setDirty(true)
  }

  function removeRow(id: string) {
    setSchedule(prev => prev.filter(e => e.id !== id))
    setDirty(true)
  }

  function addRow() {
    const newRow: DrawEvent = {
      id: `minor-${Date.now()}`,
      name: `Minor Draw`,
      periodStart: campaign.promoStart,
      periodEnd: campaign.promoEnd,
      drawDate: campaign.promoEnd,
      winners: 1,
      type: 'minor',
    }
    setSchedule(prev => [...prev, newRow])
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    await onSave(schedule)
    setSaving(false)
    setDirty(false)
  }

  const isSimple = (campaign.drawFrequency || 'AT_CONCLUSION').toUpperCase() === 'AT_CONCLUSION'

  return (
    <div className="max-w-4xl space-y-4">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-1 opacity-60">Draw Schedule</h2>
            <p className="text-white/40 text-sm">{isSimple ? 'Single draw at conclusion.' : 'Auto-generated from promotion frequency. Edit dates as needed.'}</p>
          </div>
          <div className="flex gap-2">
            {!isSimple && (
              <button onClick={addRow} className="bg-white/[0.06] border border-white/[0.10] text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-white/10 transition-all">
                + Add Row
              </button>
            )}
            {process.env.NODE_ENV === 'development' && (
            <button onClick={async () => {
              const res = await fetch(`/api/campaigns/${(campaign as any).id}/sync-draws`, { method: 'POST' })
              const data = await res.json()
              if (data.schedule) {
                setSchedule(data.schedule)
                alert('Synced to PureRandom!')
              } else {
                alert('Error: ' + (data.error || 'unknown'))
              }
            }} className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-amber-400/20 transition-all">
              🔄 Sync to PureRandom
            </button>
          )}
          {dirty && (
              <button onClick={save} disabled={saving} className="bg-white text-[#0a0a0f] font-black text-xs px-4 py-2 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-white/30 text-xs font-semibold uppercase tracking-widest text-left pb-3 pr-4">Draw</th>
                {!isSimple && <th className="text-white/30 text-xs font-semibold uppercase tracking-widest text-left pb-3 pr-4">Period Start</th>}
                {!isSimple && <th className="text-white/30 text-xs font-semibold uppercase tracking-widest text-left pb-3 pr-4">Period End</th>}
                <th className="text-white/30 text-xs font-semibold uppercase tracking-widest text-left pb-3 pr-4">Draw Date</th>
                <th className="text-white/30 text-xs font-semibold uppercase tracking-widest text-left pb-3 pr-4">Winners</th>
                <th className="text-white/30 text-xs font-semibold uppercase tracking-widest text-left pb-3 pr-4">Stus</th>
                {!isSimple && <th className="pb-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {schedule.map(event => (
                <tr key={event.id}>
                  <td className="py-3 pr-4">
                    <input
                      value={event.name}
                      onChange={e => updateRow(event.id, 'name', e.target.value)}
                      className="bg-transparent text-white font-semibold w-32 focus:outline-none focus:border-b focus:border-white/30"
                    />
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-bold ${event.type === 'major' ? 'bg-amber-400/10 text-amber-400' : 'bg-blue-400/10 text-blue-400'}`}>
                      {event.type}
                    </span>
                  </td>
                  {!isSimple && (
                    <td className="py-3 pr-4">
                      <input type="date" value={event.periodStart} onChange={e => updateRow(event.id, 'periodStart', e.target.value)}
                        className="bg-white/[0.05] border border-white/[0.10] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-white/30" />
                    </td>
                  )}
                  {!isSimple && (
                    <td className="py-3 pr-4">
                      <input type="date" value={event.periodEnd} onChange={e => updateRow(event.id, 'periodEnd', e.target.value)}
                        className="bg-white/[0.05] border border-white/[0.10] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-white/30" />
                    </td>
                  )}
                  <td className="py-3 pr-4">
                    <input type="date" value={event.drawDate} onChange={e => updateRow(event.id, 'drawDate', e.target.value)}
                      className="bg-white/[0.05] border border-white/[0.10] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-white/30" />
                  </td>
                  <td className="py-3 pr-4">
                    <input type="number" min={1} value={event.winners} onChange={e => updateRow(event.id, 'winners', parseInt(e.target.value))}
                      className="bg-white/[0.05] border border-white/[0.10] rounded-lg px-2 py-1 text-white text-xs w-16 focus:outline-none focus:border-white/30" />
                  </td>
                  {!isSimple && (
                    <td className="py-3">
                      <button onClick={() => removeRow(event.id)} className="text-red-400/50 hover:text-red-400 text-xs transition-colors">✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
