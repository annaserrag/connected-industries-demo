import { useEffect, useId, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Info } from 'lucide-react'
import { FOOTER_DISCLAIMER } from '@/contract/seed'
import { actions } from '@/core/store'
import { cn, useLang, useTr, SPRING } from './utils'

/* -------------------------------------------------------------------- Logo */

/** Abstract glyph of the "Get your Cl@ve" wordmark (rounded tile with an open ring + key dot). */
export const LogoGlyph = ({ size = 32, className, inverted }: { size?: number; className?: string; inverted?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={cn('shrink-0', className)}>
    <rect width="32" height="32" rx="9" fill={inverted ? '#ffffff' : 'var(--color-brand)'} />
    <path
      d="M22.2 11.2A8 8 0 1 0 22.6 20"
      fill="none" stroke={inverted ? 'var(--color-brand)' : '#ffffff'} strokeWidth="3.2" strokeLinecap="round"
    />
    <circle cx="16" cy="16" r="3" fill={inverted ? 'var(--color-brand)' : '#ffffff'} />
    <circle cx="23.6" cy="15.6" r="1.9" fill="#9db4ff" />
  </svg>
)

/** Product wordmark: glyph + "Get your Cl@ve". `tone="light"` for dark backgrounds. */
export const Logo = ({ size = 'md', tone = 'dark', className, showGlyph = true }: {
  size?: 'sm' | 'md' | 'lg'; tone?: 'dark' | 'light'; className?: string; showGlyph?: boolean
}) => {
  const g = { sm: 24, md: 30, lg: 40 }[size]
  const txt = { sm: 'text-[15px]', md: 'text-[18px]', lg: 'text-[24px]' }[size]
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-label="Get your Cl@ve">
      {showGlyph && <LogoGlyph size={g} />}
      <span aria-hidden className={cn('whitespace-nowrap font-semibold tracking-[-0.02em]', txt, tone === 'light' ? 'text-stage-ink' : 'text-ink')}>
        <span className={cn('font-medium', tone === 'light' ? 'text-stage-muted' : 'text-muted')}>Get your </span>
        Cl<span className={tone === 'light' ? 'text-[#9db4ff]' : 'text-brand'}>@</span>ve
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

/* ------------------------------------------------------------------ Footer */

/** Current location.hash, updated on navigation. */
function useHash() {
  const [h, set] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash))
  useEffect(() => {
    const on = () => set(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return h
}

/** Persistent disclaimer footer (EN/ES): "Student prototype — not an official Government of Spain service." */
export const Footer = ({ className, tone }: { className?: string; tone?: 'default' | 'stage' }) => {
  const tr = useTr()
  const hash = useHash()
  if (!tone) tone = hash.startsWith('#/demo') ? 'stage' : 'default'
  return (
    <footer
      className={cn(
        'flex items-center justify-center gap-2 border-t px-4 py-3 text-center text-xs leading-snug',
        tone === 'stage' ? 'border-stage-line bg-stage text-stage-muted' : 'border-line bg-canvas text-muted',
        className,
      )}
    >
      <Info className="size-3.5 shrink-0" aria-hidden />
      <span>{tr(FOOTER_DISCLAIMER)}</span>
    </footer>
  )
}

/* -------------------------------------------------------------- LangToggle */

/** EN/ES segmented toggle bound to the store. `tone="stage"` for dark backgrounds. */
export function LangToggle({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'stage' }) {
  const lang = useLang()
  const id = useId()
  const dark = tone === 'stage'
  return (
    <div
      role="group"
      aria-label={lang === 'es' ? 'Idioma' : 'Language'}
      className={cn('relative inline-flex h-9 items-center rounded-full p-1 text-xs font-bold', dark ? 'bg-white/8 ring-1 ring-white/10' : 'bg-surface-2 ring-1 ring-ink/8', className)}
    >
      {(['en', 'es'] as const).map(l => {
        const on = lang === l
        return (
          <button
            key={l}
            type="button"
            aria-pressed={on}
            lang={l}
            aria-label={l === 'en' ? 'English' : 'Español'}
            onClick={() => actions.setLang(l)}
            className={cn('relative z-0 h-7 rounded-full px-3 uppercase tracking-wide transition-colors',
              on ? (dark ? 'text-ink' : 'text-ink') : (dark ? 'text-stage-muted hover:text-stage-ink' : 'text-muted hover:text-ink'))}
          >
            {on && (
              <motion.span
                layoutId={`lang-${id}`}
                transition={SPRING}
                className={cn('absolute inset-0 -z-10 rounded-full shadow-card', dark ? 'bg-stage-ink' : 'bg-surface')}
              />
            )}
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
        <button type="button" onClick={onBack} className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel ?? tr('Back', 'Atrás')}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && <div className="text-xs font-bold tracking-[0.08em] text-brand uppercase">{eyebrow}</div>}
          <h1 className={cn(display ? 'font-display text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[38px]' : 'text-2xl font-semibold tracking-[-0.02em]')}>{title}</h1>
          {description && <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
      </div>
    </header>
  )
}
