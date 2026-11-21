import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Laptop, LogOut } from 'lucide-react'
import { Avatar, LangToggle, PhoneFrame, cn } from '@/ui'
import { actions, useClave } from '@/core/store'
import type { Case } from '@/contract/types'
import { C, fill } from './copy'
import { LogoMark, Wordmark } from './components/basics'
import { useEmbed, useGo, useMedia, useTr, withEmbed } from './hooks'

/** Where a case currently is in the citizen flow. */
export function flowPath(c: Case): string {
  if (c.status === 'draft') return c.route ? `/citizen/verify/${c.id}` : `/citizen/start/${c.id}`
  return `/citizen/case/${c.id}`
}

export function safe(fn: () => void) {
  try {
    fn()
  } catch (e) {
    console.warn('[citizen]', e)
  }
}

function Header() {
  const { tr } = useTr()
  const go = useGo()
  const embed = useEmbed()
  const activeId = useClave(s => s.activeCitizenCaseId)
  const active = useClave(s => (activeId ? s.cases[activeId] : undefined))
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line/70 bg-surface/85 px-4 py-3 backdrop-blur-md">
      <Link to={withEmbed('/citizen', embed)} className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30">
        <LogoMark size={28} />
        <Wordmark className="truncate text-[15px]" />
      </Link>
      <div className="ml-auto flex items-center gap-1.5">
        {active && (
          <button
            type="button"
            onClick={() => {
              safe(() => actions.citizenSignOut())
              go('/citizen', { replace: true })
            }}
            className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface pl-1 pr-2.5 text-xs font-semibold text-muted transition hover:border-brand/40 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
            aria-label={fill(tr(C.signOutOf), { name: active.persona.name })}
            title={fill(tr(C.signOutOf), { name: active.persona.name })}
            data-testid="citizen-signout"
          >
            <Avatar initials={active.persona.initials} hue={active.persona.hue} size={22} />
            <LogOut size={13} aria-hidden />
            <span>{tr(C.signOut)}</span>
          </button>
        )}
        <LangToggle />
      </div>
    </header>
  )
}

/** Mobile-first citizen chrome. On wide screens it renders inside the PhoneFrame; with ?embed=1 it fills the iframe. */
export function CitizenShell({ children }: { children: ReactNode }) {
  const embed = useEmbed()
  const wide = useMedia('(min-width: 900px)')
  const { pathname } = useLocation()
  const { tr } = useTr()
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
    if (!wide || embed) window.scrollTo({ top: 0 })
  }, [pathname, wide, embed])

  const inner = (
    <div className="relative flex min-h-full flex-col bg-canvas">
      <a href="#citizen-main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {tr(C.skipToContent)}
      </a>
      <Header />
      <main id="citizen-main" className="relative flex-1 px-4 pb-10 pt-5">
        {children}
      </main>
    </div>
  )

  if (embed) return <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-canvas">{inner}</div>
  if (!wide) return <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-canvas">{inner}</div>

  return (
    <div className="relative min-h-[calc(100dvh-48px)] overflow-hidden bg-canvas">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_20%,var(--color-brand-soft),transparent_70%),radial-gradient(40%_40%_at_10%_90%,var(--color-sim-soft),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-16 px-10 py-10">
        <aside className="max-w-sm">
          <div className="flex items-center gap-2">
            <LogoMark size={36} />
            <Wordmark className="text-2xl" />
          </div>
          <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-brand">{tr(C.citizenView)}</p>
          <p className="mt-4 text-lg leading-relaxed text-muted">{tr(C.sideCaption)}</p>
          <a
            href="#/officer"
            target="_blank"
            rel="noopener"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:border-brand/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
          >
            <Laptop size={16} aria-hidden /> {tr(C.openOfficer)} <ArrowRight size={14} aria-hidden />
          </a>
        </aside>
        <div className="w-[400px]">
          <PhoneFrame>
            <div ref={scroller} className={cn('relative h-[min(820px,calc(100dvh-140px))] overflow-y-auto overscroll-contain')}>{inner}</div>
          </PhoneFrame>
        </div>
      </div>
    </div>
  )
}
