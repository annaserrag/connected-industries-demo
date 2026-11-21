import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, Building2, Clock3, RotateCcw, Scale } from 'lucide-react'
import { SIMULATED_DASHBOARD as D } from '@/contract/seed'
import { COPY } from './copy'
import { CountUp, Sim } from './components/parts'
import { useFmt, useTr } from './components/hooks'

function Tile({ icon, title, children, delay }: { icon: ReactNode; title: string; children: ReactNode; delay: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.article
      data-testid="kpi-tile"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
        <Sim />
      </div>
      <h3 className="mt-3 text-sm font-semibold leading-snug text-ink">{title}</h3>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </motion.article>
  )
}

export function Kpis() {
  const tr = useTr()
  const f = useFmt()
  const last = D.weeks.length - 1
  const pre = D.launchWeekIndex - 1
  const fNow = D.hoursToAdvanced.foreigners[last]
  const sNow = D.hoursToAdvanced.spaniards[last]
  const gapBefore = D.hoursToAdvanced.foreigners[pre] - D.hoursToAdvanced.spaniards[pre]
  const gapNow = fNow - sNow
  const h = tr(COPY.hoursShort)
  const officeNow = D.shareNeedingOfficePct[last]
  const officeBefore = D.shareNeedingOfficePct[pre]
  const { total, correctedAndApproved } = D.rejections
  const corrPct = (correctedAndApproved / total) * 100
  const A = D.appeals

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile icon={<Clock3 className="size-4" />} title={tr(COPY.kpiTimeTitle)} delay={0}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{tr(COPY.kpiLatestWeek)} · {D.weeks[last]}</p>
        <dl className="mt-2 grid grid-cols-2 items-end gap-3">
          <div>
            <dt className="text-xs text-muted">{tr(COPY.kpiTimeForeigners)}</dt>
            <dd className="text-3xl font-semibold tracking-tight text-ink">
              <CountUp value={fNow} format={v => `${f.num(v)} ${h}`} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{tr(COPY.kpiTimeSpaniards)}</dt>
            <dd className="text-3xl font-semibold tracking-tight text-ink">
              <CountUp value={sNow} format={v => `${f.num(v)} ${h}`} />
            </dd>
          </div>
        </dl>
        <p className="mt-auto flex items-center gap-1.5 pt-4 text-sm text-ink">
          <ArrowDownRight className="size-4 text-success" aria-hidden="true" />
          <span>
            {tr(COPY.kpiGapNow)} <strong className="tabular-nums">{f.num(gapNow)} {h}</strong>
            <span className="text-muted"> · {tr(COPY.kpiGapBefore).toLowerCase()} {f.num(gapBefore)} {h}</span>
          </span>
        </p>
      </Tile>

      <Tile icon={<Building2 className="size-4" />} title={tr(COPY.kpiOfficeTitle)} delay={0.06}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{tr(COPY.kpiLatestWeek)} · {D.weeks[last]}</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-ink">
          <CountUp value={officeNow} format={v => f.pct(v)} />
        </p>
        <p className="mt-auto flex items-center gap-1.5 pt-4 text-sm text-ink">
          <ArrowDownRight className="size-4 text-success" aria-hidden="true" />
          <span>
            {tr(COPY.kpiBefore)}: <strong className="tabular-nums">{f.pct(officeBefore)}</strong>
            <span className="text-muted"> · {f.num(officeBefore - officeNow)} {tr(COPY.kpiPoints)}</span>
          </span>
        </p>
      </Tile>

      <Tile icon={<RotateCcw className="size-4" />} title={tr(COPY.kpiCorrectedTitle)} delay={0.12}>
        <p className="text-4xl font-semibold tracking-tight text-ink">
          <CountUp value={Math.round(corrPct * 10) / 10} format={v => f.pct1(v)} />
        </p>
        <p className="mt-1 text-sm text-muted">
          <strong className="font-semibold text-ink tabular-nums">{f.num(correctedAndApproved)}</strong> {tr(COPY.kpiCorrectedOf)}{' '}
          <span className="tabular-nums">{f.num(total)}</span> {tr(COPY.kpiCorrectedRejections)}
        </p>
        <div className="mt-auto pt-4" aria-hidden="true">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand" style={{ width: `${corrPct}%` }} />
          </div>
        </div>
      </Tile>

      <Tile icon={<Scale className="size-4" />} title={tr(COPY.kpiAppealsTitle)} delay={0.18}>
        <p className="text-4xl font-semibold tracking-tight text-ink">
          <CountUp value={A.filed} format={v => f.num(v)} />
          <span className="ml-2 text-sm font-normal text-muted">{tr(COPY.appealsFiled).toLowerCase()}</span>
        </p>
        <dl className="mt-auto divide-y divide-line pt-3 text-sm">
          {[
            [COPY.appealsUpheld, A.upheld],
            [COPY.appealsDismissed, A.dismissed],
            [COPY.appealsOpen, A.open],
          ].map(([label, v]) => (
            <div key={tr(label as typeof COPY.appealsOpen)} className="flex items-baseline justify-between py-1">
              <dt className="text-muted">{tr(label as typeof COPY.appealsOpen)}</dt>
              <dd className="font-semibold text-ink tabular-nums">{f.num(v as number)}</dd>
            </div>
          ))}
        </dl>
      </Tile>
    </div>
  )
}
