/**
 * Plausible past audit events for the background cases, so the audit trail is not empty on a
 * fresh demo. Deterministic for a given `now`. All fictional.
 */
import type { Actor, AppState, AuditEvent, Case } from '@/contract/types'
import { REJECTION_REASONS, SYSTEM_ACTOR } from '@/contract/seed'

export function seedHistory(state: AppState, now: Date): AppState {
  const events: AuditEvent[] = []
  let n = 0
  const at = (base: string, offsetSec: number) => new Date(new Date(base).getTime() + offsetSec * 1000).toISOString()
  const push = (c: Case, when: string, actor: Actor, action: AuditEvent['action'], detail: string, extra?: Partial<AuditEvent>) => {
    events.push({ id: `seed-${c.id}-${n++}`, caseId: c.id, at: when, actor, action, detail, ...extra })
  }

  for (const c of Object.values(state.cases)) {
    if (c.origin !== 'background' || !c.submittedAt) continue
    // Background cases carry a single timestamp; spread their history a few minutes *before* it,
    // ending at it, so nothing lands in the future.
    const end = c.submittedAt
    const start = at(end, -(c.checks.length * 20 + 240))
    const citizen: Actor = { kind: 'citizen', id: c.id, name: c.persona.name }
    push(c, start, citizen, 'case_started', `${c.persona.name} started an application with ${c.document.type}.`)
    push(c, at(start, 5), citizen, 'route_selected', `Route ${c.route} selected.`)
    push(c, at(start, 15), citizen, 'consent_given', 'Consent given for chip read, face check and residence check.')
    c.checks.forEach((r, i) => {
      const score = r.score !== undefined ? ` (score ${r.score.toFixed(2)})` : ''
      push(c, at(start, 30 + i * 20), SYSTEM_ACTOR, 'check_completed', `${r.id}: ${r.outcome}${score}. ${r.detail.en}`, { evidence: [r.id] })
    })
    const afterChecks = at(start, 30 + c.checks.length * 20 + 5)
    const all = c.checks.map(r => r.id)
    const autoBasic = c.decisions.find(d => d.outcome === 'approved_basic' && d.by.kind === 'system')
    if (autoBasic) {
      push(c, afterChecks, SYSTEM_ACTOR, 'auto_approved_basic',
        `All checks passed: basic level granted automatically.${c.route === 'B' || c.route === 'C' ? ' Advanced level queued for officer review.' : ''}`,
        { evidence: all })
    } else {
      const bad = c.checks.filter(r => r.outcome !== 'pass').map(r => r.id)
      push(c, afterChecks, SYSTEM_ACTOR, 'escalated_to_officer',
        `No automatic outcome; sent to an officer. Risk ${c.risk}. Flags: ${c.flags.map(f => f.code).join(', ') || 'none'}.`,
        { evidence: bad.length ? bad : all })
    }
    for (const d of c.decisions) {
      if (d.by.kind !== 'officer') continue
      if (d.outcome === 'approved_advanced') {
        push(c, end, d.by, 'officer_approved_advanced', `${d.by.name} approved the advanced level.`, { evidence: all })
      } else if (d.outcome === 'refused' && d.reasonId) {
        const ev = c.checks.filter(r => r.outcome === 'fail' || r.outcome === 'warn').map(r => r.id)
        push(c, at(end, -60), d.by, 'officer_refused', `${d.by.name} refused: ${REJECTION_REASONS[d.reasonId].officerLabel.en}.`, { evidence: ev, reasonId: d.reasonId })
      }
    }
    if (c.infoRequest) {
      push(c, end, c.infoRequest.by, 'info_requested', `${c.infoRequest.by.name} asked the citizen: "${c.infoRequest.message}"`)
    }
    if (c.appeal) {
      push(c, end, citizen, 'appeal_filed', `Appeal filed: "${c.appeal.text}"`)
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at))
  void now
  return { ...state, audit: [...state.audit, ...events] }
}
