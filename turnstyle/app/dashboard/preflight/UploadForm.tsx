'use client'

// ─────────────────────────────────────────────
// Preflight Upload — Client Form Component
//
// Handles file selection, validation feedback,
// and calls the uploadAndPreflightTerms server action.
// On success, redirects to /dashboard/preflight/[uploadId].
// ─────────────────────────────────────────────

import { useTransition, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { uploadAndPreflightTerms } from '@/app/actions/preflightUpload'

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // ── File selection ─────────────────────────

  function handleFileChange(f: File | null) {
    setError(null)
    if (!f) { setFile(null); return }
    if (!f.name.endsWith('.docx')) {
      setError('Only .docx Word documents are supported.')
      setFile(null)
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File exceeds the 10 MB limit.')
      setFile(null)
      return
    }
    setFile(f)
  }

  // ── Drag-and-drop ──────────────────────────

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0] ?? null
    handleFileChange(dropped)
  }

  // ── Submit ─────────────────────────────────

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return

    setError(null)
    const formData = new FormData()
    formData.append('file', file)

    startTransition(async () => {
      const result = await uploadAndPreflightTerms(formData)
      if (result.success) {
        router.push(`/dashboard/preflight/${result.uploadId}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload .docx file"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        className={[
          'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all select-none',
          dragOver
            ? 'border-white/60 bg-white/[0.06]'
            : file
            ? 'border-emerald-500/60 bg-emerald-500/[0.04]'
            : 'border-white/[0.12] bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          aria-hidden="true"
        />

        {file ? (
          <div className="space-y-2">
            {/* Tick icon */}
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold text-sm">{file.name}</p>
            <p className="text-white/40 text-xs">
              {(file.size / 1024).toFixed(0)} KB
              {' · '}
              <span
                className="text-white/60 hover:text-white underline underline-offset-2 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = '' }}
              >
                Remove
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Upload icon */}
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium">
                Drop your .docx here, or{' '}
                <span className="text-white underline underline-offset-2">browse</span>
              </p>
              <p className="text-white/30 text-xs mt-1">Word documents only · max 10 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!file || isPending}
        className={[
          'w-full py-3.5 rounded-xl font-black text-sm transition-all',
          file && !isPending
            ? 'bg-white text-[#0a0a0f] hover:bg-white/90'
            : 'bg-white/10 text-white/30 cursor-not-allowed',
        ].join(' ')}
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analysing…
          </span>
        ) : (
          'Run Preflight'
        )}
      </button>

      {/* Context note */}
      <p className="text-white/25 text-xs text-center leading-relaxed">
        The document is not stored permanently. Text is extracted, analysed, and
        the result is saved. No campaign record is created.
      </p>
    </form>
  )
}
