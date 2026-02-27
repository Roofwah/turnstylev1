'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { generateLOA } from '@/lib/loa-template'

export default function LOAPage() {
  const { id: campaignId } = useParams<{ id: string }>()
  const router = useRouter()
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authorisedPersonName, setAuthorisedPersonName] = useState('')
  const [position, setPosition] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaText, setLoaText] = useState('')

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`)
        if (res.ok) {
          const data = await res.json()
          setCampaign(data)
          
          // Generate LOA text
          if (data.promoter) {
            const text = generateLOA({
              promoterName: data.promoter.name,
              abn: data.promoter.abn || '[ABN not set]',
              address: data.promoter.address || '[Address not set]',
              promotionName: data.name,
              authorisedPersonName: authorisedPersonName || '[To be filled]',
              agencyName: 'Flow Marketing Pty Ltd',
              position: position || '[To be filled]',
              date: new Date().toLocaleDateString('en-AU'),
            })
            setLoaText(text)
          }
        }
      } catch (error) {
        console.error('Failed to fetch campaign:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCampaign()
  }, [campaignId])

  useEffect(() => {
    if (campaign?.promoter) {
      const text = generateLOA({
        promoterName: campaign.promoter.name,
        abn: campaign.promoter.abn || '[ABN not set]',
        address: campaign.promoter.address || '[Address not set]',
        promotionName: campaign.name,
        authorisedPersonName: authorisedPersonName || '[To be filled]',
        agencyName: 'Flow Marketing Pty Ltd',
        position: position || '[To be filled]',
        date: new Date().toLocaleDateString('en-AU'),
      })
      setLoaText(text)
    }
  }, [campaign, authorisedPersonName, position])

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation using a library like jsPDF or puppeteer
    // For now, create a text file download
    const blob = new Blob([loaText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `LOA-${campaign?.tsCode || 'campaign'}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleMarkAsSigned = async () => {
    if (!authorisedPersonName || !position) {
      alert('Please fill in Authorised Person Name and Position before marking as signed.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/permits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permitLOASigned: true }),
      })

      if (res.ok) {
        const updated = await res.json()
        setCampaign(updated)
        alert('Letter of Authority marked as signed.')
      } else {
        const error = await res.json()
        alert(`Failed to mark as signed: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to mark LOA as signed:', error)
      alert('Failed to mark as signed.')
    } finally {
      setSaving(false)
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
            <Link href={`/dashboard/${campaignId}`} className="text-white/40 hover:text-white text-sm transition-colors">
              {campaign?.name ?? 'Campaign'}
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-white text-sm font-semibold">Letter of Authority</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-gray-900 font-black text-2xl mb-6">Letter of Authority</h1>

          {/* Input fields */}
          <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Authorised Person Name
              </label>
              <input
                type="text"
                value={authorisedPersonName}
                onChange={(e) => setAuthorisedPersonName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-400"
                placeholder="Enter authorised person name"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Position/Title
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-400"
                placeholder="Enter position/title"
              />
            </div>
          </div>

          {/* LOA Document */}
          <div className="mb-6">
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-gray-800 text-sm whitespace-pre-wrap font-mono">
              {loaText}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-lg transition-all"
            >
              Download as PDF
            </button>
            <button
              onClick={handleMarkAsSigned}
              disabled={saving || campaign?.permitLOASigned}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : campaign?.permitLOASigned ? '✓ Signed' : 'Mark as Signed'}
            </button>
          </div>

          {campaign?.permitLOASigned && (
            <p className="mt-4 text-emerald-600 text-sm font-semibold">
              ✓ Letter of Authority has been marked as signed.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
