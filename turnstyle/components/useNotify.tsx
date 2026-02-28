'use client'

import { useState, useCallback, createContext, useContext, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ModalOptions {
  title: string
  message: string
  copyText?: string   // If provided, shows a copy button
  confirmLabel?: string
  onConfirm?: () => void
}

interface NotifyContextValue {
  toast: (message: string, type?: ToastType) => void
  modal: (options: ModalOptions) => void
}

// ── Context ────────────────────────────────────────────────────────────────

const NotifyContext = createContext<NotifyContextValue | null>(null)

export function useNotify() {
  const ctx = useContext(NotifyContext)
  if (!ctx) throw new Error('useNotify must be used within <NotifyProvider>')
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [modalOpts, setModalOpts] = useState<ModalOptions | null>(null)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    timerRef.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const modal = useCallback((options: ModalOptions) => {
    setModalOpts(options)
    setCopied(false)
  }, [])

  const closeModal = () => setModalOpts(null)

  const handleCopy = async () => {
    if (!modalOpts?.copyText) return
    try {
      await navigator.clipboard.writeText(modalOpts.copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback — select the text
    }
  }

  const toastColors: Record<ToastType, string> = {
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    error:   'bg-red-500/20 border-red-500/40 text-red-300',
    info:    'bg-sky-500/20 border-sky-500/40 text-sky-300',
  }

  const toastIcons: Record<ToastType, string> = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  }

  return (
    <NotifyContext.Provider value={{ toast, modal }}>
      {children}

      {/* ── Toasts ── */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm text-sm font-semibold shadow-2xl pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200 ${toastColors[t.type]}`}
          >
            <span className="text-base font-black">{toastIcons[t.type]}</span>
            <span>{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="ml-2 opacity-50 hover:opacity-100 transition-opacity text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* ── Modal ── */}
      {modalOpts && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={closeModal}
        >
          <div
            className="bg-[#111118] border border-white/[0.10] rounded-2xl p-7 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-white font-black text-lg mb-2">{modalOpts.title}</h2>
            <p className="text-white/60 text-sm mb-5 leading-relaxed">{modalOpts.message}</p>

            {modalOpts.copyText && (
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 mb-5 flex items-center gap-3">
                <code className="text-white/70 text-xs flex-1 break-all">{modalOpts.copyText}</code>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
                  }`}
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              {modalOpts.onConfirm && (
                <button
                  onClick={() => { modalOpts.onConfirm?.(); closeModal() }}
                  className="bg-white text-[#0a0a0f] font-black text-sm px-5 py-2.5 rounded-xl hover:bg-white/90 transition-all"
                >
                  {modalOpts.confirmLabel ?? 'Confirm'}
                </button>
              )}
              <button
                onClick={closeModal}
                className="bg-white/[0.06] border border-white/[0.10] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-white/10 transition-all"
              >
                {modalOpts.onConfirm ? 'Cancel' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotifyContext.Provider>
  )
}
