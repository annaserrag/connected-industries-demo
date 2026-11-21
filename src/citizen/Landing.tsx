import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Building, CalendarClock, Clock, FileText, Laptop, LayoutDashboard, Play, Scale, Smartphone, Timer, UserRound } from 'lucide-react'
import { LangToggle, cn } from '@/ui'
import { KEY_RULE, REFERENCE_FIGURES, ROUTES, ROUTE_ORDER } from '@/contract/seed'
import { C } from './copy'
import { LogoMark, RouteCode, Wordmark } from './components/basics'
import { useReduced, useTr } from './hooks'

const FIGURE_IDS = ['users', 'eidas', 'online']

export function LandingPage() {
  const { tr } = useTr()
  const reduced = useReduced()
  const rise = (d = 0) => (reduced ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const } })
  const figures = REFERENCE_FIGURES.filter(f => FIGURE_IDS.includes(f.id))

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas text-ink">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_85%_0%,var(--color-brand-soft),transparent_70%),radial-gradient(40%_35%_at_0%_60%,var(--color-sim-soft),transparent_70%)]" />

      <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-8">
        <LogoMark size={32} />
        <Wordmark className="text-lg" />
        <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="Demo">
          <Link to="/dashboard" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-muted hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 sm:inline-flex">
            <LayoutDashboard size={15} aria-hidden /> {tr(C.dashboardLink)}
          </Link>
          <Link to="/demo" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-muted hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 sm:inline-flex">
            <Play size={15} aria-hidden /> {tr(C.demoLink)}
          </Link>
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

            <motion.div {...rise(0.15)} className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link
                to="/citizen"
                data-testid="landing-citizen"
                className="group relative overflow-hidden rounded-3xl bg-brand p-5 text-brand-ink shadow-[0_18px_40px_-18px_var(--color-brand)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
              >
                <Smartphone size={26} aria-hidden />
                <span className="mt-4 block text-xl font-semibold">{tr(C.iAmCitizen)}</span>
                <span className="mt-1 block text-sm text-white/80">{tr(C.iAmCitizenSub)}</span>
                <ArrowRight size={20} aria-hidden className="absolute right-5 top-5 transition group-hover:translate-x-1" />
              </Link>
              <Link
                to="/officer"
                data-testid="landing-officer"
                className="group relative overflow-hidden rounded-3xl bg-surface p-5 text-ink ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-brand/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
              >
                <Laptop size={26} aria-hidden className="text-brand" />
                <span className="mt-4 block text-xl font-semibold">{tr(C.iAmOfficer)}</span>
                <span className="mt-1 block text-sm text-muted">{tr(C.iAmOfficerSub)}</span>
                <ArrowRight size={20} aria-hidden className="absolute right-5 top-5 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
              </Link>
            </motion.div>
            <div className="mt-4 flex gap-4 text-sm sm:hidden">
              <Link to="/dashboard" className="font-medium text-muted underline-offset-2 hover:underline">{tr(C.dashboardLink)}</Link>
              <Link to="/demo" className="font-medium text-muted underline-offset-2 hover:underline">{tr(C.demoLink)}</Link>
            </div>
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
