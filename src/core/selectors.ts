/* Derived selectors — Platform agent (A). Implements ClaveSelectors from contract/api.ts. */
import type { AppState, AuditEvent, Case, Lang, PriorityTier } from '@/contract/types'
import { PRIORITY_AGE_BUMP_HOURS, PRIORITY_TIERS } from '@/contract/seed'

/* ------------------------------------------------------------ priority
 * Tier mapping (first match wins):
 *   P1 any high-risk flag · P2 open appeal · P3 citizen answered an info request (status 'checking') ·
 *   P5 Fallback route with the officer video call pending · P6 basic granted + advanced pending_review and
 *   nothing else flagged · P4 everything else that needs a decision.
 * Age bump: waiting longer than PRIORITY_AGE_BUMP_HOURS moves a case up one tier (never above P1). A bumped
 * case joins the back of its new tier (after the cases native to it), so fresh fraud still comes first.
 */
export const TIER_ORDER: PriorityTier[] = PRIORITY_TIERS.map(t => t.id)
const tierIndex = (t: PriorityTier) => TIER_ORDER.indexOf(t)

/** When the case (re)entered the queue: submission, an open appeal, or the citizen's answer. */
export function waitingSince(c: Case): string {
  const times = [c.submittedAt ?? c.updatedAt]
  if (c.appeal?.state === 'open') times.push(c.appeal.at)
  if (c.status === 'checking' && c.infoRequest?.response) times.push(c.infoRequest.response.at)
  return times.reduce((a, b) => (b > a ? b : a))
}

/** The tier before the age bump. */
export function baseTierOf(c: Case): PriorityTier {
  if (c.risk === 'high' || c.flags.some(f => f.severity === 'high')) return 'p1_high_risk'
  if (c.appeal?.state === 'open') return 'p2_appeal'
  if (c.status === 'checking' && c.infoRequest?.response) return 'p3_citizen_replied'
  if (c.route === 'FALLBACK' && c.checks.some(k => k.id === 'officer_video' && k.outcome === 'pending')) return 'p5_video_call'
  if (c.level === 'basic' && c.advanced === 'pending_review' && c.flags.every(f => f.code === 'advanced_level_review')) return 'p6_advanced_review'
  return 'p4_medium_risk'
}

/** Hours the case has been waiting in the queue. */
export function waitingHours(c: Case, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(waitingSince(c)).getTime()) / 3_600_000)
}

/** True when the age bump moved this case up a tier. */
export function isAgeBumped(c: Case, now: Date = new Date()): boolean {
  return baseTierOf(c) !== 'p1_high_risk' && waitingHours(c, now) > PRIORITY_AGE_BUMP_HOURS
}

/** The tier a queued case sits in, with the age bump applied. */
export function priorityOf(c: Case, now: Date = new Date()): PriorityTier {
  const base = baseTierOf(c)
  return isAgeBumped(c, now) ? TIER_ORDER[Math.max(0, tierIndex(base) - 1)] : base
}

/** Cases waiting for an officer: by tier (with age bump), cases native to the tier before bumped ones, then oldest first. */
export function officerQueue(s: AppState, now: Date = new Date()): Case[] {
  const key = new Map<string, [number, number, string]>()
  for (const c of Object.values(s.cases)) {
    if (c.awaitingOfficer) key.set(c.id, [tierIndex(priorityOf(c, now)), tierIndex(baseTierOf(c)), waitingSince(c)])
  }
  return Object.values(s.cases)
    .filter(c => c.awaitingOfficer)
    .sort((a, b) => {
      const [ta, ba, wa] = key.get(a.id)!
      const [tb, bb, wb] = key.get(b.id)!
      return ta - tb || ba - bb || wa.localeCompare(wb)
    })
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
