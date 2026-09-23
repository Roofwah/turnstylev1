export default function OpsSettingsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-black mb-1">Settings</h1>
      <p className="text-white/40 text-sm mb-8">Internal ops configuration</p>

      <div className="rounded-xl border border-white/[0.08] p-6 space-y-4 text-sm">
        <div>
          <h2 className="font-bold mb-1">Dropbox integration</h2>
          <p className="text-white/50">
            MVP: paste folder URLs per promotion. Future: Dropbox API for folder creation, file detection and metadata sync.
          </p>
        </div>
        <div>
          <h2 className="font-bold mb-1">Pure Random</h2>
          <p className="text-white/50">
            Draw scheduling connects via existing Pure Random integration on campaign status change. Ops dashboard tracks entry files and certificates separately.
          </p>
        </div>
        <div>
          <h2 className="font-bold mb-1">Environment</h2>
          <p className="text-white/50 font-mono text-xs">
            PURERANDOM_URL · DATABASE_URL · NEXT_PUBLIC_APP_URL
          </p>
        </div>
      </div>
    </div>
  )
}
