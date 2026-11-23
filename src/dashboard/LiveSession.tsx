import { useMemo } from 'react'
import { Ban, CheckCircle2, Hourglass, RotateCcw, Scale, UserCheck, Users } from 'lucide-react'
import { useClave } from '@/core/store'
import { dashboardCounters } from '@/core/selectors'
import { REJECTION_REASONS, STATUSES, STATUS_ORDER } from '@/contract/seed'
import { REJ_ORDER } from '@/contract/messages'
import type { StatusId } from '@/contract/types'
import { COPY } from './copy'
import { useFmt, useTr } from './components/hooks'
import { SectionHeading } from './components/parts'

function LivePill({ label }: { label: string }) {
  return (
    <span data-testid="live-badge" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink">
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      {label}
    </span>
  )
}

/** Live counters computed from the applications in the shared store (dashboardCounters). No invented numbers. */
export function LiveSession() {
  const tr = useTr()
  const f = useFmt()
  const cases = useClave(s => s.cases)
  const state = useClave(s => s)
  const k = useMemo(() => dashboardCounters(state), [state])

  const byStatus = useMemo(() => {
    const out: Record<StatusId | 'draft', number> = { draft: 0, received: 0, checking: 0, need_info: 0, approved: 0, not_approved: 0 }
    for (const c of Object.values(cases)) out[c.status] = (out[c.status] ?? 0) + 1
    return out
  }, [cases])
  const awaiting = useMemo(() => Object.values(cases).filter(c => c.awaitingOfficer).length, [cases])
  const refusals = Object.values(k.refusalsByReason).reduce((a, b) => a + b, 0)
  const share = k.applications ? Math.round((k.neededOfficer / k.applications) * 100) : 0

  const tiles = [
    { id: 'applications', icon: Users, label: tr(COPY.liveTotal), value: k.applications },
    { id: 'auto', icon: CheckCircle2, label: tr(COPY.liveAuto), value: k.autoApprovals },
    { id: 'needed-officer', icon: UserCheck, label: `${tr(COPY.liveOfficer)} (${f.pct(share)})`, value: k.neededOfficer },
    { id: 'awaiting', icon: Hourglass, label: tr(COPY.liveAwaiting), value: awaiting },
    { id: 'refusals', icon: Ban, label: tr(COPY.liveRefusals), value: refusals },
    { id: 'corrected', icon: RotateCcw, label: tr(COPY.liveCorrected), value: k.correctedOnReview },
    { id: 'proposed', icon: Scale, label: tr(COPY.liveProposed), value: k.decidedUnderProposedRule },
  ]
  const statusRows: Array<{ id: StatusId | 'draft'; label: string; step?: number }> = [
    { id: 'draft', label: tr(COPY.liveDraft) },
    ...STATUS_ORDER.map(id => ({ id, label: tr(STATUSES[id].label), step: STATUSES[id].step })),
  ]
  const maxStatus = Math.max(1, ...statusRows.map(r => byStatus[r.id]))
  const maxRej = Math.max(1, ...REJ_ORDER.map(r => k.refusalsByReason[r]))

  return (
    <section aria-labelledby="dash-live" data-testid="live-session">
      <SectionHeading id="dash-live" title={tr(COPY.liveSection)} aside={<LivePill label={tr(COPY.liveBadge)} />}>
        {tr(COPY.liveIntro)}
      </SectionHeading>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-live="polite">
        {tiles.map(({ id, icon: Icon, label, value }) => (
          <li key={id} data-testid={`live-${id}`} data-value={value} className="rounded-[2px] border border-line bg-surface p-4">
            <Icon className="size-4 text-muted" aria-hidden="true" />
            <p className="mt-3 text-3xl font-bold tracking-tight text-ink tabular-nums">{f.num(value)}</p>
            <p className="mt-0.5 text-sm leading-snug text-muted">{label}</p>
          </li>
        ))}
        <li className="flex items-center rounded-[2px] bg-surface-2 p-4 text-sm leading-snug text-muted">{tr(COPY.liveUpdated)}.</li>
      </ul>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[2px] border border-line bg-surface p-5">
          <h3 className="text-sm font-bold text-ink">{tr(COPY.liveByReason)}</h3>
          <p className="mt-0.5 text-xs text-muted">{tr(COPY.liveByReasonHint)}</p>
          <BarTable rows={REJ_ORDER.map(r => ({ id: r, label: <><span className="font-mono text-xs font-bold text-muted">{r}</span> {tr(REJECTION_REASONS[r].officerLabel)}</>, value: k.refusalsByReason[r] }))} max={maxRej} caption={tr(COPY.liveByReason)} testid="live-rej" fmt={f.num} bar="bg-danger/80" />
        </div>
        <div className="rounded-[2px] border border-line bg-surface p-5">
          <h3 className="text-sm font-bold text-ink">{tr(COPY.liveByStatus)}</h3>
          <BarTable rows={statusRows.map(r => ({ id: r.id, label: <>{r.step && <span className="mr-1.5 text-xs font-bold text-muted tabular-nums">{r.step}.</span>}{r.label}</>, value: byStatus[r.id] }))} max={maxStatus} caption={tr(COPY.liveByStatus)} testid="live-status" fmt={f.num} bar="bg-ink/70" />
        </div>
      </div>
    </section>
  )
}

function BarTable({ rows, max, caption, testid, fmt, bar }: { rows: Array<{ id: string; label: React.ReactNode; value: number }>; max: number; caption: string; testid: string; fmt: (n: number) => string; bar: string }) {
  return (
    <table className="mt-3 w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} className="align-middle" data-testid={`${testid}-${r.id}`} data-value={r.value}>
            <th scope="row" className="w-[58%] py-1.5 pr-3 text-left font-normal text-ink">{r.label}</th>
            <td className="py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div className={`h-full rounded-full ${bar} transition-[width] duration-500 motion-reduce:transition-none`} style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
                <span className="w-6 text-right font-bold text-ink tabular-nums">{fmt(r.value)}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
