/* Derived selectors — Platform agent (A). Implements ClaveSelectors from contract/api.ts. */
import type { AppState, AuditEvent, Case, Lang, RiskLevel } from '@/contract/types'

const RISK_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 }
const since = (c: Case) => c.submittedAt ?? c.updatedAt

/** Cases waiting for an officer, sorted: risk high→medium→low, then oldest first. */
export function officerQueue(s: AppState): Case[] {
  return Object.values(s.cases)
    .filter(c => c.awaitingOfficer)
    .sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk] || since(a).localeCompare(since(b)))
}

/** Audit events for one case, oldest first. */
export function caseAudit(s: AppState, caseId: string): AuditEvent[] {
  return s.audit.filter(e => e.caseId === caseId).sort((a, b) => a.at.localeCompare(b.at))
}

/** Human relative time: "just now" / "ahora mismo", "3 min ago" / "hace 3 min", "2 h ago", "3 d ago". */
export function relativeTime(iso: string, lang: Lang, now: number = Date.now()): string {
  const sec = Math.round((now - new Date(iso).getTime()) / 1000)
  const es = lang === 'es'
  if (!Number.isFinite(sec) || sec < 45) return es ? 'ahora mismo' : 'just now'
  const min = Math.max(1, Math.round(sec / 60))
  if (min < 60) return es ? `hace ${min} min` : `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return es ? `hace ${h} h` : `${h} h ago`
  const d = Math.round(h / 24)
  return es ? `hace ${d} d` : `${d} d ago`
}

/* ---- extras beyond the contract ---- */

/** Library cases in demo-panel order. */
export function libraryCases(s: AppState): Case[] {
  return Object.values(s.cases).filter(c => c.origin === 'library')
}

/** The whole audit log, newest first (for the audit trail page). */
export function auditNewestFirst(s: AppState): AuditEvent[] {
  return [...s.audit].sort((a, b) => b.at.localeCompare(a.at))
}
