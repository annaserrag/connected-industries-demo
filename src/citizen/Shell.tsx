import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Avatar, GovHeader } from '@/ui'
import { actions, useClave } from '@/core/store'
import type { Case } from '@/contract/types'
import { C, fill } from './copy'
import { useEmbed, useGo, useTr } from './hooks'

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

/** Signed-in chip in the header: initials, first name and "Sign out". */
function SignedInChip() {
  const { tr } = useTr()
  const go = useGo()
  const activeId = useClave(s => s.activeCitizenCaseId)
  const active = useClave(s => (activeId ? s.cases[activeId] : undefined))
  if (!active) return null
  const label = fill(tr(C.signOutOf), { name: active.persona.name })
  return (
    <button
      type="button"
      onClick={() => {
        safe(() => actions.citizenSignOut())
        go('/citizen', { replace: true })
      }}
      className="flex h-9 items-center gap-2 rounded-[2px] border border-line-strong bg-surface pr-1 pl-1 sm:pr-2.5 text-[13px] font-bold text-ink transition-colors hover:border-brand hover:text-brand-strong"
      aria-label={label}
      title={label}
      data-testid="citizen-signout"
    >
      <Avatar initials={active.persona.initials} hue={active.persona.hue} size={26} />
      <span className="hidden max-w-[12ch] truncate sm:inline">{active.persona.name.split(' ')[0]}</span>
      <LogOut size={15} aria-hidden className="hidden sm:block" />
      <span className="hidden sm:inline">{tr(C.signOut)}</span>
    </button>
  )
}

/**
 * Citizen chrome: the government site header (mark, tagline, language, menu) and a centred content column.
 * Phone-first: the same layout is used on a desktop browser, as on a real service.
 */
export function CitizenShell({ children }: { children: ReactNode }) {
  const embed = useEmbed()
  const { pathname } = useLocation()
  const { tr } = useTr()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="relative flex min-h-dvh flex-col bg-canvas" data-testid="citizen-shell">
      <a href="#citizen-main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:font-bold">
        {tr(C.skipToContent)}
      </a>
      {!embed && <GovHeader actions={<SignedInChip />} />}
      {embed && (
        <div className="flex justify-end border-b border-line px-4 py-2"><SignedInChip /></div>
      )}
      <main id="citizen-main" tabIndex={-1} className="relative w-full flex-1 px-4 pt-6 pb-14 outline-none sm:px-6 sm:pt-10">
        {children}
      </main>
    </div>
  )
}
