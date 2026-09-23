'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '◫' },
  { href: '/dashboard/promotions', label: 'Promotions', icon: '☰' },
  { href: '/dashboard/draws', label: 'Draw Calendar', icon: '◷' },
  { href: '/dashboard/overdue', label: 'Overdue', icon: '!' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

const toolsItems = [
  { href: '/dashboard/intake', label: 'Campaign Intake' },
  { href: '/dashboard/new', label: 'New Campaign' },
  { href: '/dashboard/devflow', label: 'Devflow' },
  { href: '/dashboard/preflight', label: 'Preflight' },
]

export default function OpsSidebar() {
  const activePath = usePathname()
  return (
    <aside className="w-56 shrink-0 border-r border-white/[0.06] bg-[#08080c] flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/tstyle.png" alt="Turnstyle" className="h-6 w-auto" />
        </Link>
        <p className="text-[10px] uppercase tracking-widest text-white/30 mt-2">Promotion Ops</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = activePath === item.href || (item.href !== '/dashboard' && activePath.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="text-xs opacity-60 w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        <div className="pt-6 pb-2 px-3">
          <p className="text-[10px] uppercase tracking-widest text-white/25">Tools</p>
        </div>
        {toolsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/[0.06] text-[11px] text-white/25">
        Flow Marketing internal
      </div>
    </aside>
  )
}
