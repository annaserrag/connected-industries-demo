/* Derived selectors — Platform agent (A). Implements ClaveSelectors from contract/api.ts. */
import type { AppState, AuditEvent, Case, Lang, PriorityTier, RejId } from '@/contract/types'
import { REJ_ORDER } from '@/contract/messages'
import { PRIORITY_AGE_BUMP_HOURS, PRIORITY_TIERS } from '@/contract/seed'

/* ------------------------------------------------------------ priority
 * Tier mapping (first match wins):
 *   P1 any high-risk flag · P2 open review request (appeal) · P3 citizen answered an info request ·
 *   P5 Fallback: the citizen joined the video-call room or a call is live · P6 basic granted + advanced
 *   pending_review and only low flags (e.g. "Assisted session") · P4 everything else that needs a decision.
 * A case always stays in the tier that matches its reason. Waiting time never moves it to another tier.
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

const inVideoCallTier = (c: Case) =>
  c.route === 'F' && (c.session?.videoCall?.state === 'waiting' || c.session?.videoCall?.state === 'live' || Boolean(c.session?.fallback?.joined && c.session?.videoCall?.state !== 'ended'))

/** The priority tier that matches the reason the case needs an officer. */
export function baseTierOf(c: Case): PriorityTier {
  if (c.risk === 'high' || c.flags.some(f => f.severity === 'high')) return 'p1_high_risk'
  if (c.appeal?.state === 'open') return 'p2_appeal'
  if (c.status === 'checking' && c.infoRequest?.response) return 'p3_citizen_replied'
  if (inVideoCallTier(c)) return 'p5_video_call'
  if (c.level === 'basic' && c.advanced === 'pending_review' && c.flags.every(f => f.severity === 'low')) return 'p6_advanced_review'
  return 'p4_medium_risk'
}

/** Hours the case has been waiting in the queue. */
export function waitingHours(c: Case, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(waitingSince(c)).getTime()) / 3_600_000)
}

/** True when the case has waited longer than PRIORITY_AGE_BUMP_HOURS: it goes first within its own tier. */
export function isAgeBumped(c: Case, now: Date = new Date()): boolean {
  return waitingHours(c, now) > PRIORITY_AGE_BUMP_HOURS
}

/** The tier a queued case sits in. Waiting time never moves a case into another tier. */
export function priorityOf(c: Case, _now: Date = new Date()): PriorityTier {
  return baseTierOf(c)
}

/** Cases waiting for an officer: by tier, overdue cases first within the tier, then oldest first. */
export function officerQueue(s: AppState, now: Date = new Date()): Case[] {
  const key = new Map<string, [number, number, string]>()
  for (const c of Object.values(s.cases)) {
    if (c.awaitingOfficer) key.set(c.id, [tierIndex(baseTierOf(c)), isAgeBumped(c, now) ? 0 : 1, waitingSince(c)])
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

/* ---- lists ---- */

/** Open review requests (Apelaciones), oldest first. */
export function appealsQueue(s: AppState, now: Date = new Date()): Case[] {
  return officerQueue(s, now).filter(c => c.appeal?.state === 'open')
}

/** Advanced-level reviews (Revisión del nivel avanzado), oldest first. */
export function advancedQueue(s: AppState, now: Date = new Date()): Case[] {
  return officerQueue(s, now).filter(c => c.level === 'basic' && c.advanced === 'pending_review' && c.appeal?.state !== 'open')
}

/** Fallback cases waiting for a video call. */
export function videoCallQueue(s: AppState, now: Date = new Date()): Case[] {
  return officerQueue(s, now).filter(inVideoCallTier)
}

/* ---- dashboard counters (live, computed from state) ---- */

export interface DashboardCounters {
  /** Applications sent or decided (drafts excluded). */
  applications: number
  /** Basic level granted by the rules, with no person involved. */
  autoApprovals: number
  /** Applications where the basic-level decision needed (or is waiting for) an officer. */
  neededOfficer: number
  /** Officer refusals by reason (latest refusal per application, appeals included). */
  refusalsByReason: Record<RejId, number>
  /** Refusals later corrected on review. */
  correctedOnReview: number
  /** Applications decided under a proposed rule (route B, C-assisted, X, Fallback for foreigners). */
  decidedUnderProposedRule: number
  /** Open review requests. */
  appealsOpen: number
}

export function dashboardCounters(s: AppState): DashboardCounters {
  const refusalsByReason = Object.fromEntries(REJ_ORDER.map(r => [r, 0])) as Record<RejId, number>
  let applications = 0, autoApprovals = 0, neededOfficer = 0, correctedOnReview = 0, decidedUnderProposedRule = 0, appealsOpen = 0
  for (const c of Object.values(s.cases)) {
    if (c.status === 'draft' && !c.submittedAt) continue
    applications++
    const basic = c.decisions.find(d => d.outcome === 'approved_basic')
    if (basic?.by.kind === 'system') autoApprovals++
    else if (basic || c.decisions.some(d => d.outcome === 'refused') || (c.awaitingOfficer && c.level === 'none')) neededOfficer++
    for (const d of c.decisions) if ((d.outcome === 'refused' || d.outcome === 'revoked') && d.reasonId) refusalsByReason[d.reasonId]++
    if (c.correctedAfterRefusal) correctedOnReview++
    if (c.policyProposal && c.decisions.length) decidedUnderProposedRule++
    if (c.appeal?.state === 'open') appealsOpen++
  }
  return { applications, autoApprovals, neededOfficer, refusalsByReason, correctedOnReview, decidedUnderProposedRule, appealsOpen }
}

/* ---- extras ---- */

/** Preloaded demo accounts. */
export function libraryCases(s: AppState): Case[] {
  return Object.values(s.cases).filter(c => c.origin === 'library')
}

/** The whole audit log, newest first (for the audit trail page). */
export function auditNewestFirst(s: AppState): AuditEvent[] {
  return [...s.audit].sort((a, b) => b.at.localeCompare(a.at))
}
