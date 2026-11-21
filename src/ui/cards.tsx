/**
 * Cards in the style of the Cl@ve gateway (method cards) and clave.gob.es (info cards), plus our own
 * simple inline illustrations (no stock photos, no official imagery).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './utils'

/* --------------------------------------------------------- illustrations */

export type IllustrationName =
  | 'id-card' | 'people' | 'documents' | 'phone-steps' | 'password' | 'new-account' | 'office' | 'citizen' | 'chart' | 'shield'

const O = 'var(--color-brand)'
const K = 'var(--color-ink)'
const T = 'var(--color-brand-tint)'
const W = '#ffffff'

/** Simple flat illustration (decorative, aria-hidden). viewBox 160×96. */
export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  const common = { fill: 'none', stroke: K, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const art: Record<IllustrationName, ReactNode> = {
    'id-card': (
      <>
        <rect x="38" y="20" width="84" height="56" rx="4" {...common} fill={W} />
        <rect x="38" y="20" width="84" height="12" rx="4" fill={O} stroke="none" />
        <circle cx="60" cy="50" r="9" {...common} fill={T} />
        <path d="M50 68c2-6 18-6 20 0" {...common} />
        <path d="M78 46h32M78 55h24M78 64h28" {...common} />
      </>
    ),
    people: (
      <>
        <circle cx="58" cy="36" r="11" {...common} fill={T} />
        <path d="M38 76c2-14 38-14 40 0" {...common} fill={W} />
        <circle cx="102" cy="36" r="11" fill={O} stroke={K} strokeWidth={2.2} />
        <path d="M82 76c2-14 38-14 40 0" {...common} fill={W} />
        <circle cx="80" cy="46" r="8" {...common} fill={W} />
        <path d="M66 76c1-10 27-10 28 0" {...common} fill={T} />
      </>
    ),
    documents: (
      <>
        <rect x="44" y="24" width="44" height="58" rx="3" {...common} fill={W} transform="rotate(-8 66 53)" />
        <rect x="72" y="18" width="46" height="60" rx="3" {...common} fill={W} />
        <rect x="72" y="18" width="46" height="14" rx="3" fill={O} stroke="none" />
        <rect x="80" y="40" width="14" height="11" rx="2" {...common} fill={T} />
        <path d="M100 42h10M100 49h8M80 60h30M80 67h22" {...common} />
      </>
    ),
    'phone-steps': (
      <>
        <rect x="60" y="12" width="40" height="72" rx="6" {...common} fill={W} />
        <path d="M74 18h12" {...common} />
        <circle cx="80" cy="42" r="12" {...common} fill={T} />
        <path d="M74 42l4 4 8-8" stroke={O} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M70 64h20M72 71h16" {...common} />
        <path d="M30 48h18M112 48h18" stroke={O} strokeWidth={2.2} strokeDasharray="3 5" strokeLinecap="round" />
      </>
    ),
    password: (
      <>
        <rect x="40" y="30" width="80" height="40" rx="4" {...common} fill={W} />
        {[54, 68, 82, 96].map(x => <circle key={x} cx={x} cy="50" r="4" fill={K} />)}
        <path d="M108 44v12" stroke={O} strokeWidth={3} strokeLinecap="round" />
        <circle cx="122" cy="26" r="9" fill={O} stroke={K} strokeWidth={2.2} />
        <path d="M122 35v14M122 43h5" {...common} />
      </>
    ),
    'new-account': (
      <>
        <rect x="42" y="16" width="64" height="66" rx="4" {...common} fill={W} />
        <circle cx="74" cy="38" r="10" {...common} fill={T} />
        <path d="M58 66c3-12 29-12 32 0" {...common} />
        <circle cx="112" cy="66" r="13" fill={O} stroke={K} strokeWidth={2.2} />
        <path d="M112 59v14M105 66h14" stroke={W} strokeWidth={3} strokeLinecap="round" />
      </>
    ),
    office: (
      <>
        <path d="M44 40l36-20 36 20" {...common} fill={T} />
        <path d="M44 40h72" {...common} />
        {[54, 70, 86, 102].map(x => <path key={x} d={`M${x} 46v26`} {...common} />)}
        <path d="M40 78h80" {...common} />
        <rect x="74" y="27" width="12" height="7" rx="1" fill={O} stroke="none" />
      </>
    ),
    citizen: (
      <>
        <rect x="64" y="14" width="34" height="62" rx="5" {...common} fill={W} />
        <circle cx="81" cy="38" r="8" {...common} fill={T} />
        <path d="M72 56c2-8 16-8 18 0" {...common} />
        <circle cx="52" cy="50" r="10" fill={O} stroke={K} strokeWidth={2.2} />
        <path d="M36 84c2-14 30-14 32 0" {...common} fill={W} />
      </>
    ),
    chart: (
      <>
        <path d="M40 78h84M44 78V20" {...common} />
        <rect x="54" y="52" width="12" height="26" {...common} fill={T} />
        <rect x="74" y="38" width="12" height="40" fill={O} stroke={K} strokeWidth={2.2} />
        <rect x="94" y="28" width="12" height="50" {...common} fill={T} />
      </>
    ),
    shield: (
      <>
        <path d="M80 14l28 10v22c0 18-12 28-28 34-16-6-28-16-28-34V24z" {...common} fill={T} />
        <path d="M68 48l8 8 16-16" stroke={O} strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 160 96" aria-hidden className={cn('block h-auto w-full', className)}>
      {art[name]}
    </svg>
  )
}

/* ------------------------------------------------------------ InfoCard */

/**
 * clave.gob.es-style content card: square corners, 1px light border, illustration on top,
 * title as an underlined orange link (whole card is clickable), short description below.
 */
export function InfoCard({ to, title, description, illustration, className, testId }: {
  to: string; title: ReactNode; description?: ReactNode; illustration?: IllustrationName; className?: string; testId?: string
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn('group flex h-full flex-col rounded-card border border-line bg-surface transition-colors hover:border-line-strong', className)}
    >
      {illustration && (
        <span className="block border-b border-line bg-brand-soft px-8 py-4">
          <Illustration name={illustration} className="mx-auto max-w-[180px]" />
        </span>
      )}
      <span className="flex flex-1 flex-col p-5">
        <span className="text-[18px] leading-snug font-bold text-brand underline decoration-1 underline-offset-[3px] group-hover:text-brand-strong group-hover:decoration-2">
          {title}
        </span>
        {description && <span className="mt-2 text-[15px] leading-relaxed text-muted">{description}</span>}
      </span>
    </Link>
  )
}

/* ---------------------------------------------------------- MethodCard */

/**
 * Cl@ve gateway-style method card: 16px corners, 2px grey border (orange when `highlighted` or `active`),
 * optional small orange tag, illustration area, bold title, one-line description and a full-width
 * light-orange pill button. Pass `onAction` (button, with `expanded` for disclosure) or `to` (link).
 * `children` render below the button (e.g. the form the button reveals).
 */
export function MethodCard({
  title, description, illustration, actionLabel, onAction, to, expanded, controls, highlighted, active, tag, children, className, testId, headingLevel = 2,
}: {
  title: ReactNode; description?: ReactNode; illustration?: IllustrationName | ReactNode; actionLabel: ReactNode
  onAction?: () => void; to?: string
  /** For disclosure buttons: current state + id of the panel the button controls. */
  expanded?: boolean; controls?: string
  highlighted?: boolean; active?: boolean; tag?: ReactNode; children?: ReactNode; className?: string; testId?: string
  headingLevel?: 2 | 3
}) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const pill = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-brand-tint px-5 py-3 text-center text-[16px] font-bold text-ink transition-colors hover:bg-brand-tint-hover'
  return (
    <section
      data-testid={testId}
      className={cn(
        'relative flex flex-col rounded-method border-2 bg-surface p-5 sm:p-6',
        highlighted || active ? 'border-brand' : 'border-line',
        className,
      )}
    >
      {tag && (
        <span className="absolute top-4 right-4 rounded-[2px] bg-brand px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-brand-ink uppercase">{tag}</span>
      )}
      {illustration && (
        <div className="mb-4 rounded-[10px] bg-brand-soft px-6 py-2 sm:py-3">
          {typeof illustration === 'string' ? <Illustration name={illustration as IllustrationName} className="mx-auto max-w-[120px] sm:max-w-[170px]" /> : illustration}
        </div>
      )}
      <H className="text-[19px] leading-snug font-extrabold text-ink">{title}</H>
      {description && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{description}</p>}
      <div className="mt-5">
        {to ? (
          <Link to={to} className={pill}>{actionLabel}</Link>
        ) : (
          <button type="button" onClick={onAction} aria-expanded={expanded} aria-controls={controls} className={pill}>{actionLabel}</button>
        )}
      </div>
      {children}
    </section>
  )
}
