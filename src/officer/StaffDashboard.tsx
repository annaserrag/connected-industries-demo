/* Staff console · Dashboard: live KPIs from the shared store (demo data) + the simulated 12-week trends. */
import { memo, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Ban, Bot, CalendarDays, ChevronRight, Cpu, Gavel, Hourglass, RotateCcw, ShieldCheck, Timer, UserCheck, UserRound,
} from 'lucide-react'
import type { ActorKind, PriorityTier } from '@/contract/types'
import { DOCUMENTS, PRIORITY_TIERS, ROUTES, ROUTE_ORDER } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { useClave } from '@/core/store'
import { relativeTime } from '@/core/selectors'
import { countsByDocument, countsByRoute, countsByTier, DOCUMENT_ORDER, liveKpis, recentActivity } from '@/core/console'
import { AppealsChart, CorrectedChart, OfficeShareChart, RoutesChart, TimeToAdvancedChart } from '@/dashboard/charts'
import { Avatar, PolicyBadge, SimulatedBadge, cn } from '@/ui'
import { AUDIT_ACTION_LABEL, C, S } from './copy'
import { fill, useFlash, useLang, useTick, useTr } from './lib'
import { LiveDot } from './components/ui'
import { TIER_BAR, TierTag } from './Queue'

export function DemoLiveBadge() {
  const tr = useTr()
  return (
    <span data-testid="demo-live-badge" title={tr(S.demoLiveNote)} className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      {tr(S.demoLive)}
    </span>
  )
}

function Kpi({ id, icon, label, value, display, sub, tone = 'default', big }: {
  id: string; icon: ReactNode; label: string; value: number | null; display?: string; sub?: string
  tone?: 'default' | 'brand' | 'danger' | 'warning' | 'success' | 'sim'; big?: boolean
}) {
  const flash = useFlash(value)
  const toneCls = {
    default: 'bg-surface-2 text-ink', brand: 'bg-brand-soft text-brand', danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning', success: 'bg-success-soft text-success', sim: 'bg-sim-soft text-sim',
  }[tone]
  return (
    <li
      data-testid={`kpi-${id}`}
      data-value={value ?? ''}
      data-flash={flash ? '1' : undefined}
      className={cn('relative rounded-2xl border border-line bg-surface p-4 transition-shadow', flash && 'ofc-kpi-flash', big && 'sm:col-span-2 lg:col-span-1')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('grid size-8 place-items-center rounded-lg', toneCls)} aria-hidden>{icon}</span>
        <AnimatePresence>
          {flash && (
            <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-success uppercase">
              <UpdatedLabel />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <motion.p key={String(value)} initial={{ opacity: 0.35, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-3 text-[30px] leading-none font-semibold tracking-tight text-ink tabular-nums">
        {display ?? (value ?? '—')}
      </motion.p>
      <p className="mt-1.5 text-sm font-medium text-ink">{label}</p>
      {sub && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{sub}</p>}
    </li>
  )
}
function UpdatedLabel() {
  const tr = useTr()
  return <>{tr(S.updatedFlash)}</>
}

function Card({ title, hint, action, children, className, id }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string; id: string }) {
  return (
    <section aria-labelledby={`${id}-t`} className={cn('flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5', className)} data-testid={id}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-t`} className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4 min-w-0 flex-1">{children}</div>
    </section>
  )
}

interface BarRow { key: string; label: ReactNode; value: number; extra?: ReactNode; bar?: string }

function BarList({ rows, testid }: { rows: BarRow[]; testid: string }) {
  const reduce = useReducedMotion()
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(r => (
        <li key={r.key} data-testid={`${testid}-${r.key}`} data-value={r.value}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ink">{r.label}{r.extra}</span>
            <span className="shrink-0 font-semibold text-ink tabular-nums">{r.value}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <motion.div
              className={cn('h-full rounded-full', r.bar ?? 'bg-brand')}
              initial={false}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function PriorityMix({ counts }: { counts: Record<PriorityTier, number> }) {
  const tr = useTr()
  const reduce = useReducedMotion()
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${tr(S.priorityMix)}: ${PRIORITY_TIERS.map(t => `${tr(t.label)} ${counts[t.id]}`).join(', ')}`}>
        {PRIORITY_TIERS.map(t => (
          <motion.div
            key={t.id}
            className={cn('h-full border-r-2 border-surface last:border-r-0', TIER_BAR[t.id])}
            initial={false}
            animate={{ width: total ? `${(counts[t.id] / total) * 100}%` : '0%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {PRIORITY_TIERS.map(t => (
          <li key={t.id} data-testid={`tier-count-${t.id}`} data-value={counts[t.id]} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className={cn('size-2.5 shrink-0 rounded-sm', TIER_BAR[t.id])} />
            <TierTag tier={t.id} />
            <span className="hidden min-w-0 flex-1 truncate text-[12.5px] text-muted sm:block">{tr(t.why)}</span><span className="flex-1 sm:hidden" />
            <span className="w-6 text-right font-semibold text-ink tabular-nums">{counts[t.id]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const ACTOR_ICON: Record<ActorKind, typeof Cpu> = { system: Cpu, officer: ShieldCheck, citizen: UserRound }
const ACTOR_TONE: Record<ActorKind, string> = { system: 'bg-sim-soft text-sim', officer: 'bg-brand-soft text-brand', citizen: 'bg-surface-2 text-ink' }

function Activity() {
  const tr = useTr()
  const lang = useLang()
  const audit = useClave(s => s.audit)
  const cases = useClave(s => s.cases)
  const events = useMemo(() => recentActivity(audit, 9), [audit])
  return (
    <ol className="flex min-w-0 flex-col gap-1" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {events.map(e => {
          const Icon = ACTOR_ICON[e.actor.kind]
          const c = e.caseId ? cases[e.caseId] : undefined
          return (
            <motion.li
              key={e.id}
              layout="position"
              initial={{ opacity: 0, x: -12, backgroundColor: 'rgba(31,79,214,0.10)' }}
              animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(31,79,214,0)' }}
              transition={{ duration: 0.35, backgroundColor: { duration: 2 } }}
              className="flex items-center gap-3 rounded-xl px-2 py-2"
            >
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', ACTOR_TONE[e.actor.kind])}><Icon className="size-3.5" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm"><span className="font-semibold text-ink">{tr(AUDIT_ACTION_LABEL[e.action])}</span><span className="text-muted"> · {e.actor.name}</span></p>
                {c ? (
                  <Link to={PATHS.officerCase(c.id)} className="inline-flex items-center gap-1.5 rounded text-[12.5px] text-muted outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand">
                    <Avatar initials={c.persona.initials} hue={c.persona.hue} size={16} />{c.persona.name}
                  </Link>
                ) : <p className="truncate text-[12.5px] text-muted">{e.detail}</p>}
              </div>
              <time dateTime={e.at} className="shrink-0 text-[12px] text-muted tabular-nums">{relativeTime(e.at, lang)}</time>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}

/** The simulated 12-week charts don't depend on the store: memoised so live updates never re-render Recharts. */
const Trends = memo(function Trends() {
  const tr = useTr()
  return (
    <section aria-labelledby="trends-title" className="mt-10" data-testid="simulated-trends">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="trends-title" className="text-xl font-semibold tracking-tight text-ink">{tr(S.trendsTitle)}</h2>
        <SimulatedBadge />
      </div>
      <p className="mt-1 max-w-3xl text-sm text-muted">{tr(S.trendsBody)}</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TimeToAdvancedChart />
        <OfficeShareChart />
        <CorrectedChart />
        <AppealsChart />
        <RoutesChart />
      </div>
    </section>
  )
})

export function StaffDashboardPage() {
  const tr = useTr()
  useTick(15_000)
  const state = useClave(s => s)
  const now = new Date()
  const k = useMemo(() => liveKpis(state, now), [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const tiers = useMemo(() => countsByTier(state, now), [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const docs = useMemo(() => countsByDocument(state), [state])
  const routes = useMemo(() => countsByRoute(state), [state])
  const minutes = k.medianMinutesToDecision
  const minutesText = minutes === null ? '—' : `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} ${tr(S.min)}`

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 xl:px-8" data-testid="staff-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">{tr(S.dashTitle)}</h1>
            <DemoLiveBadge />
            <LiveDot label={tr({ en: 'Live', es: 'En directo' })} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">{tr(S.dashSubtitle)} {tr(S.demoLiveNote)}</p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label={tr(S.demoLive)}>
        <Kpi id="today" icon={<CalendarDays className="size-4" />} label={tr(S.kToday)} value={k.applicationsToday} sub={fill(tr(S.kTodaySub), { n: k.applicationsTotal })} tone="brand" />
        <Kpi id="awaiting" icon={<Hourglass className="size-4" />} label={tr(S.kAwaiting)} value={k.awaitingDecision} sub={tr(S.kAwaitingSub)} tone="warning" />
        <Kpi id="auto" icon={<Bot className="size-4" />} label={tr(S.kAuto)} value={k.autoApproved} sub={tr(S.kAutoSub)} tone="sim" />
        <Kpi id="officer" icon={<UserCheck className="size-4" />} label={tr(S.kOfficer)} value={k.officerDecided} sub={tr(S.kOfficerSub)} tone="success" />
        <Kpi id="refusals" icon={<Ban className="size-4" />} label={tr(S.kRefusals)} value={k.refusals} sub={tr(S.kRefusalsSub)} tone="danger" />
        <Kpi id="corrections" icon={<RotateCcw className="size-4" />} label={tr(S.kCorrections)} value={k.corrections} sub={fill(tr(S.kCorrectionsSub), { n: k.correctedApproved })} />
        <Kpi id="appeals" icon={<Gavel className="size-4" />} label={tr(S.kAppeals)} value={k.appealsOpen} sub={tr(S.kAppealsSub)} tone="warning" />
        <Kpi id="median" icon={<Timer className="size-4" />} label={tr(S.kMedian)} value={minutes === null ? null : Math.round(minutes * 10) / 10} display={minutesText} sub={fill(tr(S.kMedianSub), { n: k.decisionsMeasured })} tone="brand" />
      </ul>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card id="priority-mix" title={tr(S.priorityMix)} hint={tr(S.priorityMixHint)} action={<Link to={PATHS.officer} className="inline-flex items-center text-xs font-semibold text-brand hover:underline">{tr({ en: 'Open queue', es: 'Abrir cola' })}<ChevronRight className="size-3.5" aria-hidden /></Link>}>
          <PriorityMix counts={tiers} />
        </Card>
        <Card id="by-document" title={tr(S.byDocument)} hint={tr(S.byDocumentHint)} action={<Link to={PATHS.officerDocuments} className="inline-flex shrink-0 items-center whitespace-nowrap text-xs font-semibold text-brand hover:underline">{tr(C.navDocuments)}<ChevronRight className="size-3.5" aria-hidden /></Link>}>
          <BarList
            testid="doc-bar"
            rows={DOCUMENT_ORDER.map(d => ({
              key: d,
              label: <span className="min-w-0 truncate">{tr(DOCUMENTS[d].label).split(' (')[0]}</span>,
              extra: d === 'NIE_PAPER' || d === 'RED_CARD' ? <span className="shrink-0"><PolicyBadge /></span> : undefined,
              value: docs[d],
              bar: d === 'NIE_PAPER' || d === 'RED_CARD' ? 'bg-warning' : 'bg-brand',
            }))}
          />
        </Card>
        <Card id="by-route" title={tr(S.byRoute)} hint={tr(S.byRouteHint)}>
          <BarList
            testid="route-bar"
            rows={ROUTE_ORDER.map(r => ({
              key: r,
              label: <><span className="shrink-0 rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">{ROUTES[r].code}</span><span className="min-w-0 truncate" title={tr(ROUTES[r].name)}>{tr(ROUTES[r].name)}</span></>,
              value: routes[r],
              bar: r === 'FALLBACK' ? 'bg-sim' : 'bg-ink/80',
            }))}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card id="activity" title={tr(S.activity)} hint={tr(S.activityHint)} action={<Link to={PATHS.officerAudit} className="inline-flex items-center text-xs font-semibold text-brand hover:underline">{tr(S.seeAudit)}<ChevronRight className="size-3.5" aria-hidden /></Link>}>
          <Activity />
        </Card>
      </div>

      <Trends />
    </div>
  )
}
