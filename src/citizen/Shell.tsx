import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { LifeBuoy, LogOut } from 'lucide-react'
import { Avatar, GovHeader, Switch, cn } from '@/ui'
import { MSG } from '@/contract/messages'
import { actions, useClave } from '@/core/store'
import type { Case } from '@/contract/types'
import { C, fill } from './copy'
import { BigButton, Modal } from './components/basics'
import { clearHelperDone, useEmbed, useGo, useLargeText, useTr } from './hooks'

/** True while the citizen is still doing the steps (nothing sent, nobody in charge, no Fallback taken). */
export function inFlow(c: Case): boolean {
  const s = c.session
  return !c.submittedAt && !c.awaitingOfficer && c.level === 'none' && c.status !== 'not_approved' && c.status !== 'approved'
    && !s.fallback?.joined && !s.fallback?.comeBackLater
}

/** Where a case currently is in the citizen flow. */
export function flowPath(c: Case): string {
  if (!c.session.route && c.status === 'draft') return `/citizen/start/${c.id}`
  if (inFlow(c) && (!c.session.fallback || c.session.fallback.offered === 'consent')) return `/citizen/verify/${c.id}`
  return `/citizen/case/${c.id}`
}

export function safe(fn: () => void) {
  try {
    fn()
  } catch (e) {
    console.warn('[citizen]', e)
  }
}

/** Signed-in chip in the header: avatar, first name and a visible "Sign out" button (confirmed mid-flow). */
function SignedInChip() {
  const { tr } = useTr()
  const go = useGo()
  const [confirm, setConfirm] = useState(false)
  const activeId = useClave(s => s.activeCitizenCaseId)
  const active = useClave(s => (activeId ? s.cases[activeId] : undefined))
  if (!active) return null
  const label = fill(tr(C.signOutOf), { name: active.persona.name })
  const midFlow = inFlow(active) && Boolean(active.session.route) && active.status !== 'draft'
  const doSignOut = () => {
    setConfirm(false)
    safe(() => actions.citizenSignOut())
    clearHelperDone()
    go('/citizen', { replace: true })
  }
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="hidden items-center gap-2 sm:flex" title={active.persona.name}>
          <Avatar initials={active.persona.initials} hue={active.persona.hue} size={26} />
          <span className="max-w-[12ch] truncate text-[13px] font-bold text-ink">{active.persona.name.split(' ')[0]}</span>
        </span>
        <button
          type="button"
          onClick={() => (midFlow ? setConfirm(true) : doSignOut())}
          className="flex h-9 items-center gap-1.5 rounded-[2px] border border-line-strong bg-surface pr-2.5 pl-1 text-[13px] font-bold whitespace-nowrap text-ink transition-colors hover:border-brand hover:text-brand-strong"
          aria-label={label}
          title={label}
          data-testid="citizen-signout"
        >
          <span className="hidden min-[420px]:inline sm:hidden"><Avatar initials={active.persona.initials} hue={active.persona.hue} size={24} /></span>
          <LogOut size={15} aria-hidden className="ml-1.5 min-[420px]:hidden sm:block sm:ml-0" />
          {/* Phones: icon only (the accessible name stays on the button), so the service name is never cut. */}
          <span className="sr-only min-[420px]:not-sr-only">{tr(C.signOutSession)}</span>
        </button>
      </span>
      <Modal open={confirm} onOpenChange={setConfirm} title={tr(C.signOutConfirmTitle)} closeLabel={tr(C.close)}>
        <p className="text-[16px] leading-relaxed text-ink">{tr(C.signOutConfirmBody)}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <BigButton testId="signout-confirm" onClick={doSignOut}><LogOut size={18} aria-hidden />{tr(C.signOutSession)}</BigButton>
          <BigButton variant="secondary" testId="signout-cancel" onClick={() => setConfirm(false)}>{tr(C.signOutStay)}</BigButton>
        </div>
      </Modal>
    </>
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
  const [large] = useLargeText()
  const signedIn = useClave(s => Boolean(s.activeCitizenCaseId && s.cases[s.activeCitizenCaseId]))

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className={cn('relative flex min-h-dvh flex-col bg-canvas', large && 'citizen-large')} data-testid="citizen-shell" data-large-text={large ? '1' : undefined}>
      <a href="#citizen-main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:font-bold">
        {tr(C.skipToContent)}
      </a>
      {!embed && <GovHeader actions={signedIn ? <SignedInChip /> : undefined} />}
      {embed && (
        <div className="flex justify-end border-b border-line px-4 py-2"><SignedInChip /></div>
      )}
      <main id="citizen-main" tabIndex={-1} className="relative w-full flex-1 px-4 pt-6 pb-14 outline-none sm:px-6 sm:pt-10">
        {children}
        <HelpPanel />
      </main>
    </div>
  )
}

/** MSG-HELP-01 on every citizen screen, with the large-text switch (remembered in this browser). */
export function HelpPanel() {
  const { tr } = useTr()
  const [large, setLarge] = useLargeText()
  return (
    <aside aria-labelledby="help-01-title" className="mx-auto mt-10 w-full max-w-[640px] rounded-card border border-line bg-band p-4" data-testid="msg-HELP-01">
      <h2 id="help-01-title" className="flex items-center gap-2 text-[16px] font-bold text-ink">
        <LifeBuoy size={18} className="text-brand" aria-hidden />{tr(MSG['HELP-01'].title)}
      </h2>
      <p className="mt-1 text-[15px] leading-relaxed text-ink">{tr(MSG['HELP-01'])}</p>
      <Switch className="mt-3 text-[15px]" checked={large} onCheckedChange={setLarge} label={tr(MSG['HELP-01'].button)} />
    </aside>
  )
}
