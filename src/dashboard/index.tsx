import { useLocation } from 'react-router-dom'
import { FlaskConical, Gavel, ShieldCheck } from 'lucide-react'
import { KEY_RULE, POLICY_PROPOSALS, POLICY_PROPOSAL_LABEL, SIMULATED_INDICATORS } from '@/contract/seed'
import { HomeLink, LangToggle, Logo, cn } from '@/ui'
import { COPY } from './copy'
import { isEmbed, useLang, useTr } from './components/hooks'
import { SectionHeading } from './components/parts'
import { Kpis } from './Kpis'
import { AppealsChart, CorrectedChart, OfficeShareChart, RoutesChart, TimeToAdvancedChart } from './charts'
import { LiveSession } from './LiveSession'
import { PublishedFigures } from './PublishedFigures'

function SimulatedBanner({ compact }: { compact?: boolean }) {
  const tr = useTr()
  return (
    <div
      role="note"
      aria-labelledby="dash-sim-title"
      data-testid="simulated-banner"
      className={cn(
        'flex gap-4 rounded-2xl border border-sim/25 bg-sim-soft text-ink',
        compact ? 'items-center p-3 sm:p-4' : 'items-start p-4 sm:p-5',
      )}
    >
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-sim text-white">
        <FlaskConical className="size-5" />
      </span>
      <div className="min-w-0">
        <p id="dash-sim-title" className="text-base font-bold text-sim sm:text-lg">{tr(COPY.bannerTitle)}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink">{tr(COPY.bannerBody)}</p>
        {!compact && <p className="mt-1 text-sm leading-relaxed text-muted">{tr(COPY.bannerAside)}</p>}
      </div>
    </div>
  )
}

function Footnote() {
  const tr = useTr()
  return (
    <section aria-labelledby="dash-foot" className="grid gap-4 border-t border-line pt-8 md:grid-cols-2">
      <h2 id="dash-foot" className="sr-only">{tr(COPY.notes)}</h2>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
          {tr(COPY.footRule)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink">{tr(KEY_RULE)}</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          <Gavel className="size-4 text-warning" aria-hidden="true" />
          {tr(COPY.footProposals)}
        </p>
        <ul className="mt-2 space-y-2">
          {POLICY_PROPOSALS.map((p, i) => (
            <li key={i} className="flex flex-col items-start gap-1 text-sm leading-relaxed text-ink sm:flex-row sm:gap-2">
              <span className="mt-0.5 shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">{tr(POLICY_PROPOSAL_LABEL)}</span>
              <span>{tr(p)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{tr(COPY.footProposalsNote)}</p>
      </div>
    </section>
  )
}

export function DashboardPage() {
  const tr = useTr()
  const lang = useLang()
  const { search } = useLocation()
  const embed = isEmbed(search)

  return (
    <main lang={lang} className="min-h-full bg-canvas text-ink" data-testid="dashboard-page">
      <div className={cn('mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8', embed ? 'py-5' : 'py-8 sm:py-12')}>
        {!embed && (
          <header className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between gap-4">
              <HomeLink><Logo size="sm" /></HomeLink>
              <LangToggle />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-brand">{tr(COPY.eyebrow)}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-[2.75rem] sm:leading-[1.1]" style={{ fontFamily: 'var(--font-display, inherit)' }}>
              {tr(COPY.title)}
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted sm:text-base">{tr(COPY.subtitle)}</p>
          </header>
        )}
        {embed && <h1 className="sr-only">{tr(COPY.title)}</h1>}

        <SimulatedBanner compact={embed} />

        <div className="mt-10 space-y-12 sm:mt-12 sm:space-y-16">
          <section aria-labelledby="dash-kpis">
            <SectionHeading
              id="dash-kpis"
              title={tr(COPY.kpiSection)}
              aside={<span className="text-sm text-muted">{tr(COPY.period)}</span>}
            >
              {SIMULATED_INDICATORS.map(i => tr(i.label)).join(' · ')}
            </SectionHeading>
            <Kpis />
          </section>

          <section aria-labelledby="dash-charts">
            <SectionHeading id="dash-charts" title={tr(COPY.chartsSection)} />
            <div className="grid gap-4 lg:grid-cols-2">
              <TimeToAdvancedChart />
              <OfficeShareChart />
              <CorrectedChart />
              <AppealsChart />
              <RoutesChart />
            </div>
          </section>

          <LiveSession />

          <PublishedFigures />

          <Footnote />
        </div>
      </div>
    </main>
  )
}
