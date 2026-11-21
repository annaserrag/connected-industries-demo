import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { Table2 } from 'lucide-react'
import { cn } from '@/ui'
import { COPY } from '../copy'
import { useTr } from './hooks'

/** Formerly the "Simulated" pill; the public statistics page no longer labels cards (the About page discloses it). */
export function Sim() {
  return null
}

/** Animated number. Renders the final value immediately for reduced motion and for assistive tech. */
export function CountUp({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(reduce ? value : 0)
  const fromRef = useRef(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setShown(value)
      fromRef.current = value
      return
    }
    const decimals = Number.isInteger(value) ? 0 : 1
    const ctl = animate(fromRef.current, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setShown(Number(v.toFixed(decimals))),
    })
    fromRef.current = value
    return () => ctl.stop()
  }, [value, reduce])

  return (
    <span className={cn('tabular-nums', className)}>
      <span aria-hidden="true" ref={ref}>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}

export interface TableSpec {
  caption: string
  columns: string[]
  rows: Array<Array<string | number>>
}

export function DataTable({ spec, id, visible }: { spec: TableSpec; id: string; visible: boolean }) {
  return (
    <div id={id} className={cn(visible ? 'mt-4 overflow-x-auto rounded-[2px] border border-line' : 'sr-only')}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className={cn(visible ? 'px-3 pt-3 pb-1 text-left text-xs font-medium text-muted' : '')}>{spec.caption}</caption>
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {spec.columns.map((c, i) => (
              <th key={c} scope="col" className={cn('px-3 py-2 font-bold text-ink', i > 0 && 'text-right')}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line last:border-0">
              {r.map((cell, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row" className="px-3 py-1.5 font-medium text-ink">{cell}</th>
                ) : (
                  <td key={ci} className="px-3 py-1.5 text-right tabular-nums text-ink">{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Card wrapper for a simulated chart: title, takeaway, Simulated badge, chart (role=img) and a data-table toggle. */
export function ChartCard({
  title,
  takeaway,
  summary,
  table,
  legend,
  height = 260,
  className,
  children,
}: {
  title: string
  takeaway: string
  /** Accessible one-sentence description of the chart. */
  summary: string
  table: TableSpec
  legend?: ReactNode
  height?: number
  className?: string
  children: ReactNode
}) {
  const tr = useTr()
  const [open, setOpen] = useState(false)
  const id = useId()
  const titleId = `${id}-title`
  const tableId = `${id}-table`
  return (
    <section
      data-testid="chart-card"
      aria-labelledby={titleId}
      className={cn('flex flex-col rounded-[2px] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6', className)}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={titleId} className="text-base font-bold leading-snug text-ink sm:text-[17px]">{title}</h3>
        <Sim />
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{takeaway}</p>
      {legend && <div className="mt-4">{legend}</div>}
      <div role="img" aria-label={summary} className="mt-4 w-full min-w-0" style={{ height }}>
        {children}
      </div>
      <div className="mt-auto pt-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={tableId}
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Table2 className="size-4" aria-hidden="true" />
          {open ? tr(COPY.hideTable) : tr(COPY.showTable)}
        </button>
        <DataTable spec={table} id={tableId} visible={open} />
      </div>
    </section>
  )
}

/** Legend item: swatch + text (identity never by colour alone: swatch also shows the line style). */
export function LegendItem({ color, label, dashed, hatch }: { color: string; label: string; dashed?: boolean; hatch?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink">
      <svg width="22" height="12" aria-hidden="true" className="shrink-0">
        {hatch ? (
          <>
            <defs>
              <pattern id={`lg-hatch-${color.replace(/[^a-z0-9]/gi, '')}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="4" fill="transparent" />
                <line x1="0" y1="0" x2="0" y2="4" stroke={color} strokeWidth="2" />
              </pattern>
            </defs>
            <rect x="1" y="1" width="20" height="10" rx="3" fill={`url(#lg-hatch-${color.replace(/[^a-z0-9]/gi, '')})`} stroke={color} strokeWidth="1" />
          </>
        ) : dashed !== undefined ? (
          <line x1="1" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2.5" strokeDasharray={dashed ? '4 3' : undefined} strokeLinecap="round" />
        ) : (
          <rect x="1" y="1" width="20" height="10" rx="3" fill={color} />
        )}
      </svg>
      {label}
    </span>
  )
}

export function SectionHeading({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <h2 id={id} className="text-xl font-bold tracking-tight text-ink sm:text-2xl" style={{ fontFamily: 'var(--font-display, inherit)' }}>
          {title}
        </h2>
        {children && <p className="mt-1.5 text-sm leading-relaxed text-muted sm:text-[15px]">{children}</p>}
      </div>
      {aside && <div className="shrink-0 self-start sm:self-end">{aside}</div>}
    </div>
  )
}
