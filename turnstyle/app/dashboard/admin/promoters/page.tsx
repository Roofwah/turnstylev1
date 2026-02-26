'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface PromoterTemplate {
  id: string
  name: string
  templateFileId: string
  mechanicType: string
  isActive: boolean
}

interface Promoter {
  id: string
  name: string
  abn: string | null
  address: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  templates: PromoterTemplate[]
}

const TEMPLATE_FILES = [
  { id: 'repco-trade',      label: 'Repco Trade' },
  { id: 'repco-retail',     label: 'Repco Retail' },
  { id: 'generic-trade',    label: 'Generic Trade' },
  { id: 'generic-consumer', label: 'Generic Consumer' },
]

const MECHANIC_TYPES = [
  { value: 'SWEEPSTAKES',   label: 'Trade Lottery / Sweepstakes' },
  { value: 'LIMITED_OFFER', label: 'Limited Offer' },
  { value: 'INSTANT_WIN',   label: 'Instant Win' },
  { value: 'OTHER',         label: 'Other' },
]

const INPUT_CLS = "w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/40 transition-all"
const LABEL_CLS = "text-white/40 text-xs font-semibold uppercase tracking-widest block mb-1.5"

export default function AdminPromotersPage() {
  const [promoters, setPromoters]             = useState<Promoter[]>([])
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [selected, setSelected]               = useState<Promoter | null>(null)
  const [showNewPromoter, setShowNewPromoter] = useState(false)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [editing, setEditing]                 = useState(false)
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState('')

  // New promoter refs
  const refName         = useRef<HTMLInputElement>(null)
  const refAbn          = useRef<HTMLInputElement>(null)
  const refAddress      = useRef<HTMLInputElement>(null)
  const refContactName  = useRef<HTMLInputElement>(null)
  const refContactEmail = useRef<HTMLInputElement>(null)
  const refContactPhone = useRef<HTMLInputElement>(null)

  // Edit promoter refs
  const refEditName         = useRef<HTMLInputElement>(null)
  const refEditAbn          = useRef<HTMLInputElement>(null)
  const refEditAddress      = useRef<HTMLInputElement>(null)
  const refEditContactName  = useRef<HTMLInputElement>(null)
  const refEditContactEmail = useRef<HTMLInputElement>(null)
  const refEditContactPhone = useRef<HTMLInputElement>(null)

  // Template refs
  const refTplName     = useRef<HTMLInputElement>(null)
  const refTplFileId   = useRef<HTMLSelectElement>(null)
  const refTplMechanic = useRef<HTMLSelectElement>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/promoters')
      const data = await res.json()
      setPromoters(Array.isArray(data) ? data : [])
    } catch {
      setPromoters([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
  }

  function selectPromoter(p: Promoter) {
    setSelected(p)
    setShowNewPromoter(false)
    setShowNewTemplate(false)
    setEditing(false)
  }

  async function savePromoter() {
    const name = refName.current?.value?.trim()
    if (!name) return flash('Company name is required', true)
    setSaving(true)
    const res = await fetch('/api/admin/promoters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        abn:          refAbn.current?.value?.trim()          || null,
        address:      refAddress.current?.value?.trim()      || null,
        contactName:  refContactName.current?.value?.trim()  || null,
        contactEmail: refContactEmail.current?.value?.trim() || null,
        contactPhone: refContactPhone.current?.value?.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      flash('Promoter added')
      if (refName.current)         refName.current.value         = ''
      if (refAbn.current)          refAbn.current.value          = ''
      if (refAddress.current)      refAddress.current.value      = ''
      if (refContactName.current)  refContactName.current.value  = ''
      if (refContactEmail.current) refContactEmail.current.value = ''
      if (refContactPhone.current) refContactPhone.current.value = ''
      setShowNewPromoter(false)
      load()
    } else {
      flash('Failed to save', true)
    }
  }

  async function updatePromoter() {
    if (!selected) return
    const name = refEditName.current?.value?.trim()
    if (!name) return flash('Company name is required', true)
    setSaving(true)
    const res = await fetch(`/api/admin/promoters/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        abn:          refEditAbn.current?.value?.trim()          || null,
        address:      refEditAddress.current?.value?.trim()      || null,
        contactName:  refEditContactName.current?.value?.trim()  || null,
        contactEmail: refEditContactEmail.current?.value?.trim() || null,
        contactPhone: refEditContactPhone.current?.value?.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      flash('Promoter updated')
      setEditing(false)
      const updated = await fetch(`/api/admin/promoters/${selected.id}`).then(r => r.json())
      setSelected(updated)
      load()
    } else {
      flash('Failed to update', true)
    }
  }

  async function saveTemplate(promoterId: string) {
    const name = refTplName.current?.value?.trim()
    if (!name) return flash('Template name is required', true)
    setSaving(true)
    const res = await fetch(`/api/admin/promoters/${promoterId}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        templateFileId: refTplFileId.current?.value   ?? 'generic-trade',
        mechanicType:   refTplMechanic.current?.value ?? 'SWEEPSTAKES',
      }),
    })
    setSaving(false)
    if (res.ok) {
      flash('Template added')
      if (refTplName.current) refTplName.current.value = ''
      setShowNewTemplate(false)
      const updated = await fetch(`/api/admin/promoters/${promoterId}`).then(r => r.json())
      setSelected(updated)
      load()
    } else {
      flash('Failed to save template', true)
    }
  }

  async function deleteTemplate(promoterId: string, templateId: string) {
    if (!confirm('Delete this template?')) return
    await fetch(`/api/admin/promoters/${promoterId}/templates/${templateId}`, { method: 'DELETE' })
    const updated = await fetch(`/api/admin/promoters/${promoterId}`).then(r => r.json())
    setSelected(updated)
    load()
  }

  async function deletePromoter(promoterId: string) {
    if (!confirm('Delete this promoter? This cannot be undone.')) return
    const res = await fetch(`/api/admin/promoters/${promoterId}`, { method: 'DELETE' })
    if (res.ok) {
      setSelected(null)
      load()
    } else {
      flash('Cannot delete — promoter has campaigns linked to it. Remove campaigns first.', true)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />

      <nav className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <img src="/tstyle.png" alt="Turnstyle" className="h-7 w-auto" />
          <span className="text-white/20">/</span>
          <Link href="/dashboard" className="text-white/40 hover:text-white text-sm transition-colors">Dashboard</Link>
          <span className="text-white/20">/</span>
          <span className="text-white text-sm font-semibold">Promoters</span>
        </div>
        <button onClick={() => { setShowNewPromoter(true); setSelected(null); setEditing(false) }}
          className="bg-white text-[#0a0a0f] font-black text-sm px-5 py-2 rounded-xl hover:bg-white/90 transition-all">
          + Add Promoter
        </button>
      </nav>

      {error   && <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">{error}</div>}
      {success && <div className="mx-6 mt-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold px-4 py-3 rounded-xl">{success}</div>}

      <main className="flex h-[calc(100vh-65px)]">

        {/* Left */}
        <div className="w-80 border-r border-white/[0.06] overflow-y-auto p-4">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-3">
            {promoters.length} Promoter{promoters.length !== 1 ? 's' : ''}
          </p>
          {loading ? (
            <div className="text-white/20 text-sm">Loading...</div>
          ) : (
            <div className="space-y-1">
              {promoters.map(p => (
                <button key={p.id} onClick={() => selectPromoter(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${selected?.id === p.id ? 'bg-white/10 border-white/20' : 'border-transparent hover:bg-white/[0.04]'}`}>
                  <div className="text-white font-semibold text-sm">{p.name}</div>
                  <div className="text-white/30 text-xs mt-0.5">
                    {p.abn && <span className="mr-2">ABN {p.abn}</span>}
                    <span>{p.templates?.length ?? 0} template{(p.templates?.length ?? 0) !== 1 ? 's' : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex-1 overflow-y-auto p-8">

          {/* New promoter form */}
          {showNewPromoter && (
            <div className="max-w-xl">
              <h2 className="text-white font-black text-xl mb-6">Add New Promoter</h2>
              <div className="space-y-4">
                <div><label className={LABEL_CLS}>Company name (full legal name)</label><input ref={refName} placeholder="e.g. Repco Parts Pty Ltd" className={INPUT_CLS} /></div>
                <div><label className={LABEL_CLS}>ABN</label><input ref={refAbn} placeholder="e.g. 12 345 678 901" className={INPUT_CLS} /></div>
                <div><label className={LABEL_CLS}>Address</label><input ref={refAddress} placeholder="e.g. 22 Enterprise Drive, Rowville VIC 3175" className={INPUT_CLS} /></div>
                <div className="border-t border-white/[0.06] pt-4">
                  <p className={LABEL_CLS}>Contact (optional)</p>
                  <div className="space-y-3">
                    <div><label className={LABEL_CLS}>Contact name</label><input ref={refContactName} placeholder="e.g. Jane Smith" className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Contact email</label><input ref={refContactEmail} placeholder="e.g. jane@company.com" className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Contact phone</label><input ref={refContactPhone} placeholder="e.g. 0412 345 678" className={INPUT_CLS} /></div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={savePromoter} disabled={saving}
                    className="bg-white text-[#0a0a0f] font-black text-sm px-6 py-2.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Promoter'}
                  </button>
                  <button onClick={() => setShowNewPromoter(false)}
                    className="bg-white/[0.06] border border-white/10 text-white/50 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/10 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Promoter detail */}
          {selected && !showNewPromoter && (
            <div className="max-w-2xl">

              {/* Edit mode */}
              {editing ? (
                <div className="mb-8">
                  <h2 className="text-white font-black text-xl mb-6">Edit Promoter</h2>
                  <div className="space-y-4">
                    <div><label className={LABEL_CLS}>Company name</label><input ref={refEditName} defaultValue={selected.name} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>ABN</label><input ref={refEditAbn} defaultValue={selected.abn ?? ''} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Address</label><input ref={refEditAddress} defaultValue={selected.address ?? ''} className={INPUT_CLS} /></div>
                    <div className="border-t border-white/[0.06] pt-4">
                      <p className={LABEL_CLS}>Contact</p>
                      <div className="space-y-3">
                        <div><label className={LABEL_CLS}>Contact name</label><input ref={refEditContactName} defaultValue={selected.contactName ?? ''} className={INPUT_CLS} /></div>
                        <div><label className={LABEL_CLS}>Contact email</label><input ref={refEditContactEmail} defaultValue={selected.contactEmail ?? ''} className={INPUT_CLS} /></div>
                        <div><label className={LABEL_CLS}>Contact phone</label><input ref={refEditContactPhone} defaultValue={selected.contactPhone ?? ''} className={INPUT_CLS} /></div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={updatePromoter} disabled={saving}
                        className="bg-white text-[#0a0a0f] font-black text-sm px-6 py-2.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={() => setEditing(false)}
                        className="bg-white/[0.06] border border-white/10 text-white/50 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/10 transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h2 className="text-white font-black text-2xl">{selected.name}</h2>
                    {selected.abn     && <p className="text-white/40 text-sm mt-1">ABN {selected.abn}</p>}
                    {selected.address && <p className="text-white/30 text-sm">{selected.address}</p>}
                    {(selected.contactName || selected.contactEmail || selected.contactPhone) && (
                      <div className="mt-3">
                        {selected.contactName  && <p className="text-white/50 text-sm">{selected.contactName}</p>}
                        {selected.contactEmail && <p className="text-white/30 text-sm">{selected.contactEmail}</p>}
                        {selected.contactPhone && <p className="text-white/30 text-sm">{selected.contactPhone}</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing(true)}
                      className="text-white/40 hover:text-white text-xs font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10 border border-white/10">
                      Edit
                    </button>
                    <button onClick={() => deletePromoter(selected.id)}
                      className="text-red-400/40 hover:text-red-400 text-xs font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-red-400/10">
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Templates */}
              {!editing && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white/30 text-xs font-semibold uppercase tracking-widest">Templates</p>
                    <button onClick={() => setShowNewTemplate(t => !t)}
                      className="text-white/50 hover:text-white text-xs font-bold transition-colors">
                      + Add Template
                    </button>
                  </div>

                  {showNewTemplate && (
                    <div className="bg-white/[0.03] border border-white/20 rounded-2xl p-5 mb-3 space-y-3">
                      <div><label className={LABEL_CLS}>Template name</label><input ref={refTplName} placeholder="e.g. Repco Trade — National" className={INPUT_CLS} /></div>
                      <div>
                        <label className={LABEL_CLS}>Template file</label>
                        <select ref={refTplFileId} className={INPUT_CLS}>
                          {TEMPLATE_FILES.map(f => <option key={f.id} value={f.id} className="bg-[#1a1a2e]">{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Mechanic type</label>
                        <select ref={refTplMechanic} className={INPUT_CLS}>
                          {MECHANIC_TYPES.map(m => <option key={m.value} value={m.value} className="bg-[#1a1a2e]">{m.label}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-3 pt-1">
                        <button onClick={() => saveTemplate(selected.id)} disabled={saving}
                          className="bg-white text-[#0a0a0f] font-black text-sm px-5 py-2 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50">
                          {saving ? 'Saving...' : 'Save Template'}
                        </button>
                        <button onClick={() => setShowNewTemplate(false)}
                          className="text-white/30 hover:text-white text-sm font-semibold transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!selected.templates?.length ? (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 text-white/20 text-sm text-center">
                      No templates yet — add one above
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selected.templates.map(t => (
                        <div key={t.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-white font-semibold text-sm">{t.name}</p>
                            <p className="text-white/30 text-xs mt-0.5">
                              {TEMPLATE_FILES.find(f => f.id === t.templateFileId)?.label ?? t.templateFileId} · {MECHANIC_TYPES.find(m => m.value === t.mechanicType)?.label ?? t.mechanicType}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.isActive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                              {t.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <button onClick={() => deleteTemplate(selected.id, t.id)}
                              className="text-red-400/30 hover:text-red-400 text-xs transition-colors">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!selected && !showNewPromoter && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-white/20 text-sm mb-4">Select a promoter or add a new one</p>
                <button onClick={() => setShowNewPromoter(true)}
                  className="bg-white text-[#0a0a0f] font-black text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-all">
                  + Add Promoter
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}