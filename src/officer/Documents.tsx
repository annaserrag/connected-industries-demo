/* Staff console · By document: applications organised by the document used to apply. */
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import { motion } from 'framer-motion'
import { BookUser, CreditCard, FileText, Fingerprint, Globe2, IdCard, Nfc, ScrollText, Video } from 'lucide-react'
import type { DocumentType } from '@/contract/types'
import { DOCUMENTS, LEVEL_LABELS } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { useClave } from '@/core/store'
import { priorityOf, relativeTime } from '@/core/selectors'
import { casesByDocument, DOCUMENT_ORDER } from '@/core/console'
import { Avatar, PolicyBadge, RouteBadge, StatusPill, cn } from '@/ui'
import { C, S } from './copy'
import { useLang, useTick, useTr } from './lib'
import { RiskTag } from './components/ui'
import { TierTag } from './Queue'
import { DemoLiveBadge } from './StaffDashboard'

export const DOC_ICON: Record<DocumentType, typeof IdCard> = {
  DNI: IdCard, EU_EID: Globe2, PASSPORT: BookUser, TIE: CreditCard, NIE_PAPER: ScrollText, RED_CARD: FileText,
}
export const isPolicyDoc = (d: DocumentType) => d === 'NIE_PAPER' || d === 'RED_CARD'

export function DocumentsPage() {
  const tr = useTr()
  const lang = useLang()
  useTick()
  const navigate = useNavigate()
  const state = useClave(s => s)
  const groups = useMemo(() => casesByDocument(state), [state])
  const [params, setParams] = useSearchParams()
  const first = DOCUMENT_ORDER.find(d => groups[d].length > 0) ?? 'PASSPORT'
  const active = (DOCUMENT_ORDER.includes(params.get('doc') as DocumentType) ? params.get('doc') : first) as DocumentType
  const now = new Date()

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 xl:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">{tr(S.docTitle)}</h1>
        <DemoLiveBadge />
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted">{tr(S.docSubtitle)}</p>

      <Tabs.Root value={active} onValueChange={v => setParams({ doc: v }, { replace: true })} className="mt-5">
        <Tabs.List aria-label={tr(S.docTitle)} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {DOCUMENT_ORDER.map(d => {
            const Icon = DOC_ICON[d]
            const n = groups[d].length
            const queued = groups[d].filter(c => c.awaitingOfficer).length
            return (
              <Tabs.Trigger
                key={d}
                value={d}
                data-testid={`doc-tab-${d}`}
                data-count={n}
                className={cn(
                  'group relative flex flex-col items-start gap-2 rounded-2xl border bg-surface p-4 text-left outline-none transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand',
                  'data-[state=active]:border-ink data-[state=active]:shadow-[0_0_0_1px_var(--color-ink)] border-line',
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className={cn('grid size-9 place-items-center rounded-xl', isPolicyDoc(d) ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand')}><Icon className="size-[18px]" aria-hidden /></span>
                  <span className="text-[28px] leading-none font-semibold tracking-tight text-ink tabular-nums" data-testid={`doc-count-${d}`}>{n}</span>
                </span>
                <span className="text-sm leading-snug font-semibold text-ink">{tr(DOCUMENTS[d].label).split(' (')[0]}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  {queued > 0 ? <span className="font-semibold text-warning">{queued} {tr(C.inQueue)}</span> : <span>{tr(S.notInQueue)}</span>}
                  {isPolicyDoc(d) && <PolicyBadge />}
                </span>
              </Tabs.Trigger>
            )
          })}
        </Tabs.List>

        {DOCUMENT_ORDER.map(d => {
          const list = groups[d]
          const def = DOCUMENTS[d]
          return (
            <Tabs.Content key={d} value={d} className="mt-5 outline-none focus-visible:ring-2 focus-visible:ring-brand" data-testid={`doc-panel-${d}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface px-5 py-4">
                <h2 className="text-lg font-semibold tracking-tight text-ink">{tr(def.label)}</h2>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                  {def.hasChip ? <Nfc className="size-4 text-brand" aria-hidden /> : <Video className="size-4 text-sim" aria-hidden />}
                  {def.hasChip ? tr(S.hasChip) : tr(S.noChip)}
                </span>
                {isPolicyDoc(d) && (
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-ink"><PolicyBadge />{tr(S.policyRoute)}</span>
                )}
                <span className="ml-auto text-sm font-semibold text-ink tabular-nums">{list.length} {tr(list.length === 1 ? S.caseOne : S.casesN)}</span>
              </div>

              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
                {list.length === 0 ? (
                  <div className="grid place-items-center px-6 py-14 text-center">
                    <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted"><Fingerprint className="size-6" aria-hidden /></span>
                    <p className="mt-3 font-semibold text-ink">{tr(S.noAppsDoc)}</p>
                    <p className="mt-1 text-sm text-muted">{tr(S.noAppsDocBody)}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                      <caption className="sr-only">{tr(def.label)}</caption>
                      <thead>
                        <tr className="border-b border-line bg-canvas/70 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                          <th scope="col" className="py-2.5 pr-3 pl-5">{tr(C.applicant)}</th>
                          <th scope="col" className="px-3 py-2.5">{tr(C.status)}</th>
                          <th scope="col" className="px-3 py-2.5">{tr(C.route)}</th>
                          <th scope="col" className="px-3 py-2.5">{tr(C.risk)}</th>
                          <th scope="col" className="px-3 py-2.5">{tr(S.priority)}</th>
                          <th scope="col" className="px-3 py-2.5">{tr(C.level)}</th>
                          <th scope="col" className="py-2.5 pr-5 pl-3 text-right">{tr(S.updated)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((c, i) => (
                          <motion.tr
                            key={c.id}
                            layout="position"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(i, 8) * 0.03 }}
                            onClick={() => navigate(PATHS.officerCase(c.id))}
                            data-case-id={c.id}
                            className="cursor-pointer border-b border-line/70 last:border-b-0 hover:bg-canvas/60"
                          >
                            <td className="py-3 pr-3 pl-5">
                              <div className="flex items-center gap-3">
                                <Avatar initials={c.persona.initials} hue={c.persona.hue} size={32} />
                                <div className="min-w-0">
                                  <Link to={PATHS.officerCase(c.id)} onClick={e => e.stopPropagation()} className="block truncate font-semibold text-ink outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand">{c.persona.name}</Link>
                                  <p className="truncate font-mono text-[11px] text-muted">{c.document.number}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3"><StatusPill status={c.status} /></td>
                            <td className="px-3 py-3">{c.route ? <RouteBadge route={c.route} compact /> : <span className="text-muted">—</span>}</td>
                            <td className="px-3 py-3"><RiskTag risk={c.risk} size="sm" /></td>
                            <td className="px-3 py-3">{c.awaitingOfficer ? <TierTag tier={priorityOf(c, now)} /> : <span className="text-[12px] text-muted">{tr(S.notInQueue)}</span>}</td>
                            <td className="px-3 py-3 text-[13px] text-ink">{c.level === 'none' ? tr(C.levelNone) : tr(LEVEL_LABELS[c.level])}</td>
                            <td className="py-3 pr-5 pl-3 text-right text-[13px] whitespace-nowrap text-muted tabular-nums">{relativeTime(c.updatedAt, lang)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Tabs.Content>
          )
        })}
      </Tabs.Root>
    </div>
  )
}
