/**
 * Store — implements ClaveActions from contract/api.ts.
 *
 * - zustand hook `useClave` over AppState
 * - every action: new state → localStorage → BroadcastChannel (other tabs replace their state)
 * - the citizen actions record INPUTS only (answers, consents, chip presses, camera inputs, uploads, contact);
 *   results come from the world (contract/world.ts) and the rules (core/engine.ts)
 * - KEY RULE: only officerRefuse / officerRevoke / officerDecideAppeal('uphold') can set 'not_approved' or add a
 *   refused/revoked decision, and they require a signed-in officer and a reason from the closed list REJ-01…08.
 *   A review request must be decided by an officer other than the one who refused.
 */
import { useCallback } from 'react'
import { create } from 'zustand'
import type {
  Actor, AppState, AuditAction, AuditEvent, AssistantAnswers, Bilingual, CameraInput, Case, CheckId, HelperRelation, Lang,
  PersonData, RejId, Session, TypedDocument, Upload, Who,
} from '@/contract/types'
import type { ClaveActions, RouteAnswersInput, RouteRecommendation, SubmitResult, UploadInput } from '@/contract/api'
import {
  buildSeedState, CHANNEL_NAME, HELPER_RELATIONS, OFFICERS, REJECTION_REASONS, STATE_VERSION, STORAGE_KEY, SYSTEM_ACTOR,
  ageFrom, countryByName, displayDocument, fullName, isFictionalDniNie, hasDniNieShape, isProposedRule, newDraftCase, normaliseDocNumber,
  personaOf, recommendRoute, statusMsgId,
} from '@/contract/seed'
import { DEMO_SMS_CODE, HELPER_RELATION_LABELS } from '@/contract/messages'
import { lookupDocument } from '@/contract/world'
import { decide, evaluate, readFace, readVideo, riskOf, subjectDocument, type RuleResult } from './engine'
import { seedHistory } from './history'
import { createAccountActions } from './accounts'
import { createStaffActions } from './staff'

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

type AuditExtra = Pick<AuditEvent, 'evidence' | 'reasonId' | 'ruleId' | 'tags'>
function audit(caseId: string | null, actor: Actor, action: AuditAction, detail: string, extra?: AuditExtra): AuditEvent {
  const clean = extra ? Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))) : {}
  return { id: newId(), caseId, at: nowIso(), actor, action, detail, ...clean }
}

function getCase(caseId: string): Case {
  const c = useClave.getState().cases[caseId]
  if (!c) throw new ClaveRuleError(`Unknown case "${caseId}"`)
  return c
}

const fail = (m: string): never => { throw new ClaveRuleError(m) }

/** Keeps the legacy (deprecated) fields in sync with the session, for the screens still migrating. */
function withDerived(c: Case): Case {
  const s = c.session
  const helping = s.who === 'helping'
  const minor = s.who === 'child' && s.minor
  const next: Case = { ...c }
  next.consentGiven = Boolean(s.consents.at && !s.consents.declined)
  if (c.answers) {
    next.answers = { ...c.answers, who: s.who, assisted: helping, forMinor: s.who === 'child', nfc: s.nfc, euEid: s.euEid, hasEuEid: s.euEid === 'yes' }
  }
  next.assisted = helping && s.helper
    ? { helperName: s.helper.name, relation: HELPER_RELATION_LABELS[s.helper.relation], deviceOwner: s.helper.name, applicantPhone: s.contact?.mobile }
    : undefined
  if (minor) {
    next.persona = personaOf(s.minor!, s.minor!.document)
    next.document = displayDocument(s.minor!.document)
    next.guardian = { name: fullName(c.typed.data), relation: { en: 'parent or legal guardian', es: 'madre, padre o tutor legal' }, document: displayDocument(c.typed), route: 'B' }
  } else {
    next.persona = personaOf(c.typed.data, c.typed)
    next.document = displayDocument(c.typed)
    next.guardian = undefined
  }
  next.policyProposal = isProposedRule(s.route ?? c.route, c.answers ? { ...c.answers, who: s.who } : null)
  return next
}

/** Apply a patch to one case and append audit events, as one commit. */
function updateCase(caseId: string, patch: (c: Case) => Partial<Case>, events: AuditEvent[] | ((c: Case) => AuditEvent[]), action?: AuditAction) {
  const s = useClave.getState()
  const c = s.cases[caseId]
  if (!c) throw new ClaveRuleError(`Unknown case "${caseId}"`)
  const evs = typeof events === 'function' ? events(c) : events
  const next = withDerived({ ...c, ...patch(c), updatedAt: nowIso() })
  commit({ ...s, cases: { ...s.cases, [caseId]: next }, audit: [...s.audit, ...evs] }, caseId, action ?? evs[evs.length - 1]?.action ?? null)
}

function patchSession(c: Case, p: Partial<Session>): Session {
  return { ...c.session, ...p }
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

function requireReason(reasonId: RejId | undefined | null): RejId {
  if (!reasonId || !Object.prototype.hasOwnProperty.call(REJECTION_REASONS, reasonId)) {
    throw new ClaveRuleError('A reason from the closed list (REJ-01…REJ-08) is required to refuse or revoke.')
  }
  return reasonId
}

/** True while the citizen is still doing the checks (nothing decided, nobody in charge yet). */
function inFlow(c: Case): boolean {
  return !c.submittedAt && !c.awaitingOfficer && c.level === 'none' && c.status !== 'not_approved' && c.status !== 'approved'
    && !c.session.fallback?.joined && !c.session.fallback?.comeBackLater
}
function requireFlow(c: Case) {
  if (!inFlow(c)) fail('This step is closed: the application is already with the rules or a person.')
}
function requireRoute(c: Case) {
  if (!c.session.route) fail('Answer the route assistant first (setAnswers).')
}

const advancedEligible = (c: Case) => (c.session.route === 'B' || c.session.route === 'C') && c.session.who !== 'child'
const tagsFor = (c: Case, extra: string[] = []) => [
  ...extra,
  ...(c.policyProposal ? ['Proposed rule'] : []),
  ...(c.session.who === 'helping' ? ['Assisted session'] : []),
]

/* ----------------------------------------------------------- uploads */

export const UPLOAD_MAX_BYTES = 1.5 * 1024 * 1024
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/

/** Validates a data URL image ≤ 1.5 MB. Throws ClaveRuleError otherwise. */
export function toUpload(file: UploadInput): Upload {
  const m = IMAGE_DATA_URL.exec(file?.dataUrl ?? '')
  if (!m) fail('Add an image (PNG, JPG, WEBP or GIF).')
  const b64 = m![2].replace(/\s+/g, '')
  const size = Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
  if (size > UPLOAD_MAX_BYTES) fail('The image is larger than 1.5 MB. Choose a smaller one.')
  const name = (file.name ?? '').trim().slice(0, 120) || 'image'
  return { name, dataUrl: file.dataUrl, at: nowIso(), mime: m![1], size }
}

/* ------------------------------------------------------- applying rules */

/** Writes the result of decide() onto the case (fallback offered / to an officer / automatic basic). */
function applyRule(caseId: string, r: RuleResult, actor: Actor = SYSTEM_ACTOR) {
  const at = nowIso()
  const common: Partial<Case> = {
    checks: r.checks, flags: r.flags, risk: r.risk, aiReason: r.aiReason, discrepancies: r.discrepancies,
    suggestedReason: r.suggestedReason, ruleId: r.ruleId ?? undefined, citizenMsgs: r.citizenMsgs,
  }
  if (r.kind === 'fallback') {
    updateCase(caseId, cc => ({
      ...common,
      status: r.fallback === 'consent' || r.fallback === 'no_nfc' ? cc.status : 'need_info',
      awaitingOfficer: false,
      session: patchSession(cc, { fallback: { offered: r.fallback!, joined: false, at } }),
    }), [audit(caseId, actor, 'fallback_offered', r.auditText, { evidence: r.evidence, ruleId: r.ruleId ?? undefined })])
    return
  }
  if (r.kind === 'to_officer') {
    updateCase(caseId, cc => ({
      ...common,
      status: 'checking',
      awaitingOfficer: true,
      attempt: Math.max(1, cc.attempt),
      submittedAt: cc.submittedAt ?? at,
    }), cc => [audit(caseId, SYSTEM_ACTOR, 'escalated_to_officer', `${r.auditText}. Flags: ${r.flags.map(f => f.code).join(', ') || 'none'}.`, { evidence: r.evidence, ruleId: r.ruleId ?? undefined, tags: tagsFor(cc) })])
    return
  }
  if (r.kind === 'auto_basic') {
    updateCase(caseId, cc => ({
      ...common,
      status: 'approved',
      level: 'basic',
      advanced: r.advancedReview ? 'pending_review' : 'not_requested',
      awaitingOfficer: r.advancedReview,
      decisions: [...cc.decisions, { outcome: 'approved_basic', by: SYSTEM_ACTOR, at, ruleId: r.ruleId ?? undefined }],
    }), cc => [audit(caseId, SYSTEM_ACTOR, 'auto_approved_basic', r.auditText, { evidence: r.evidence, ruleId: r.ruleId ?? undefined, tags: tagsFor(cc) })])
  }
}

/* ---------------------------------------------------------- submit run */

/** Per-case run token: a reset (or a new run) cancels the old one. Local to this tab. */
const runs = new Map<string, number>()
let runSeq = 0

async function runSubmit(caseId: string): Promise<SubmitResult> {
  const token = ++runSeq
  runs.set(caseId, token)
  const alive = () => runs.get(caseId) === token && Boolean(useClave.getState().cases[caseId])
  const cancelled: SubmitResult = { kind: 'continue', ruleId: null }

  await wait(ENGINE_TIMING.toChecking)
  if (!alive()) return cancelled
  updateCase(caseId, () => ({ status: 'checking', citizenMsgs: ['STA-2'] }), [])

  // Each check appears one by one so the screens can animate; results are already determined by the inputs.
  const planned = evaluate(getCase(caseId)).checks.filter(k => k.outcome !== 'pending' || k.id === 'guardian_link' || k.id === 'red_card')
  for (const r of planned) {
    await wait(ENGINE_TIMING.perCheck)
    if (!alive()) return cancelled
    const score = r.score !== undefined ? ` (score ${r.score.toFixed(2)}, simulated)` : ''
    updateCase(caseId, cc => ({ checks: [...cc.checks.filter(x => x.id !== r.id), r] }), [
      audit(caseId, SYSTEM_ACTOR, 'check_completed', `${r.id}: ${r.outcome}${score}. ${r.detail.en}`, { evidence: [r.id] }),
    ])
  }

  await wait(ENGINE_TIMING.perCheck / 2)
  if (!alive()) return cancelled
  const result = decide(getCase(caseId), new Date(), 'submit')
  applyRule(caseId, result)
  runs.delete(caseId)
  return { kind: result.kind, ruleId: result.ruleId }
}

/* ------------------------------------------------------- answers → route */

function answersFrom(c: Case, a: RouteAnswersInput): AssistantAnswers {
  const nationality = a.nationality ?? c.answers?.nationality ?? c.typed.nationality
  const group = a.nationalityGroup ?? countryByName(nationality)?.group ?? c.presetAnswers.nationalityGroup
  const who: Who = a.who ?? c.session.who ?? 'self'
  const unsure = a.document === 'UNSURE'
  const document = a.document === 'UNSURE' ? c.typed.type : a.document
  const euEid = group === 'eu' ? (a.euEid ?? null) : null
  return {
    nationalityGroup: group, nationality, document, documentUnsure: unsure || undefined, euEid, who, nfc: a.nfc ?? null,
    hasEuEid: euEid === 'yes', assisted: who === 'helping', forMinor: who === 'child',
  }
}

function applyAnswers(caseId: string, answers: AssistantAnswers): RouteRecommendation {
  const c = getCase(caseId)
  if (c.status !== 'draft' || c.session.consents.at) throw new ClaveRuleError('The route can only be changed before the consent.')
  const rec = recommendRoute(answers)
  const actor = citizenActor(c)
  const s = useClave.getState()
  const next = withDerived({
    ...c,
    answers,
    route: rec.route,
    session: { ...c.session, route: rec.route, who: answers.who ?? 'self', nfc: answers.nfc ?? null, euEid: answers.euEid ?? null },
    citizenMsgs: [rec.msg],
    updatedAt: nowIso(),
  })
  const desc = `${answers.documentUnsure ? 'document unknown' : answers.document}, ${answers.nationality ?? answers.nationalityGroup}${answers.euEid ? `, EU eID ${answers.euEid}` : ''}, who ${answers.who}${answers.nfc ? `, NFC ${answers.nfc}` : ''}`
  commit({
    ...s,
    activeCitizenCaseId: caseId,
    cases: { ...s.cases, [caseId]: next },
    audit: [...s.audit, audit(caseId, actor, 'route_selected', `Route assistant: ${desc}. Route ${rec.route} recommended (MSG-${rec.msg})${rec.policyProposal ? ', proposed rule' : ''}.`)],
  }, caseId, 'route_selected')
  return { route: rec.route, msg: rec.msg, policyProposal: rec.policyProposal }
}

const MOBILE_RE = /^\+?\d{9,15}$/
const cleanMobile = (m: string) => (m ?? '').replace(/[^\d+]/g, '')
/** Compare mobiles ignoring a +34 prefix. */
const sameMobile = (a?: string, bb?: string) => {
  const n = (x?: string) => cleanMobile(x ?? '').replace(/^\+?34(?=\d{9}$)/, '').replace(/^\+/, '')
  return Boolean(a && bb) && n(a) === n(bb)
}
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/

/* -------------------------------------------------------------- actions */

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

  /* ---- citizen journey ---- */
  setAnswers(caseId, a) {
    const c = getCase(caseId)
    if (!a || !a.document) fail('Choose a document (or "I am not sure").')
    return applyAnswers(caseId, answersFrom(c, a))
  },
  setWho(caseId, who) {
    const c = getCase(caseId)
    const base = c.answers ?? c.presetAnswers
    return applyAnswers(caseId, { ...base, who, assisted: who === 'helping', forMinor: who === 'child' })
  },
  setHelper(caseId, helper) {
    const c = getCase(caseId)
    requireFlow(c)
    if (c.session.who !== 'helping') fail('The helper form is only for "I am helping someone else register".')
    const name = (helper?.name ?? '').trim().replace(/\s+/g, ' ')
    if (name.length < 2) fail('Write the helper’s name.')
    if (!['family', 'friend', 'support'].includes(helper.relation)) fail('Choose the relation.')
    const mobile = helper.mobile ? cleanMobile(helper.mobile) : undefined
    if (mobile && !MOBILE_RE.test(mobile)) fail('Write a mobile number with 9 to 15 digits.')
    updateCase(caseId, cc => ({ session: patchSession(cc, { helper: { name, relation: helper.relation as HelperRelation, mobile } }) }), [
      audit(caseId, citizenActor(c), 'case_started', `Assisted mode: ${name} (${helper.relation}) helps ${c.persona.name} with the phone. The helper's number is not linked to the account.`, { tags: ['Assisted session'] }),
    ])
  },
  confirmApplicant(caseId, proceed) {
    const c = getCase(caseId)
    requireFlow(c)
    updateCase(caseId, cc => ({ session: patchSession(cc, { applicantConfirmed: proceed }) }), [
      audit(caseId, citizenActor(c), 'case_started', proceed
        ? `${c.persona.name} confirmed on camera: "Yes, I want to register myself" (MSG-ASS-01).`
        : `${c.persona.name} chose "No, stop" (MSG-ASS-01). Session stopped.`, { tags: ['Assisted session'] }),
    ])
  },
  setMinor(caseId, minor) {
    const c = getCase(caseId)
    requireFlow(c)
    if (c.session.who !== 'child') fail('Choose "I am registering a child I am responsible for" first.')
    const given = (minor?.givenNames ?? '').trim().replace(/\s+/g, ' ')
    const sur = (minor?.surnames ?? '').trim().replace(/\s+/g, ' ')
    if (!given || !sur) fail('Write the child’s given names and surnames.')
    const age = ageFrom(minor.dateOfBirth)
    if (age === null || age < 0) fail('Write a valid date of birth (YYYY-MM-DD).')
    if (age! >= 18) fail('A minor is under 18.')
    const number = normaliseDocNumber(minor.document?.number ?? '')
    if (!number) fail('Write the child’s document number.')
    if (hasDniNieShape(number) && !isFictionalDniNie(number)) fail('That number could be a real person’s. Use the fictional demo number.')
    if (!VALID_DATE.test(minor.document?.expiry ?? '')) fail('Write the document’s expiry date (YYYY-MM-DD).')
    const data: PersonData = { givenNames: given, surnames: sur, dateOfBirth: minor.dateOfBirth }
    const document: TypedDocument = { type: minor.document.type, number, expiry: minor.document.expiry, nationality: minor.document.nationality ?? c.typed.nationality, data }
    updateCase(caseId, cc => ({ session: patchSession(cc, { minor: { ...data, document } }) }), [
      audit(caseId, citizenActor(c), 'case_started', `${fullName(c.typed.data)} registers a minor in their care: ${fullName(data)} (${age}), ${document.type} ${number}.`),
    ])
  },
  recordGuardianCheck(caseId, camera = 'person') {
    const c = getCase(caseId)
    requireFlow(c)
    if (c.session.who !== 'child') fail('Only when registering a child.')
    const rec = lookupDocument(c.typed)
    const chip: 'ok' | 'failed' = rec.chip?.readable ? 'ok' : 'failed'
    const face = readFace(camera, c.typed.number, 0).result
    const passed = chip === 'ok' && Boolean(rec.chip?.signatureValid) && face === 'pass'
    updateCase(caseId, cc => ({ session: patchSession(cc, { guardianChecks: passed ? 'passed' : undefined }) }), [
      audit(caseId, { kind: 'citizen', id: c.id, name: fullName(c.typed.data) }, 'check_completed',
        `Guardian ${fullName(c.typed.data)}: own chip ${chip}${rec.chip && !rec.chip.signatureValid ? ' (signature invalid)' : ''}, face ${face} (camera: ${camera}). ${passed ? 'Guardian identity confirmed (does not register her).' : 'Guardian identity not confirmed.'}`, { evidence: ['guardian_link'] }),
    ])
    return { chip, face, passed }
  },
  recordEidLogin(caseId) {
    const c = getCase(caseId)
    requireFlow(c)
    if (c.session.route !== 'A') fail('The national eID login is Route A only.')
    const data = { ...c.typed.data }
    updateCase(caseId, cc => ({ session: patchSession(cc, { eidLogin: { at: nowIso(), data } }) }), [
      audit(caseId, citizenActor(c), 'check_completed', `Mock national eID page (${c.typed.nationality}) returned name and date of birth: ${fullName(data)}, ${data.dateOfBirth}.`, { evidence: ['eidas_login'] }),
    ])
    return data
  },
  giveConsents(caseId, consents) {
    const c = getCase(caseId)
    requireRoute(c)
    requireFlow(c)
    const route = c.session.route!
    const needFace = route === 'B' || route === 'X' || route === 'C'
    const needResidence = route === 'A' || route === 'B'
    if (needFace && !consents.face) fail('Tick the face-data box (MSG-CON-03) to continue on this route.')
    if (needResidence && !consents.residence) fail('Tick the residence-records box (MSG-CON-04) to continue on this route.')
    const at = nowIso()
    const face = needFace ? true : Boolean(consents.face)
    const residence = route === 'X' ? false : Boolean(consents.residence)
    updateCase(caseId, cc => ({
      status: cc.status === 'draft' ? 'received' : cc.status,
      citizenMsgs: ['STA-1'],
      session: patchSession(cc, { consents: { face, residence, at }, fallback: cc.session.fallback?.offered === 'consent' ? undefined : cc.session.fallback }),
    }), [audit(caseId, citizenActor(c), 'consent_given',
      `Consent given at ${at}: ${['identity document and why we check (MSG-CON-01, 02)', face ? 'face data (MSG-CON-03)' : null, residence ? 'residence records (MSG-CON-04)' : null].filter(Boolean).join('; ')}.`)])
  },
  declineConsent(caseId) {
    const c = getCase(caseId)
    requireRoute(c)
    requireFlow(c)
    updateCase(caseId, cc => ({ session: patchSession(cc, { consents: { declined: true, at: nowIso() } }) }), [
      audit(caseId, citizenActor(c), 'consent_declined', 'The citizen chose "I do not agree" (MSG-CON-06). No checks run.'),
    ])
    applyRule(caseId, decide(getCase(caseId), new Date(), 'flow'), citizenActor(c))
  },
  recordChipRead(caseId) {
    const c = getCase(caseId)
    requireRoute(c)
    requireFlow(c)
    const route = c.session.route!
    if (!(route === 'B' || route === 'X')) fail('The chip is read on Route B and Route X only.')
    if (!c.session.consents.face) fail('Give the consent first (MSG-CON-03).')
    const doc = subjectDocument(c)
    if (!doc) fail(route === 'X' ? 'Type the passport number and expiry first (setPassport).' : 'Type the child’s data first (setMinor).')
    if (c.session.who === 'child' && c.session.guardianChecks !== 'passed') fail('The guardian’s own chip and face check come first.')
    const rec = lookupDocument(doc!)
    const read: 'ok' | 'failed' = rec.chip?.readable ? 'ok' : 'failed'
    const attempt = c.session.chipReads.length + 1
    updateCase(caseId, cc => ({
      status: cc.status === 'received' ? 'checking' : cc.status,
      session: patchSession(cc, { chipReads: [...cc.session.chipReads, read] }),
    }), [audit(caseId, citizenActor(c), 'chip_read', `"Read chip" press ${attempt} (${doc!.nationality} ${doc!.type} ${doc!.number}): ${read === 'ok' ? 'chip read' : 'chip could not be read'}.`, { evidence: ['chip_read'] })])
    const r = decide(getCase(caseId), new Date(), 'flow')
    if (r.kind !== 'continue') applyRule(caseId, r)
    const printedMismatch = read === 'ok' && rec.chip ? evaluate(getCase(caseId)).printedDiff : undefined
    const msg = r.kind === 'fallback' ? 'VER-04' : r.kind === 'to_officer' ? 'VER-07' : read === 'ok' ? 'VER-01' : 'VER-03'
    return {
      read, attempt, signatureValid: read === 'ok' ? rec.chip?.signatureValid : undefined, printedMismatch, msg,
      outcome: r.kind === 'fallback' ? 'fallback' : r.kind === 'to_officer' ? 'to_officer' : 'continue',
    }
  },
  recordFaceAttempt(caseId, camera: CameraInput) {
    const c = getCase(caseId)
    requireRoute(c)
    requireFlow(c)
    if (!['person', 'reflections', 'synthetic'].includes(camera)) fail('Choose what the simulated camera sees.')
    const route = c.session.route!
    if (!(route === 'B' || route === 'X')) fail('The face check is Route B and Route X (route C uses the DNI video).')
    const chipOk = c.session.chipReads[c.session.chipReads.length - 1] === 'ok'
    if (!chipOk) fail('Read the chip first: the face is compared with the chip photo.')
    const doc = subjectDocument(c)!
    const n = c.session.faceAttempts.length
    const reading = readFace(camera, doc.number, n)
    updateCase(caseId, cc => ({ session: patchSession(cc, { faceAttempts: [...cc.session.faceAttempts, camera] }) }), [
      audit(caseId, citizenActor(c), 'face_attempt',
        `Face check attempt ${n + 1} (camera: ${camera}): ${reading.result}${reading.liveness !== undefined ? `, liveness ${reading.liveness.toFixed(2)}, face match ${reading.faceMatch!.toFixed(2)} (simulated values)` : ''}.`, { evidence: ['liveness', 'face_match'] }),
    ])
    const r = decide(getCase(caseId), new Date(), 'flow')
    if (r.kind === 'fallback') applyRule(caseId, r)
    return {
      result: reading.result, attempt: n + 1, liveness: reading.liveness, faceMatch: reading.faceMatch,
      msg: r.kind === 'fallback' ? 'FALL-01' : reading.result === 'pass' ? 'VER-02' : 'VER-05',
      outcome: r.kind === 'fallback' ? 'fallback' : 'continue',
    }
  },
  recordVideoAttempt(caseId, camera: CameraInput) {
    const c = getCase(caseId)
    requireRoute(c)
    requireFlow(c)
    if (c.session.route !== 'C') fail('The DNI video is Route C only.')
    if (!c.session.consents.face) fail('Give the consent first (MSG-CON-03).')
    if (c.session.who === 'helping' && c.session.applicantConfirmed !== true) fail('The applicant must confirm first (MSG-ASS-01).')
    const n = c.session.videoAttempts.length
    const result = readVideo(camera)
    updateCase(caseId, cc => ({
      status: cc.status === 'received' ? 'checking' : cc.status,
      session: patchSession(cc, { videoAttempts: [...cc.session.videoAttempts, camera] }),
    }), [audit(caseId, citizenActor(c), 'video_attempt', `DNI video attempt ${n + 1} (camera: ${camera}): ${result}.`, { evidence: ['dni_video'] })])
    const r = decide(getCase(caseId), new Date(), 'flow')
    if (r.kind === 'fallback') applyRule(caseId, r)
    return {
      result, attempt: n + 1,
      msg: r.kind === 'fallback' ? 'FALL-01' : result === 'pass' ? 'VER-02' : 'VER-06',
      outcome: r.kind === 'fallback' ? 'fallback' : 'continue',
    }
  },
  setPassport(caseId, passport) {
    const c = getCase(caseId)
    requireFlow(c)
    if (c.session.route !== 'X') fail('The passport step is Route X only.')
    const number = normaliseDocNumber(passport?.number ?? '')
    if (!/^[A-Z0-9]{6,12}$/.test(number)) fail('Write the passport number (6 to 12 letters or digits).')
    if (!VALID_DATE.test(passport?.expiry ?? '')) fail('Write the passport expiry date (YYYY-MM-DD).')
    const doc: TypedDocument = { type: 'PASSPORT', number, expiry: passport.expiry, nationality: c.typed.nationality, data: { ...c.typed.data } }
    updateCase(caseId, cc => ({ session: patchSession(cc, { passport: doc, chipReads: [], faceAttempts: [] }) }), [
      audit(caseId, citizenActor(c), 'case_started', `Route X: passport ${number} (expires ${passport.expiry}) typed for the chip read.`),
    ])
  },
  uploadProof(caseId, file) {
    const c = getCase(caseId)
    if (c.session.who !== 'child') fail('The proof of parental authority is only for registering a child.')
    const up = toUpload(file)
    updateCase(caseId, cc => ({ session: patchSession(cc, { uploads: { ...cc.session.uploads, proof: up } }) }), [
      audit(caseId, { kind: 'citizen', id: c.id, name: fullName(c.typed.data) }, 'upload_added', `Proof of parental authority uploaded ("${up.name}", ${Math.round((up.size ?? 0) / 1024)} KB).`, { evidence: ['guardian_link'] }),
    ])
  },
  uploadRedCard(caseId, file, card) {
    const c = getCase(caseId)
    requireFlow(c)
    if (c.session.route !== 'X') fail('The red card is uploaded on Route X only.')
    const number = (card?.number ?? '').trim()
    if (number.length < 3) fail('Write the number on the card.')
    if (!VALID_DATE.test(card?.expiry ?? '')) fail('Write the card’s expiry date (YYYY-MM-DD).')
    const up = toUpload(file)
    updateCase(caseId, cc => ({ session: patchSession(cc, { uploads: { ...cc.session.uploads, redCard: { ...up, number, expiry: card.expiry } } }) }), [
      audit(caseId, citizenActor(c), 'upload_added', `Red card photo uploaded ("${up.name}"), number ${number}, expires ${card.expiry}.`, { evidence: ['red_card'] }),
    ])
  },
  uploadAppealDoc(caseId, file) {
    const c = getCase(caseId)
    if (c.status !== 'not_approved') fail('A document for a review can be added after a refusal.')
    const up = toUpload(file)
    updateCase(caseId, cc => ({ session: patchSession(cc, { uploads: { ...cc.session.uploads, appeal: up } }) }), [
      audit(caseId, citizenActor(c), 'upload_added', `Document for the review request uploaded ("${up.name}").`),
    ])
  },
  setContact(caseId, contact) {
    const c = getCase(caseId)
    requireFlow(c)
    const mobile = cleanMobile(contact?.mobile ?? '')
    if (!MOBILE_RE.test(mobile)) fail('Write a mobile number with 9 to 15 digits.')
    if (c.session.helper?.mobile && sameMobile(mobile, c.session.helper.mobile)) fail('Use your own mobile number: the number of the person helping you cannot be used (MSG-ASS-02).')
    const s = useClave.getState()
    const taken = Object.values(s.cases).some(o => o.id !== caseId && o.session?.contact?.smsConfirmed && sameMobile(o.session.contact.mobile, mobile))
    if (taken) fail('This mobile number is already linked to another person’s Cl@ve. A mobile number can belong to only one person’s Cl@ve.')
    const email = contact.email?.trim() || undefined
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Write a valid email address.')
    updateCase(caseId, cc => ({ session: patchSession(cc, { contact: { mobile, email, smsConfirmed: false } }) }), [
      audit(caseId, citizenActor(c), 'contact_confirmed', `Mobile ${mobile.slice(0, -4).replace(/\d/g, '•')}${mobile.slice(-4)} given; demo SMS code sent.${email ? ' Email for updates given.' : ''}`),
    ])
    return { demoCode: DEMO_SMS_CODE }
  },
  confirmSms(caseId, code) {
    const c = getCase(caseId)
    if (!c.session.contact) fail('Give a mobile number first.')
    const ok = (code ?? '').trim() === DEMO_SMS_CODE
    if (ok) {
      updateCase(caseId, cc => ({ session: patchSession(cc, { contact: { ...cc.session.contact!, smsConfirmed: true } }) }), [
        audit(caseId, citizenActor(c), 'contact_confirmed', `SMS code confirmed from the applicant's own number${c.session.helper ? "; helper's number not linked" : ''}.`),
      ])
    }
    return ok
  },
  confirmReview(caseId) {
    const c = getCase(caseId)
    requireFlow(c)
    updateCase(caseId, cc => ({ session: patchSession(cc, { confirmedReview: true }) }), [
      audit(caseId, citizenActor(c), 'case_started', 'Review screen: "I confirm that my details are correct" ticked (MSG-AI-04).'),
    ])
  },
  async submit(caseId) {
    const c = getCase(caseId)
    requireRoute(c)
    requireFlow(c)
    const s = c.session
    const route = s.route!
    const missing: string[] = []
    if (route === 'F') missing.push('Route F has no automatic checks: join the video call (joinVideoCall)')
    if (!s.consents.at || s.consents.declined) missing.push('consent')
    if (route === 'A' && !s.eidLogin) missing.push('national eID login')
    if (route === 'B' || route === 'X') {
      if (s.chipReads[s.chipReads.length - 1] !== 'ok') missing.push('a successful chip read')
      if (s.faceAttempts.length === 0 || readFace(s.faceAttempts[s.faceAttempts.length - 1], subjectDocument(c)?.number ?? '', s.faceAttempts.length - 1).result !== 'pass') missing.push('a passed face check')
    }
    if (route === 'C' && readVideo(s.videoAttempts[s.videoAttempts.length - 1] ?? 'reflections') !== 'pass') missing.push('a passed DNI video')
    if (route === 'X' && !s.uploads.redCard) missing.push('the red card photo, number and expiry')
    if (s.who === 'child') {
      if (s.guardianChecks !== 'passed') missing.push('the guardian’s own chip and face check')
      if (!s.uploads.proof) missing.push('the proof of parental authority')
    }
    if (s.who === 'helping' && s.applicantConfirmed !== true) missing.push('the applicant’s own confirmation (MSG-ASS-01)')
    if (!s.contact?.smsConfirmed) missing.push('a confirmed SMS code')
    if (!s.confirmedReview) missing.push('the final confirmation box (MSG-AI-04)')
    if (missing.length) fail(`Not ready to send: ${missing.join('; ')}.`)
    updateCase(caseId, () => ({
      status: 'received', attempt: 1, submittedAt: nowIso(), citizenMsgs: ['STA-1'],
    }), [audit(caseId, citizenActor(c), 'submitted', `Application sent (Route ${route}${s.who === 'helping' ? ', assisted' : s.who === 'child' ? ', minor with guardian' : ''}).`, { tags: tagsFor(c) })])
    return runSubmit(caseId)
  },
  joinVideoCall(caseId) {
    const c = getCase(caseId)
    const fb = c.session.fallback
    if (!fb && c.session.route !== 'F') fail('There is no video call offered on this application.')
    if (c.level !== 'none' || c.status === 'not_approved') fail('The application is already decided.')
    const r = decide(c, new Date(), 'flow')
    const offered = fb?.offered ?? (r.fallback ?? 'no_nfc')
    const at = nowIso()
    updateCase(caseId, cc => ({
      route: 'F',
      status: 'checking',
      awaitingOfficer: true,
      submittedAt: cc.submittedAt ?? at,
      attempt: Math.max(1, cc.attempt),
      checks: r.checks.length ? evaluate({ ...cc, session: { ...cc.session, fallback: { offered, joined: true, at }, videoCall: { state: 'waiting' } } }).checks : cc.checks,
      flags: r.kind === 'fallback' ? r.flags : cc.flags,
      risk: r.kind === 'fallback' ? r.risk : cc.risk,
      aiReason: r.kind === 'fallback' ? r.aiReason : cc.aiReason,
      ruleId: r.ruleId ?? cc.ruleId,
      citizenMsgs: ['FALL-01'],
      session: patchSession(cc, { fallback: { offered, joined: true, at: fb?.at ?? at }, videoCall: { state: 'waiting' } }),
    }), [audit(caseId, citizenActor(c), 'video_call_joined', `Citizen joined the video-call waiting room (Fallback: ${offered}).`, { ruleId: r.ruleId ?? undefined, tags: tagsFor(c) })])
  },
  comeBackLater(caseId) {
    const c = getCase(caseId)
    const fb = c.session.fallback
    if (!fb) fail('There is no video call offered on this application.')
    if (c.level !== 'none' || c.status === 'not_approved') fail('The application is already decided.')
    const r = decide(c, new Date(), 'flow')
    const at = nowIso()
    updateCase(caseId, cc => ({
      route: 'F',
      status: 'checking',
      awaitingOfficer: true,
      submittedAt: cc.submittedAt ?? at,
      attempt: Math.max(1, cc.attempt),
      checks: evaluate({ ...cc, session: { ...cc.session, fallback: { ...fb!, comeBackLater: true } } }).checks,
      flags: r.kind === 'fallback' ? r.flags : cc.flags,
      risk: r.kind === 'fallback' ? r.risk : cc.risk,
      aiReason: r.kind === 'fallback' ? r.aiReason : cc.aiReason,
      suggestedReason: r.suggestedReason ?? cc.suggestedReason,
      citizenMsgs: ['STA-2'],
      session: patchSession(cc, { fallback: { ...fb!, comeBackLater: true } }),
    }), cc => [audit(caseId, citizenActor(c), 'escalated_to_officer', `Citizen chose "Come back later": the case waits for an officer, risk ${r.risk}. Video call not joined.`, { ruleId: r.ruleId ?? undefined, tags: tagsFor(cc) })])
  },

  /* ---- citizen after a decision ---- */
  replyToInfoRequest(caseId, text, upload) {
    const c = getCase(caseId)
    if (c.status !== 'need_info' || !c.infoRequest || c.infoRequest.response) fail('There is no open request for information.')
    const t = (text ?? '').trim()
    if (!t && !upload) fail('Write an answer or add an image.')
    const up = upload ? toUpload(upload) : undefined
    const at = nowIso()
    updateCase(caseId, cc => ({
      status: 'checking',
      awaitingOfficer: true,
      citizenMsgs: ['COR-02', 'STA-2'],
      infoRequest: { ...cc.infoRequest!, response: { text: t, at, upload: up } },
      session: patchSession(cc, { uploads: { ...cc.session.uploads, ...(up ? { info: up } : {}), ...(up && cc.session.who === 'child' ? { proof: up } : {}) } }),
    }), [audit(caseId, citizenActor(c), 'info_provided', `Citizen answered the officer${t ? `: "${t}"` : ''}${up ? ` and uploaded "${up.name}"` : ''} (MSG-COR-02).`)])
  },
  requestReview(caseId, text, upload) {
    const c = getCase(caseId)
    const last = c.decisions[c.decisions.length - 1]
    const lastIsRefusal = last?.outcome === 'refused' || last?.outcome === 'revoked'
    if (c.appeal?.state === 'open') fail('A review is already open. You do not need to send it again (MSG-COR-04).')
    const advancedOnly = lastIsRefusal && last.scope === 'advanced' && c.level === 'basic'
    if (!lastIsRefusal || (c.status !== 'not_approved' && !advancedOnly)) fail('A review can be asked for after a refusal.')
    if (c.appeal?.state === 'dismissed') fail('This decision was already reviewed by a person and kept (MSG-COR-07).')
    const t = (text ?? '').trim()
    if (!t) fail('Tell us in a few words why the decision should change.')
    if (t.length > 500) fail('Use 500 characters or fewer.')
    const up = upload ? toUpload(upload) : c.session.uploads.appeal
    const at = nowIso()
    const appealFlag = { code: 'appeal_filed' as const, severity: 'medium' as const, reason: { en: `Review requested against ${last.reasonId} by ${last.by.name}: a different officer decides`, es: `Revisión solicitada contra ${last.reasonId} de ${last.by.name}: decide otra persona` } }
    updateCase(caseId, cc => {
      const flags = [...cc.flags.filter(f => f.code !== 'appeal_filed' && f.severity !== 'high'), appealFlag]
      return {
        // An advanced-only review keeps the basic level and status 4; a full refusal goes back to status 2.
        status: advancedOnly ? 'approved' : 'checking',
        awaitingOfficer: true,
        citizenMsgs: advancedOnly ? ['COR-04', 'COR-05', 'STA-4'] : ['COR-04', 'COR-05'],
        appeal: { text: t, at, state: 'open', upload: up, refusedBy: last.by.id, refusedReasonId: last.reasonId, ...(advancedOnly ? { scope: 'advanced' as const } : {}) },
        flags, risk: riskOf(flags),
        session: patchSession(cc, { uploads: { ...cc.session.uploads, ...(up ? { appeal: up } : {}) } }),
      }
    }, [audit(caseId, citizenActor(c), 'appeal_filed', `Review requested (MSG-COR-03): "${t}"${up ? `, with "${up.name}"` : ''}. Refusal by ${last.by.name} (${last.reasonId}); a different officer must decide.`, { reasonId: last.reasonId, ruleId: 'APPEAL-SECOND-OFFICER' })])
  },

  /* ---- officer ---- */
  officerStartVideoCall(caseId) {
    const by = requireOfficer()
    const c = getCase(caseId)
    if (c.status === 'draft' && !c.session.fallback) fail('The application has not been sent yet.')
    if (c.level !== 'none' && c.advanced !== 'pending_review') fail('Nothing to decide on this application.')
    if (c.session.videoCall?.state === 'live') fail('The video call is already live.')
    const at = nowIso()
    updateCase(caseId, cc => {
      const session = patchSession(cc, { videoCall: { state: 'live', officerId: by.id, officerName: by.name, startedAt: at } })
      return { session, checks: evaluate({ ...cc, session }).checks, citizenMsgs: ['FALL-01'] }
    }, [audit(caseId, by, 'video_call_started', `${by.name} started the video call${c.session.fallback?.joined ? '' : ' (the citizen had not joined the waiting room)'}.`, { evidence: ['officer_video'] })])
  },
  officerEndVideoCall(caseId) {
    const by = requireOfficer()
    const c = getCase(caseId)
    if (c.session.videoCall?.state !== 'live') fail('There is no live video call on this application.')
    updateCase(caseId, cc => {
      const session = patchSession(cc, { videoCall: { ...cc.session.videoCall!, state: 'ended', endedAt: nowIso() } })
      return { session, checks: evaluate({ ...cc, session }).checks }
    }, [audit(caseId, by, 'video_call_ended', `${by.name} ended the video call.`, { evidence: ['officer_video'] })])
  },
  officerApproveBasic(caseId, note) {
    const by = requireOfficer()
    const c = getCase(caseId)
    if (c.appeal?.state === 'open') return actions.officerDecideAppeal(caseId, 'approve', undefined, note)
    if (c.level !== 'none') fail('The basic level is already granted.')
    if (c.status === 'draft' || !c.submittedAt) fail('The application has not reached an officer yet.')
    if (c.status === 'need_info') fail('Waiting for the citizen’s answer to your request.')
    if (c.status === 'not_approved') fail('This application was refused. A review request reopens it.')
    const call = c.session.videoCall
    const onFallback = c.route === 'F'
    if (onFallback && call?.state !== 'live' && call?.state !== 'ended') fail('Start the video call before approving: on the Fallback the officer confirms the document and face live.')
    const at = nowIso()
    const prior = c.decisions.some(d => d.outcome === 'refused' || d.outcome === 'revoked')
    const adv = advancedEligible(c)
    const afterInfo = Boolean(c.infoRequest?.response)
    const ruleId = onFallback ? 'VIDEO-CALL' : afterInfo ? 'INFO-REQUEST' : c.ruleId
    const evidence: CheckId[] = [...c.checks.filter(k => k.outcome === 'pass').map(k => k.id), ...(onFallback ? ['officer_video' as CheckId] : [])]
    updateCase(caseId, cc => {
      const session = call?.state === 'live' ? patchSession(cc, { videoCall: { ...call, state: 'ended', endedAt: at } }) : cc.session
      const statusMsg = statusMsgId('approved', adv ? 'pending_review' : 'not_requested')
      return {
        session,
        checks: evaluate({ ...cc, session }).checks,
        status: 'approved',
        level: 'basic',
        advanced: adv ? 'pending_review' : 'not_requested',
        awaitingOfficer: adv,
        flags: adv ? [...cc.flags.filter(f => f.severity === 'low'), { code: 'advanced_level_review', severity: 'low', reason: { en: 'Advanced level always gets a human review', es: 'El nivel avanzado siempre lo revisa una persona' } }] : cc.flags,
        risk: adv ? 'low' : cc.risk,
        correctedAfterRefusal: cc.correctedAfterRefusal || prior,
        citizenMsgs: afterInfo ? ['COR-08', statusMsg] : [statusMsg],
        decisions: [...cc.decisions, { outcome: 'approved_basic', by, at, note, ruleId }],
      }
    }, cc => [audit(caseId, by, 'officer_approved_basic',
      `${by.name} approved the basic level${onFallback ? ' on the video call (original document and face seen live)' : afterInfo ? ' after the requested information' : ''}${c.session.who === 'child' ? '; proof of parental authority reviewed' : ''}${c.route === 'X' || c.session.route === 'X' ? '; red card reviewed' : ''}.${adv ? ' Advanced level queued for review.' : ''}${note ? ` Note: ${note}` : ''}`,
      { evidence, ruleId, tags: tagsFor(cc, cc.policyProposal ? ['Decided under proposed rule'] : []) })])
  },
  officerApproveAdvanced(caseId, note) {
    const by = requireOfficer()
    const c = getCase(caseId)
    if (c.appeal?.state === 'open') return actions.officerDecideAppeal(caseId, 'approve', undefined, note)
    if (c.advanced !== 'pending_review' || c.level !== 'basic') fail('There is no advanced-level review on this application.')
    const at = nowIso()
    updateCase(caseId, cc => ({
      status: 'approved', level: 'advanced', advanced: 'granted', awaitingOfficer: false,
      flags: cc.flags.filter(f => f.code !== 'advanced_level_review'),
      citizenMsgs: ['STA-4C'],
      decisions: [...cc.decisions, { outcome: 'approved_advanced', by, at, note }],
    }), cc => [audit(caseId, by, 'officer_approved_advanced', `${by.name} approved the advanced level${cc.session.who === 'helping' && cc.session.helper ? ` (assisted session: applicant ${cc.persona.name} confirmed on camera; helper ${cc.session.helper.name}, ${cc.session.helper.relation}; SMS from the applicant's own number)` : ''}.${note ? ` Note: ${note}` : ''}`,
      { evidence: cc.checks.filter(k => k.outcome === 'pass').map(k => k.id), tags: tagsFor(cc) })])
  },
  officerRequestInfo(caseId, message, reason) {
    const by = requireOfficer()
    const c = getCase(caseId)
    const msg = (message ?? '').trim()
    if (!msg) fail('Write what you need from the citizen.')
    if (c.status === 'draft' || !c.submittedAt) fail('The application has not been sent yet.')
    if (c.appeal?.state === 'open' && c.appeal.refusedBy === by.id) fail('A different officer must handle the review: you took the original decision.')
    if (c.level !== 'none' && c.advanced !== 'pending_review') fail('Nothing to decide on this application.')
    const at = nowIso()
    updateCase(caseId, () => ({
      status: 'need_info',
      awaitingOfficer: false,
      citizenMsgs: ['STA-3', 'COR-01'],
      infoRequest: { message: msg, at, by, reason: reason?.trim() || undefined },
    }), [audit(caseId, by, 'info_requested', `${by.name} asked the citizen (MSG-COR-01): "${msg}"${reason ? ` because ${reason}` : ''}.`, { ruleId: 'INFO-REQUEST' })])
  },
  officerRefuse(caseId, reasonId, note) {
    // KEY RULE: officer + reason from the closed list, checked before anything else.
    const by = requireOfficer()
    const reason = requireReason(reasonId)
    const c = getCase(caseId)
    if (c.appeal?.state === 'open') return actions.officerDecideAppeal(caseId, 'uphold', reason, note)
    if (c.status === 'draft' && !c.session.fallback) fail('The application has not been sent yet.')
    const openDecision = c.level === 'none' || c.advanced === 'pending_review'
    if (c.level === 'advanced' || !openDecision || c.status === 'not_approved') fail('Nothing open to refuse. Use Revoke, with a reason, to take back a granted level.')
    const at = nowIso()
    const evidence = c.checks.filter(r => r.outcome === 'fail' || r.outcome === 'warn').map(r => r.id)
    const noteTxt = note ? ` Internal note: ${note}` : ''
    const decision = { outcome: 'refused' as const, by, reasonId: reason, note, at, ruleId: c.ruleId, ...(c.level === 'basic' ? { scope: 'advanced' as const } : {}) }
    const label = REJECTION_REASONS[reason].officerLabel.en
    if (c.level === 'basic') {
      // Basic already granted: the refusal applies to the advanced level only; basic stays.
      updateCase(caseId, cc => ({
        advanced: 'not_requested', awaitingOfficer: false,
        flags: cc.flags.filter(f => f.code !== 'advanced_level_review'),
        citizenMsgs: ['STA-4'],
        decisions: [...cc.decisions, decision],
      }), [audit(caseId, by, 'officer_refused', `${by.name} refused the advanced level (${reason}: ${label}). Basic level kept.${noteTxt}`, { evidence, reasonId: reason })])
      return
    }
    updateCase(caseId, cc => {
      const call = cc.session.videoCall
      const session = call?.state === 'live' ? patchSession(cc, { videoCall: { ...call, state: 'ended', endedAt: at } }) : cc.session
      return {
        session,
        status: 'not_approved', level: 'none', advanced: 'not_requested', awaitingOfficer: false,
        citizenMsgs: ['STA-5', reason],
        decisions: [...cc.decisions, decision],
      }
    }, cc => [audit(caseId, by, 'officer_refused', `${by.name} refused with ${reason} (${label}).${noteTxt} The citizen sees MSG-STA-5 + MSG-${reason} and can ask for a review.`, { evidence, reasonId: reason, ruleId: cc.ruleId, tags: tagsFor(cc, cc.policyProposal ? ['Decided under proposed rule'] : []) })])
  },
  officerRevoke(caseId, reasonId, note) {
    const by = requireOfficer()
    const reason = requireReason(reasonId)
    const c = getCase(caseId)
    if (c.level === 'none') fail('There is no granted level to revoke.')
    const at = nowIso()
    updateCase(caseId, () => ({
      status: 'not_approved', level: 'none', advanced: 'not_requested', awaitingOfficer: false,
      citizenMsgs: ['STA-5', reason],
      decisions: [...c.decisions, { outcome: 'revoked', by, reasonId: reason, note, at }],
    }), [audit(caseId, by, 'officer_revoked', `${by.name} revoked the ${c.level} level (${reason}: ${REJECTION_REASONS[reason].officerLabel.en}).${note ? ` Internal note: ${note}` : ''}`, { reasonId: reason })])
  },
  officerDecideAppeal(caseId, decision, reasonId, note) {
    const by = requireOfficer()
    const c = getCase(caseId)
    if (c.appeal?.state !== 'open') fail('There is no open review request on this application.')
    if (c.appeal!.refusedBy === by.id) fail('A different officer must decide the review: you took the original decision (rule APPEAL-SECOND-OFFICER).')
    if (decision !== 'approve' && decision !== 'uphold') fail('Choose approve or uphold.')
    const at = nowIso()
    if (c.appeal!.scope === 'advanced') {
      // Review of an advanced-only refusal: the basic level was never taken away.
      if (decision === 'approve') {
        updateCase(caseId, cc => ({
          status: 'approved', level: 'advanced', advanced: 'granted', awaitingOfficer: false,
          appeal: { ...cc.appeal!, state: 'upheld', decidedBy: by, decidedAt: at },
          flags: cc.flags.filter(f => f.code !== 'appeal_filed' && f.code !== 'advanced_level_review'), risk: 'low',
          correctedAfterRefusal: true,
          citizenMsgs: ['COR-06', 'STA-4C'],
          decisions: [...cc.decisions, { outcome: 'approved_advanced', by, at, note, ruleId: 'APPEAL-SECOND-OFFICER' }],
        }), cc => [audit(caseId, by, 'appeal_decided', `${by.name} reviewed the request (advanced-level refusal ${cc.appeal!.refusedReasonId}) and granted the advanced level.${note ? ` Note: ${note}` : ''}`,
          { ruleId: 'APPEAL-SECOND-OFFICER', tags: tagsFor(cc, ['Refusal corrected on review']) })])
        return
      }
      const keptAdv = requireReason(reasonId ?? c.appeal!.refusedReasonId)
      updateCase(caseId, cc => ({
        status: 'approved', level: 'basic', advanced: 'not_requested', awaitingOfficer: false,
        appeal: { ...cc.appeal!, state: 'dismissed', decidedBy: by, decidedAt: at, keptReasonId: keptAdv },
        flags: cc.flags.filter(f => f.code !== 'appeal_filed'),
        citizenMsgs: ['COR-07', 'STA-4'],
        decisions: [...cc.decisions, { outcome: 'refused', by, reasonId: keptAdv, note, at, ruleId: 'APPEAL-SECOND-OFFICER', scope: 'advanced' }],
      }), [audit(caseId, by, 'appeal_decided', `${by.name} reviewed the request and kept the advanced-level refusal (${keptAdv}). Basic level kept.${note ? ` Internal note: ${note}` : ''}`, { reasonId: keptAdv, ruleId: 'APPEAL-SECOND-OFFICER' })])
      return
    }
    if (decision === 'approve') {
      const adv = advancedEligible(c)
      const statusMsg = statusMsgId('approved', adv ? 'pending_review' : 'not_requested')
      updateCase(caseId, cc => ({
        status: 'approved', level: 'basic', advanced: adv ? 'pending_review' : 'not_requested', awaitingOfficer: adv,
        appeal: { ...cc.appeal!, state: 'upheld', decidedBy: by, decidedAt: at },
        flags: adv ? [{ code: 'advanced_level_review', severity: 'low', reason: { en: 'Advanced level always gets a human review', es: 'El nivel avanzado siempre lo revisa una persona' } }] : [],
        risk: 'low',
        correctedAfterRefusal: true,
        citizenMsgs: ['COR-06', statusMsg],
        decisions: [...cc.decisions, { outcome: 'approved_basic', by, at, note, ruleId: 'APPEAL-SECOND-OFFICER' }],
      }), cc => [audit(caseId, by, 'appeal_decided', `${by.name} reviewed the request (refusal ${cc.appeal!.refusedReasonId} by ${OFFICERS.find(o => o.id === cc.appeal!.refusedBy)?.name ?? cc.appeal!.refusedBy}) and approved the basic level${cc.appeal!.upload ? ` after viewing "${cc.appeal!.upload.name}"` : ''}.${adv ? ' Advanced level queued for review.' : ''}${note ? ` Note: ${note}` : ''}`,
        { ruleId: 'APPEAL-SECOND-OFFICER', tags: tagsFor(cc, ['Refusal corrected on review']), evidence: cc.checks.filter(k => k.outcome === 'pass').map(k => k.id) })])
      return
    }
    const kept = requireReason(reasonId ?? c.appeal!.refusedReasonId)
    updateCase(caseId, cc => ({
      status: 'not_approved', awaitingOfficer: false,
      appeal: { ...cc.appeal!, state: 'dismissed', decidedBy: by, decidedAt: at, keptReasonId: kept },
      flags: cc.flags.filter(f => f.code !== 'appeal_filed'),
      citizenMsgs: ['COR-07', kept],
      decisions: [...cc.decisions, { outcome: 'refused', by, reasonId: kept, note, at, ruleId: 'APPEAL-SECOND-OFFICER' }],
    }), [audit(caseId, by, 'appeal_decided', `${by.name} reviewed the request and kept the refusal (${kept}: ${REJECTION_REASONS[kept].officerLabel.en}).${note ? ` Internal note: ${note}` : ''}`, { reasonId: kept, ruleId: 'APPEAL-SECOND-OFFICER' })])
  },

  /* ---- demo ---- */
  resetDemo() {
    runs.clear()
    const s = useClave.getState()
    const fresh = freshState(new Date())
    const ev = audit(null, SYSTEM_ACTOR, 'demo_reset', 'Data reset to the initial state.')
    // Keep the per-tab language, the signed-in officer and staff job details so the presenter is not logged out.
    commit({ ...fresh, lang: s.lang, officerId: s.officerId, officerProfiles: s.officerProfiles ?? {}, audit: [...fresh.audit, ev] }, null, 'demo_reset')
  },
  resetCase(caseId) {
    const c = getCase(caseId)
    if (c.origin === 'background') fail('Only preloaded and sign-up applications can be reset.')
    runs.delete(caseId)
    const s = useClave.getState()
    const fresh = c.origin === 'library' ? buildSeedState(new Date()).cases[caseId] : undefined
    const next = fresh ?? newDraftCase(c.id, c.origin, c.typed, nowIso(), { caseRef: c.caseRef, caseLabel: c.caseLabel })
    commit({
      ...s,
      cases: { ...s.cases, [caseId]: next },
      audit: [...s.audit.filter(e => e.caseId !== caseId || e.action === 'account_created'), audit(caseId, SYSTEM_ACTOR, 'demo_reset', `Application ${caseId} reset to draft.`)],
    }, caseId, 'demo_reset')
  },

  /* ---- citizen accounts (src/core/accounts.ts) ---- */
  ...createAccountActions({ get: () => useClave.getState(), commit, audit }),
  /* ---- staff access (src/core/staff.ts) ---- */
  ...createStaffActions({ get: () => useClave.getState(), commit, audit, fail: m => { throw new ClaveRuleError(m) } }),

  /* ================================================ deprecated UI shims */

  startCase(caseId, answers, _route) {
    const c = getCase(caseId)
    if (c.status !== 'draft') fail('This application has already been sent. Reset it to start again.')
    applyAnswers(caseId, {
      ...answers,
      who: answers.who ?? (answers.forMinor ? 'child' : answers.assisted ? 'helping' : 'self'),
      euEid: answers.euEid ?? (answers.nationalityGroup === 'eu' ? (answers.hasEuEid ? 'yes' : 'no') : null),
      nfc: answers.nfc ?? null,
    })
  },
  giveConsent(caseId) {
    const c = getCase(caseId)
    if (c.session.consents.at && !c.session.consents.declined) return
    actions.giveConsents(caseId, { face: true, residence: c.session.route !== 'X' })
  },
  async submitForVerification(caseId) {
    // Old screens animate the chip and face steps without recording them: record the defaults they show.
    let c = getCase(caseId)
    if (!c.session.consents.at) actions.giveConsent(caseId)
    c = getCase(caseId)
    const s = c.session
    const r = s.route
    if (r === 'F') { actions.joinVideoCall(caseId); return }
    if (r === 'A' && !s.eidLogin) actions.recordEidLogin(caseId)
    if (r === 'X' && !s.passport) actions.setPassport(caseId, { number: c.typed.type === 'PASSPORT' ? c.typed.number : `P${c.typed.number.replace(/[^A-Z0-9]/gi, '').slice(-8)}`, expiry: c.typed.expiry })
    if (s.who === 'child' && !s.minor) fail('Add the child’s data first.')
    if (s.who === 'child' && s.guardianChecks !== 'passed') actions.recordGuardianCheck(caseId)
    if (s.who === 'child' && !getCase(caseId).session.uploads.proof) actions.uploadProof(caseId, { name: 'proof.png', dataUrl: TINY_PNG })
    if (r === 'B' || r === 'X') {
      for (let i = 0; i < 2 && inFlow(getCase(caseId)) && getCase(caseId).session.chipReads.slice(-1)[0] !== 'ok'; i++) actions.recordChipRead(caseId)
      if (!inFlow(getCase(caseId))) return
      if (getCase(caseId).session.faceAttempts.slice(-1)[0] !== 'person') actions.recordFaceAttempt(caseId, 'person')
      if (r === 'X' && !getCase(caseId).session.uploads.redCard) actions.uploadRedCard(caseId, { name: 'red-card.png', dataUrl: TINY_PNG }, { number: 'DEMO-0005', expiry: c.typed.expiry })
    }
    if (r === 'C') {
      if (s.who === 'helping' && s.applicantConfirmed !== true) actions.confirmApplicant(caseId, true)
      if (getCase(caseId).session.videoAttempts.slice(-1)[0] !== 'person') actions.recordVideoAttempt(caseId, 'person')
    }
    if (!inFlow(getCase(caseId))) return
    if (!getCase(caseId).session.contact?.smsConfirmed) {
      const mobile = s.contact?.mobile ?? `+34600${demoDigits(caseId)}`
      actions.setContact(caseId, { mobile })
      actions.confirmSms(caseId, DEMO_SMS_CODE)
    }
    actions.confirmReview(caseId)
    await actions.submit(caseId)
  },
  respondToInfoRequest(caseId, text) {
    actions.replyToInfoRequest(caseId, text)
  },
  fileAppeal(caseId, text) {
    actions.requestReview(caseId, text)
  },
  async submitCorrection(caseId, note) {
    actions.requestReview(caseId, note)
  },
  setAssistedHelper(caseId, helper) {
    const i = HELPER_RELATIONS.findIndex(r => r.en === helper.relation.en)
    const relation: HelperRelation = i === 1 ? 'friend' : i === 2 ? 'support' : 'family'
    const c = getCase(caseId)
    if (c.session.who !== 'helping') {
      updateCase(caseId, cc => ({ session: patchSession(cc, { who: 'helping' }) }), [])
    }
    actions.setHelper(caseId, { name: helper.helperName, relation })
  },
  setApplicantContact(caseId, contact) {
    if (contact.noOwnPhone || !contact.phone) return
    actions.setContact(caseId, { mobile: contact.phone })
  },
  setMinorApplicant(caseId, minor) {
    const c = getCase(caseId)
    const parts = (minor.name ?? '').trim().split(/\s+/)
    if (parts.length < 2) fail('Write the minor’s name and surname.')
    if (!(minor.age >= 0 && minor.age < 18)) fail('A minor is under 18.')
    if (c.session.who !== 'child') updateCase(caseId, cc => ({ session: patchSession(cc, { who: 'child' }) }), [])
    const y = new Date().getFullYear() - Math.floor(minor.age) - 1
    const dob = `${y}-06-15`
    const digits = parseInt(normaliseDocNumber(c.typed.number).replace(/\D/g, '').slice(-7) || '1234567', 10) + 23
    actions.setMinor(caseId, {
      givenNames: parts[0], surnames: parts.slice(1).join(' '), dateOfBirth: dob,
      document: { type: 'TIE', number: fictionalTie(digits), expiry: c.typed.expiry, nationality: c.typed.nationality },
    })
  },
  setSimulatedFailure() { /* removed: outcomes come from the rules */ },
  bookVideoCall(caseId, slotIso) {
    const c = getCase(caseId)
    if (Number.isNaN(Date.parse(slotIso))) fail('Pick one of the available times.')
    updateCase(caseId, () => ({ videoCallSlot: slotIso }), [
      audit(caseId, citizenActor(c), 'video_call_booked', `Citizen picked a video-call time: ${new Date(slotIso).toISOString().slice(11, 16)} UTC.`),
    ])
  },
  officerApprove(caseId, note) {
    const c = getCase(caseId)
    if (c.appeal?.state === 'open') return actions.officerDecideAppeal(caseId, 'approve', undefined, note)
    if (c.level === 'none') return actions.officerApproveBasic(caseId, note)
    return actions.officerApproveAdvanced(caseId, note)
  },
  officerCompleteVideoCall(caseId) {
    const c = getCase(caseId)
    if (c.session.videoCall?.state !== 'live') actions.officerStartVideoCall(caseId)
    actions.officerEndVideoCall(caseId)
  },
}

/** 1×1 transparent PNG used by the legacy shim when old screens do not upload anything. */
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const demoDigits = (id: string) => String(parseInt(id.replace(/[^a-z0-9]/gi, '').slice(-6), 36) % 1_000_000).padStart(6, '0')
function fictionalTie(n: number): string {
  // Same rule as fictionalDniNie('X', n): shape of a NIE, wrong check letter.
  const L = 'TRWAGMYFPDXBNJZSQVHLCKE'
  const body = String(n).padStart(7, '0').slice(-7)
  const k = Number(`0${body}`) % 23
  return `X${body}${L[(k + 7) % 23]}`
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

/** Convenience for UIs: the checks the engine computes for a case on its route. */
export const plannedChecks = (c: Case): CheckId[] => evaluate(c).checks.map(k => k.id)

/** Exposed for tests and the debug console. */
export const getState = () => useClave.getState()
