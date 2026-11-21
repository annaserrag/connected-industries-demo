/* Officer console chrome: left nav + top bar. */
import type { ReactNode } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { Inbox, History, LayoutDashboard, LogOut } from 'lucide-react'
import { OFFICERS, SERVICE_NAME } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { actions, useClave } from '@/core/store'
import { officerQueue } from '@/core/selectors'
import { Avatar, HomeLink, LangToggle, LogoGlyph, cn } from '@/ui'
import { C } from '../copy'
import { useTr } from '../lib'
import { Kbd, LiveDot } from './ui'

function Brand() {
  const tr = useTr()
  return (
    <HomeLink className="gap-2.5 focus-visible:ring-2 focus-visible:ring-white/60">
      <LogoGlyph size={36} />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-white">{SERVICE_NAME}</span>
        <span className="block text-[11px] font-medium text-white/70">{tr(C.appName)}</span>
      </span>
    </HomeLink>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const tr = useTr()
  const officerId = useClave(s => s.officerId)
  const queueCount = useClave(s => officerQueue(s).length)
  const officer = OFFICERS.find(o => o.id === officerId)
  const [params] = useSearchParams()
  const embed = params.get('embed') === '1'

  const navItem = (to: string, icon: ReactNode, label: string, extra?: ReactNode, end = false) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-white/60',
          isActive ? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-white/65 hover:bg-white/6 hover:text-white',
        )
      }
    >
      <span aria-hidden className="opacity-90">{icon}</span>
      <span className="flex-1">{label}</span>
      {extra}
    </NavLink>
  )

  return (
    <div className={cn('flex bg-canvas', embed ? 'ofc-embed h-dvh overflow-hidden' : 'min-h-screen')}>
      {!embed && (
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col bg-[#11131a] px-4 py-5 text-white lg:flex" aria-label={tr(C.navSection)}>
          <Brand />
          <nav className="mt-8 space-y-1" aria-label={tr(C.navSection)}>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.08em] text-white/70 uppercase">{tr(C.navSection)}</p>
            {navItem(PATHS.officer, <Inbox className="size-[18px]" />, tr(C.navQueue),
              <span className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white" aria-label={`${queueCount} ${tr(C.inQueue)}`}>{queueCount}</span>, true)}
            {navItem(PATHS.officerAudit, <History className="size-[18px]" />, tr(C.navAudit))}
            {navItem(PATHS.dashboard, <LayoutDashboard className="size-[18px]" />, tr(C.navDashboard))}
          </nav>

          <div className="mt-auto space-y-4">
            <div className="rounded-xl border border-white/8 bg-white/4 p-3 text-xs text-white/70">
              <p className="mb-2 font-semibold text-white/85">{tr(C.shortcuts)}</p>
              <ul className="space-y-1.5">
                {[
                  [['J', 'K'], tr(C.kbdMove)],
                  [['↵'], tr(C.kbdOpen)],
                  [['A'], tr(C.approve)],
                  [['I'], tr({ en: 'Request info', es: 'Pedir info' })],
                  [['R'], tr(C.refuse)],
                ].map(([keys, label]) => (
                  <li key={String(label)} className="flex items-center justify-between gap-2">
                    <span>{label as string}</span>
                    <span className="flex gap-1">{(keys as string[]).map(k => <Kbd key={k} className="border-white/15 bg-white/8 text-white/80">{k}</Kbd>)}</span>
                  </li>
                ))}
              </ul>
            </div>
            {officer && (
              <div className="flex items-center gap-3 rounded-xl px-1">
                <Avatar initials={officer.name.split(' ').map(p => p[0]).join('')} hue={226} size={36} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">{officer.name}</p>
                  <p className="truncate text-[11px] text-white/50">{officer.id}</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      <div className={cn('flex min-w-0 flex-1 flex-col', embed && 'h-dvh overflow-y-auto')}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-line bg-surface/85 px-6 backdrop-blur">
          <HomeLink className="lg:hidden"><span className="font-semibold">{SERVICE_NAME}</span></HomeLink>
          <nav className="flex gap-1 lg:hidden" aria-label={tr(C.navSection)}>
            <NavLink end to={PATHS.officer} className={({ isActive }) => cn('rounded-lg px-2.5 py-1.5 text-sm', isActive ? 'bg-surface-2 font-semibold' : 'text-muted')}>{tr(C.navQueue)}</NavLink>
            <NavLink to={PATHS.officerAudit} className={({ isActive }) => cn('rounded-lg px-2.5 py-1.5 text-sm', isActive ? 'bg-surface-2 font-semibold' : 'text-muted')}>{tr(C.navAudit)}</NavLink>
          </nav>
          <div title={tr(C.liveHint)}><LiveDot label={tr(C.live)} /></div>
          <span className="hidden text-xs text-muted xl:inline">{tr(C.liveHint)}</span>
          <div className="ml-auto flex items-center gap-3">
            <LangToggle />
            {officer && (
              <>
                <div className="hidden text-right leading-tight sm:block">
                  <p className="text-[11px] text-muted">{tr(C.signedInAs)}</p>
                  <p className="text-sm font-semibold">{officer.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => actions.officerSignOut()}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <LogOut className="size-4" aria-hidden />
                  {tr(C.signOut)}
                </button>
              </>
            )}
          </div>
        </header>
        <main id="officer-main" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
