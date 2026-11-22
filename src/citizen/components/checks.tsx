import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleMinus, Clock, LoaderCircle, TriangleExclamationPoint, X } from 'lucide-react'
import type { CheckId, CheckOutcome, CheckResult } from '@/contract/types'
import { CHECKS, ENGINE } from '@/contract/seed'
import { cn, SimulatedValuesNote } from '@/ui'
import { C, fill } from '../copy'
import { useReduced, useTr } from '../hooks'

const tone: Record<CheckOutcome, { ring: string; icon: ReactNode }> = {
  pass: { ring: 'bg-success text-white', icon: <Check size={14} strokeWidth={3} /> },
  warn: { ring: 'bg-warning-soft text-warning', icon: <TriangleExclamationPoint size={14} strokeWidth={2.5} /> },
  fail: { ring: 'bg-danger-soft text-danger', icon: <X size={14} strokeWidth={3} /> },
  pending: { ring: 'bg-surface-2 text-muted', icon: <Clock size={14} strokeWidth={2.5} /> },
  skipped: { ring: 'bg-surface-2 text-muted', icon: <CircleMinus size={14} strokeWidth={2.5} /> },
}

export function ScoreBar({ score, min, label }: { score: number; min: number; label: string }) {
  const reduced = useReduced()
  const ok = score >= min
  const pct = Math.round(score * 100)
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] font-medium text-muted">
        <span>{label}</span>
        <span className="flex items-baseline gap-1.5"><SimulatedValuesNote /><span className={cn('tabular-nums', ok ? 'text-success' : 'text-danger')}>{score.toFixed(2)}</span></span>
      </div>
      <div
        className="relative mt-1 h-2 w-full rounded-full bg-surface-2"
        role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={score}
        aria-valuetext={`${score.toFixed(2)} / min ${min.toFixed(2)}`}
      >
        <motion.div
          className={cn('h-full rounded-full', ok ? 'bg-success' : 'bg-danger')}
          initial={{ width: reduced ? `${pct}%` : 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        />
        <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded bg-ink/60" style={{ left: `${min * 100}%` }} />
      </div>
    </div>
  )
}

/**
 * Live list of checks. `expected` gives the order of checks we are waiting for;
 * results already in `results` are shown with their outcome, the rest as "checking…" (if running).
 */
export function CheckList({
  expected, results, running, showDetail = true, compact = false,
}: {
  expected: CheckId[]; results: CheckResult[]; running: boolean; showDetail?: boolean; compact?: boolean
}) {
  const { tr } = useTr()
  const reduced = useReduced()
  const got = new Map(results.map(r => [r.id, r]))
  const order: CheckId[] = [...results.map(r => r.id), ...expected.filter(id => !got.has(id))]
  const firstWaiting = order.find(id => !got.has(id))

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      <AnimatePresence initial={false}>
        {order.map(id => {
          const r = got.get(id)
          const def = CHECKS[id]
          const isScored = r?.score !== undefined && (id === 'liveness' || id === 'face_match')
          const min = id === 'liveness' ? ENGINE.livenessMin : ENGINE.faceMatchMin
          const active = !r && running && id === firstWaiting
          return (
            <motion.li
              key={id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex gap-3', compact ? 'px-3 py-2.5' : 'px-4 py-3')}
            >
              <span className="mt-0.5">
                {r ? (
                  <motion.span
                    initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className={cn('grid size-6 place-items-center rounded-full', tone[r.outcome].ring)}
                  >
                    {tone[r.outcome].icon}
                  </motion.span>
                ) : active ? (
                  <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-brand">
                    <LoaderCircle size={14} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" />
                  </span>
                ) : (
                  <span className="grid size-6 place-items-center rounded-full border-2 border-dashed border-line" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className={cn('text-sm font-bold', r || active ? 'text-ink' : 'text-muted')}>{tr(def.label)}</span>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      !r ? 'text-muted' : r.outcome === 'pass' ? 'text-success' : r.outcome === 'fail' ? 'text-danger' : r.outcome === 'warn' ? 'text-warning' : 'text-muted',
                    )}
                  >
                    {r ? tr(C.outcome[r.outcome]) : active ? tr(C.running) : tr(C.outcome.pending)}
                  </span>
                </div>
                {r && showDetail && r.outcome !== 'fail' && <p className="mt-0.5 text-xs leading-snug text-muted">{tr(r.detail)}</p>}
                {!r && !compact && <p className="mt-0.5 text-xs leading-snug text-muted">{tr(def.explains)}</p>}
                {r && isScored && r.score !== undefined && (
                  <ScoreBar score={r.score} min={min} label={`${tr(C.score)} · ${fill(tr(C.threshold), { min: min.toFixed(2) })}`} />
                )}
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}

export function CheckListHeader({ title }: { title: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="font-display text-[18px] font-bold text-ink">{title}</h2>
    </div>
  )
}
