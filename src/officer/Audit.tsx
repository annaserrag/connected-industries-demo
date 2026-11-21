/* Screen 8: audit trail (full page + compact per-case timeline). */
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Cpu, Download, FilterX, History, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import type { ActorKind, AuditEvent } from '@/contract/types'
import { CHECKS, REJECTION_REASONS } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { useClave } from '@/core/store'
import { relativeTime } from '@/core/selectors'
import { Avatar, cn } from '@/ui'
import { ACTOR_LABEL, AUDIT_ACTION_LABEL, C } from './copy'
import { auditToCsv, downloadText, formatDateTime, formatTime, useLang, useTick, useTr } from './lib'
import { TOASTER_ID } from './live'
import { Btn } from './components/ui'

const ACTOR_ICON: Record<ActorKind, typeof Cpu> = { system: Cpu, officer: ShieldCheck, citizen: UserRound }
const ACTOR_TONE: Record<ActorKind, string> = {
  system: 'bg-sim-soft text-sim',
  officer: 'bg-brand-soft text-brand',
  citizen: 'bg-surface-2 text-ink',
}

function actionTone(a: AuditEvent['action']): string {
  if (a === 'officer_refused' || a === 'officer_revoked') return 'text-danger'
  if (a === 'auto_approved_basic' || a === 'officer_approved_basic' || a === 'officer_approved_advanced') return 'text-success'
  if (a === 'escalated_to_officer' || a === 'info_requested' || a === 'appeal_filed') return 'text-warning'
  return 'text-ink'
}

export function ActorChip({ e }: { e: AuditEvent }) {
  const tr = useTr()
  const Icon = ACTOR_ICON[e.actor.kind]
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className={cn('grid size-6 shrink-0 place-items-center rounded-md', ACTOR_TONE[e.actor.kind])} title={tr(ACTOR_LABEL[e.actor.kind])}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{e.actor.name}</span>
        <span className="block text-[11px] text-muted">{tr(ACTOR_LABEL[e.actor.kind])}</span>
      </span>
    </span>
  )
}

function EvidenceChips({ e }: { e: AuditEvent }) {
  const tr = useTr()
  if (!e.evidence?.length) return <span className="text-muted">—</span>
  const shown = e.evidence.slice(0, 3)
  const rest = e.evidence.length - shown.length
  return (
    <ul className="flex flex-wrap gap-1" title={e.evidence.map(id => tr(CHECKS[id].label)).join(', ')}>
      {shown.map(id => <li key={id} className="max-w-full truncate rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap">{tr(CHECKS[id].label)}</li>)}
      {rest > 0 && <li className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">+{rest}</li>}
    </ul>
  )
}

/** Compact vertical timeline used inside the case detail page (oldest first). */
export function AuditTimeline({ events, compact }: { events: AuditEvent[]; compact?: boolean }) {
  const tr = useTr()
  const lang = useLang()
  if (!events.length) return <p className="text-sm text-muted">{tr(C.noAudit)}</p>
  const list = compact ? events.slice(-6) : events
  return (
    <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-3 before:w-px before:bg-line" aria-label={tr(C.caseAudit)}>
      <AnimatePresence initial={false}>
        {list.map(e => {
          const Icon = ACTOR_ICON[e.actor.kind]
          return (
            <motion.li key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative flex gap-3 pl-0">
              <span className={cn('relative z-10 grid size-6 shrink-0 place-items-center rounded-full ring-4 ring-surface', ACTOR_TONE[e.actor.kind])}><Icon className="size-3.5" aria-hidden /></span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cn('font-semibold', actionTone(e.action))}>{tr(AUDIT_ACTION_LABEL[e.action])}</span>
                  <span className="text-xs text-muted">{e.actor.name} · <time dateTime={e.at}>{formatTime(e.at, lang)}</time></span>
                </p>
                <p className="text-[13px] text-muted">{e.detail}</p>
                {e.reasonId && <p className="text-[12px] font-medium text-danger">{tr(C.reason)}: {tr(REJECTION_REASONS[e.reasonId].officerLabel)}</p>}
                {e.evidence?.length ? <div className="mt-1"><EvidenceChips e={e} /></div> : null}
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}

export function AuditPage() {
  const tr = useTr()
  const lang = useLang()
  useTick()
  const audit = useClave(s => s.audit)
  const cases = useClave(s => s.cases)
  const [params, setParams] = useSearchParams()
  const caseF = params.get('case') ?? 'all'
  const actorF = (params.get('actor') ?? 'all') as ActorKind | 'all'

  const setF = (k: 'case' | 'actor', v: string) => {
    const p = new URLSearchParams(params)
    if (v === 'all') p.delete(k); else p.set(k, v)
    setParams(p, { replace: true })
  }

  const caseIds = useMemo(() => {
    const ids = new Set(audit.map(e => e.caseId).filter((x): x is string => !!x))
    return [...ids].sort((a, b) => (cases[a]?.persona.name ?? a).localeCompare(cases[b]?.persona.name ?? b))
  }, [audit, cases])

  const rows = useMemo(
    () => [...audit].reverse().filter(e => (caseF === 'all' || e.caseId === caseF) && (actorF === 'all' || e.actor.kind === actorF)),
    [audit, caseF, actorF],
  )

  const exportCsv = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadText(`getyourclave-audit-${caseF === 'all' ? 'all' : caseF}-${stamp}.csv`, auditToCsv(rows, cases, lang))
    toast.success(tr(C.exported), { toasterId: TOASTER_ID, description: `${rows.length} ${tr(C.events)}` })
  }

  const counts = { system: 0, officer: 0, citizen: 0 } as Record<ActorKind, number>
  audit.forEach(e => { counts[e.actor.kind]++ })

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 xl:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-[26px] font-semibold tracking-tight">{tr(C.auditTitle)}<span className="rounded-full bg-ink px-2.5 py-0.5 text-sm font-semibold tabular-nums text-white">{audit.length}</span></h1>
          <p className="mt-1 text-sm text-muted">{tr(C.auditSubtitle)}</p>
        </div>
        <Btn variant="primary" onClick={exportCsv} disabled={rows.length === 0}><Download className="size-4" aria-hidden />{tr(C.exportCsv)}</Btn>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>{tr(C.filterCase)}</span>
          <select value={caseF} onChange={e => setF('case', e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <option value="all">{tr(C.allCases)}</option>
            {caseIds.map(id => <option key={id} value={id}>{cases[id]?.persona.name ?? id}</option>)}
            {caseF !== 'all' && !caseIds.includes(caseF) && <option value={caseF}>{cases[caseF]?.persona.name ?? caseF}</option>}
          </select>
        </label>
        <div role="group" aria-label={tr(C.filterActor)} className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(['all', 'system', 'officer', 'citizen'] as const).map(k => {
            const Icon = k === 'all' ? History : ACTOR_ICON[k]
            return (
              <button key={k} type="button" aria-pressed={actorF === k} onClick={() => setF('actor', k)}
                className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand', actorF === k ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
                <Icon className="size-3.5" aria-hidden />
                {k === 'all' ? tr(C.allActors) : tr(ACTOR_LABEL[k])}
                <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', actorF === k ? 'bg-white/20' : 'bg-surface-2')}>{k === 'all' ? audit.length : counts[k]}</span>
              </button>
            )
          })}
        </div>
        {(caseF !== 'all' || actorF !== 'all') && (
          <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <FilterX className="size-4" aria-hidden />{tr(C.clearFilters)}
          </button>
        )}
        <span className="ml-auto text-sm text-muted tabular-nums" aria-live="polite">{rows.length} {tr(C.events)}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted"><History className="size-7" aria-hidden /></span>
            <p className="mt-4 text-lg font-semibold">{tr(C.noAudit)}</p>
            <p className="mt-1 max-w-md text-sm text-muted">{tr(C.noAuditBody)}</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-260px)] overflow-auto">
            <table className="w-full min-w-[1040px] table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[11%]" /><col className="w-[15%]" /><col className="w-[12%]" /><col className="w-[14%]" /><col /><col className="w-[16%]" /><col className="w-[11%]" />
              </colgroup>
              <caption className="sr-only">{tr(C.auditTitle)}</caption>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-line bg-canvas text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                  <th scope="col" className="py-2.5 pr-3 pl-5">{tr(C.time)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.actor)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.action)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.filterCase)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.detail)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.evidence)}</th>
                  <th scope="col" className="py-2.5 pr-5 pl-3">{tr(C.reason)}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map(e => {
                    const c = e.caseId ? cases[e.caseId] : undefined
                    return (
                      <motion.tr key={e.id} initial={{ opacity: 0, backgroundColor: 'rgba(31,79,214,0.12)' }} animate={{ opacity: 1, backgroundColor: 'rgba(31,79,214,0)' }} transition={{ backgroundColor: { duration: 2 } }} className="border-b border-line/70 align-top last:border-b-0">
                        <td className="py-3 pr-3 pl-5 whitespace-nowrap">
                          <time dateTime={e.at} className="block font-medium tabular-nums">{formatDateTime(e.at, lang)}</time>
                          <span className="text-[11px] text-muted">{relativeTime(e.at, lang)}</span>
                        </td>
                        <td className="px-3 py-3"><ActorChip e={e} /></td>
                        <td className={cn('px-3 py-3 font-semibold', actionTone(e.action))}>{tr(AUDIT_ACTION_LABEL[e.action])}</td>
                        <td className="px-3 py-3">
                          {c ? (
                            <Link to={PATHS.officerCase(c.id)} className="inline-flex items-center gap-2 rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand">
                              <Avatar initials={c.persona.initials} hue={c.persona.hue} size={22} />
                              <span className="text-[13px] font-medium">{c.persona.name}</span>
                            </Link>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-ink/85">{e.detail}</td>
                        <td className="px-3 py-3"><EvidenceChips e={e} /></td>
                        <td className="py-3 pr-5 pl-3">
                          {e.reasonId ? <span className="inline-flex rounded-md bg-danger-soft px-1.5 py-0.5 text-[12px] font-semibold text-danger">{tr(REJECTION_REASONS[e.reasonId].officerLabel)}</span> : <span className="text-muted">—</span>}
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
