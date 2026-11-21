/**
 * Store — Platform agent (A). Implements ClaveActions from contract/api.ts.
 *
 * - zustand hook `useClave` over AppState
 * - every action: new state → localStorage → BroadcastChannel (other tabs replace their state)
 * - simulated engine runs asynchronously in the tab that triggered it (see engine.ts)
 * - KEY RULE: only officerRefuse / officerRevoke can set 'not_approved' or add a refused/revoked
 *   decision, and both require a signed-in officer and a reasonId from REJECTION_REASONS.
 */
import { useCallback } from 'react'
import { create } from 'zustand'
import type {
  Actor, AppState, AuditAction, AuditEvent, Bilingual, Case, CheckId, Lang, RejectionReasonId,
} from '@/contract/types'
import type { ClaveActions } from '@/contract/api'
import {
  buildSeedState, CHANNEL_NAME, OFFICERS, REJECTION_REASONS, STATE_VERSION, STORAGE_KEY, SYSTEM_ACTOR,
} from '@/contract/seed'
import { checksForCase, decide, deriveFlags, OFFICER_VIDEO_DONE, riskOf, runCheck } from './engine'
import { seedHistory } from './history'
import { createAccountActions, resetSignUpCase } from './accounts'

export class ClaveRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClaveRuleError'
  }
}

/* ------------------------------------------------------------ timing */

/** Engine pacing (ms). `setEngineSpeed(0)` makes it instant (tests). */
export const ENGINE_TIMING = { toChecking: 600, perCheck: 500 }
let speed = 1
export function setEngineSpeed(factor: number) { speed = Math.max(0, factor) }
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms * speed))

/* --------------------------------------------------------- persistence */

const TAB_ID = Math.random().toString(36).slice(2)

function freshState(now = new Date()): AppState {
  return seedHistory(buildSeedState(now), now)
}

function loadState(): AppState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed && parsed.version === STATE_VERSION && parsed.cases) return parsed
    }
  } catch { /* corrupted or unavailable storage: fall back to seed */ }
  return freshState()
}

function save(s: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* quota / private mode */ }
}

export const useClave = create<AppState>(() => loadState())

/* ------------------------------------------------------------ live sync */

export interface LiveSyncState {
  /** ms timestamp of the last state received from another tab, or null. */
  lastRemoteAt: number | null
  /** Case the remote change was about (null for session/demo-wide changes). */
  caseId: string | null
  /** Audit action of the remote change, when there was one. */
  action: AuditAction | null
  /** Whether cross-tab sync is available in this browser. */
  connected: boolean
  /** Increments on every remote update (handy as a React key to replay an animation). */
  seq: number
}

export const useLiveSync = create<LiveSyncState>(() => ({
  lastRemoteAt: null, caseId: null, action: null, connected: false, seq: 0,
}))

interface SyncMessage { type: 'state'; from: string; state: AppState; caseId: string | null; action: AuditAction | null }

let channel: BroadcastChannel | null = null

function receive(msg: SyncMessage) {
  if (!msg || msg.type !== 'state' || msg.from === TAB_ID || msg.state?.version !== STATE_VERSION) return
  // The language is a per-tab view preference: the citizen phone and the officer desk can differ.
  const lang = useClave.getState().lang
  useClave.setState({ ...msg.state, lang }, true)
  useLiveSync.setState(s => ({ lastRemoteAt: Date.now(), caseId: msg.caseId, action: msg.action, seq: s.seq + 1 }))
}

if (typeof window !== 'undefined') {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = e => receive(e.data as SyncMessage)
    useLiveSync.setState({ connected: true })
  } else {
    // Fallback: the storage event fires in other tabs when localStorage changes.
    window.addEventListener('storage', e => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const state = JSON.parse(e.newValue) as AppState
        const last = state.audit[state.audit.length - 1]
        receive({ type: 'state', from: '', state, caseId: last?.caseId ?? null, action: last?.action ?? null })
      } catch { /* ignore */ }
    })
    useLiveSync.setState({ connected: true })
  }
}

/** Single write path: replace state, persist, broadcast. Receivers never re-broadcast (no echo). */
function commit(next: AppState, caseId: string | null = null, action: AuditAction | null = null) {
  useClave.setState(next, true)
  save(next)
  try { channel?.postMessage({ type: 'state', from: TAB_ID, state: next, caseId, action } satisfies SyncMessage) } catch { /* ignore */ }
}

/* -------------------------------------------------------------- helpers */

let evCounter = 0
const nowIso = () => new Date().toISOString()
const newId = () => `ev-${Date.now().toString(36)}-${(evCounter++).toString(36)}-${TAB_ID.slice(0, 4)}`

function audit(caseId: string | null, actor: Actor, action: AuditAction, detail: string, extra?: Pick<AuditEvent, 'evidence' | 'reasonId'>): AuditEvent {
  return { id: newId(), caseId, at: nowIso(), actor, action, detail, ...extra }
}

function getCase(caseId: string): Case {
  const c = useClave.getState().cases[caseId]
  if (!c) throw new ClaveRuleError(`Unknown case "${caseId}"`)
  return c
}

/** Apply a patch to one case and append audit events, as one commit. */
function updateCase(caseId: string, patch: (c: Case) => Partial<Case>, events: AuditEvent[] | ((c: Case) => AuditEvent[]), action?: AuditAction) {
  const s = useClave.getState()
  const c = s.cases[caseId]
  if (!c) throw new ClaveRuleError(`Unknown case "${caseId}"`)
  const evs = typeof events === 'function' ? events(c) : events
  const next: Case = { ...c, ...patch(c), updatedAt: nowIso() }
  commit({ ...s, cases: { ...s.cases, [caseId]: next }, audit: [...s.audit, ...evs] }, caseId, action ?? evs[evs.length - 1]?.action ?? null)
}

function citizenActor(c: Case): Actor {
  return { kind: 'citizen', id: c.id, name: c.persona.name }
}

function requireOfficer(): Actor {
  const id = useClave.getState().officerId
  const o = OFFICERS.find(x => x.id === id)
  if (!o) throw new ClaveRuleError('Only a signed-in officer can do this.')
  return { kind: 'officer', id: o.id, name: o.name }
}

function requireReason(reasonId: RejectionReasonId | undefined | null): RejectionReasonId {
  if (!reasonId || !Object.prototype.hasOwnProperty.call(REJECTION_REASONS, reasonId)) {
    throw new ClaveRuleError('A reason from the closed list is required to refuse or revoke.')
  }
  return reasonId
}

/* ---------------------------------------------------------- engine run */

/** Per-case run token: a reset (or a new run) cancels the old one. Local to this tab. */
const runs = new Map<string, number>()
let runSeq = 0

async function runEngine(caseId: string): Promise<void> {
  const token = ++runSeq
  runs.set(caseId, token)
  const alive = () => runs.get(caseId) === token && Boolean(useClave.getState().cases[caseId])

  await wait(ENGINE_TIMING.toChecking)
  if (!alive()) return
  updateCase(caseId, () => ({ status: 'checking' }), [])

  const ids = checksForCase(getCase(caseId))
  for (const id of ids) {
    await wait(ENGINE_TIMING.perCheck)
    if (!alive()) return
    const c = getCase(caseId)
    const r = runCheck(c, id)
    const score = r.score !== undefined ? ` (score ${r.score.toFixed(2)})` : ''
    updateCase(caseId, cc => ({ checks: [...cc.checks.filter(x => x.id !== id), r] }), [
      audit(caseId, SYSTEM_ACTOR, 'check_completed', `${id}: ${r.outcome}${score}. ${r.detail.en}`, { evidence: [id] }),
    ])
  }

  await wait(ENGINE_TIMING.perCheck / 2)
  if (!alive()) return
  applyOutcome(caseId)
  runs.delete(caseId)
}

function applyOutcome(caseId: string) {
  const c = getCase(caseId)
  const out = decide(c, c.checks)
  if (out.kind === 'auto_basic') {
    const at = nowIso()
    updateCase(caseId, () => ({
      status: 'approved',
      level: 'basic',
      advanced: out.advancedReview ? 'pending_review' : 'not_requested',
      flags: out.flags,
      risk: out.risk,
      awaitingOfficer: out.advancedReview,
      decisions: [...c.decisions, { outcome: 'approved_basic', by: SYSTEM_ACTOR, at }],
    }), [
      audit(caseId, SYSTEM_ACTOR, 'auto_approved_basic',
        `All checks passed: basic level granted automatically.${out.advancedReview ? ' Advanced level queued for officer review.' : ''}`,
        { evidence: out.evidence }),
    ])
    return
  }
  // to_officer: the engine never refuses. Status stays 'checking' while a person looks at it.
  let checks = c.checks
  let route = c.route
  if (out.toFallback) {
    route = 'FALLBACK'
    checks = [...checks.filter(r => r.id !== 'officer_video'), runCheck({ ...c, route }, 'officer_video')]
  }
  updateCase(caseId, () => ({
    status: 'checking',
    route,
    checks,
    flags: out.flags,
    risk: out.risk,
    awaitingOfficer: true,
  }), [
    audit(caseId, SYSTEM_ACTOR, 'escalated_to_officer',
      `${out.why}. Risk ${out.risk}.${out.toFallback ? ' Route changed to Fallback.' : ''} Flags: ${out.flags.map(f => f.code).join(', ') || 'none'}.`,
      { evidence: out.evidence }),
  ])
}

/* -------------------------------------------------------------- actions */

function resetLibraryCase(c: Case, fresh: AppState): Case {
  return { ...(fresh.cases[c.id] ?? c), updatedAt: nowIso() }
}

export const actions: ClaveActions = {
  /* ---- session ---- */
  setLang(lang: Lang) {
    if (lang !== 'en' && lang !== 'es') return
    const s = useClave.getState()
    if (s.lang === lang) return
    // Language is per tab: persisted (so a reload keeps it) but not broadcast.
    const next = { ...s, lang }
    useClave.setState(next, true)
    save(next)
  },
  officerSignIn(officerId: string) {
    const o = OFFICERS.find(x => x.id === officerId)
    if (!o) throw new ClaveRuleError(`Unknown officer "${officerId}"`)
    commit({ ...useClave.getState(), officerId })
  },
  officerSignOut() {
    commit({ ...useClave.getState(), officerId: null })
  },
  setActiveCitizenCase(caseId: string | null) {
    if (caseId !== null) getCase(caseId)
    commit({ ...useClave.getState(), activeCitizenCaseId: caseId }, caseId)
  },

  /* ---- citizen flow ---- */
  startCase(caseId, answers, route) {
    const c = getCase(caseId)
    if (c.status !== 'draft') throw new ClaveRuleError('This case has already been submitted. Reset it to start again.')
    const actor = citizenActor(c)
    const s = useClave.getState()
    const next: Case = { ...c, answers, route, updatedAt: nowIso() }
    commit({
      ...s,
      activeCitizenCaseId: caseId,
      cases: { ...s.cases, [caseId]: next },
      audit: [
        ...s.audit,
        audit(caseId, actor, 'case_started', `${c.persona.name} started an application with ${answers.document}${answers.assisted ? ' (assisted mode)' : ''}.`),
        audit(caseId, actor, 'route_selected', `Route ${route} selected.`),
      ],
    }, caseId, 'route_selected')
  },
  giveConsent(caseId) {
    const c = getCase(caseId)
    if (c.consentGiven) return
    updateCase(caseId, () => ({ consentGiven: true }), [
      audit(caseId, citizenActor(c), 'consent_given', 'Consent given for chip read, face check and residence check.'),
    ])
  },
  async submitForVerification(caseId) {
    const c = getCase(caseId)
    if (c.status !== 'draft') throw new ClaveRuleError('This case has already been submitted.')
    if (!c.route || !c.answers) throw new ClaveRuleError('Choose a route first (startCase).')
    updateCase(caseId, () => ({
      status: 'received', attempt: 1, checks: [], flags: [], risk: 'low', awaitingOfficer: false, submittedAt: nowIso(),
    }), [], 'case_started')
    await runEngine(caseId)
  },
  respondToInfoRequest(caseId, text) {
    const c = getCase(caseId)
    if (c.status !== 'need_info' || !c.infoRequest) throw new ClaveRuleError('There is no open request for information.')
    const at = nowIso()
    updateCase(caseId, cc => ({
      status: 'checking',
      awaitingOfficer: true,
      infoRequest: cc.infoRequest ? { ...cc.infoRequest, response: { text, at } } : cc.infoRequest,
    }), [audit(caseId, citizenActor(c), 'info_provided', `Citizen answered the officer: "${text}"`)])
  },
  fileAppeal(caseId, text) {
    const c = getCase(caseId)
    const last = c.decisions[c.decisions.length - 1]
    const lastIsRefusal = last?.outcome === 'refused' || last?.outcome === 'revoked'
    if (c.status !== 'not_approved' && !lastIsRefusal) throw new ClaveRuleError('Only a refused decision can be appealed.')
    if (c.appeal?.state === 'open') throw new ClaveRuleError('An appeal is already open.')
    if (c.appeal?.state === 'dismissed') throw new ClaveRuleError('An appeal on this application was already reviewed and dismissed.')
    const appeal = { text, at: nowIso(), state: 'open' as const }
    updateCase(caseId, cc => {
      const withAppeal = { ...cc, appeal }
      const flags = [...cc.flags.filter(f => f.code !== 'appeal_filed'), ...deriveFlags(withAppeal, []).filter(f => f.code === 'appeal_filed')]
      return { appeal, awaitingOfficer: true, flags, risk: riskOf(flags) }
    }, [audit(caseId, citizenActor(c), 'appeal_filed', `Appeal filed: "${text}"`)])
  },
  async submitCorrection(caseId, note) {
    const c = getCase(caseId)
    if (c.status !== 'not_approved') throw new ClaveRuleError('Only a case that was not approved can be corrected.')
    updateCase(caseId, cc => ({
      status: 'received',
      attempt: cc.attempt + 1,
      checks: [],
      flags: [],
      risk: 'low',
      awaitingOfficer: false,
      infoRequest: undefined,
      submittedAt: nowIso(),
    }), [audit(caseId, citizenActor(c), 'correction_submitted', `Citizen says the cause was corrected: "${note}". Running attempt ${c.attempt + 1}.`)])
    await runEngine(caseId)
  },

  bookVideoCall(caseId, slotIso) {
    const c = getCase(caseId)
    if (Number.isNaN(Date.parse(slotIso))) throw new ClaveRuleError('Pick one of the available times.')
    updateCase(caseId, () => ({ videoCallSlot: slotIso }), [
      audit(caseId, citizenActor(c), 'video_call_booked', `Citizen booked a video call with an officer for ${new Date(slotIso).toISOString().slice(11, 16)} UTC.`),
    ])
  },

  /* ---- officer ---- */
  officerApprove(caseId, note) {
    const by = requireOfficer()
    const c = getCase(caseId)
    const at = nowIso()
    const evidence = c.checks.filter(r => r.outcome === 'pass' || r.outcome === 'warn').map(r => r.id)
    const noteTxt = note ? ` Note: ${note}` : ''
    const prior = c.decisions.some(d => d.outcome === 'refused' || d.outcome === 'revoked')
    const appeal = c.appeal?.state === 'open' ? { ...c.appeal, state: 'upheld' as const } : c.appeal
    if (c.checks.some(r => r.id === 'officer_video' && r.outcome === 'pending')) {
      throw new ClaveRuleError('Complete the video call before approving.')
    }

    if (c.level === 'none') {
      const flags = c.flags.filter(f => f.code !== 'appeal_filed')
      updateCase(caseId, () => ({
        status: 'approved',
        level: 'basic',
        awaitingOfficer: false,
        appeal,
        flags,
        correctedAfterRefusal: c.correctedAfterRefusal || prior,
        decisions: [...c.decisions, { outcome: 'approved_basic', by, at, note }],
      }), [audit(caseId, by, 'officer_approved_basic',
        `${by.name} approved the basic level.${prior ? ' Corrected after an earlier refusal.' : ''}${appeal?.state === 'upheld' && c.appeal?.state === 'open' ? ' Appeal upheld.' : ''}${noteTxt}`,
        { evidence })])
      return
    }
    // An upheld appeal against an advanced-only refusal grants the advanced level (basic was kept).
    const appealOnAdvanced = c.level === 'basic' && c.advanced !== 'granted' && c.appeal?.state === 'open'
    if (c.advanced === 'pending_review' || appealOnAdvanced) {
      updateCase(caseId, () => ({
        status: 'approved',
        level: 'advanced',
        advanced: 'granted',
        awaitingOfficer: false,
        appeal,
        flags: c.flags.filter(f => f.code !== 'advanced_level_review' && f.code !== 'appeal_filed'),
        correctedAfterRefusal: c.correctedAfterRefusal || prior,
        decisions: [...c.decisions, { outcome: 'approved_advanced', by, at, note }],
      }), [audit(caseId, by, 'officer_approved_advanced', `${by.name} approved the advanced level.${appealOnAdvanced ? ' Appeal upheld.' : ''}${noteTxt}`, { evidence })])
      return
    }
    throw new ClaveRuleError('Nothing to approve on this case.')
  },
  officerRequestInfo(caseId, message) {
    const by = requireOfficer()
    const c = getCase(caseId)
    if (!message?.trim()) throw new ClaveRuleError('Write what you need from the citizen.')
    if (c.status === 'draft') throw new ClaveRuleError('The case has not been submitted yet.')
    const at = nowIso()
    updateCase(caseId, () => ({
      status: 'need_info',
      awaitingOfficer: false,
      infoRequest: { message, at, by },
    }), [audit(caseId, by, 'info_requested', `${by.name} asked the citizen: "${message}"`)])
  },
  officerRefuse(caseId, reasonId, note) {
    // KEY RULE: officer + reason from the closed list, checked before anything else.
    const by = requireOfficer()
    const reason = requireReason(reasonId)
    const c = getCase(caseId)
    if (c.status === 'draft') throw new ClaveRuleError('The case has not been submitted yet.')
    // A granted level can only be taken back with Revoke. Refuse is for open decisions: a pending
    // application, a pending advanced review, or an open appeal.
    const openDecision = c.level === 'none' || c.advanced === 'pending_review' || c.appeal?.state === 'open'
    if (c.level === 'advanced' || !openDecision) throw new ClaveRuleError('This level is already granted. Use Revoke, with a reason, to take it back.')
    const at = nowIso()
    const evidence = c.checks.filter(r => r.outcome === 'fail' || r.outcome === 'warn').map(r => r.id)
    const appeal = c.appeal?.state === 'open' ? { ...c.appeal, state: 'dismissed' as const } : c.appeal
    const noteTxt = note ? ` Note: ${note}` : ''
    const dismissed = c.appeal?.state === 'open' ? ' Appeal dismissed.' : ''
    const decision = { outcome: 'refused' as const, by, reasonId: reason, note, at }

    if (c.level !== 'none' && c.advanced !== 'granted' && (c.advanced === 'pending_review' || c.appeal?.state === 'open')) {
      // Basic is already granted: the refusal applies to the advanced level only; basic stays.
      updateCase(caseId, () => ({
        advanced: 'not_requested',
        awaitingOfficer: false,
        appeal,
        flags: c.flags.filter(f => f.code !== 'advanced_level_review'),
        decisions: [...c.decisions, decision],
      }), [audit(caseId, by, 'officer_refused', `${by.name} refused the advanced level: ${REJECTION_REASONS[reason].officerLabel.en}. Basic level kept.${dismissed}${noteTxt}`, { evidence: evidence.length ? evidence : undefined, reasonId: reason })])
      return
    }
    updateCase(caseId, () => ({
      status: 'not_approved',
      level: 'none',
      advanced: 'not_requested',
      awaitingOfficer: false,
      appeal,
      decisions: [...c.decisions, decision],
    }), [audit(caseId, by, 'officer_refused', `${by.name} refused: ${REJECTION_REASONS[reason].officerLabel.en}.${dismissed}${noteTxt}`, { evidence: evidence.length ? evidence : undefined, reasonId: reason })])
  },
  officerRevoke(caseId, reasonId, note) {
    const by = requireOfficer()
    const reason = requireReason(reasonId)
    const c = getCase(caseId)
    if (c.level === 'none') throw new ClaveRuleError('There is no granted level to revoke.')
    const at = nowIso()
    updateCase(caseId, () => ({
      status: 'not_approved',
      level: 'none',
      advanced: 'not_requested',
      awaitingOfficer: false,
      appeal: c.appeal?.state === 'open' ? { ...c.appeal, state: 'dismissed' } : c.appeal,
      decisions: [...c.decisions, { outcome: 'revoked', by, reasonId: reason, note, at }],
    }), [audit(caseId, by, 'officer_revoked', `${by.name} revoked the ${c.level} level: ${REJECTION_REASONS[reason].officerLabel.en}.${note ? ` Note: ${note}` : ''}`, { reasonId: reason })])
  },
  officerCompleteVideoCall(caseId) {
    const by = requireOfficer()
    const c = getCase(caseId)
    if (!c.checks.some(r => r.id === 'officer_video' && r.outcome === 'pending')) {
      throw new ClaveRuleError('There is no pending video call on this case.')
    }
    const checks = c.checks.map(r => (r.id === 'officer_video' ? OFFICER_VIDEO_DONE : r))
    updateCase(caseId, () => ({ checks, awaitingOfficer: true }), [
      audit(caseId, by, 'check_completed', `${by.name} completed the video call: officer_video pass.`, { evidence: ['officer_video'] }),
    ])
  },

  /* ---- demo ---- */
  resetDemo() {
    runs.clear()
    const s = useClave.getState()
    const fresh = freshState(new Date())
    const ev = audit(null, SYSTEM_ACTOR, 'demo_reset', 'Demo reset to the seed state.')
    // Keep the per-tab language and the signed-in officer so the presenter is not logged out.
    commit({ ...fresh, lang: s.lang, officerId: s.officerId, audit: [...fresh.audit, ev] }, null, 'demo_reset')
  },
  resetCase(caseId) {
    const c = getCase(caseId)
    if (c.origin === 'background') throw new ClaveRuleError('Only library and sign-up cases can be reset.')
    runs.delete(caseId)
    const s = useClave.getState()
    const fresh = buildSeedState(new Date())
    commit({
      ...s,
      cases: { ...s.cases, [caseId]: c.origin === 'signup' ? resetSignUpCase(c) : resetLibraryCase(c, fresh) },
      audit: [...s.audit.filter(e => e.caseId !== caseId || e.action === 'account_created'), audit(caseId, SYSTEM_ACTOR, 'demo_reset', `Case ${caseId} reset to draft.`)],
    }, caseId, 'demo_reset')
  },

  /* ---- citizen accounts (src/core/accounts.ts) ---- */
  ...createAccountActions({ get: () => useClave.getState(), commit, audit }),
}

/* ---------------------------------------------------------- translation */

/** t(bilingual) in the current language. Outside React, or inside a component that subscribes to `lang`. */
export const t = (b: Bilingual): string => b[useClave.getState().lang] ?? b.en

/** Hook: returns a t bound to the current language; the component re-renders on language change. */
export function useT(): (b: Bilingual) => string {
  const lang = useClave(s => s.lang)
  return useCallback((b: Bilingual) => b[lang] ?? b.en, [lang])
}

/** Hook: current language. */
export const useLang = () => useClave(s => s.lang)

/** Convenience for UIs: the checks the engine will run for a case (route + guardian). */
export const plannedChecks = (c: Case): CheckId[] => checksForCase(c)

/** Exposed for tests and the debug console. */
export const getState = () => useClave.getState()

