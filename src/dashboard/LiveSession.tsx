import { useMemo } from 'react'
import { CheckCircle2, Hourglass, RotateCcw, UserCheck, Users } from 'lucide-react'
import { useClave } from '@/core/store'
import { STATUSES, STATUS_ORDER } from '@/contract/seed'
import type { StatusId } from '@/contract/types'
import { COPY } from './copy'
import { useFmt, useTr } from './components/hooks'
import { SectionHeading } from './components/parts'

const OFFICER_DECISION_ACTIONS = new Set(['officer_approved_basic', 'officer_approved_advanced', 'officer_refused', 'officer_revoked'])

function LivePill({ label }: { label: string }) {
  return (
    <span data-testid="demo-badge" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink">
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      {label}
    </span>
  )
}

export function LiveSession() {
  const tr = useTr()
  const f = useFmt()
  const cases = useClave(s => s.cases)
  const audit = useClave(s => s.audit)

  const stats = useMemo(() => {
    const list = Object.values(cases)
    const byStatus: Record<StatusId | 'draft', number> = { draft: 0, received: 0, checking: 0, need_info: 0, approved: 0, not_approved: 0 }
    for (const c of list) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
    const auto = new Set<string>()
    const officer = new Set<string>()
    for (const e of audit) {
      if (!e.caseId) continue
      if (e.action === 'auto_approved_basic') auto.add(e.caseId)
      if (OFFICER_DECISION_ACTIONS.has(e.action)) officer.add(e.caseId)
    }
    // Also count decisions recorded on the case itself (in case audit was trimmed).
    for (const c of list) {
      for (const d of c.decisions) {
        if (d.by.kind === 'system') auto.add(c.id)
        if (d.by.kind === 'officer') officer.add(c.id)
      }
    }
    return {
      total: list.length,
      byStatus,
      auto: auto.size,
      officer: officer.size,
      awaiting: list.filter(c => c.awaitingOfficer).length,
      corrected: list.filter(c => c.correctedAfterRefusal).length,
    }
  }, [cases, audit])

  const tiles = [
    { icon: Users, label: tr(COPY.liveTotal), value: stats.total },
    { icon: CheckCircle2, label: tr(COPY.liveAuto), value: stats.auto },
    { icon: UserCheck, label: tr(COPY.liveOfficer), value: stats.officer },
    { icon: Hourglass, label: tr(COPY.liveAwaiting), value: stats.awaiting },
    { icon: RotateCcw, label: tr(COPY.liveCorrected), value: stats.corrected },
  ]
  const statusRows: Array<{ id: StatusId | 'draft'; label: string; step?: number }> = [
    { id: 'draft', label: tr(COPY.liveDraft) },
    ...STATUS_ORDER.map(id => ({ id, label: tr(STATUSES[id].label), step: STATUSES[id].step })),
  ]
  const maxStatus = Math.max(1, ...statusRows.map(r => stats.byStatus[r.id]))

  return (
    <section aria-labelledby="dash-live" data-testid="live-session">
      <SectionHeading id="dash-live" title={tr(COPY.liveSection)} aside={<LivePill label={tr(COPY.liveBadge)} />}>
        {tr(COPY.liveIntro)}
      </SectionHeading>
      <div className="grid gap-4 lg:grid-cols-5">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-3" aria-live="polite">
          {tiles.map(({ icon: Icon, label, value }, i) => (
            <li key={label} className={`rounded-2xl border border-dashed border-line bg-surface p-4 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
              <Icon className="size-4 text-muted" aria-hidden="true" />
              <p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">{f.num(value)}</p>
              <p className="mt-0.5 text-sm leading-snug text-muted">{label}</p>
            </li>
          ))}
          <li className="col-span-2 flex items-center rounded-2xl bg-surface-2 p-4 text-sm leading-snug text-muted sm:col-span-1">
            {tr(COPY.liveUpdated)}. {tr(COPY.liveBadge)}: {tr(COPY.liveNotPart)}
          </li>
        </ul>
        <div className="rounded-2xl border border-dashed border-line bg-surface p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-ink">{tr(COPY.liveByStatus)}</h3>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">{tr(COPY.liveByStatus)}</caption>
            <tbody>
              {statusRows.map(r => (
                <tr key={r.id} className="align-middle">
                  <th scope="row" className="w-[52%] py-1.5 pr-3 text-left font-normal text-ink">
                    {r.step && <span className="mr-1.5 text-xs font-semibold text-muted tabular-nums">{r.step}.</span>}
                    {r.label}
                  </th>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-ink/70 transition-[width] duration-500 motion-reduce:transition-none"
                          style={{ width: `${(stats.byStatus[r.id] / maxStatus) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-semibold text-ink tabular-nums">{f.num(stats.byStatus[r.id])}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
