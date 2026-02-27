'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Campaign {
  id: string
  tsCode: string
  name: string
  prizePoolTotal: number
  status: string
  permitNSW: string | null
  permitSA: string | null
  permitACT: string | null
  permitLOASigned: boolean
  promoter: {
    name: string
  } | null
}

export default function AdminPermitsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      // Fetch all campaigns in PENDING status
      const res = await fetch('/api/campaigns')
      if (res.ok) {
        const allCampaigns = await res.json()
        const pendingCampaigns = allCampaigns.filter((c: Campaign) => c.status === 'PENDING')
        setCampaigns(pendingCampaigns)
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRequiredPermits = (prizePool: number) => {
    const needsACT = prizePool >= 3000
    const needsSA = prizePool >= 5000
    const needsNSW = prizePool >= 10000
    return { needsACT, needsSA, needsNSW }
  }

  const canAdvanceToScheduled = (campaign: Campaign) => {
    const pool = Number(campaign.prizePoolTotal)
    const { needsACT, needsSA, needsNSW } = getRequiredPermits(pool)
    if (needsACT && !campaign.permitACT) return false
    if (needsSA && !campaign.permitSA) return false
    if (needsNSW && !campaign.permitNSW) return false
    if ((needsACT || needsSA || needsNSW) && !campaign.permitLOASigned) return false
    return true
  }

  const handleSave = async (campaignId: string) => {
    setSaving(prev => ({ ...prev, [campaignId]: true }))
    try {
      const updates = editing[campaignId]
      const res = await fetch(`/api/campaigns/${campaignId}/permits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (res.ok) {
        const updated = await res.json()
        setCampaigns(prev => prev.map(c => c.id === campaignId ? updated : c))
        setEditing(prev => {
          const next = { ...prev }
          delete next[campaignId]
          return next
        })
      } else {
        const error = await res.json()
        alert(`Failed to save: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to save permits:', error)
      alert('Failed to save permits.')
    } finally {
      setSaving(prev => ({ ...prev, [campaignId]: false }))
    }
  }

  const handleForceToScheduled = async (campaignId: string) => {
    if (!confirm('Force this campaign to SCHEDULED status? This bypasses permit checks.')) {
      return
    }

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SCHEDULED', force: true }),
      })

      if (res.ok) {
        alert('Campaign advanced to SCHEDULED.')
        fetchCampaigns() // Refresh list
      } else {
        const error = await res.json()
        alert(`Failed to advance: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to force advance:', error)
      alert('Failed to advance campaign.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white/60 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
            <span className="text-white/20">/</span>
            <Link href="/dashboard" className="text-white/40 hover:text-white text-sm transition-colors">
              Dashboard
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">Permits Management</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-white font-black text-2xl mb-6">Permits Management</h1>
        <p className="text-white/60 text-sm mb-8">
          Manage permits and Letter of Authority for campaigns in PENDING status.
        </p>

        {campaigns.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
            <p className="text-white/40 text-sm">No campaigns in PENDING status.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const pool = Number(campaign.prizePoolTotal)
              const { needsACT, needsSA, needsNSW } = getRequiredPermits(pool)
              const isEditing = !!editing[campaign.id]
              const edits = editing[campaign.id] || {}
              const canAdvance = canAdvanceToScheduled(campaign)

              return (
                <div
                  key={campaign.id}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Link
                        href={`/dashboard/${campaign.id}`}
                        className="text-white font-bold text-lg hover:text-white/80 transition-colors"
                      >
                        {campaign.name}
                      </Link>
                      <p className="text-white/40 text-xs mt-1">
                        {campaign.tsCode} · {campaign.promoter?.name || 'No promoter'}
                      </p>
                      <p className="text-white/60 text-sm mt-2">
                        Prize Pool: {pool.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canAdvance ? (
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
                          Ready to Schedule
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-semibold">
                          Permits Required
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {needsACT && (
                      <div>
                        <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-1.5">
                          ACT Permit
                        </label>
                        <input
                          type="text"
                          value={isEditing ? (edits.permitACT ?? campaign.permitACT ?? '') : (campaign.permitACT ?? '')}
                          onChange={(e) => {
                            setEditing(prev => ({
                              ...prev,
                              [campaign.id]: {
                                ...prev[campaign.id],
                                permitACT: e.target.value,
                              },
                            }))
                          }}
                          disabled={!isEditing}
                          className="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-white/40 transition-all disabled:opacity-50"
                          placeholder="Enter ACT permit number"
                        />
                      </div>
                    )}
                    {needsSA && (
                      <div>
                        <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-1.5">
                          SA Permit
                        </label>
                        <input
                          type="text"
                          value={isEditing ? (edits.permitSA ?? campaign.permitSA ?? '') : (campaign.permitSA ?? '')}
                          onChange={(e) => {
                            setEditing(prev => ({
                              ...prev,
                              [campaign.id]: {
                                ...prev[campaign.id],
                                permitSA: e.target.value,
                              },
                            }))
                          }}
                          disabled={!isEditing}
                          className="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-white/40 transition-all disabled:opacity-50"
                          placeholder="Enter SA permit number"
                        />
                      </div>
                    )}
                    {needsNSW && (
                      <div>
                        <label className="block text-white/40 text-xs font-semibold uppercase tracking-widest mb-1.5">
                          NSW Permit
                        </label>
                        <input
                          type="text"
                          value={isEditing ? (edits.permitNSW ?? campaign.permitNSW ?? '') : (campaign.permitNSW ?? '')}
                          onChange={(e) => {
                            setEditing(prev => ({
                              ...prev,
                              [campaign.id]: {
                                ...prev[campaign.id],
                                permitNSW: e.target.value,
                              },
                            }))
                          }}
                          disabled={!isEditing}
                          className="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-white/40 transition-all disabled:opacity-50"
                          placeholder="Enter NSW permit number"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isEditing ? (edits.permitLOASigned ?? campaign.permitLOASigned) : campaign.permitLOASigned}
                        onChange={(e) => {
                          setEditing(prev => ({
                            ...prev,
                            [campaign.id]: {
                              ...prev[campaign.id],
                              permitLOASigned: e.target.checked,
                            },
                          }))
                        }}
                        disabled={!isEditing}
                        className="w-4 h-4 rounded border-white/20 bg-white/[0.06] text-amber-500 focus:ring-amber-500 disabled:opacity-50"
                      />
                      <span className="text-white/60 text-sm">
                        Letter of Authority signed
                      </span>
                      <Link
                        href={`/dashboard/${campaign.id}/loa`}
                        className="text-amber-400 hover:text-amber-300 text-sm underline"
                      >
                        View LOA →
                      </Link>
                    </label>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => setEditing(prev => {
                              const next = { ...prev }
                              delete next[campaign.id]
                              return next
                            })}
                            className="px-4 py-2 bg-white/[0.06] border border-white/20 text-white/60 text-sm font-semibold rounded-lg hover:bg-white/[0.10] transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(campaign.id)}
                            disabled={saving[campaign.id]}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
                          >
                            {saving[campaign.id] ? 'Saving...' : 'Save'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditing(prev => ({ ...prev, [campaign.id]: {} }))}
                            className="px-4 py-2 bg-white/[0.06] border border-white/20 text-white text-sm font-semibold rounded-lg hover:bg-white/[0.10] transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleForceToScheduled(campaign.id)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-all"
                          >
                            Force to Scheduled
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
