/*
 * Officer console chrome: government-style top bar (thin orange line, brand + tagline) and a left menu that is
 * ALWAYS reachable, on every console route:
 *   ≥ 1280 px  full sidebar with labels (can be collapsed to the rail)
 *   768–1279   collapsed icon rail with tooltips + expand toggle (choice remembered in localStorage)
 *   < 768 px   a visible "Menu" button in the top bar opens a drawer with the same items
 */
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import * as RDialog from '@radix-ui/react-dialog'
import { FileStack, History, Inbox, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Rows3, Scale, ShieldCheck, UserRound, X } from 'lucide-react'
import type { Bilingual } from '@/contract/types'
import { OFFICERS, STAFF_OFFICES } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { actions, useClave } from '@/core/store'
import { officerQueue } from '@/core/selectors'
import { Avatar, GovHeader, cn } from '@/ui'
import { C, S } from '../copy'
import { postLabel } from '../ProfileForm'
import { useLang, useTr } from '../lib'
import { Kbd, LiveDot, Tip } from './ui'

/* ------------------------------------------------------------ layout state */

export const NAV_PREF_KEY = 'getyourclave.officer.nav'
type NavPref = 'auto' | 'expanded' | 'collapsed'

function readPref(): NavPref {
  try {
    const v = window.localStorage.getItem(NAV_PREF_KEY)
    return v === 'expanded' || v === 'collapsed' ? v : 'auto'
  } catch { return 'auto' }
}
function writePref(v: NavPref) {
  try { window.localStorage.setItem(NAV_PREF_KEY, v) } catch { /* private mode / blocked storage */ }
}

export function useMedia(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true)
  const [m, setM] = useState(get)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

/* ------------------------------------------------------------ nav items */

interface Item { to: string; icon: ComponentType<{ className?: string }>; label: Bilingual; testId: string; match?: (p: string) => boolean }

const ITEMS: Item[] = [
  { to: PATHS.officer, icon: Inbox, label: C.navQueue, testId: 'nav-queue', match: p => p === PATHS.officer || p === `${PATHS.officer}/` || p.startsWith(`${PATHS.officer}/case/`) },
  { to: PATHS.officerAppeals, icon: Scale, label: C.navAppeals, testId: 'nav-appeals' },
  { to: PATHS.officerAdvanced, icon: ShieldCheck, label: C.navAdvanced, testId: 'nav-advanced' },
  { to: PATHS.officerDashboard, icon: LayoutDashboard, label: C.navStaffDashboard, testId: 'nav-dashboard' },
  { to: PATHS.officerDocuments, icon: FileStack, label: C.navDocuments, testId: 'nav-documents' },
  { to: PATHS.officerAll, icon: Rows3, label: C.navAll, testId: 'nav-applications' },
  { to: PATHS.officerAudit, icon: History, label: C.navAudit, testId: 'nav-audit' },
  { to: PATHS.officerProfile, icon: UserRound, label: C.navProfile, testId: 'nav-profile' },
]

function NavItems({ rail, onNavigate, queueCount }: { rail: boolean; onNavigate?: () => void; queueCount: number }) {
  const tr = useTr()
  const { pathname } = useLocation()
  return (
    <ul className="grid gap-0.5">
      {ITEMS.map(item => {
        const active = item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(`${item.to}/`)
        const Icon = item.icon
        const label = tr(item.label)
        const count = item.to === PATHS.officer ? queueCount : null
        const link = (
          <Link
            to={item.to}
            onClick={onNavigate}
            data-testid={item.testId}
            aria-current={active ? 'page' : undefined}
            aria-label={rail ? (count !== null ? `${label} (${count})` : label) : undefined}
            className={cn(
              'relative flex h-11 items-center text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
              rail ? 'justify-center' : 'gap-3 pr-3 pl-5',
              active ? 'bg-surface font-bold text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink',
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />}
            <span aria-hidden className={cn('relative', active ? 'text-brand' : 'text-muted')}>
              <Icon className="size-[19px]" />
              {rail && count !== null && count > 0 && (
                <span className="absolute -top-2 -right-3 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10.5px] leading-[17px] font-bold text-brand-ink tabular-nums">{count}</span>
              )}
            </span>
            {!rail && <span className="min-w-0 flex-1 truncate">{label}</span>}
            {!rail && count !== null && (
              <span className={cn('rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums', active ? 'bg-brand text-brand-ink' : 'bg-surface text-ink ring-1 ring-line-strong/50')} aria-label={`${count} ${tr(C.inQueue)}`}>{count}</span>
            )}
          </Link>
        )
        return <li key={item.to}>{rail ? <Tip content={count !== null ? `${label} · ${count}` : label} side="right">{link}</Tip> : link}</li>
      })}
    </ul>
  )
}

function Shortcuts() {
  const tr = useTr()
  return (
    <div className="mx-3 rounded-[2px] border border-line bg-surface p-3 text-[13px] text-muted">
      <p className="mb-2 font-bold text-ink">{tr(C.shortcuts)}</p>
      <ul className="space-y-1.5">
        {([
          [['J', 'K'], tr(C.kbdMove)],
          [['↵'], tr(C.kbdOpen)],
          [['A'], tr(C.approve)],
          [['I'], tr({ en: 'Request info', es: 'Pedir info' })],
          [['R'], tr(C.refuse)],
        ] as const).map(([keys, label]) => (
          <li key={label} className="flex items-center justify-between gap-2">
            <span>{label}</span>
            <span className="flex gap-1">{keys.map(k => <Kbd key={k}>{k}</Kbd>)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function useIdentity() {
  const tr = useTr()
  const lang = useLang()
  const officerId = useClave(s => s.officerId)
  const profile = useClave(s => (officerId ? s.officerProfiles?.[officerId] : undefined))
  const officer = OFFICERS.find(o => o.id === officerId)
  const office = profile ? STAFF_OFFICES.find(o => o.code === profile.officeCode) : undefined
  return {
    officer,
    initials: officer ? officer.name.split(' ').map(p => p[0]).join('').slice(0, 2) : '',
    officeText: office ? `${tr(office.name)} · ${office.code}` : (officer ? tr(officer.office) : ''),
    postText: profile ? postLabel(profile.post, lang) : '',
  }
}

function UserBlock({ rail }: { rail: boolean }) {
  const { officer, initials, postText, officeText } = useIdentity()
  if (!officer) return null
  const avatar = <Avatar initials={initials} hue={20} size={34} />
  if (rail) return <div className="grid place-items-center py-1" title={`${officer.name}${postText ? ` · ${postText}` : ''}`}>{avatar}</div>
  return (
    <div className="flex items-center gap-3 px-4">
      {avatar}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[14px] font-bold text-ink">{officer.name}</p>
        <p className="truncate text-[12px] text-muted" title={officeText}>{postText || officeText}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ shell */

export function Shell({ children }: { children: ReactNode }) {
  const tr = useTr()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const embed = params.get('embed') === '1'
  const queueCount = useClave(s => officerQueue(s).length)
  const { officer, postText, officeText } = useIdentity()

  const wide = useMedia('(min-width: 1280px)')
  const tablet = useMedia('(min-width: 768px)')
  const [pref, setPref] = useState<NavPref>(readPref)
  const [drawer, setDrawer] = useState(false)
  const expanded = tablet && (wide ? pref !== 'collapsed' : pref === 'expanded')
  const toggle = () => { const next: NavPref = expanded ? 'collapsed' : 'expanded'; setPref(next); writePref(next) }

  useEffect(() => { setDrawer(false) }, [pathname])
  useEffect(() => { if (tablet) setDrawer(false) }, [tablet])

  const signOut = () => { navigate(PATHS.officer); actions.officerSignOut() }

  const topActions = (
    <>
      <span className="hidden md:inline-flex" title={tr(C.liveHint)}><LiveDot label={tr(C.live)} /></span>
      {officer && (
        <div className="hidden min-w-0 text-right leading-tight lg:block" data-testid="officer-identity">
          <p className="text-[14px] font-bold text-ink">{officer.name}{postText && <span className="font-normal text-muted"> · {postText}</span>}</p>
          <p className="max-w-[340px] truncate text-[12px] text-muted" title={officeText}>{officeText}</p>
        </div>
      )}
      {officer && (
        <button
          type="button"
          onClick={signOut}
          className="hidden h-9 items-center gap-2 rounded-[2px] border border-line-strong bg-surface px-3 text-[14px] font-bold text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex"
        >
          <LogOut className="size-4" aria-hidden />
          {tr(C.signOut)}
        </button>
      )}
      {!tablet && (
        <RDialog.Trigger asChild>
          <button
            type="button"
            data-testid="console-menu-button"
            aria-label={tr(S.menu)}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[2px] bg-brand px-3 text-[15px] font-bold text-brand-ink outline-none hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <Menu className="size-5" aria-hidden />
            <span className="max-[360px]:sr-only">{tr(S.menu)}</span>
          </button>
        </RDialog.Trigger>
      )}
    </>
  )

  return (
    <RDialog.Root open={drawer} onOpenChange={setDrawer}>
      <div className={cn('flex flex-col bg-canvas', embed ? 'ofc-embed h-dvh overflow-hidden' : 'min-h-dvh')} data-testid="console-shell">
        <a href="#officer-main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:font-bold">
          {tr({ en: 'Skip to content', es: 'Saltar al contenido' })}
        </a>
        <GovHeader tagline={S.staffConsole} menu={false} width="max-w-none" sticky actions={topActions} />

        <div className={cn('flex min-h-0 flex-1', embed && 'overflow-hidden')}>
          {tablet && (
            <aside
              data-testid="console-sidebar"
              data-expanded={expanded ? 'true' : 'false'}
              aria-label={tr(C.navSection)}
              className={cn(
                'sticky top-[68px] flex h-[calc(100dvh-68px)] shrink-0 flex-col border-r border-line bg-band transition-[width] duration-200 motion-reduce:transition-none',
                expanded ? 'w-[256px]' : 'w-[68px]',
              )}
            >
              <nav aria-label={tr(C.navSection)} className="min-h-0 flex-1 overflow-y-auto pt-4">
                {expanded && <p className="px-5 pb-2 text-[12px] font-bold tracking-[0.08em] text-muted uppercase">{tr(C.navSection)}</p>}
                <NavItems rail={!expanded} queueCount={queueCount} />
              </nav>
              <div className="grid gap-3 border-t border-line pt-3 pb-3">
                {expanded && <Shortcuts />}
                <UserBlock rail={!expanded} />
                <div className={cn('flex', expanded ? 'px-3' : 'justify-center')}>
                  {(() => {
                    const btn = (
                      <button
                        type="button"
                        onClick={toggle}
                        data-testid="nav-toggle"
                        aria-expanded={expanded}
                        aria-label={expanded ? tr(S.collapseNav) : tr(S.expandNav)}
                        className={cn(
                          'inline-flex h-9 items-center gap-2 rounded-[2px] text-[14px] font-bold text-ink outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand',
                          expanded ? 'w-full px-2' : 'w-10 justify-center',
                        )}
                      >
                        {expanded ? <PanelLeftClose className="size-[18px] text-muted" aria-hidden /> : <PanelLeftOpen className="size-[18px] text-muted" aria-hidden />}
                        {expanded && <span>{tr(S.collapseNav)}</span>}
                      </button>
                    )
                    return expanded ? btn : <Tip content={tr(S.expandNav)} side="right">{btn}</Tip>
                  })()}
                </div>
              </div>
            </aside>
          )}

          <main id="officer-main" tabIndex={-1} className={cn('min-w-0 flex-1 outline-none', embed && 'overflow-y-auto')}>{children}</main>
        </div>
      </div>

      {/* phone drawer: the same items */}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/45 data-[state=open]:animate-[ofc-fade_.18s_ease-out]" />
        <RDialog.Content
          data-testid="console-drawer"
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,88vw)] flex-col border-t-4 border-brand bg-band shadow-pop outline-none data-[state=open]:animate-[ofc-slide_.2s_ease-out]"
        >
          <div className="flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4">
            <RDialog.Title className="font-display text-[18px] font-bold text-ink">{tr(S.menu)}</RDialog.Title>
            <RDialog.Close className="grid size-11 place-items-center rounded-[2px] text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand" aria-label={tr(S.closeMenu)}>
              <X className="size-6" aria-hidden />
            </RDialog.Close>
          </div>
          <nav aria-label={tr(C.navSection)} className="min-h-0 flex-1 overflow-y-auto pt-3">
            <NavItems rail={false} queueCount={queueCount} onNavigate={() => setDrawer(false)} />
          </nav>
          <div className="grid gap-3 border-t border-line py-4">
            <UserBlock rail={false} />
            <div className="px-4">
              <button
                type="button"
                onClick={() => { setDrawer(false); signOut() }}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[2px] border border-line-strong bg-surface text-[15px] font-bold text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand"
              >
                <LogOut className="size-4" aria-hidden />{tr(C.signOut)}
              </button>
            </div>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
