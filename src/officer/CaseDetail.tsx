/* Screen 7: case detail (SPEC §6) — header, AI reason, checks table, attempts, evidence, uploads, decisions, audit. */
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Baby, BadgeCheck, ChevronRight, HandHelping, History, Scale } from 'lucide-react'
import { DOCUMENTS, LEVEL_LABELS } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { useClave } from '@/core/store'
import { subjectDocument } from '@/core/engine'
import { caseAudit, officerQueue, relativeTime } from '@/core/selectors'
import { Avatar, ProposedRuleTag, RouteBadge, StatusPill, cn } from '@/ui'
import { C, K } from './copy'
import { caseTitle, formatDate, isExpired, useHotkeys, useLang, useTick, useTr } from './lib'
import { useLive } from './live'
import { Kbd, Panel, RiskTag } from './components/ui'
import {
  AiReasonBox, AppealPanel, AssistedPanel, AttemptsPanel, ChecksTable, ConsentsPanel, DecisionsPanel, DiscrepancyTable,
  InfoThread, PrintedVsChip, ProofPanel, RedCardPanel, StillsStrip, useEvaluation,
} from './components/CaseSections'
import { DecisionPanel } from './DecisionPanel'
import { AuditTimeline } from './Audit'

export function Badge({ icon, children, tone, testId }: { icon?: React.ReactNode; children: React.ReactNode; tone: 'info' | 'warning' | 'brand'; testId?: string }) {
  const cls = { info: 'bg-info-soft text-info ring-info/30', warning: 'bg-warning-soft text-warning ring-warning/30', brand: 'bg-brand-soft text-brand ring-brand/30' }[tone]
  return <span data-testid={testId} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset', cls)}>{icon}{children}</span>
}

export function CaseDetailPage() {
  const { id = '' } = useParams()
  const tr = useTr()
  const lang = useLang()
  useTick()
  const navigate = useNavigate()
  const c = useClave(s => s.cases[id])
  const state = useClave(s => s)
  const queue = useMemo(() => officerQueue(state), [state])
  const events = useMemo(() => caseAudit(state, id), [state, id])
  const { flashed } = useLive()
  const e = useEvaluation(c)

  const idx = queue.findIndex(q => q.id === id)
  const go = (d: number) => {
    if (!queue.length) return
    const n = idx === -1 ? 0 : (idx + d + queue.length) % queue.length
    navigate(PATHS.officerCase(queue[n].id))
  }
  useHotkeys({ j: () => go(1), k: () => go(-1), escape: () => navigate(PATHS.officer) })

  if (!c) {
    return (
      <div className="grid place-items-center px-6 py-24 text-center">
        <p className="text-lg font-semibold">{tr(C.caseNotFound)}</p>
        <p className="mt-1 text-sm text-muted">{tr(C.caseNotFoundBody)}</p>
        <Link to={PATHS.officer} className="mt-4 text-sm font-semibold text-brand hover:underline">{tr(C.backToQueue)}</Link>
      </div>
    )
  }

  const doc = subjectDocument(c) ?? c.typed
  const expired = isExpired(doc.expiry)
  const levelText = c.level === 'none' ? tr(C.levelNone) : tr(LEVEL_LABELS[c.level])
  const title = caseTitle(c)
  const s = c.session

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 xl:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link to={PATHS.officer} className="inline-flex items-center gap-1.5 rounded-[2px] py-1 text-sm font-medium text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand">
          <ArrowLeft className="size-4" aria-hidden />{tr(C.backToQueue)}<Kbd className="ml-1">Esc</Kbd>
        </Link>
        {idx !== -1 && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="tabular-nums">{idx + 1} / {queue.length} {tr(C.inQueue)}</span>
            <Kbd>J</Kbd><Kbd>K</Kbd>
          </div>
        )}
      </div>

      {/* Header */}
      <motion.header
        key={c.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        data-testid="case-header"
        className={cn('mt-3 rounded-[4px] border border-line bg-surface p-5', flashed.has(c.id) && 'ofc-flash')}
      >
        <div className="flex flex-wrap items-start gap-5">
          <span className="hidden sm:block"><Avatar initials={c.caseLabel ? 'AX' : c.persona.initials} hue={c.persona.hue} size={60} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {c.caseRef && <span className="rounded-[2px] bg-ink px-1.5 py-0.5 font-mono text-xs font-bold text-white" data-testid="case-ref">{c.caseRef}</span>}
              <h1 className="font-display text-[22px] font-bold sm:text-[26px]">{title}</h1>
              <RiskTag risk={c.risk} />
              <StatusPill status={c.status} advanced={c.advanced} />
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {c.caseLabel ? <>{tr(K.documentHolder)}: <b className="text-ink">{c.typed.data.givenNames} {c.typed.data.surnames}</b> · </> : null}
              {tr(c.persona.profile)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {c.route && <RouteBadge route={c.route} />}
              {s?.route && c.route === 'F' && s.route !== 'F' && <span className="text-xs text-muted">({tr({ en: 'started on', es: 'empezó por' })} <RouteBadge route={s.route} compact />)</span>}
              {c.policyProposal && <ProposedRuleTag />}
              {s?.who === 'helping' && <Badge tone="info" icon={<HandHelping className="size-3.5" aria-hidden />} testId="assisted-badge">{tr(K.assisted)}</Badge>}
              {s?.who === 'child' && <Badge tone="warning" icon={<Baby className="size-3.5" aria-hidden />}>{tr(K.minor)}</Badge>}
              {c.appeal?.state === 'open' && <Badge tone="warning" icon={<Scale className="size-3.5" aria-hidden />}>{tr(K.appealTag)}</Badge>}
              <span className="text-line" aria-hidden>|</span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className={cn('size-4', c.level === 'none' ? 'text-muted' : 'text-success')} aria-hidden />
                <span className="font-medium">{levelText}</span>
                {c.advanced === 'pending_review' && <span className="text-brand">· {tr(C.advancedPending)}</span>}
              </span>
            </div>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm md:grid-cols-3 xl:grid-cols-6">
          {[
            [tr({ en: 'Nationality', es: 'Nacionalidad' }), `${c.persona.nationality} · ${c.persona.age} ${tr(C.years)}`],
            [tr(C.document), tr(DOCUMENTS[doc.type].label)],
            [tr(C.number), <span className="font-mono text-[13px]">{doc.number}</span>],
            [tr(C.expires), <span className={cn(expired && 'font-semibold text-danger')}>{formatDate(doc.expiry, lang)}{expired && ` · ${tr(C.expired)}`}</span>],
            [tr(C.issuedBy), doc.nationality],
            [tr(C.submitted), c.submittedAt ? relativeTime(c.submittedAt, lang) : '—'],
          ].map(([k, v], i) => (
            <div key={i} className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{k}</dt>
              <dd className="mt-0.5 truncate text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </motion.header>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        {/* Decision panel first on small screens so actions are reachable. */}
        <div className="lg:sticky lg:top-[72px] lg:order-2">
          <DecisionPanel c={c} />
        </div>
        <div className="min-w-0 space-y-5 lg:order-1">
          <AiReasonBox c={c} />
          <ChecksTable c={c} />
          <PrintedVsChip c={c} e={e} />
          <DiscrepancyTable c={c} e={e} />
          <RedCardPanel c={c} />
          <ProofPanel c={c} />
          <AppealPanel c={c} />
          <InfoThread c={c} />
          <AttemptsPanel c={c} e={e} />
          <StillsStrip c={c} e={e} />
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <AssistedPanel c={c} />
            <ConsentsPanel c={c} />
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <DecisionsPanel c={c} />
            <Panel
              id="case-audit"
              title={tr(C.caseAudit)}
              icon={<History className="size-4" />}
              action={<Link to={`${PATHS.officerAudit}?case=${c.id}`} className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand hover:underline">{tr(C.viewFullAudit)}<ChevronRight className="size-3.5" aria-hidden /></Link>}
            >
              <AuditTimeline events={events} compact />
              {events.length > 6 && <Link to={`${PATHS.officerAudit}?case=${c.id}`} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">+{events.length - 6} · {tr(C.viewFullAudit)}</Link>}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
