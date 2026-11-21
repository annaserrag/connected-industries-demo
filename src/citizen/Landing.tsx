import { Link, useSearchParams } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, Building, CalendarClock, Check, Clock, FileText, KeyRound, Scale, ShieldCheck, Smartphone, Timer, UserRound } from 'lucide-react'
import type { Bilingual } from '@/contract/types'
import { LangToggle, SimulatedBadge, cn } from '@/ui'
import { KEY_RULE, REFERENCE_FIGURES, REGISTRATION_AUTHORITIES, ROUTES, ROUTE_ORDER } from '@/contract/seed'
import { C } from './copy'
import { LogoMark, RouteCode, Wordmark } from './components/basics'
import { useReduced, useTr } from './hooks'

const FIGURE_IDS = ['users', 'eidas', 'online']

const b = (en: string, es: string): Bilingual => ({ en, es })
/** Landing-only copy (the rest of the citizen copy lives in ./copy). */
const L = {
  modes: b('How do you want to start?', '¿Cómo quieres empezar?'),
  tabApply: b('Apply', 'Solicitar'),
  tabStaff: b('Staff access', 'Acceso para personal'),
  apply: b('Apply', 'Solicitar'),
  applySub: b('From your phone, no appointment', 'Desde tu móvil, sin cita'),
  applyPoints: [b('Any document you live in Spain with', 'Con el documento con el que vives en España'), b('Minutes, not weeks', 'Minutos, no semanas'), b('Already applied? Follow it here', '¿Ya lo pediste? Síguelo aquí')],
  staffTitle: b('For registration staff', 'Para el personal de registro'),
  staffBody: b(
    'For staff of bodies enabled as Cl@ve registration authorities, such as the Tax Agency, Social Security, SEPE or a Government Delegation. Sign in with your work certificate or DNIe; access opens only if your organisation has authorised you.',
    'Para el personal de organismos habilitados como autoridades de registro de Cl@ve, como la Agencia Tributaria, la Seguridad Social, el SEPE o una Delegación del Gobierno. Entra con tu certificado de empleado público o tu DNIe; solo accedes si tu organismo te ha autorizado.',
  ),
  staffCta: b('Sign in with your certificate', 'Entrar con tu certificado'),
  staffNote: b('No accounts are created here. Organisation names appear as text only.', 'Aquí no se crean cuentas. Los nombres de organismos aparecen solo como texto.'),
}

export function LandingPage() {
  const { tr } = useTr()
  const reduced = useReduced()
  const rise = (d = 0) => (reduced ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const } })
  const figures = REFERENCE_FIGURES.filter(f => FIGURE_IDS.includes(f.id))
  const [params, setParams] = useSearchParams()
  const mode = params.get('access') === 'staff' ? 'staff' : 'apply'
  const setMode = (m: string) => setParams(m === 'staff' ? { access: 'staff' } : {}, { replace: true })

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas text-ink">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_85%_0%,var(--color-brand-soft),transparent_70%),radial-gradient(40%_35%_at_0%_60%,var(--color-sim-soft),transparent_70%)]" />

      <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-8">
        <LogoMark size={32} />
        <Wordmark className="text-lg" />
        <nav className="ml-auto flex items-center gap-1 text-sm" aria-label={tr(b('Language', 'Idioma'))}>
          <LangToggle />
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        <section className="grid items-center gap-10 pt-6 lg:grid-cols-[1.15fr_1fr] lg:pt-14">
          <div>
            <motion.p {...rise(0)} className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/60 motion-reduce:animate-none" /><span className="relative size-2 rounded-full bg-brand" /></span>
              {tr(C.launchEyebrow)}
            </motion.p>
            <motion.h1 {...rise(0.05)} className="mt-5 font-display text-[44px] font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {tr(C.heroTitle1)}<br />
              <span className="bg-gradient-to-r from-brand to-sim bg-clip-text text-transparent">{tr(C.heroTitle2)}</span>
            </motion.h1>
            <motion.p {...rise(0.1)} className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{tr(C.heroBody)}</motion.p>

            <motion.div {...rise(0.15)} className="mt-8 max-w-xl">
              <Tabs.Root value={mode} onValueChange={setMode}>
                <Tabs.List aria-label={tr(L.modes)} className="relative inline-flex rounded-full bg-surface p-1 ring-1 ring-line" data-testid="landing-tabs">
                  {([['apply', L.tabApply, Smartphone], ['staff', L.tabStaff, BadgeCheck]] as const).map(([v, label, Icon]) => (
                    <Tabs.Trigger
                      key={v}
                      value={v}
                      data-testid={`landing-tab-${v}`}
                      className="relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted outline-none transition-colors hover:text-ink focus-visible:ring-4 focus-visible:ring-brand/30 data-[state=active]:text-surface"
                    >
                      {mode === v && (
                        <motion.span layoutId="landing-tab-pill" transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-ink" aria-hidden />
                      )}
                      <Icon size={16} aria-hidden className="relative" />
                      <span className="relative">{tr(label)}</span>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                <AnimatePresence mode="wait" initial={false}>
                  {mode === 'apply' ? (
                    <Tabs.Content key="apply" value="apply" forceMount asChild>
                      <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} tabIndex={-1} className="mt-4 outline-none">
                        <Link
                          to="/citizen"
                          data-testid="landing-citizen"
                          className="group relative flex items-center gap-4 overflow-hidden rounded-3xl bg-brand p-5 text-brand-ink shadow-[0_18px_40px_-18px_var(--color-brand)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40 motion-reduce:transition-none sm:p-6"
                        >
                          <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/15 blur-2xl" />
                          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Smartphone size={26} aria-hidden /></span>
                          <span className="relative min-w-0 flex-1">
                            <span className="block text-[28px] leading-none font-semibold tracking-tight sm:text-3xl">{tr(L.apply)}</span>
                            <span className="mt-1.5 block text-[15px] text-white/85">{tr(L.applySub)}</span>
                          </span>
                          <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand transition group-hover:translate-x-1 motion-reduce:transition-none"><ArrowRight size={20} aria-hidden /></span>
                        </Link>
                        <ul className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-3">
                          {L.applyPoints.map((p, i) => (
                            <li key={i} className="flex items-start gap-1.5"><Check size={15} className="mt-0.5 shrink-0 text-success" aria-hidden />{tr(p)}</li>
                          ))}
                        </ul>
                      </motion.div>
                    </Tabs.Content>
                  ) : (
                    <Tabs.Content key="staff" value="staff" forceMount asChild>
                      <motion.div initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} tabIndex={-1} className="mt-4 rounded-3xl bg-ink p-5 text-surface outline-none sm:p-6" data-testid="landing-staff-panel">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid size-10 place-items-center rounded-xl bg-white/10"><ShieldCheck size={20} aria-hidden /></span>
                          <h2 className="text-xl font-semibold tracking-tight text-white">{tr(L.staffTitle)}</h2>
                          <span className="ml-auto"><SimulatedBadge /></span>
                        </div>
                        <p className="mt-3 text-[15px] leading-relaxed text-white/80">{tr(L.staffBody)}</p>
                        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={tr(b('Registration authorities (examples)', 'Autoridades de registro (ejemplos)'))}>
                          {REGISTRATION_AUTHORITIES.map(a => (
                            <li key={a.id} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85">{a.short}</li>
                          ))}
                        </ul>
                        <Link
                          to="/officer"
                          data-testid="landing-officer"
                          className="group mt-5 inline-flex h-12 items-center gap-2.5 rounded-xl bg-white px-5 text-[15px] font-semibold text-ink outline-none transition hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-white/50"
                        >
                          <KeyRound size={18} aria-hidden />{tr(L.staffCta)}
                          <ArrowRight size={16} aria-hidden className="transition group-hover:translate-x-0.5 motion-reduce:transition-none" />
                        </Link>
                        <p className="mt-3 text-[12.5px] text-white/70">{tr(L.staffNote)}</p>
                      </motion.div>
                    </Tabs.Content>
                  )}
                </AnimatePresence>
              </Tabs.Root>
            </motion.div>
          </div>

          {/* before / after */}
          <motion.div {...rise(0.2)} className="grid gap-3" aria-label={`${tr(C.todayLabel)} / ${tr(C.nowLabel)}`}>
            <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{tr(C.todayLabel)}</p>
              <ol className="mt-3 flex flex-wrap items-center gap-2">
                {C.todaySteps.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-muted">
                      {[<Building key="b" size={14} aria-hidden />, <FileText key="f" size={14} aria-hidden />, <CalendarClock key="c" size={14} aria-hidden />, <Clock key="w" size={14} aria-hidden />][i]}
                      <span className="line-through decoration-danger/60 decoration-2">{tr(s)}</span>
                    </span>
                    {i < C.todaySteps.length - 1 && <span aria-hidden className="text-line">→</span>}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[13px] leading-snug text-muted">{tr(C.todayNote)}</p>
            </div>
            <div className="relative overflow-hidden rounded-3xl bg-ink p-5 text-surface">
              <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-brand/40 blur-3xl" />
              <p className="relative text-xs font-bold uppercase tracking-wider text-white/60">{tr(C.nowLabel)}</p>
              <ol className="relative mt-3 flex flex-wrap items-center gap-2">
                {C.nowSteps.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-base font-semibold text-white">
                      {i === 0 ? <Smartphone size={16} aria-hidden /> : <Timer size={16} aria-hidden />}{tr(s)}
                    </span>
                    {i === 0 && <span aria-hidden className="text-white/40">→</span>}
                  </li>
                ))}
              </ol>
              <p className="relative mt-3 text-[13px] leading-snug text-white/70">{tr(C.nowNote)}</p>
            </div>
          </motion.div>
        </section>

        {/* routes */}
        <section aria-labelledby="routes-title" className="mt-16">
          <h2 id="routes-title" className="font-display text-2xl font-semibold tracking-tight">{tr(C.routesTitle)}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ROUTE_ORDER.map(r => (
              <li key={r} className="rounded-3xl bg-surface p-4 ring-1 ring-line">
                <RouteCode code={ROUTES[r].code} className="shrink-0 self-start" />
                <p className="mt-2 font-semibold leading-snug">{tr(ROUTES[r].name)}</p>
                <p className="mt-1 text-[13px] leading-snug text-muted">{tr(ROUTES[r].forWhom)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex max-w-3xl gap-2 text-sm text-muted">
            <Scale size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <span><strong className="text-ink">{tr(C.keyRuleTitle)}:</strong> {tr(KEY_RULE)}</span>
          </p>
        </section>

        {/* reference figures */}
        <section aria-labelledby="figures-title" className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="figures-title" className="font-display text-2xl font-semibold tracking-tight">{tr(C.figuresTitle)}</h2>
            <p className="text-sm text-muted">{tr(C.figuresNote)}</p>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {figures.map(f => (
              <li key={f.id} className={cn('rounded-3xl bg-surface p-5 ring-1 ring-line')} data-testid={`figure-${f.id}`}>
                <p className="font-display text-3xl font-semibold tracking-tight text-ink tabular-nums">{f.value}</p>
                <p className="mt-1 text-sm leading-snug text-ink">{tr(f.label)}</p>
                <p className="mt-3 text-xs text-muted">
                  {f.year} · {tr(C.sourceLabel)}: <span title={f.sourceUrl}>{f.source}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 flex items-center justify-center gap-2 text-center text-xs text-muted">
          <UserRound size={13} aria-hidden /> {tr(C.studentPrototype)}
        </p>
      </main>
    </div>
  )
}
