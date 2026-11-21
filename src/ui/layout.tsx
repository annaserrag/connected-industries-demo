import { type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { actions } from '@/core/store'
import { cn, useLang, useTr } from './utils'

/* -------------------------------------------------------------------- Logo */

/**
 * Our own neutral glyph (no official branding): a square orange tile with an open key-ring and a key bit.
 */
export const LogoGlyph = ({ size = 32, className, inverted }: { size?: number; className?: string; inverted?: boolean }) => {
  const fg = inverted ? 'var(--color-brand)' : '#ffffff'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="2" fill={inverted ? '#ffffff' : 'var(--color-brand)'} />
      <circle cx="12.5" cy="16" r="6" fill="none" stroke={fg} strokeWidth="3" />
      <path d="M18.5 16h8.5M23.5 16v4M27 16v3" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="square" />
    </svg>
  )
}

/** Product wordmark: glyph + "Get your Cl@ve". `tone="light"` for dark backgrounds. */
export const Logo = ({ size = 'md', tone = 'dark', className, showGlyph = true }: {
  size?: 'sm' | 'md' | 'lg'; tone?: 'dark' | 'light'; className?: string; showGlyph?: boolean
}) => {
  const g = { sm: 26, md: 32, lg: 40 }[size]
  const txt = { sm: 'text-[15px]', md: 'text-[18px]', lg: 'text-[24px]' }[size]
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-label="Get your Cl@ve">
      {showGlyph && <LogoGlyph size={g} />}
      <span aria-hidden className={cn('whitespace-nowrap font-display font-bold', txt, tone === 'light' ? 'text-white' : 'text-ink')}>
        Get your Cl<span className={tone === 'light' ? 'text-[#ffb48a]' : 'text-brand'}>@</span>ve
      </span>
    </span>
  )
}

/* -------------------------------------------------------------- PhoneFrame */

/**
 * Phone-sized device frame for the citizen view on desktop. On screens narrower than `sm`
 * (a real phone) it renders the children full-bleed with no frame. `bare` forces no frame.
 */
export const PhoneFrame = ({ children, className, bare, height = 820 }: {
  children?: ReactNode; className?: string; bare?: boolean; height?: number
}) => {
  if (bare) return <div className={cn('min-h-dvh bg-canvas', className)}>{children}</div>
  return (
    <>
      <div className={cn('min-h-dvh bg-canvas sm:hidden', className)}>{children}</div>
      <div className={cn('mx-auto hidden w-[400px] max-w-full shrink-0 sm:block', className)}>
        <div className="relative rounded-phone bg-[#15171b] p-[11px] shadow-device" style={{ height }}>
          {/* side buttons */}
          <span aria-hidden className="absolute top-[120px] -left-[3px] h-8 w-[3px] rounded-l bg-[#2a2d33]" />
          <span aria-hidden className="absolute top-[170px] -left-[3px] h-14 w-[3px] rounded-l bg-[#2a2d33]" />
          <span aria-hidden className="absolute top-[150px] -right-[3px] h-20 w-[3px] rounded-r bg-[#2a2d33]" />
          <div className="relative flex h-full flex-col overflow-hidden rounded-[36px] bg-canvas">
            <PhoneStatusBar />
            <div className="scroll-quiet relative min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            <div aria-hidden className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[120px] -translate-x-1/2 rounded-full bg-ink/80" />
          </div>
        </div>
      </div>
    </>
  )
}

/** Fake phone status bar (time, island, signal) used inside PhoneFrame. */
export const PhoneStatusBar = ({ dark }: { dark?: boolean }) => (
  <div aria-hidden className={cn('relative flex h-11 shrink-0 items-center justify-between px-7 text-[14px] font-semibold', dark ? 'text-white' : 'text-ink')}>
    <span>9:41</span>
    <span className="absolute top-2.5 left-1/2 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-[#0b0c0e]" />
    <span className="flex items-center gap-1.5">
      <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" /><rect x="22.5" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".45" /></svg>
    </span>
  </div>
)

/* ------------------------------------------------------------- LaptopFrame */

/** Laptop-style device frame (bezel, camera notch, base) for showing the officer desktop. */
export const LaptopFrame = ({ children, className, label }: { children?: ReactNode; className?: string; label?: string }) => (
  <div className={cn('flex w-full flex-col items-center', className)}>
    <div className="relative w-full rounded-t-[18px] bg-[#15171b] p-[10px] pt-[22px] shadow-device">
      <span aria-hidden className="absolute top-[8px] left-1/2 size-[6px] -translate-x-1/2 rounded-full bg-[#2c3038] ring-1 ring-white/5" />
      {label && <span className="absolute top-[4px] left-4 text-[10px] font-medium tracking-wide text-stage-muted uppercase">{label}</span>}
      <div className="relative overflow-hidden rounded-[6px] bg-canvas">{children}</div>
    </div>
    <div aria-hidden className="relative h-[14px] w-[104%] rounded-b-[14px] bg-gradient-to-b from-[#c9ccd2] to-[#8e929a]">
      <span className="absolute top-0 left-1/2 h-[5px] w-[14%] -translate-x-1/2 rounded-b-[6px] bg-[#7a7e86]" />
    </div>
  </div>
)

/* -------------------------------------------------------------- LangToggle */

/**
 * EN/ES language selector bound to the store (two square buttons, active one filled).
 * Buttons are named "English" / "Español" for assistive tech and tests. `tone="stage"` for dark backgrounds.
 */
export function LangToggle({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'stage' }) {
  const lang = useLang()
  const dark = tone === 'stage'
  return (
    <div
      role="group"
      aria-label={lang === 'es' ? 'Idioma' : 'Language'}
      className={cn('inline-flex h-9 items-center rounded-[2px] border text-[13px] font-bold', dark ? 'border-white/30' : 'border-line-strong', className)}
    >
      {(['en', 'es'] as const).map((l, i) => {
        const on = lang === l
        return (
          <button
            key={l}
            type="button"
            aria-pressed={on}
            lang={l}
            aria-label={l === 'en' ? 'English' : 'Español'}
            onClick={() => actions.setLang(l)}
            className={cn('h-full px-2 uppercase sm:px-2.5 tracking-wide transition-colors', i === 1 && (dark ? 'border-l border-white/30' : 'border-l border-line-strong'),
              on ? (dark ? 'bg-white text-ink' : 'bg-ink text-white') : (dark ? 'text-white/80 hover:text-white' : 'text-ink hover:bg-surface-2'))}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------- PageHeader */

/** Page title block: optional back link, eyebrow, display title, description and right-side actions. */
export const PageHeader = ({ title, eyebrow, description, actions: right, onBack, backLabel, className, display = true }: {
  title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode
  onBack?: () => void; backLabel?: string; className?: string; display?: boolean
}) => {
  const tr = useTr()
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {onBack && (
        <button type="button" onClick={onBack} className="-ml-1 inline-flex w-fit items-center gap-1 px-1 py-0.5 text-sm font-bold text-brand underline underline-offset-[3px] hover:text-brand-strong">
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel ?? tr('Back', 'Atrás')}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && <div className="text-xs font-bold tracking-[0.08em] text-brand-strong uppercase">{eyebrow}</div>}
          <h1 className={cn(display ? 'font-display text-[26px] leading-tight font-bold sm:text-[32px]' : 'text-2xl font-bold')}>{title}</h1>
          {description && <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
      </div>
    </header>
  )
}
