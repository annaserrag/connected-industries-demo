/* Local helpers for the officer console. Built on radix + kit tokens; no edits to src/ui. */
import type { ReactNode } from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import * as RTooltip from '@radix-ui/react-tooltip'
import { CircleCheck, CircleDashed, CircleMinus, CircleX, ShieldAlert, ShieldCheck, ShieldQuestion, TriangleAlert, X } from 'lucide-react'
import type { CheckOutcome, RiskLevel } from '@/contract/types'
import { SIMULATED_LABEL } from '@/contract/seed'
import { cn, SimulatedBadge } from '@/ui'
import { OUTCOME_LABEL, RISK_LABEL } from '../copy'
import { useTr } from '../lib'

/* ------------------------------------------------------------------ Kbd */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line border-b-2 bg-surface px-1 font-mono text-[10.5px] font-semibold leading-none text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/* -------------------------------------------------------------- LiveDot */
export function LiveDot({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold text-success', className)}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      {label}
    </span>
  )
}

/* ------------------------------------------------------------- Simulated */
export function Sim({ className }: { className?: string }) {
  const tr = useTr()
  return (
    <span className={className}>
      <SimulatedBadge label={tr(SIMULATED_LABEL)} />
    </span>
  )
}

/* -------------------------------------------------------------- Tooltip */
export function Tip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Root delayDuration={150}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-xs rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg"
        >
          {content}
          <RTooltip.Arrow className="fill-ink" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

/* --------------------------------------------------------------- Panel */
export function Panel({
  title, icon, hint, action, children, className, tone = 'default', id,
}: {
  title: ReactNode; icon?: ReactNode; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
  tone?: 'default' | 'danger' | 'warning' | 'sim'; id?: string
}) {
  const ring = { default: 'border-line', danger: 'border-danger/30', warning: 'border-warning/30', sim: 'border-sim/25' }[tone]
  const headId = id ? `${id}-title` : undefined
  return (
    <section aria-labelledby={headId} className={cn('rounded-2xl border bg-surface shadow-[0_1px_2px_rgba(16,16,20,0.04)]', ring, className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id={headId} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
            {icon && <span className="text-muted" aria-hidden>{icon}</span>}
            {title}
          </h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------- RiskTag */
export function RiskTag({ risk, size = 'md' }: { risk: RiskLevel; size?: 'sm' | 'md' }) {
  const tr = useTr()
  const Icon = risk === 'high' ? ShieldAlert : risk === 'medium' ? ShieldQuestion : ShieldCheck
  const tone = {
    high: 'bg-danger-soft text-danger ring-danger/20',
    medium: 'bg-warning-soft text-warning ring-warning/20',
    low: 'bg-success-soft text-success ring-success/20',
  }[risk]
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset', tone, size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs')}>
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
      {tr(RISK_LABEL[risk])}
    </span>
  )
}

/* ----------------------------------------------------------- CheckIcon */
export function CheckIcon({ outcome, className }: { outcome: CheckOutcome; className?: string }) {
  const tr = useTr()
  const map = {
    pass: [CircleCheck, 'text-success'],
    fail: [CircleX, 'text-danger'],
    warn: [TriangleAlert, 'text-warning'],
    pending: [CircleDashed, 'text-muted'],
    skipped: [CircleMinus, 'text-muted'],
  } as const
  const [Icon, color] = map[outcome]
  return <Icon className={cn('size-4 shrink-0', color, className)} aria-label={tr(OUTCOME_LABEL[outcome])} role="img" />
}

/* ------------------------------------------------------------ ScoreBar */
export function ScoreBar({ score, threshold, label }: { score: number; threshold: number; label: string }) {
  const tr = useTr()
  const ok = score >= threshold
  const pct = Math.round(score * 100)
  return (
    <div className="mt-2">
      <div
        className="relative h-2.5 rounded-full bg-surface-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={score}
        aria-label={`${label}: ${score.toFixed(2)} (${tr({ en: 'threshold', es: 'umbral' })} ${threshold.toFixed(2)})`}
      >
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-700', ok ? 'bg-success' : 'bg-danger')}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink" style={{ left: `calc(${threshold * 100}% - 1px)` }} aria-hidden />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted" aria-hidden>
        <span className={cn('font-semibold tabular-nums', ok ? 'text-success' : 'text-danger')}>{score.toFixed(2)}</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: `${threshold * 100}%` }}>
          ▲ {threshold.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Dialog */
export function Dialog({
  open, onOpenChange, title, description, children, footer, wide, dark,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode
  children: ReactNode; footer?: ReactNode; wide?: boolean; dark?: boolean
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] data-[state=open]:animate-[ofc-fade_.18s_ease-out]" />
        <RDialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl shadow-2xl outline-none data-[state=open]:animate-[ofc-pop_.2s_cubic-bezier(.2,.9,.3,1.2)]',
            wide ? 'max-w-3xl' : 'max-w-lg',
            dark ? 'bg-[#0f1117] text-white' : 'bg-surface text-ink',
          )}
        >
          <div className={cn('flex items-start justify-between gap-4 border-b px-6 pt-5 pb-4', dark ? 'border-white/10' : 'border-line')}>
            <div>
              <RDialog.Title className="text-lg font-semibold tracking-tight">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className={cn('mt-1 text-sm', dark ? 'text-white/65' : 'text-muted')}>{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close
              className={cn('rounded-lg p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand', dark ? 'text-white/70 hover:bg-white/10' : 'text-muted hover:bg-surface-2')}
              aria-label="Close"
            >
              <X className="size-4" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className={cn('flex items-center justify-end gap-2 border-t px-6 py-4', dark ? 'border-white/10' : 'border-line bg-canvas/60')}>{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/* ------------------------------------------------------- small buttons */
export function Btn({
  variant = 'secondary', size = 'md', className, children, kbd, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'dangerOutline'; size?: 'sm' | 'md' | 'lg'; kbd?: string
}) {
  const v = {
    primary: 'bg-brand text-brand-ink hover:brightness-110 shadow-sm',
    success: 'bg-success text-white hover:brightness-110 shadow-sm',
    secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
    ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
    danger: 'bg-danger text-white hover:brightness-110 shadow-sm',
    dangerOutline: 'bg-surface text-danger border border-danger/35 hover:bg-danger-soft',
  }[variant]
  const s = { sm: 'h-8 px-2.5 text-[13px] gap-1.5', md: 'h-10 px-3.5 text-sm gap-2', lg: 'h-11 px-4 text-[15px] gap-2' }[size]
  const onDark = variant === 'primary' || variant === 'success' || variant === 'danger'
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap transition outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:brightness-100',
        v, s, className,
      )}
      {...p}
    >
      {children}
      {kbd && <Kbd className={cn('ml-auto', onDark && 'border-white/30 bg-white/15 text-white')}>{kbd}</Kbd>}
    </button>
  )
}
