import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle, ArrowUpRight, CheckCircle2, CircleDashed, CircleDot, FlaskConical, Inbox, Landmark,
  Loader2, ScrollText, ShieldAlert, ShieldCheck, Shield, XCircle, MessageSquareMore,
} from 'lucide-react'
import type { RiskLevel, RouteId, StatusId } from '@/contract/types'
import { POLICY_PROPOSAL_LABEL, ROUTES, SIMULATED_LABEL, STATUSES } from '@/contract/seed'
import { cn, useTr, SPRING_POP } from './utils'

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Render the child element (e.g. a router <Link>) with button styles. */
  asChild?: boolean
  /** Shows a spinner and disables the button. */
  loading?: boolean
  /** Icon element shown before the label. */
  icon?: ReactNode
  /** Icon element shown after the label. */
  iconRight?: ReactNode
  /** Stretch to full width. */
  block?: boolean
}

const btnVariant: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-ink shadow-brand hover:bg-brand-strong',
  secondary: 'bg-surface text-ink shadow-card hover:bg-surface-2',
  ghost: 'text-ink hover:bg-ink/[0.05]',
  danger: 'bg-danger text-white shadow-[0_6px_16px_-6px_rgb(176_36_28/0.55)] hover:bg-[#951d16]',
  soft: 'bg-brand-soft text-brand hover:bg-brand-tint/70',
}
const btnSize: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-[10px]',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-[12px]',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-[14px]',
}

/** Button with primary / secondary / ghost / danger / soft variants; supports `asChild`, `loading`, icons. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', asChild, loading, icon, iconRight, block, className, children, disabled, ...p },
  ref,
) {
  const Comp = asChild ? Slot : 'button'
  const cls = cn(
    'relative inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.005em]',
    'transition-[background-color,box-shadow,transform,color] duration-150 ease-out active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    btnVariant[variant], btnSize[size], block && 'w-full', className,
  )
  if (asChild) return <Comp ref={ref} className={cls} {...p}>{children}</Comp>
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...p}>
      {loading ? <Loader2 className="size-[1.1em] animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  )
})

/* -------------------------------------------------------------------- Card */

type Box = { className?: string; children?: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>

/** Surface card: white, 18px radius, layered hairline shadow. `interactive` adds hover lift. */
export const Card = ({ className, children, interactive, ...p }: Box & { interactive?: boolean }) => (
  <div
    className={cn(
      'rounded-card bg-surface shadow-card',
      interactive && 'transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-raised',
      className,
    )}
    {...p}
  >
    {children}
  </div>
)
/** Card header block (padding + optional actions row). */
export const CardHeader = ({ className, children, ...p }: Box) => (
  <div className={cn('flex flex-col gap-1 px-5 pt-5 pb-3', className)} {...p}>{children}</div>
)
/** Card title (h3, semibold). */
export const CardTitle = ({ className, children }: { className?: string; children?: ReactNode }) => (
  <h3 className={cn('text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink', className)}>{children}</h3>
)
/** Muted description under a CardTitle. */
export const CardDescription = ({ className, children }: { className?: string; children?: ReactNode }) => (
  <p className={cn('text-sm leading-relaxed text-muted', className)}>{children}</p>
)
/** Card body block. */
export const CardContent = ({ className, children, ...p }: Box) => (
  <div className={cn('px-5 pb-5', className)} {...p}>{children}</div>
)
/** Card footer row with a hairline separator. */
export const CardFooter = ({ className, children, ...p }: Box) => (
  <div className={cn('flex items-center gap-2 border-t border-line px-5 py-3.5', className)} {...p}>{children}</div>
)

/* ------------------------------------------------------------------- Badge */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
const toneCls: Record<Tone | 'sim' | 'brand', string> = {
  neutral: 'bg-surface-2 text-muted ring-ink/8',
  info: 'bg-info-soft text-info ring-info/15',
  success: 'bg-success-soft text-success ring-success/15',
  warning: 'bg-warning-soft text-warning ring-warning/15',
  danger: 'bg-danger-soft text-danger ring-danger/15',
  sim: 'bg-sim-soft text-sim ring-sim/20',
  brand: 'bg-brand text-brand-ink ring-transparent',
}

/** Small pill label. Pair tone with an icon or words — never colour alone. */
export const Badge = ({ tone = 'neutral', children, className, icon, size = 'sm' }: {
  tone?: Tone; children?: ReactNode; className?: string; icon?: ReactNode; size?: 'sm' | 'md'
}) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ring-1 ring-inset whitespace-nowrap',
      size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[13px]',
      '[&_svg]:size-3.5',
      toneCls[tone], className,
    )}
  >
    {icon}
    {children}
  </span>
)

/** The "Simulated" pill (violet, flask icon). Put it on every simulated thing. */
export const SimulatedBadge = ({ label, className }: { label?: string; className?: string }) => {
  const tr = useTr()
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
        toneCls.sim, className,
      )}
      title={tr('Nothing here is real: this check is simulated for the prototype.', 'Nada de esto es real: esta comprobación está simulada para el prototipo.')}
    >
      <FlaskConical className="size-3.5" aria-hidden />
      {label ?? tr(SIMULATED_LABEL)}
    </span>
  )
}

/** The "Policy proposal" pill (warning tone, scroll icon) for the red-card route and rule changes. */
export const PolicyBadge = ({ className }: { className?: string }) => {
  const tr = useTr()
  return (
    <Badge tone="warning" icon={<ScrollText aria-hidden />} className={className}>
      {tr(POLICY_PROPOSAL_LABEL)}
    </Badge>
  )
}

const statusMeta: Record<StatusId | 'draft', { tone: Tone; icon: ReactNode }> = {
  draft: { tone: 'neutral', icon: <CircleDashed aria-hidden /> },
  received: { tone: 'info', icon: <Inbox aria-hidden /> },
  checking: { tone: 'info', icon: <Loader2 aria-hidden className="animate-spin [animation-duration:2.2s]" /> },
  need_info: { tone: 'warning', icon: <MessageSquareMore aria-hidden /> },
  approved: { tone: 'success', icon: <CheckCircle2 aria-hidden /> },
  not_approved: { tone: 'danger', icon: <XCircle aria-hidden /> },
}

/** Citizen status pill (the five reference-sheet statuses + draft), icon + label. Animates on change. */
export const StatusPill = ({ status, className, size }: { status: StatusId | 'draft'; className?: string; size?: 'sm' | 'md' }) => {
  const tr = useTr()
  const reduce = useReducedMotion()
  const m = statusMeta[status]
  const label = status === 'draft' ? tr('Not started', 'Sin empezar') : tr(STATUSES[status].label)
  return (
    <motion.span
      key={status}
      initial={reduce ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING_POP}
      className="inline-flex"
    >
      <Badge tone={m.tone} icon={m.icon} className={className} size={size}>{label}</Badge>
    </motion.span>
  )
}

/** Risk level badge: low / medium / high with shield icon + word. */
export const RiskBadge = ({ risk, className }: { risk: RiskLevel; className?: string }) => {
  const tr = useTr()
  const m = {
    low: { tone: 'success' as Tone, icon: <ShieldCheck aria-hidden />, l: tr('Low risk', 'Riesgo bajo') },
    medium: { tone: 'warning' as Tone, icon: <Shield aria-hidden />, l: tr('Medium risk', 'Riesgo medio') },
    high: { tone: 'danger' as Tone, icon: <ShieldAlert aria-hidden />, l: tr('High risk', 'Riesgo alto') },
  }[risk]
  return <Badge tone={m.tone} icon={m.icon} className={className}>{m.l}</Badge>
}

/** Route badge: square code chip + route name (set `compact` for code only). */
export const RouteBadge = ({ route, compact, className }: { route: RouteId; compact?: boolean; className?: string }) => {
  const tr = useTr()
  const r = ROUTES[route]
  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-soft py-0.5 pr-2.5 pl-0.5 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/15', compact && 'pr-0.5', className)}
      title={tr(r.name)}
    >
      <span className={cn('grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-ink', route === 'FALLBACK' && 'px-2')}>
        {route === 'FALLBACK' ? tr('Fallback', 'Alternativa') : r.code}
      </span>
      {!compact && <span className="truncate">{tr(r.name)}</span>}
      {compact && <span className="sr-only">{tr(r.name)}</span>}
    </span>
  )
}

/* ------------------------------------------------------------------ Avatar */

/** Generated avatar (initials on a hue gradient) — never a photo. */
export const Avatar = ({ initials, hue, size = 40, className, ring }: {
  initials: string; hue: number; size?: number; className?: string; ring?: boolean
}) => (
  <span
    aria-hidden
    className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold', ring && 'ring-2 ring-surface', className)}
    style={{
      width: size, height: size, fontSize: Math.max(10, size * 0.36),
      background: `radial-gradient(120% 120% at 25% 15%, hsl(${hue} 85% 92%) 0%, hsl(${hue} 60% 80%) 60%, hsl(${(hue + 30) % 360} 55% 72%) 100%)`,
      color: `hsl(${hue} 55% 22%)`,
      letterSpacing: '-0.02em',
    }}
  >
    {initials.slice(0, 2).toUpperCase()}
  </span>
)

/* ----------------------------------------------------------- small pieces */

/** Inline loading spinner with an accessible label. */
export const Spinner = ({ size = 16, className, label }: { size?: number; className?: string; label?: string }) => {
  const tr = useTr()
  return (
    <span role="status" className={cn('inline-flex text-current', className)}>
      <Loader2 style={{ width: size, height: size }} className="animate-spin" aria-hidden />
      <span className="sr-only">{label ?? tr('Loading', 'Cargando')}</span>
    </span>
  )
}

/** Keyboard key hint. */
export const Kbd = ({ children, className }: { children: ReactNode; className?: string }) => (
  <kbd className={cn('inline-grid h-5 min-w-5 place-items-center rounded-[6px] border border-line bg-surface px-1.5 font-sans text-[11px] font-semibold text-muted shadow-[inset_0_-1px_0_var(--color-line)]', className)}>
    {children}
  </kbd>
)

/** Shimmering placeholder block. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={cn('animate-shimmer rounded-[10px] bg-[length:200%_100%]', className)}
    style={{ backgroundImage: 'linear-gradient(90deg, var(--color-surface-2) 0%, #faf8f4 50%, var(--color-surface-2) 100%)' }}
  />
)

/** Pulsing "Live" dot with optional label (for synced views). */
export const LiveDot = ({ label, tone = 'success', className }: { label?: string | false; tone?: 'success' | 'danger' | 'brand'; className?: string }) => {
  const tr = useTr()
  const c = { success: 'bg-[#16a35a]', danger: 'bg-danger', brand: 'bg-brand' }[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', className)}>
      <span className="relative inline-flex size-2.5" aria-hidden>
        <span className={cn('absolute inset-0 rounded-full motion-safe:animate-pulse-ring', c)} />
        <span className={cn('relative inline-flex size-2.5 rounded-full', c)} />
      </span>
      {label !== false && <span>{label ?? tr('Live', 'En directo')}</span>}
    </span>
  )
}

/** Thin labelled divider. */
export const Divider = ({ label, className }: { label?: string; className?: string }) => (
  <div role="separator" className={cn('flex items-center gap-3 text-xs font-medium text-muted', className)}>
    <span className="h-px flex-1 bg-line" />
    {label && <span>{label}</span>}
    {label && <span className="h-px flex-1 bg-line" />}
  </div>
)

/** Callout box for notes, warnings and rules (icon + title + body). */
export const Callout = ({ tone = 'info', title, children, icon, className }: {
  tone?: Tone | 'sim'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string
}) => {
  const defaultIcon = {
    neutral: <CircleDot aria-hidden />, info: <Landmark aria-hidden />, success: <CheckCircle2 aria-hidden />,
    warning: <AlertTriangle aria-hidden />, danger: <XCircle aria-hidden />, sim: <FlaskConical aria-hidden />,
  }[tone]
  const bg = { neutral: 'bg-surface-2', info: 'bg-info-soft', success: 'bg-success-soft', warning: 'bg-warning-soft', danger: 'bg-danger-soft', sim: 'bg-sim-soft' }[tone]
  const fg = { neutral: 'text-muted', info: 'text-info', success: 'text-success', warning: 'text-warning', danger: 'text-danger', sim: 'text-sim' }[tone]
  return (
    <div className={cn('flex gap-3 rounded-[14px] p-4 text-sm leading-relaxed text-ink', bg, className)}>
      <span className={cn('mt-0.5 shrink-0 [&_svg]:size-[18px]', fg)}>{icon ?? defaultIcon}</span>
      <div className="min-w-0 space-y-1">
        {title && <p className={cn('font-semibold', fg)}>{title}</p>}
        {children && <div className="text-ink/90">{children}</div>}
      </div>
    </div>
  )
}

/** External-looking text link styled with the accent (for "learn more"). */
export const TextLink = ({ className, children, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a className={cn('inline-flex items-center gap-0.5 font-semibold text-brand underline decoration-brand/30 underline-offset-[3px] hover:decoration-brand', className)} {...p}>
    {children}
    <ArrowUpRight className="size-3.5" aria-hidden />
  </a>
)
