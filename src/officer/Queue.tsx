/* Screen 6: the officer case queue. */
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Ban, CircleCheck, Clock, Cpu, FilterX, Hourglass, Inbox, Info, Layers, ListOrdered, Scale, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles, Undo2 } from 'lucide-react'
import type { AppState, Case, PriorityTier, RiskLevel, RouteId } from '@/contract/types'
import { CHECKS, DOCUMENTS, PRIORITY_AGE_BUMP_HOURS, PRIORITY_TIERS, ROUTES, routeCode, ROUTE_ORDER } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { score2, useClave } from '@/core/store'
import { advancedQueue, appealsQueue, baseTierOf, isAgeBumped, officerQueue, priorityOf, relativeTime, videoCallQueue, waitingSince } from '@/core/selectors'
import { Avatar, RouteBadge, StatusPill, cn } from '@/ui'
import { PROPOSED_RULE_TAG } from '@/contract/messages'
import { C, DECISION_LABEL, K, OUTCOME_LABEL, RISK_LABEL, S } from './copy'
import { caseTitle, effectiveOutcome, fill, lastDecisionAt, RISK_RANK, reviewKind, useHotkeys, useLang, useTick, useTr } from './lib'
import { useLive } from './live'
import { CheckIcon, Kbd, LiveDot, RiskTag , Tip } from './components/ui'

type View = 'all' | 'decision' | 'advanced' | 'appeals' | 'videocalls'
export type QueuePreset = 'appeals' | 'advanced' | 'videocalls'

export const shortDoc = (c: Case, lang: 'en' | 'es') => DOCUMENTS[c.document.type].label[lang].split(' (')[0]

/** Small tags under the applicant: proposed rule, assisted session, minor, review requested. */
export function CaseTags({ c }: { c: Case }) {
  const tr = useTr()
  const assisted = c.session?.who === 'helping'
  const minor = c.session?.who === 'child'
  if (!c.policyProposal && !assisted && !minor && c.appeal?.state !== 'open') return null
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {c.policyProposal && <span data-testid="proposed-rule" title={tr(PROPOSED_RULE_TAG)} className="inline-flex items-center gap-1 rounded-[2px] border border-dashed border-warning/60 bg-warning-soft px-1.5 text-[10.5px] font-bold text-warning"><Scale className="size-3" aria-hidden />{tr(K.proposedRule)}</span>}
      {assisted && <span data-testid="assisted-badge" className="inline-flex items-center rounded-[2px] bg-info-soft px-1.5 text-[10.5px] font-bold text-info ring-1 ring-inset ring-info/30">{tr(K.assisted)}</span>}
      {minor && <span className="inline-flex items-center rounded-[2px] bg-warning-soft px-1.5 text-[10.5px] font-bold text-warning ring-1 ring-inset ring-warning/30">{tr(K.minor)}</span>}
      {c.appeal?.state === 'open' && <span className="inline-flex items-center rounded-[2px] bg-warning-soft px-1.5 text-[10.5px] font-bold text-warning ring-1 ring-inset ring-warning/30">{tr(K.appealTag)}</span>}
    </span>
  )
}

export const TIER_TONE: Record<PriorityTier, string> = {
  p1_high_risk: 'bg-danger-soft text-danger ring-danger/25',
  p2_appeal: 'bg-warning-soft text-warning ring-warning/25',
  p3_citizen_replied: 'bg-brand-soft text-brand ring-brand/25',
  p4_medium_risk: 'bg-surface-2 text-ink ring-line',
  p5_video_call: 'bg-sim-soft text-sim ring-sim/25',
  p6_advanced_review: 'bg-success-soft text-success ring-success/25',
}
export const TIER_BAR: Record<PriorityTier, string> = {
  p1_high_risk: 'bg-danger',
  p2_appeal: 'bg-warning',
  p3_citizen_replied: 'bg-brand',
  p4_medium_risk: 'bg-muted',
  p5_video_call: 'bg-sim',
  p6_advanced_review: 'bg-success',
}
export const tierDef = (t: PriorityTier) => PRIORITY_TIERS.find(x => x.id === t)!

/** "P1" pill with the tier label; colour is never the only cue (code + text). */
export function TierTag({ tier, short }: { tier: PriorityTier; short?: boolean }) {
  const tr = useTr()
  const label = tr(tierDef(tier).label)
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset', TIER_TONE[tier])} title={tr(tierDef(tier).why)}>
      {short ? label.split(' · ')[0] : label}
    </span>
  )
}

function topFlag(c: Case) {
  return [...c.flags].sort((a, b) => RISK_RANK[a.severity] - RISK_RANK[b.severity])[0]
}

/* Rows are memoised: a store change re-renders (and re-measures for layout animation) only the rows whose case changed. */
const TierHeaderRow = memo(function TierHeaderRow({ tier, count, cols }: { tier: PriorityTier; count: number; cols: number }) {
  const tr = useTr()
  const def = tierDef(tier)
  return (
    <motion.tr layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid={`tier-row-${tier}`} className="border-b border-line/70 bg-canvas/70">
                          <th colSpan={cols} scope="colgroup" className="py-2 pr-5 pl-5 text-left font-normal">
                            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <TierTag tier={tier} />
                              <span className="text-[12px] font-semibold text-muted tabular-nums">{count} {tr(count === 1 ? S.caseOne : S.casesN)}</span>
                              <span className="text-[12.5px] text-muted">{tr(def.why)}</span>
                              <Tip content={<><b>{tr(def.label)}</b><br />{tr(def.why)}</>}>
                                <button type="button" aria-label={`${tr(S.whyTier)}: ${tr(def.label)}`} className="grid size-6 place-items-center rounded-md text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand">
                                  <Info className="size-3.5" aria-hidden />
                                </button>
                              </Tip>
                            </span>
                          </th>
                        </motion.tr>
  )
})

/** Check icons of a queue row; wraps instead of overflowing. */
function CheckIcons({ c }: { c: Case }) {
  const tr = useTr()
  return (
    <ul className="flex flex-wrap items-center gap-0.5" aria-label={tr(C.checks)}>
      {c.checks.map(k => {
        const o = effectiveOutcome(k)
        const text = `${tr(CHECKS[k.id].label)}: ${tr(OUTCOME_LABEL[o])}${k.score !== undefined ? ` (${score2(k.score)})` : ''}`
        return (
          <li key={k.id}>
            <Tip content={<><b>{tr(CHECKS[k.id].label)}</b> · {tr(OUTCOME_LABEL[o])}{k.score !== undefined && ` · ${score2(k.score)}`}<br /><span className="opacity-75">{tr(k.detail)}</span></>}>
              <span className="block rounded p-0.5" aria-label={text} role="img"><CheckIcon outcome={o} /></span>
            </Tip>
          </li>
        )
      })}
    </ul>
  )
}

/** Waiting time (and the 24 h bump tag) of a queue row. */
function Waiting({ c, bumped }: { c: Case; bumped: boolean }) {
  const tr = useTr()
  const lang = useLang()
  return (
    <span className="inline-flex flex-col items-end">
      <span className="inline-flex items-center gap-1 text-[13px] whitespace-nowrap text-muted tabular-nums">
        <Clock className="size-3.5" aria-hidden />
        {relativeTime(waitingSince(c), lang)}
      </span>
      {bumped && (
        <Tip content={fill(tr(S.bumped), { tier: tr(tierDef(baseTierOf(c)).label), h: PRIORITY_AGE_BUMP_HOURS })}>
          <span data-testid="age-bump" tabIndex={0} className="mt-1 flex w-fit items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-bold text-warning outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <ArrowUp className="size-3" aria-hidden />{fill(tr(S.bumpedShort), { h: PRIORITY_AGE_BUMP_HOURS })}
            <span className="sr-only">: {fill(tr(S.bumped), { tier: tr(tierDef(baseTierOf(c)).label), h: PRIORITY_AGE_BUMP_HOURS })}</span>
          </span>
        </Tip>
      )}
    </span>
  )
}

const QueueRow = memo(function QueueRow({ c, i, tier, bumped, isSel, isNew, flashed, onSelect, registerRow }: {
  c: Case; i: number; tier: PriorityTier; bumped: boolean; isSel: boolean; /** re-render tick for the waiting time */ minute: number; isNew: boolean; flashed: boolean
  onSelect: (i: number) => void; registerRow: (id: string, el: HTMLTableRowElement | null) => void
}) {
  const tr = useTr()
  const lang = useLang()
  const navigate = useNavigate()
  const f = topFlag(c)
  return (
    <motion.tr
                        data-tier={tier}
                        data-case-id={c.id}
                        ref={el => registerRow(c.id, el)}
                        layout="position"
                        initial={{ opacity: 0, x: -24, backgroundColor: 'rgba(31,79,214,0.14)' }}
                        animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(31,79,214,0)' }}
                        exit={{ opacity: 0, x: 24, transition: { duration: 0.25 } }}
                        transition={{ duration: isNew ? 0.6 : 0.3, backgroundColor: { duration: 2.4 } }}
                        onClick={() => navigate(PATHS.officerCase(c.id))}
                        onMouseEnter={() => onSelect(i)}
                        aria-selected={isSel}
                        className={cn(
                          'group relative cursor-pointer border-b border-line/70 last:border-b-0',
                          isSel ? 'bg-brand-soft/45' : 'hover:bg-canvas/60',
                          flashed && 'ofc-flash',
                        )}
                      >
                        <td className="relative py-3 pr-3 pl-5">
                          <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1 rounded-r', c.risk === 'high' ? 'bg-danger' : c.risk === 'medium' ? 'bg-warning' : 'bg-success/60', isSel && 'w-1.5')} />
                          <div className="flex items-center gap-3">
                            <Avatar initials={c.caseLabel ? 'AX' : c.persona.initials} hue={c.persona.hue} size={36} />
                            <div className="min-w-0">
                              <Link
                                to={PATHS.officerCase(c.id)}
                                onClick={e => e.stopPropagation()}
                                onFocus={() => onSelect(i)}
                                className="block truncate font-semibold text-ink outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand"
                              >
                                {caseTitle(c)}
                              </Link>
                              <p className="truncate text-xs text-muted">{c.caseRef && <span className="font-mono font-semibold text-ink/70">{c.caseRef} · </span>}{c.persona.nationality} · {shortDoc(c, lang)} · {c.persona.age}<span className="sr-only"> · {tr(S.priority)}: {tr(tierDef(tier).label)}</span></p>
                              <CaseTags c={c} />
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 min-[1100px]:hidden" data-testid="queue-compact-meta">
                                {c.route && <RouteBadge route={c.route} compact />}
                                <StatusPill status={c.status} advanced={c.advanced} className="h-auto py-0.5 leading-tight whitespace-normal" />
                                <CheckIcons c={c} />
                                <Waiting c={c} bumped={bumped} />
                              </div>
                            </div>
                            {isNew && <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">{tr(C.newCase)}</span>}
                          </div>
                        </td>
                        <td className="hidden px-3 py-3 min-[1100px]:table-cell">{c.route && <Tip content={tr(ROUTES[c.route].name)}><span className="inline-flex"><RouteBadge route={c.route} compact /></span></Tip>}</td>
                        <td className="px-3 py-3"><RiskTag risk={c.risk} /></td>
                        <td className="hidden px-3 py-3 min-[1100px]:table-cell">
                          <div className="flex flex-col items-start gap-1">
                            <StatusPill status={c.status} advanced={c.advanced} className="h-auto max-w-full py-0.5 text-left leading-tight whitespace-normal" />
                            {reviewKind(c) === 'advanced' && <span className="text-[11px] font-medium text-brand">{tr(C.advancedReviews)}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {c.aiReason || f ? (
                            <p data-testid="queue-ai-reason" className="flex items-start gap-1.5 text-[13px] leading-snug text-ink">
                              <span aria-hidden className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', c.risk === 'high' ? 'bg-danger' : c.risk === 'medium' ? 'bg-warning' : 'bg-muted')} />
                              <span className="line-clamp-3">{tr(c.aiReason ?? f!.reason)}</span>
                            </p>
                          ) : <span className="text-xs text-muted">{tr(C.noFlags)}</span>}
                        </td>
                        <td className="hidden px-3 py-3 min-[1100px]:table-cell"><CheckIcons c={c} /></td>
                        <td className="hidden py-3 pr-5 pl-3 text-right whitespace-nowrap min-[1100px]:table-cell">
                          <Waiting c={c} bumped={bumped} />
                          {isSel && <span className="mt-1 hidden justify-end group-hover:flex"><Kbd>↵</Kbd></span>}
                        </td>
                      </motion.tr>
  )
}, (a, b) =>
  // Cross-tab sync replaces every case object, so compare by identity + last update instead of reference.
  a.c.id === b.c.id && a.c.updatedAt === b.c.updatedAt && a.i === b.i && a.tier === b.tier && a.bumped === b.bumped &&
  a.minute === b.minute && a.isSel === b.isSel && a.isNew === b.isNew && a.flashed === b.flashed && a.onSelect === b.onSelect && a.registerRow === b.registerRow)

/** True at ≥ 1100 px, where the queue shows all seven columns (a spanning row must not add phantom columns below). */
const WIDE_QUERY = '(min-width: 1100px)'
function useWideQueue(): boolean {
  return useSyncExternalStore(
    cb => { const m = window.matchMedia(WIDE_QUERY); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  )
}

export function QueuePage({ preset }: { preset?: QueuePreset } = {}) {
  const tr = useTr()
  const wide = useWideQueue()
  const lang = useLang()
  useTick()
  const navigate = useNavigate()
  const { arrived, flashed } = useLive()
  const all = useClave(s => s.cases)
  const queue = useMemo(() => {
    const st = { cases: all } as AppState
    return preset === 'appeals' ? appealsQueue(st) : preset === 'advanced' ? advancedQueue(st) : preset === 'videocalls' ? videoCallQueue(st) : officerQueue(st)
  }, [all, preset])
  const registerRow = useCallback((id: string, el: HTMLTableRowElement | null) => { rowRefs.current[id] = el }, [])

  const [view, setView] = useState<View>(preset ?? 'all')
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all')
  const [route, setRoute] = useState<RouteId | 'all'>('all')
  const [sel, setSel] = useState(0)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const filtered = queue.filter(c =>
    (view === 'all' || preset === view || (view === 'appeals' ? reviewKind(c) === 'appeal' : reviewKind(c) === view)) &&
    (risk === 'all' || c.risk === risk) &&
    (route === 'all' || c.route === route),
  )
  const counts = {
    high: queue.filter(c => c.risk === 'high').length,
    medium: queue.filter(c => c.risk === 'medium').length,
    low: queue.filter(c => c.risk === 'low').length,
    advanced: queue.filter(c => reviewKind(c) === 'advanced').length,
    decision: queue.filter(c => reviewKind(c) === 'decision').length,
    appeals: queue.filter(c => reviewKind(c) === 'appeal').length,
  }
  const now = new Date()
  const tierOf = new Map(filtered.map(c => [c.id, priorityOf(c, now)] as const))
  const tierCount = (t: PriorityTier) => filtered.filter(c => tierOf.get(c.id) === t).length
  const selIdx = Math.min(sel, Math.max(0, filtered.length - 1))
  const selected = filtered[selIdx]

  useEffect(() => {
    if (selected) rowRefs.current[selected.id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  useHotkeys({
    j: () => setSel(Math.min(selIdx + 1, filtered.length - 1)),
    arrowdown: () => setSel(Math.min(selIdx + 1, filtered.length - 1)),
    k: () => setSel(Math.max(selIdx - 1, 0)),
    arrowup: () => setSel(Math.max(selIdx - 1, 0)),
    enter: () => selected && navigate(PATHS.officerCase(selected.id)),
    o: () => selected && navigate(PATHS.officerCase(selected.id)),
  })

  const inVerification = Object.values(all).filter(c => !c.awaitingOfficer && (c.status === 'received' || c.status === 'checking'))
  const recent = Object.values(all)
    .filter(c => !c.awaitingOfficer && c.status !== 'draft' && (c.decisions.length > 0 || c.status === 'need_info'))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, 8)

  const filtersOn = view !== (preset ?? 'all') || risk !== 'all' || route !== 'all'
  const clear = () => { setView(preset ?? 'all'); setRisk('all'); setRoute('all') }

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 xl:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[28px] font-bold text-ink">{tr(preset === 'appeals' ? C.navAppeals : preset === 'advanced' ? C.navAdvanced : preset === 'videocalls' ? K.navVideo : C.queueTitle)}</h1>
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-sm font-semibold tabular-nums text-white">{preset ? filtered.length : queue.length}</span>
            <LiveDot label={tr(C.live)} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">{tr(preset === 'appeals' ? C.appealsSubtitle : preset === 'advanced' ? C.advancedSubtitle : preset === 'videocalls' ? K.videoSubtitle : C.queueSubtitle)}</p>
          <p data-testid="priority-legend" className="mt-1.5 flex max-w-3xl items-start gap-1.5 text-[13px] font-medium text-ink">
            <ListOrdered className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            {fill(tr(S.legend), { h: PRIORITY_AGE_BUMP_HOURS })}
          </p>
        </div>
        <div className="hidden items-center gap-3 text-xs text-muted md:flex" aria-hidden>
          <span className="flex items-center gap-1"><Kbd>J</Kbd><Kbd>K</Kbd> {tr(C.kbdMove)}</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> {tr(C.kbdOpen)}</span>
        </div>
      </div>

      {/* Risk tiles = risk filter */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label={tr(C.risk)}>
        {([
          ['high', ShieldAlert, 'text-danger', 'bg-danger-soft', counts.high],
          ['medium', ShieldQuestion, 'text-warning', 'bg-warning-soft', counts.medium],
          ['low', ShieldCheck, 'text-success', 'bg-success-soft', counts.low],
        ] as const).map(([r, Icon, fg, bg, n]) => (
          <button
            key={r}
            type="button"
            aria-pressed={risk === r}
            onClick={() => { setRisk(risk === r ? 'all' : r); setSel(0) }}
            className={cn(
              'group flex items-center gap-3 rounded-[4px] border bg-surface p-4 text-left outline-none transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand',
              risk === r ? 'border-ink shadow-sm' : 'border-line',
            )}
          >
            <span className={cn('grid size-10 place-items-center rounded-[2px]', bg, fg)}><Icon className="size-5" aria-hidden /></span>
            <span>
              <span className="block text-2xl leading-none font-semibold tabular-nums text-ink">{n}</span>
              <span className="mt-1 block text-xs font-medium text-muted">{tr(RISK_LABEL[r])}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={view === 'advanced'}
          onClick={() => { setView(view === 'advanced' ? 'all' : 'advanced'); setSel(0) }}
          className={cn(
            'flex items-center gap-3 rounded-[4px] border bg-surface p-4 text-left outline-none transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand',
            view === 'advanced' ? 'border-ink shadow-sm' : 'border-line',
          )}
        >
          <span className="grid size-10 place-items-center rounded-[2px] bg-brand-soft text-brand"><Layers className="size-5" aria-hidden /></span>
          <span>
            <span className="block text-2xl leading-none font-semibold tabular-nums text-ink">{counts.advanced}</span>
            <span className="mt-1 block text-xs font-medium text-muted">{tr(C.advancedReviews)}</span>
          </span>
        </button>
      </div>

      {/* Engine strip */}
      <AnimatePresence>
        {inVerification.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            aria-label={tr(C.inVerification)}
            className="overflow-hidden"
          >
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[4px] border border-line bg-surface-2 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Cpu className="size-4 animate-pulse" aria-hidden />{tr(C.inVerification)}</span>
              <span className="text-xs text-muted">{tr(C.inVerificationHint)}</span>
              <ul className="flex flex-wrap gap-2">
                {inVerification.map(c => (
                  <li key={c.id}>
                    <Link to={PATHS.officerCase(c.id)} className="flex items-center gap-2 rounded-[2px] bg-surface px-2.5 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand">
                      <Avatar initials={c.persona.initials} hue={c.persona.hue} size={22} />
                      <span className="font-medium">{caseTitle(c)}</span>
                      <span className="flex gap-0.5">
                        {(c.route ? ROUTES[c.route].checks : []).map(id => {
                          const r = c.checks.find(k => k.id === id)
                          return r ? <CheckIcon key={id} outcome={effectiveOutcome(r)} className="size-3.5" /> : <span key={id} className="size-3.5 rounded-full border border-dashed border-muted/50" aria-hidden />
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div role="group" aria-label={tr(C.view)} className="inline-flex max-w-full flex-wrap rounded-[2px] border border-line bg-surface p-1">
          {([
            ['all', tr(C.all), queue.length],
            ['decision', tr(C.needsDecision), counts.decision],
            ['advanced', tr(C.advancedReviews), counts.advanced],
            ['appeals', tr(C.navAppeals), counts.appeals],
          ] as const).map(([v, label, n]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => { setView(v); setSel(0) }}
              className={cn(
                'flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-brand',
                view === v ? 'bg-ink text-white shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {label}
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', view === v ? 'bg-white/20' : 'bg-surface-2')}>{n}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>{tr(C.risk)}</span>
          <select value={risk} onChange={e => { setRisk(e.target.value as RiskLevel | 'all'); setSel(0) }} className="h-9 rounded-[2px] border border-line bg-surface px-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <option value="all">{tr(C.allRisks)}</option>
            {(['high', 'medium', 'low'] as const).map(r => <option key={r} value={r}>{tr(RISK_LABEL[r])}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>{tr(C.route)}</span>
          <select value={route} onChange={e => { setRoute(e.target.value as RouteId | 'all'); setSel(0) }} className="h-9 max-w-[240px] rounded-[2px] border border-line bg-surface px-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <option value="all">{tr(C.allRoutes)}</option>
            {ROUTE_ORDER.map(r => <option key={r} value={r}>{tr(routeCode(r))} · {tr(ROUTES[r].name)}</option>)}
          </select>
        </label>
        {filtersOn && (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-[2px] px-2 py-1.5 text-sm font-medium text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand">
            <FilterX className="size-4" aria-hidden />{tr(C.clearFilters)}
          </button>
        )}
        <span className="ml-auto text-sm text-muted tabular-nums" aria-live="polite">{filtered.length} / {queue.length} {tr(C.inQueue)}</span>
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-[4px] border border-line bg-surface shadow-[0_1px_2px_rgba(16,16,20,0.04)]">
        {filtered.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-[4px] bg-success-soft text-success"><Inbox className="size-7" aria-hidden /></span>
            <p className="mt-4 text-lg font-semibold">{queue.length === 0 ? tr(C.emptyQueueTitle) : tr(C.emptyFilterTitle)}</p>
            <p className="mt-1 max-w-md text-sm text-muted">{queue.length === 0 ? tr(C.emptyQueueBody) : ''}</p>
            {queue.length > 0 && <button type="button" onClick={clear} className="mt-3 text-sm font-semibold text-brand hover:underline">{tr(C.clearFilters)}</button>}
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            {/* Wide (≥ 1100 px): seven fixed columns. Narrower: route, status, checks and waiting time move into the applicant cell. */}
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">{tr(C.queueTitle)}</caption>
              <thead>
                <tr className="border-b border-line bg-canvas/70 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                  <th scope="col" className="w-[46%] py-2.5 pr-3 pl-5 min-[1100px]:w-[22%]">{tr(C.applicant)}</th>
                  <th scope="col" className="hidden w-[76px] px-3 py-2.5 min-[1100px]:table-cell">{tr(C.route)}</th>
                  <th scope="col" className="w-[128px] px-3 py-2.5">{tr(C.risk)}</th>
                  <th scope="col" className="hidden w-[156px] px-3 py-2.5 min-[1100px]:table-cell">{tr(C.status)}</th>
                  <th scope="col" className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3" aria-hidden />{tr(C.whyFlagged)}</span>
                  </th>
                  <th scope="col" className="hidden w-[168px] px-3 py-2.5 min-[1100px]:table-cell">{tr(C.checks)}</th>
                  <th scope="col" className="hidden w-[112px] py-2.5 pr-5 pl-3 text-right min-[1100px]:table-cell">{tr(C.waiting)}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.flatMap((c, i) => {
                    const tier = tierOf.get(c.id)!
                    const out = []
                    if (i === 0 || tierOf.get(filtered[i - 1].id) !== tier) {
                      out.push(<TierHeaderRow key={`tier-${tier}`} tier={tier} count={tierCount(tier)} cols={wide ? 7 : 3} />)
                    }
                    out.push(
                      <QueueRow
                        key={c.id}
                        c={c}
                        i={i}
                        tier={tier}
                        bumped={isAgeBumped(c, now)}
                        minute={Math.floor(now.getTime() / 60_000)}
                        isSel={i === selIdx}
                        isNew={arrived.has(c.id)}
                        flashed={flashed.has(c.id)}
                        onSelect={setSel}
                        registerRow={registerRow}
                      />,
                    )
                    return out
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recently decided */}
      <section className="mt-8" aria-labelledby="recent-title">
        <div className="flex items-baseline justify-between">
          <h2 id="recent-title" className="text-base font-semibold tracking-tight">{tr(C.recentlyDecided)}</h2>
          <p className="text-xs text-muted">{tr(C.recentlyDecidedHint)}</p>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 rounded-[4px] border border-dashed border-line p-6 text-center text-sm text-muted">{tr(C.nothingDecided)}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2 min-[1100px]:grid-cols-2">
            <AnimatePresence initial={false}>
              {recent.map(c => {
                const d = c.decisions[c.decisions.length - 1]
                const waiting = c.status === 'need_info'
                const Icon = waiting ? Hourglass : d?.outcome === 'refused' ? Ban : d?.outcome === 'revoked' ? Undo2 : CircleCheck
                const tone = waiting ? 'text-warning bg-warning-soft' : d?.outcome === 'refused' || d?.outcome === 'revoked' ? 'text-danger bg-danger-soft' : 'text-success bg-success-soft'
                const when = waiting ? c.infoRequest?.at ?? c.updatedAt : lastDecisionAt(c) ?? c.updatedAt
                return (
                  <motion.li key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Link to={PATHS.officerCase(c.id)} className={cn('flex items-center gap-3 rounded-[4px] border border-line bg-surface px-4 py-3 outline-none transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand', flashed.has(c.id) && 'ofc-flash')}>
                      <Avatar initials={c.persona.initials} hue={c.persona.hue} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{caseTitle(c)}</p>
                        <p className="truncate text-xs text-muted">
                          {waiting ? tr(C.waitingOnCitizen) : d ? `${tr(DECISION_LABEL[d.outcome])} · ${tr(C.by)} ${d.by.kind === 'system' ? tr({ en: 'engine', es: 'motor' }) : d.by.name}` : ''}
                        </p>
                      </div>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', tone)}>
                        <Icon className="size-3.5" aria-hidden />
                        {waiting ? tr(C.waitingOnCitizen) : d ? tr(DECISION_LABEL[d.outcome]) : ''}
                      </span>
                      <span className="w-20 text-right text-xs text-muted tabular-nums">{relativeTime(when, lang)}</span>
                    </Link>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  )
}
