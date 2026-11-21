/**
 * Selectors for the staff console (dashboard, by-document view, all applications).
 * Everything is computed from the shared store, so it updates live when the citizen tab acts.
 * The cases are SIMULATED demo data: label the numbers "Demo data · live" wherever shown.
 */
import type { AppState, AuditAction, AuditEvent, Case, DocumentType, PriorityTier, RouteId } from '@/contract/types'
import { DOCUMENTS, ROUTE_ORDER } from '@/contract/seed'
import { officerQueue, priorityOf, TIER_ORDER } from './selectors'

export const DOCUMENT_ORDER = Object.keys(DOCUMENTS) as DocumentType[]

/** Applications that were actually submitted (drafts are personas that have not applied yet). */
export function applications(s: AppState): Case[] {
  return Object.values(s.cases).filter(c => c.status !== 'draft')
}

/** Queue size per priority tier (with the age bump). */
export function countsByTier(s: AppState, now: Date = new Date()): Record<PriorityTier, number> {
  const out = Object.fromEntries(TIER_ORDER.map(t => [t, 0])) as Record<PriorityTier, number>
  for (const c of officerQueue(s, now)) out[priorityOf(c, now)]++
  return out
}

/** Submitted applications grouped by the document used to apply, in DOCUMENTS order. */
export function casesByDocument(s: AppState): Record<DocumentType, Case[]> {
  const out = Object.fromEntries(DOCUMENT_ORDER.map(d => [d, [] as Case[]])) as Record<DocumentType, Case[]>
  for (const c of applications(s)) out[c.answers?.document ?? c.document.type].push(c)
  for (const d of DOCUMENT_ORDER) out[d].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  return out
}

/** The document a case applied with (the assistant answer wins over the persona's main document). */
export const documentOf = (c: Case): DocumentType => c.answers?.document ?? c.document.type

export function countsByDocument(s: AppState): Record<DocumentType, number> {
  const g = casesByDocument(s)
  return Object.fromEntries(DOCUMENT_ORDER.map(d => [d, g[d].length])) as Record<DocumentType, number>
}

/** Submitted applications per route. */
export function countsByRoute(s: AppState): Record<RouteId, number> {
  const out = Object.fromEntries(ROUTE_ORDER.map(r => [r, 0])) as Record<RouteId, number>
  for (const c of applications(s)) if (c.route) out[c.route]++
  return out
}

const START_ACTIONS = new Set<AuditAction>(['case_started', 'correction_submitted'])
const DECISION_ACTIONS = new Set<AuditAction>(['auto_approved_basic', 'officer_approved_basic', 'officer_approved_advanced', 'officer_refused'])

/**
 * Minutes from submission to the first decision of each attempt, from the audit trail
 * (start = 'case_started' or 'correction_submitted'; decision = auto/officer approval or refusal).
 */
export function decisionDurationsMinutes(audit: AuditEvent[]): number[] {
  const open = new Map<string, number>()
  const out: number[] = []
  const sorted = [...audit].sort((a, b) => a.at.localeCompare(b.at))
  for (const e of sorted) {
    if (!e.caseId) continue
    if (START_ACTIONS.has(e.action)) open.set(e.caseId, new Date(e.at).getTime())
    else if (DECISION_ACTIONS.has(e.action) && open.has(e.caseId)) {
      out.push((new Date(e.at).getTime() - open.get(e.caseId)!) / 60_000)
      open.delete(e.caseId)
    }
  }
  return out
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const sameLocalDay = (iso: string, now: Date) => {
  const d = new Date(iso)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export interface LiveKpis {
  applicationsToday: number
  applicationsTotal: number
  awaitingDecision: number
  autoApproved: number
  officerDecided: number
  refusals: number
  corrections: number
  correctedApproved: number
  appealsOpen: number
  medianMinutesToDecision: number | null
  decisionsMeasured: number
}

export function liveKpis(s: AppState, now: Date = new Date()): LiveKpis {
  const apps = applications(s)
  let autoApproved = 0, officerDecided = 0, refusals = 0
  for (const c of apps) {
    for (const d of c.decisions) {
      if (d.by.kind === 'system') autoApproved++
      else officerDecided++
      if (d.outcome === 'refused' || d.outcome === 'revoked') refusals++
    }
  }
  const durations = decisionDurationsMinutes(s.audit)
  return {
    applicationsToday: apps.filter(c => c.submittedAt && sameLocalDay(c.submittedAt, now)).length,
    applicationsTotal: apps.length,
    awaitingDecision: officerQueue(s, now).length,
    autoApproved,
    officerDecided,
    refusals,
    corrections: apps.filter(c => c.attempt >= 2).length,
    correctedApproved: apps.filter(c => c.correctedAfterRefusal).length,
    appealsOpen: apps.filter(c => c.appeal?.state === 'open').length,
    medianMinutesToDecision: median(durations),
    decisionsMeasured: durations.length,
  }
}

/** Newest audit events first, for the live activity feed. */
export function recentActivity(audit: AuditEvent[], n = 8): AuditEvent[] {
  return [...audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, n)
}
