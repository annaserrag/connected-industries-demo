/* Staff console · All applications: every case, searchable and filterable. */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FilterX, Search } from 'lucide-react'
import type { DocumentType, Level, RouteId, StatusId } from '@/contract/types'
import { DOCUMENTS, LEVEL_LABELS, ROUTES, routeCode, ROUTE_ORDER, STATUSES, STATUS_ORDER } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { useClave } from '@/core/store'
import { priorityOf, relativeTime } from '@/core/selectors'
import { documentOf, DOCUMENT_ORDER } from '@/core/console'
import { Avatar, RouteBadge, StatusPill, cn } from '@/ui'
import { C, S } from './copy'
import { useLang, useTick, useTr, caseTitle } from './lib'
import { TierTag } from './Queue'
import { LiveBadge } from './StaffDashboard'

const selCls = 'h-9 rounded-[2px] border border-line bg-surface px-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand'

export function ApplicationsPage() {
  const tr = useTr()
  const lang = useLang()
  useTick()
  const navigate = useNavigate()
  const cases = useClave(s => s.cases)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusId | 'draft' | 'all'>('all')
  const [route, setRoute] = useState<RouteId | 'all'>('all')
  const [doc, setDoc] = useState<DocumentType | 'all'>('all')
  const [level, setLevel] = useState<Level | 'all'>('all')

  // Submitted applications first (most recently updated on top), personas that have not applied yet (drafts) last.
  const all = useMemo(() => Object.values(cases).sort((a, b) =>
    Number(a.status === 'draft') - Number(b.status === 'draft') || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')), [cases])
  const needle = q.trim().toLowerCase()
  const rows = all.filter(c =>
    (!needle || [c.persona.name, caseTitle(c), c.caseRef ?? '', c.id, c.document.number, c.persona.nationality].some(v => v.toLowerCase().includes(needle))) &&
    (status === 'all' || c.status === status) &&
    (route === 'all' || c.route === route) &&
    (doc === 'all' || documentOf(c) === doc) &&
    (level === 'all' || c.level === level),
  )
  const filtersOn = Boolean(needle) || status !== 'all' || route !== 'all' || doc !== 'all' || level !== 'all'
  const clear = () => { setQ(''); setStatus('all'); setRoute('all'); setDoc('all'); setLevel('all') }
  const now = new Date()

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 xl:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[28px] font-bold text-ink">{tr(S.allTitle)}</h1>
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-sm font-semibold tabular-nums text-white">{all.length}</span>
        <LiveBadge />
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted">{tr(S.allSubtitle)}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="relative flex min-w-[260px] flex-1 items-center sm:max-w-sm">
          <span className="sr-only">{tr(S.search)}</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={tr(S.searchPh)}
            className="h-10 w-full rounded-[2px] border border-line bg-surface pr-3 pl-9 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>{tr(C.status)}</span>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={selCls}>
            <option value="all">{tr(S.allStatuses)}</option>
            <option value="draft">{tr(S.draft)}</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUSES[s].step}. {tr(STATUSES[s].label)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>{tr(C.route)}</span>
          <select value={route} onChange={e => setRoute(e.target.value as typeof route)} className={cn(selCls, 'max-w-[220px]')}>
            <option value="all">{tr(C.allRoutes)}</option>
            {ROUTE_ORDER.map(r => <option key={r} value={r}>{tr(routeCode(r))} · {tr(ROUTES[r].name)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>{tr(C.document)}</span>
          <select value={doc} onChange={e => setDoc(e.target.value as typeof doc)} className={cn(selCls, 'max-w-[220px]')}>
            <option value="all">{tr(S.allDocs)}</option>
            {DOCUMENT_ORDER.map(d => <option key={d} value={d}>{tr(DOCUMENTS[d].label).split(' (')[0]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>{tr(C.level)}</span>
          <select value={level} onChange={e => setLevel(e.target.value as typeof level)} className={selCls}>
            <option value="all">{tr(S.allLevels)}</option>
            <option value="none">{tr(C.levelNone)}</option>
            <option value="basic">{tr(LEVEL_LABELS.basic)}</option>
            <option value="advanced">{tr(LEVEL_LABELS.advanced)}</option>
          </select>
        </label>
        {filtersOn && (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-[2px] px-2 py-1.5 text-sm font-medium text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand">
            <FilterX className="size-4" aria-hidden />{tr(C.clearFilters)}
          </button>
        )}
        <span className="ml-auto text-sm text-muted tabular-nums" aria-live="polite" data-testid="apps-count">{rows.length} / {all.length} {tr(S.shown)}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-[4px] border border-line bg-surface">
        {rows.length === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <p className="font-semibold text-ink">{tr(S.noMatch)}</p>
            <button type="button" onClick={clear} className="mt-2 text-sm font-semibold text-brand hover:underline">{tr(C.clearFilters)}</button>
          </div>
        ) : (
          <div className="relative max-h-[calc(100vh-280px)] overflow-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm" data-testid="apps-table">
              <caption className="sr-only">{tr(S.allTitle)}</caption>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-line bg-canvas text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                  <th scope="col" className="py-2.5 pr-3 pl-5">{tr(C.applicant)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.status)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.route)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.document)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(C.level)}</th>
                  <th scope="col" className="px-3 py-2.5">{tr(S.priority)}</th>
                  <th scope="col" className="py-2.5 pr-5 pl-3 text-right">{tr(S.updated)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => {
                  const d = documentOf(c)
                  return (
                    <tr key={c.id} onClick={() => navigate(PATHS.officerCase(c.id))} data-case-id={c.id} className="cursor-pointer border-b border-line/70 last:border-b-0 hover:bg-canvas/60">
                      <td className="py-2.5 pr-3 pl-5">
                        <div className="flex items-center gap-3">
                          <Avatar initials={c.persona.initials} hue={c.persona.hue} size={30} />
                          <div className="min-w-0">
                            <Link to={PATHS.officerCase(c.id)} onClick={e => e.stopPropagation()} className="block truncate font-semibold text-ink outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand">{caseTitle(c)}</Link>
                            <p className="truncate text-[11px] text-muted"><span className="font-mono">{c.id}</span> · {c.persona.nationality}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><StatusPill status={c.status} advanced={c.advanced} /></td>
                      <td className="px-3 py-2.5">{c.route ? <RouteBadge route={c.route} compact /> : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink">{tr(DOCUMENTS[d].label).split(' (')[0]}</span>
                        <span className="block font-mono text-[11px] text-muted">{c.document.number}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-ink">{c.level === 'none' ? tr(C.levelNone) : tr(LEVEL_LABELS[c.level])}</td>
                      <td className="px-3 py-2.5">{c.awaitingOfficer ? <TierTag tier={priorityOf(c, now)} short /> : <span className="text-[12px] text-muted">—</span>}</td>
                      <td className="py-2.5 pr-5 pl-3 text-right text-[13px] whitespace-nowrap text-muted tabular-nums">{relativeTime(c.updatedAt, lang)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
