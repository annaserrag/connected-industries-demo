import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, CircleAlert, Minus, X } from 'lucide-react'
import type { CheckOutcome } from '@/contract/types'
import { cn, useLang, useTr, SPRING, SPRING_POP } from './utils'

/* --------------------------------------------------------------- CheckTick */

/** Animated check mark in a filled circle (draws the stroke). Use for success moments. */
export const CheckTick = ({ size = 24, className, tone = 'success', delay = 0 }: {
  size?: number; className?: string; tone?: 'success' | 'brand'; delay?: number
}) => {
  const reduce = useReducedMotion()
  const fill = tone === 'success' ? 'var(--color-success)' : 'var(--color-brand)'
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden className={cn('shrink-0', className)}
      initial={reduce ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING_POP, delay }}
    >
      <circle cx="12" cy="12" r="12" fill={fill} />
      <motion.path
        d="M7 12.4l3.2 3.2L17.2 8.6"
        fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.38, ease: [0.65, 0, 0.35, 1], delay: delay + 0.12 }}
      />
    </motion.svg>
  )
}

/* ---------------------------------------------------------------- CountUp */

/** Number that counts up to `value` when it enters the viewport (instant under reduced motion). */
export const CountUp = ({ value, duration = 1.2, decimals = 0, prefix = '', suffix = '', className }: {
  value: number; duration?: number; decimals?: number; prefix?: string; suffix?: string; className?: string
}) => {
  const lang = useLang()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  const [n, setN] = useState(reduce ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduce) { setN(value); return }
    if (!inView) return
    const c = animate(from.current, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: v => setN(v) })
    from.current = value
    return () => c.stop()
  }, [value, inView, reduce, duration])
  const fmt = new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}{fmt.format(n)}{suffix}
    </span>
  )
}

/* --------------------------------------------------------------- ScoreBar */

/** Horizontal 0–1 score bar with a threshold marker, percentage text and pass/below label. */
export const ScoreBar = ({ value, threshold, label, className, showValue = true }: {
  value: number; threshold?: number; label?: string; className?: string; showValue?: boolean
}) => {
  const tr = useTr()
  const reduce = useReducedMotion()
  const ok = threshold == null || value >= threshold
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          {label && <span className="font-medium text-muted">{label}</span>}
          {showValue && (
            <span className={cn('shrink-0 whitespace-nowrap font-semibold tabular-nums', ok ? 'text-success' : 'text-danger')}>
              {pct}%{threshold != null && <span className="font-medium text-muted"> / {tr('min', 'mín.')} {Math.round(threshold * 100)}%</span>}
            </span>
          )}
        </div>
      )}
      <div
        className="relative h-2 w-full overflow-visible rounded-full bg-surface-2 ring-1 ring-inset ring-ink/5"
        role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}
      >
        <motion.div
          className={cn('h-full rounded-full', ok ? 'bg-success' : 'bg-danger')}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        {threshold != null && (
          <span
            aria-hidden
            className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink/70"
            style={{ left: `calc(${threshold * 100}% - 1px)` }}
          />
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- CheckRow */

const outcomeMeta: Record<CheckOutcome, { en: string; es: string; cls: string }> = {
  pending: { en: 'Checking…', es: 'Comprobando…', cls: 'text-brand' },
  pass: { en: 'Passed', es: 'Superada', cls: 'text-success' },
  fail: { en: 'Failed', es: 'No superada', cls: 'text-danger' },
  warn: { en: 'Needs a look', es: 'Revisar', cls: 'text-warning' },
  skipped: { en: 'Not needed', es: 'No necesaria', cls: 'text-muted' },
}

/** Icon for a check outcome (spinner ring / drawn tick / cross / alert / dash). */
export const OutcomeIcon = ({ outcome, size = 28 }: { outcome: CheckOutcome; size?: number }) => {
  const reduce = useReducedMotion()
  const pop = { initial: reduce ? false : { scale: 0.3, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.6, opacity: 0 }, transition: SPRING_POP } as const
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden>
      <AnimatePresence mode="popLayout" initial={false}>
        {outcome === 'pending' && (
          <motion.span key="p" {...pop} className="absolute inset-0">
            <svg viewBox="0 0 28 28" className="size-full motion-safe:animate-spin [animation-duration:1.1s]">
              <circle cx="14" cy="14" r="11" fill="none" stroke="var(--color-brand-soft)" strokeWidth="3" />
              <path d="M14 3a11 11 0 0 1 11 11" fill="none" stroke="var(--color-brand)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </motion.span>
        )}
        {outcome === 'pass' && <motion.span key="ok" {...pop} className="absolute inset-0"><CheckTick size={size} /></motion.span>}
        {outcome === 'fail' && (
          <motion.span key="f" {...pop} className="absolute inset-0 grid place-items-center rounded-full bg-danger text-white"><X className="size-[60%]" strokeWidth={3} /></motion.span>
        )}
        {outcome === 'warn' && (
          <motion.span key="w" {...pop} className="absolute inset-0 grid place-items-center rounded-full bg-warning text-white"><CircleAlert className="size-[62%]" strokeWidth={2.6} /></motion.span>
        )}
        {outcome === 'skipped' && (
          <motion.span key="s" {...pop} className="absolute inset-0 grid place-items-center rounded-full bg-surface-2 text-muted ring-1 ring-inset ring-line-strong/40"><Minus className="size-[55%]" strokeWidth={3} /></motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/**
 * One verification check: outcome icon + label + outcome word + optional detail, simulated badge
 * and score bar. Animates when the outcome changes (e.g. pending → pass).
 */
export const CheckRow = ({ label, outcome, detail, score, threshold, icon, trailing, className, compact }: {
  label: ReactNode; outcome: CheckOutcome; detail?: ReactNode; score?: number; threshold?: number
  /** Optional leading icon shown before the label (e.g. a lucide icon for the check type). */
  icon?: ReactNode
  /** Right side slot (e.g. <SimulatedBadge/>). */
  trailing?: ReactNode
  className?: string; compact?: boolean
}) => {
  const tr = useTr()
  const reduce = useReducedMotion()
  const m = outcomeMeta[outcome]
  const settled = outcome !== 'pending'
  return (
    <motion.div
      layout={reduce ? false : 'position'}
      className={cn(
        'relative flex gap-3 rounded-[14px] transition-colors duration-300',
        compact ? 'py-2' : 'p-3.5',
        !compact && (outcome === 'fail' ? 'bg-danger-soft/60' : outcome === 'warn' ? 'bg-warning-soft/60' : 'bg-surface'),
        className,
      )}
    >
      <OutcomeIcon outcome={outcome} size={compact ? 22 : 28} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {icon && <span className="text-muted [&_svg]:size-4" aria-hidden>{icon}</span>}
          <span className={cn('font-semibold text-ink', compact ? 'text-sm' : 'text-[15px]')}>{label}</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={outcome}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className={cn('text-xs font-semibold', m.cls)}
            >
              {tr(m.en, m.es)}
            </motion.span>
          </AnimatePresence>
          {trailing && <span className="ml-auto">{trailing}</span>}
        </div>
        <AnimatePresence initial={false}>
          {settled && (detail || score != null) && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={SPRING}
              className="overflow-hidden"
            >
              {detail && <p className="mt-0.5 text-[13px] leading-snug text-muted">{detail}</p>}
              {score != null && <ScoreBar value={score} threshold={threshold} className="mt-2 max-w-[320px]" />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ----------------------------------------------------------------- Stepper */

export type StepState = 'done' | 'current' | 'upcoming' | 'error' | 'warning'
export interface StepItem {
  id?: string
  label: ReactNode
  description?: ReactNode
  /** Overrides the state derived from `current`. */
  state?: StepState
}

/** Steps with done / current / upcoming (and error / warning) states. Horizontal or vertical; animated connector fill. */
export const Stepper = ({ steps, current = 0, orientation = 'horizontal', className, ariaLabel }: {
  steps: StepItem[]; current?: number; orientation?: 'horizontal' | 'vertical'; className?: string; ariaLabel?: string
}) => {
  const tr = useTr()
  const reduce = useReducedMotion()
  const states: StepState[] = steps.map((s, i) => s.state ?? (i < current ? 'done' : i === current ? 'current' : 'upcoming'))
  const word = (s: StepState) => ({
    done: tr('completed', 'completado'), current: tr('current step', 'paso actual'), upcoming: tr('not started', 'pendiente'),
    error: tr('problem', 'problema'), warning: tr('action needed', 'requiere acción'),
  })[s]

  const dot = (s: StepState, i: number) => (
    <span className="relative grid size-8 shrink-0 place-items-center" aria-hidden>
      {s === 'current' && !reduce && (
        <span className="absolute inset-0 rounded-full bg-brand/25 motion-safe:animate-pulse-ring" />
      )}
      <motion.span
        key={s}
        initial={reduce ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={SPRING_POP}
        className={cn(
          'relative grid size-8 place-items-center rounded-full text-[13px] font-bold',
          s === 'done' && 'bg-success text-white',
          s === 'current' && 'bg-brand text-brand-ink shadow-brand',
          s === 'upcoming' && 'bg-surface text-muted ring-[1.5px] ring-inset ring-line-strong/60',
          s === 'error' && 'bg-danger text-white',
          s === 'warning' && 'bg-warning text-white',
        )}
      >
        {s === 'done' ? <Check className="size-4" strokeWidth={3} /> : s === 'error' ? <X className="size-4" strokeWidth={3} /> : s === 'warning' ? <CircleAlert className="size-4" strokeWidth={2.6} /> : i + 1}
      </motion.span>
    </span>
  )

  if (orientation === 'vertical') {
    return (
      <ol className={cn('relative', className)} aria-label={ariaLabel}>
        {steps.map((s, i) => {
          const st = states[i]
          const last = i === steps.length - 1
          const filled = st === 'done'
          return (
            <li key={s.id ?? i} className="relative flex gap-3.5 pb-6 last:pb-0" aria-current={st === 'current' ? 'step' : undefined}>
              {!last && (
                <span aria-hidden className="absolute top-9 bottom-1 left-[15px] w-[2px] overflow-hidden rounded-full bg-line">
                  <motion.span
                    className="block w-full rounded-full bg-success"
                    initial={false}
                    animate={{ height: filled ? '100%' : '0%' }}
                    transition={{ duration: reduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
              )}
              {dot(st, i)}
              <div className="min-w-0 pt-1">
                <p className={cn('text-[15px] leading-snug font-semibold', st === 'upcoming' ? 'text-muted' : 'text-ink')}>
                  {s.label}<span className="sr-only"> — {word(st)}</span>
                </p>
                {s.description && <div className="mt-1 text-sm leading-relaxed text-muted">{s.description}</div>}
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className={cn('flex w-full items-start', className)} aria-label={ariaLabel}>
      {steps.map((s, i) => {
        const st = states[i]
        const last = i === steps.length - 1
        return (
          <li key={s.id ?? i} className="relative flex min-w-0 flex-1 flex-col items-center text-center" aria-current={st === 'current' ? 'step' : undefined}>
            {!last && (
              <span aria-hidden className="absolute top-[15px] h-[2px] overflow-hidden rounded-full bg-line" style={{ left: 'calc(50% + 22px)', right: 'calc(-50% + 22px)' }}>
                <motion.span
                  className="block h-full rounded-full bg-success"
                  initial={false}
                  animate={{ width: st === 'done' ? '100%' : '0%' }}
                  transition={{ duration: reduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            )}
            {dot(st, i)}
            <span className={cn('mt-2 max-w-[11ch] text-xs leading-tight font-semibold', st === 'upcoming' ? 'text-muted' : 'text-ink')}>
              {s.label}<span className="sr-only"> — {word(st)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
