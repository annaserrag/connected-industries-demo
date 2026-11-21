import { useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { KEY_RULE, SIMULATED_INDICATORS } from '@/contract/seed'
import { GovHeader, GovTitleBand } from '@/ui'
import { COPY } from './copy'
import { isEmbed, useLang, useTr } from './components/hooks'
import { SectionHeading } from './components/parts'
import { Kpis } from './Kpis'
import { AppealsChart, CorrectedChart, OfficeShareChart, RoutesChart, TimeToAdvancedChart } from './charts'
import { LiveSession } from './LiveSession'
import { PublishedFigures } from './PublishedFigures'

function Footnote() {
  const tr = useTr()
  return (
    <section aria-labelledby="dash-foot" className="border-t border-line pt-8">
      <h2 id="dash-foot" className="sr-only">{tr(COPY.notes)}</h2>
      <div className="rounded-card border-l-4 border-brand bg-brand-soft p-5">
        <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
          <ShieldCheck className="size-5 text-brand" aria-hidden="true" />
          {tr(COPY.footRule)}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{tr(KEY_RULE)}</p>
      </div>
    </section>
  )
}

/** Public "Service statistics" page in the platform's style. No "Simulated" labels: the About page discloses the data. */
export function DashboardPage() {
  const tr = useTr()
  const lang = useLang()
  const { search } = useLocation()
  const embed = isEmbed(search)

  return (
    <div lang={lang} className="min-h-full bg-canvas text-ink" data-testid="dashboard-page">
      {!embed && <GovHeader />}
      <main id="main">
        {!embed && <GovTitleBand title={tr(COPY.title)} subtitle={tr(COPY.subtitle)} eyebrow={tr(COPY.eyebrow)} />}
        {embed && <h1 className="sr-only">{tr(COPY.title)}</h1>}
        <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
          <div className="space-y-12 sm:space-y-16">
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
    </div>
  )
}
