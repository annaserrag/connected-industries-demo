/* Screen 7: case detail. */
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Baby, Ban, BadgeCheck, CalendarClock, ChevronRight, CircleAlert, FileText, Fingerprint, HandHelping,
  History, ListChecks, MessageSquareText, ScanFace, Scale, Smartphone, Sparkles, Undo2,
} from 'lucide-react'
import type { Case, CheckResult } from '@/contract/types'
import { CHECKS, DOCUMENTS, ENGINE, LEVEL_LABELS, REJECTION_REASONS, ROUTES, isProposedRule } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { useClave } from '@/core/store'
import { caseAudit, officerQueue, relativeTime } from '@/core/selectors'
import { Avatar, ProposedRuleTag, RouteBadge, SimulatedValuesNote, StatusPill, cn } from '@/ui'
import { C, DECISION_LABEL, OUTCOME_LABEL } from './copy'
import { effectiveOutcome, formatDate, formatDateTime, isExpired, RISK_RANK, SCORED, useHotkeys, useLang, useTick, useTr } from './lib'
import { useLive } from './live'
import { CheckIcon, Kbd, Panel, RiskTag, ScoreBar } from './components/ui'
import { FaceArt } from './components/FaceArt'
import { DecisionPanel } from './DecisionPanel'
import { AuditTimeline } from './Audit'

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

  const expired = isExpired(c.document.expires)
  const flags = [...c.flags].sort((a, b) => RISK_RANK[a.severity] - RISK_RANK[b.severity])
  const levelText = c.level === 'none' ? tr(C.levelNone) : tr(LEVEL_LABELS[c.level])

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-5 xl:px-8">
      {/* Breadcrumb */}
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
        className={cn('mt-3 rounded-[4px] border border-line bg-surface p-5', flashed.has(c.id) && 'ofc-flash')}
      >
        <div className="flex flex-wrap items-start gap-5">
          <span className="hidden sm:block"><Avatar initials={c.persona.initials} hue={c.persona.hue} size={64} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[22px] font-bold sm:text-[26px]">{c.persona.name}</h1>
              <RiskTag risk={c.risk} />
              <StatusPill status={c.status} advanced={c.advanced} />
              
            </div>
            <p className="mt-0.5 text-sm text-muted">{tr(c.persona.profile)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {c.route && <RouteBadge route={c.route} />}
              {isProposedRule(c.route, c.answers ?? c.presetAnswers) && <ProposedRuleTag />}
              <span className="text-line" aria-hidden>|</span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className={cn('size-4', c.level === 'none' ? 'text-muted' : 'text-success')} aria-hidden />
                <span className="font-medium">{levelText}</span>
                {c.advanced === 'pending_review' && <span className="text-brand">· {tr(C.advancedPending)}</span>}
              </span>
            </div>
          </div>
          <span className="hidden font-mono text-xs text-muted sm:inline">{tr(C.caseId)} {c.id}</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm md:grid-cols-4 xl:grid-cols-7">
          {[
            [tr({ en: 'Age', es: 'Edad' }), `${c.persona.age} ${tr(C.years)}`],
            [tr({ en: 'Nationality', es: 'Nacionalidad' }), c.persona.nationality],
            [tr(C.document), tr(DOCUMENTS[c.document.type].label)],
            [tr(C.number), <span className="font-mono text-[13px]">{c.document.number}</span>],
            [tr(C.expires), <span className={cn(expired && 'font-semibold text-danger')}>{formatDate(c.document.expires, lang)}{expired && ` · ${tr(C.expired)}`}</span>],
            [tr(C.issuedBy), c.document.issuingCountry],
            [tr(C.submitted), c.submittedAt ? `${relativeTime(c.submittedAt, lang)} · ${tr(C.attempt)} ${c.attempt}` : '—'],
          ].map(([k, v], i) => (
            <div key={i} className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{k}</dt>
              <dd className="mt-0.5 truncate text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </motion.header>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="min-w-0 space-y-5">
          {/* Why flagged + evidence */}
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Panel
            id="flags"
            title={tr(C.aiFlagged)}
            icon={<Sparkles className="size-4" />}
            hint={tr(C.aiFlaggedHint)}
            tone={c.risk === 'high' ? 'danger' : c.risk === 'medium' ? 'warning' : 'default'}
          >
            {flags.length === 0 ? (
              <p className="text-sm text-muted">{tr(C.noFlagsBody)}</p>
            ) : (
              <ul className="space-y-2">
                {flags.map((f, i) => (
                  <motion.li
                    key={f.code}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn(
                      'flex items-start gap-3 rounded-[2px] border p-3',
                      f.severity === 'high' ? 'border-danger/25 bg-danger-soft/50' : f.severity === 'medium' ? 'border-warning/25 bg-warning-soft/50' : 'border-line bg-canvas/60',
                    )}
                  >
                    <CircleAlert className={cn('mt-0.5 size-4 shrink-0', f.severity === 'high' ? 'text-danger' : f.severity === 'medium' ? 'text-warning' : 'text-muted')} aria-hidden />
                    <p className="flex-1 text-sm font-medium text-ink">{tr(f.reason)}</p>
                    <span className="sr-only">{tr(C.severity)}:</span>
                    <RiskTag risk={f.severity} size="sm" />
                  </motion.li>
                ))}
              </ul>
            )}
          </Panel>

            <Evidence c={c} />
          </div>

          <Panel id="checks" title={tr(C.checksTitle)} icon={<ListChecks className="size-4" />} hint={tr(C.checksHint)}>
            {c.checks.length === 0 ? (
              <p className="text-sm text-muted">{tr(C.noChecks)}</p>
            ) : (
              <ul className="grid gap-x-8 md:grid-cols-2">
                {c.checks.map(k => <CheckRowItem key={k.id} r={k} />)}
              </ul>
            )}
          </Panel>

          {/* Context */}
          <ContextPanels c={c} />

          {/* Decisions + audit */}
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel id="decisions" title={tr(C.previousDecisions)} icon={<Scale className="size-4" />}>
              {c.decisions.length === 0 ? <p className="text-sm text-muted">{tr(C.noDecisions)}</p> : (
                <ol className="space-y-2.5">
                  {[...c.decisions].reverse().map((d, i) => {
                    const bad = d.outcome === 'refused' || d.outcome === 'revoked'
                    const Icon = d.outcome === 'refused' ? Ban : d.outcome === 'revoked' ? Undo2 : BadgeCheck
                    return (
                      <li key={i} className="flex gap-3 rounded-[2px] border border-line p-3">
                        <span className={cn('grid size-8 shrink-0 place-items-center rounded-[2px]', bad ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}><Icon className="size-4" aria-hidden /></span>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-semibold">{tr(DECISION_LABEL[d.outcome])}</p>
                          <p className="text-xs text-muted">{d.by.kind === 'system' ? tr({ en: 'Verification engine (automatic)', es: 'Motor de verificación (automático)' }) : d.by.name} · {formatDateTime(d.at, lang)}</p>
                          {d.reasonId && <p className="mt-1 text-[13px]"><span className="font-medium text-muted">{tr(C.reason)}:</span> {tr(REJECTION_REASONS[d.reasonId].officerLabel)}</p>}
                          {d.note && <p className="mt-0.5 text-[13px] text-muted italic">“{d.note}”</p>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Panel>
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

        <div className="lg:sticky lg:top-[72px]">
          <DecisionPanel c={c} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- checks */
function CheckRowItem({ r }: { r: CheckResult }) {
  const tr = useTr()
  const o = effectiveOutcome(r)
  const th = SCORED[r.id]
  return (
    <li className="flex gap-3 border-t border-line py-3 first:border-t-0 md:[&:nth-child(2)]:border-t-0">
      <CheckIcon outcome={o} className="mt-0.5 size-5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-semibold text-ink">{tr(CHECKS[r.id].label)}</p>
          <span className={cn('text-xs font-semibold', o === 'pass' ? 'text-success' : o === 'fail' ? 'text-danger' : o === 'warn' ? 'text-warning' : 'text-muted')}>{tr(OUTCOME_LABEL[o])}</span>
        </div>
        <p className="mt-0.5 text-[13px] text-ink/85">{tr(r.detail)}</p>
        <p className="text-xs text-muted">{tr(CHECKS[r.id].explains)}</p>
        {th !== undefined && r.score !== undefined && <ScoreBar score={r.score} threshold={th} label={tr(CHECKS[r.id].label)} />}
      </div>
    </li>
  )
}

/* ----------------------------------------------------------- evidence */
function Evidence({ c }: { c: Case }) {
  const tr = useTr()
  const live = c.checks.find(k => k.id === 'liveness')
  const face = c.checks.find(k => k.id === 'face_match')
  const hasChip = DOCUMENTS[c.document.type].hasChip && c.route !== 'A' && c.route !== 'C'
  const spoof = live ? live.outcome === 'fail' || (live.score !== undefined && live.score < ENGINE.livenessMin) : false

  return (
    <Panel id="evidence" title={tr(C.evidence)} icon={<ScanFace className="size-4" />} hint={tr(C.evidenceHint)} tone={spoof ? 'danger' : 'default'}>
      {!hasChip && !live ? (
        <div className="flex items-start gap-3 rounded-[2px] bg-canvas p-4 text-sm text-muted">
          <FileText className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>{c.route === 'A' ? tr({ en: 'Identity confirmed by the citizen’s own EU eID through eIDAS: no chip photo or face capture on this route.', es: 'Identidad confirmada por el eID de la UE de la persona vía eIDAS: en esta vía no hay foto de chip ni captura facial.' }) : c.route === 'C' ? tr({ en: 'Today’s DNI video identification: evidence stays with the existing service.', es: 'Videoidentificación con DNI actual: las pruebas quedan en el servicio existente.' }) : tr(C.noChipPhoto)}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <figure>
              <div className="overflow-hidden rounded-[2px] ring-1 ring-line">
                <FaceArt hue={c.persona.hue} initials={c.persona.initials} variant={hasChip ? 'chip' : 'empty'} label={tr(C.chipPhoto)} className="text-muted" />
              </div>
              <figcaption className="mt-1.5 flex items-center gap-1 text-xs font-medium text-muted"><Fingerprint className="size-3.5" aria-hidden />{tr(C.chipPhoto)}</figcaption>
            </figure>
            <div className="flex flex-col items-center gap-1 text-center" aria-hidden={!face}>
              {face && (
                <>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', (face.score ?? 0) >= ENGINE.faceMatchMin ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>{face.score?.toFixed(2)}</span>
                  <span className="text-[10px] font-medium text-muted">{tr(CHECKS.face_match.label)}</span>
                  <SimulatedValuesNote />
                  <span className="h-px w-8 bg-line" />
                </>
              )}
            </div>
            <figure>
              <div className={cn('overflow-hidden rounded-[2px] ring-1', spoof ? 'ring-2 ring-danger' : 'ring-line')}>
                <FaceArt
                  hue={c.persona.hue}
                  initials={c.persona.initials}
                  variant={!live ? 'empty' : spoof ? 'spoof' : 'live'}
                  tag={tr({ en: 'NO DEPTH · REPLAY', es: 'SIN PROFUNDIDAD · REPETICIÓN' })}
                  label={live ? `${tr(C.liveCapture)}: ${spoof ? tr(C.livenessFailedBig) : tr(C.liveOk)}` : tr(C.noCapture)}
                  className="text-muted"
                />
              </div>
              <figcaption className="mt-1.5 flex items-center gap-1 text-xs font-medium text-muted"><Smartphone className="size-3.5" aria-hidden />{tr(C.liveCapture)}{live?.score !== undefined && <span className={cn('ml-auto font-bold tabular-nums', spoof ? 'text-danger' : 'text-success')}>{live.score.toFixed(2)}</span>}</figcaption>
            </figure>
          </div>
          {spoof ? (
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 rounded-[2px] bg-danger p-3.5 text-white" role="alert">
              <p className="flex items-center gap-2 text-sm font-bold"><CircleAlert className="size-4" aria-hidden />{tr(C.livenessFailedBig)}</p>
              <p className="mt-1 text-[13px] text-white/90">{tr(C.matchesButNotLive)}</p>
              {live && <p className="mt-1.5 text-xs text-white/80">{tr(live.detail)}</p>}
            </motion.div>
          ) : live ? (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-success"><ScanFace className="size-4" aria-hidden />{tr(C.liveOk)}</p>
          ) : null}
        </>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------- context panels */
function ContextPanels({ c }: { c: Case }) {
  const tr = useTr()
  const lang = useLang()
  const blocks: React.ReactNode[] = []

  if (c.videoCallSlot) {
    const when = new Date(c.videoCallSlot).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    blocks.push(
      <Panel key="videocall" id="videocall" title={lang === 'es' ? 'Videollamada reservada' : 'Video call booked'} icon={<HandHelping className="size-4" />}>
        <p className="text-sm text-ink">{lang === 'es' ? `La persona solicitante reservó una videollamada para hoy a las ${when}.` : `The applicant booked a video call for today at ${when}.`}</p>
      </Panel>,
    )
  }
  if (c.assisted) {
    blocks.push(
      <Panel key="assisted" id="assisted" title={tr(C.assistedTitle)} icon={<HandHelping className="size-4" />}>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted">{tr(C.helper)}</dt><dd className="font-semibold">{c.assisted.helperName} <span className="font-normal text-muted">({tr(c.assisted.relation)})</span></dd></div>
          <div><dt className="text-xs text-muted">{tr(C.deviceOwner)}</dt><dd className="font-semibold">{c.assisted.deviceOwner}</dd></div>
        </dl>
        <p className="mt-3 rounded-[2px] bg-info-soft p-3 text-[13px] text-info">{tr(C.assistedBody)}</p>
      </Panel>,
    )
  }
  if (c.guardian) {
    blocks.push(
      <Panel key="guardian" id="guardian" title={tr(C.guardianTitle)} icon={<Baby className="size-4" />}>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted">{tr(C.guardian)}</dt><dd className="font-semibold">{c.guardian.name} <span className="font-normal text-muted">({tr(c.guardian.relation)})</span></dd></div>
          <div><dt className="text-xs text-muted">{tr(C.guardianRoute)}</dt><dd className="flex items-center gap-1.5"><RouteBadge route={c.guardian.route} />{tr(ROUTES[c.guardian.route].name)}</dd></div>
          <div><dt className="text-xs text-muted">{tr(C.document)}</dt><dd>{tr(DOCUMENTS[c.guardian.document.type].label)}</dd></div>
          <div><dt className="text-xs text-muted">{tr(C.number)}</dt><dd className="font-mono text-[13px]">{c.guardian.document.number}</dd></div>
        </dl>
      </Panel>,
    )
  }
  if (c.infoRequest) {
    const ir = c.infoRequest
    blocks.push(
      <Panel key="info" id="info" title={tr(C.infoRequestTitle)} icon={<MessageSquareText className="size-4" />}>
        <div className="space-y-3">
          <div className="max-w-[90%] rounded-[4px] rounded-tl-sm bg-surface-2 p-3 text-sm">
            <p>{ir.message}</p>
            <p className="mt-1 text-[11px] text-muted">{tr(C.askedBy)} {ir.by.name} · {formatDateTime(ir.at, lang)}</p>
          </div>
          {ir.response ? (
            <div className="ml-auto max-w-[90%] rounded-[4px] rounded-tr-sm bg-brand p-3 text-sm text-white">
              <p className="text-[11px] font-semibold text-white/75">{tr(C.citizenResponse)}</p>
              <p className="mt-0.5">{ir.response.text}</p>
              <p className="mt-1 text-[11px] text-white/70">{c.persona.name} · {formatDateTime(ir.response.at, lang)}</p>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-muted"><CalendarClock className="size-4" aria-hidden />{tr(C.noResponseYet)}</p>
          )}
        </div>
      </Panel>,
    )
  }
  if (c.appeal) {
    const a = c.appeal
    const stateLabel = a.state === 'open' ? C.appealOpen : a.state === 'upheld' ? C.appealUpheld : C.appealDismissed
    blocks.push(
      <Panel key="appeal" id="appeal" title={tr(C.appealTitle)} icon={<Scale className="size-4" />} tone={a.state === 'open' ? 'warning' : 'default'}
        action={<span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', a.state === 'open' ? 'bg-warning-soft text-warning' : a.state === 'upheld' ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted')}>{tr(stateLabel)}</span>}>
        <blockquote className="border-l-2 border-warning/50 pl-3 text-sm italic">“{a.text}”</blockquote>
        <p className="mt-2 text-xs text-muted">{c.persona.name} · {formatDateTime(a.at, lang)}</p>
      </Panel>,
    )
  }
  if (!blocks.length) return null
  return <div className="grid gap-5 xl:grid-cols-2">{blocks}</div>
}
