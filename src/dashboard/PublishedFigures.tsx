import { ExternalLink } from 'lucide-react'
import { REFERENCE_FIGURES } from '@/contract/seed'
import { COPY } from './copy'
import { useTr } from './components/hooks'
import { SectionHeading } from './components/parts'

/** Real figures, exactly as written in the contract. No derived numbers. */
export function PublishedFigures() {
  const tr = useTr()
  return (
    <section aria-labelledby="dash-context" data-testid="published-figures">
      <SectionHeading
        id="dash-context"
        title={tr(COPY.contextSection)}
        aside={<span className="inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink">{tr(COPY.publishedBadge)}</span>}
      >
        {tr(COPY.contextIntro)}
      </SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {REFERENCE_FIGURES.map(fig => (
          <li key={fig.id} data-testid="published-figure" data-figure-id={fig.id} className="flex flex-col rounded-2xl border border-line bg-surface-2/60 p-4">
            <p className="text-sm leading-snug text-muted">{tr(fig.label)}</p>
            <p data-testid="figure-value" className="mt-2 break-words text-lg font-semibold leading-tight tracking-tight text-ink tabular-nums">{fig.value}</p>
            <dl className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted">
              <div className="flex gap-1">
                <dt>{tr(COPY.year)}:</dt>
                <dd data-testid="figure-year" className="font-semibold text-ink">{fig.year}</dd>
              </div>
              <div className="flex gap-1">
                <dt>{tr(COPY.source)}:</dt>
                <dd>
                  <a
                    data-testid="figure-source"
                    href={fig.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 font-semibold text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {fig.source}
                    <ExternalLink className="size-3" aria-hidden="true" />
                    <span className="sr-only"> {tr(COPY.opensNewTab)}</span>
                  </a>
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}
