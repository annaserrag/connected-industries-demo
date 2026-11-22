/**
 * Site chrome in the style of Spanish e-government portals (clave.gob.es, the Cl@ve gateway):
 * thin orange top line, white header with the product mark + uppercase tagline, language selector and a
 * square orange menu button; light-grey title band; link footer with the copyright line.
 * No official logos or coats of arms: the mark is our own neutral glyph.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Menu, X } from 'lucide-react'
import type { Bilingual } from '@/contract/types'
import { HomeLink } from './HomeLink'
import { LangToggle, LogoGlyph } from './layout'
import { cn, useTr } from './utils'

/* ---------------------------------------------------------------- copy */

const b = (en: string, es: string): Bilingual => ({ en, es })

export const GOV_TAGLINE: Bilingual = b('Electronic identity registration', 'Registro de identidad electrónica')
export const GOV_COPYRIGHT: Bilingual = b(
  '© 2026 Get your Cl@ve · Academic prototype of IE University',
  '© 2026 Get your Cl@ve · Prototipo académico de IE University',
)

export interface GovNavItem { to: string; label: Bilingual; description?: Bilingual }

/** Default items of the header menu. */
export const GOV_MENU: GovNavItem[] = [
  { to: '/citizen?mode=signup', label: b('Apply', 'Solicitar'), description: b('Get your Cl@ve from your phone, no appointment', 'Obtén tu Cl@ve desde el móvil, sin cita') },
  { to: '/citizen', label: b('Sign in · Track my application', 'Acceder · Seguir mi solicitud'), description: b('See the status of your application', 'Consulta el estado de tu solicitud') },
  { to: '/officer', label: b('Staff access', 'Acceso para personal'), description: b('For staff of a registration office', 'Para el personal de una oficina de registro') },
  { to: '/help', label: b('Help', 'Ayuda'), description: b('Who can apply, documents, how it works', 'Quién puede solicitarla, documentos, cómo funciona') },
  { to: '/dashboard', label: b('Service statistics', 'Estadísticas del servicio') },
  { to: '/about', label: b('About this platform', 'Sobre esta plataforma') },
]

/** Footer links (each one is a real page). */
export const GOV_FOOTER_LINKS: GovNavItem[] = [
  { to: '/accessibility', label: b('Accessibility', 'Accesibilidad') },
  { to: '/legal', label: b('Legal notice', 'Aviso legal') },
  { to: '/privacy', label: b('Privacy', 'Privacidad') },
  { to: '/about', label: b('About this platform', 'Sobre esta plataforma') },
  { to: '/help', label: b('Help', 'Ayuda') },
]

/* ------------------------------------------------------------- wordmark */

/** "Get your Cl@ve" wordmark in Merriweather. */
export function GovWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display font-bold whitespace-nowrap text-ink', className)}>
      Get your Cl<span className="text-brand">@</span>ve
    </span>
  )
}

/* --------------------------------------------------------------- header */

export interface GovHeaderProps {
  /** Extra controls placed before the language selector (e.g. a signed-in user chip with sign out). */
  actions?: ReactNode
  /** Tagline next to the mark. Defaults to GOV_TAGLINE; pass `false` to hide it. */
  tagline?: Bilingual | false
  /** Menu items; defaults to GOV_MENU. Pass `false` to hide the menu button. */
  menu?: GovNavItem[] | false
  /** Max width of the inner container (Tailwind class). Default 'max-w-[1200px]'. */
  width?: string
  /** Sticky at the top of the viewport. Default false. */
  sticky?: boolean
  className?: string
}

/**
 * Site header like clave.gob.es: thin orange line on top, mark + uppercase tagline on the left,
 * EN/ES selector and a square orange menu button on the right. The mark always links home ("/").
 */
export function GovHeader({ actions, tagline = GOV_TAGLINE, menu = GOV_MENU, width = 'max-w-[1200px]', sticky, className }: GovHeaderProps) {
  const tr = useTr()
  const [open, setOpen] = useState(false)
  const { pathname, search } = useLocation()
  const panelId = useId()
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // Close on navigation.
  useEffect(() => { setOpen(false) }, [pathname, search])
  // Escape closes and returns focus; click outside closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  return (
    <header className={cn('relative z-40 bg-surface', sticky && 'sticky top-0', className)} data-testid="gov-header">
      <div aria-hidden className="h-1 bg-brand" />
      <div className="border-b border-line">
        <div className={cn('mx-auto flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6', width)}>
          <HomeLink className="gap-2.5 rounded-[2px]" label={tr('Get your Cl@ve, home', 'Get your Cl@ve, inicio')}>
            <LogoGlyph size={34} className="max-[359px]:hidden" />
            <span className="flex min-w-0 flex-col leading-none">
              <GovWordmark className="text-[17px] sm:text-[19px]" />
              {tagline && (
                <span className="mt-1 block max-w-[150px] text-[9.5px] leading-[1.2] font-bold tracking-[0.01em] text-muted uppercase sm:hidden">{tr(tagline)}</span>
              )}
            </span>
          </HomeLink>
          {tagline && (
            <span className="hidden items-center gap-3 sm:flex">
              <span aria-hidden className="h-8 w-px bg-line" />
              <span className="max-w-[22ch] text-[11.5px] leading-tight font-bold tracking-[0.08em] text-muted uppercase">{tr(tagline)}</span>
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            {actions}
            <LangToggle />
            {menu && (
              <button
                ref={btnRef}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={tr(open ? 'Close menu' : 'Menu', open ? 'Cerrar menú' : 'Menú')}
                onClick={() => setOpen(o => !o)}
                className="grid size-11 shrink-0 place-items-center rounded-[2px] bg-brand text-brand-ink transition-colors hover:bg-brand-strong"
                data-testid="gov-menu-button"
              >
                {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
              </button>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {menu && open && (
          <motion.div
            ref={panelRef}
            id={panelId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-x-0 top-full border-b-4 border-brand bg-surface shadow-pop"
          >
            <nav aria-label={tr('Main menu', 'Menú principal')} className={cn('mx-auto px-4 py-3 sm:px-6 sm:py-5', width)}>
              <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {menu.map(item => (
                  <li key={item.to + item.label.en} className="border-b border-line last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
                    <Link to={item.to} className="group flex items-center gap-3 py-3.5" onClick={() => setOpen(false)}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-bold text-brand underline decoration-1 underline-offset-[3px] group-hover:text-brand-strong group-hover:decoration-2">
                          {tr(item.label)}
                        </span>
                        {item.description && <span className="mt-0.5 block text-[14px] text-muted">{tr(item.description)}</span>}
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-brand" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

/* ----------------------------------------------------------- title band */

/** Full-width light-grey band with the page H1 (Merriweather) and a one-line subtitle, like clave.gob.es. */
export function GovTitleBand({ title, subtitle, eyebrow, children, width = 'max-w-[1200px]', className, breadcrumb }: {
  title: ReactNode; subtitle?: ReactNode; eyebrow?: ReactNode; children?: ReactNode
  width?: string; className?: string
  /** Optional trail: [{ to, label }] rendered before the title (last item is the current page). */
  breadcrumb?: { to?: string; label: string }[]
}) {
  const tr = useTr()
  return (
    <div className={cn('bg-band', className)}>
      <div className={cn('mx-auto px-4 py-8 sm:px-6 sm:py-10', width)}>
        {breadcrumb && (
          <nav aria-label={tr('Breadcrumb', 'Ruta de navegación')} className="mb-3 text-[14px]">
            <ol className="flex flex-wrap items-center gap-1.5 text-muted">
              {breadcrumb.map((c, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                  {c.to ? <Link to={c.to} className="gov-link font-semibold">{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && <p className="mb-2 text-[12px] font-bold tracking-[0.08em] text-brand-strong uppercase">{eyebrow}</p>}
        <h1 className="font-display text-[26px] leading-tight font-bold text-ink sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-[70ch] text-[16px] leading-relaxed text-muted sm:text-[17px]">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- footer */

export interface GovFooterProps {
  className?: string
  /** Max width of the inner container (Tailwind class). Default 'max-w-[1200px]'. */
  width?: string
}

/** Site footer: Accessibility, Legal notice, Privacy, About this platform, Help + the copyright line. */
export function GovFooter({ className, width = 'max-w-[1200px]' }: GovFooterProps) {
  const tr = useTr()
  return (
    <footer className={cn('border-t border-line bg-band text-ink', className)} data-testid="gov-footer">
      <div className={cn('mx-auto px-4 py-6 sm:px-6', width)}>
        <nav aria-label={tr('Footer', 'Pie de página')}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            {GOV_FOOTER_LINKS.map(l => (
              <li key={l.to}>
                <Link to={l.to} className="gov-link font-semibold">{tr(l.label)}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted" data-testid="gov-copyright">{tr(GOV_COPYRIGHT)}</p>
      </div>
    </footer>
  )
}

/** @deprecated name kept for API compatibility: the persistent footer is now the GovFooter. */
export const Footer = GovFooter

/* ---------------------------------------------------------- page shell */

/** Header + optional title band + main content. The footer is mounted once by the app. */
export function GovPage({ title, subtitle, breadcrumb, children, width = 'max-w-[1200px]', headerProps, mainClassName }: {
  title?: ReactNode; subtitle?: ReactNode; breadcrumb?: { to?: string; label: string }[]
  children?: ReactNode; width?: string; headerProps?: GovHeaderProps; mainClassName?: string
}) {
  const tr = useTr()
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:font-bold">
        {tr('Skip to content', 'Saltar al contenido')}
      </a>
      <GovHeader {...headerProps} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {title && <GovTitleBand title={title} subtitle={subtitle} breadcrumb={breadcrumb} width={width} />}
        <div className={cn('mx-auto px-4 py-8 sm:px-6 sm:py-10', width, mainClassName)}>{children}</div>
      </main>
    </div>
  )
}
