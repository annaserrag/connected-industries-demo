/**
 * CONTRACT — store API, selectors, paths and UI-kit props.
 *
 * Interfaces between the five builder areas:
 *  - Store API     : implemented by Platform (src/core/store.ts), used by everyone.
 *  - App routes    : wired by Platform (src/core/App.tsx), screens exported by each area.
 *  - UI kit        : implemented by Design (src/ui/index.ts), used by Citizen/Officer/Dashboard.
 */
import type {
  SignInResult,
  SignUpInput,
  SignUpResult,
  OfficerProfileInput,
  PriorityTier,
  StaffSignInResult,
  AppState,
  AssistantAnswers,
  AuditEvent,
  Bilingual,
  CameraInput,
  Case,
  DocumentType,
  HelperRelation,
  Lang,
  PersonData,
  RejectionReasonId,
  RouteId,
  SimFailure,
  Who,
  YesNoUnsure,
} from './types'

/* ================================================================ STORE API
 * import { useClave, actions, t } from '@/core/store'
 *
 *   const cases = useClave(s => s.cases)           // zustand-style selector hook over AppState
 *   actions.setAnswers('kenji', { document: 'TIE', who: 'self', nfc: 'unsure' })
 *
 * Every action: updates state, appends AuditEvent(s), persists to localStorage, broadcasts to
 * other tabs (BroadcastChannel). Other tabs re-render within ~100 ms.
 * Actions that are not allowed in the current state throw ClaveRuleError (UI should prevent them).
 *
 * Outcomes are never scripted: they come from the typed data, the simulated world (contract/world.ts), the
 * camera input of each attempt, the rules (core/engine.ts) and the officer's decisions.
 */

/** Route-assistant answers (RA-02…RA-06). Missing fields fall back to the typed account data. */
export interface RouteAnswersInput {
  /** Country short name (EN), e.g. "Japan". Defaults to the typed nationality. */
  nationality?: string
  nationalityGroup?: AssistantAnswers['nationalityGroup']
  /** 'UNSURE' = RA-03 "No lo sé" → Fallback. */
  document: DocumentType | 'UNSURE'
  euEid?: YesNoUnsure | null
  who?: Who
  nfc?: YesNoUnsure | null
}

export interface RouteRecommendation { route: RouteId; msg: string; policyProposal: boolean }

/** A small image chosen by the citizen (data URL, image/*, ≤ 1.5 MB). */
export interface UploadInput { name: string; dataUrl: string }

/** What the outside world answered for one "Read chip" press. msg = the citizen message to show next. */
export interface ChipReadResult {
  read: 'ok' | 'failed'
  attempt: number
  signatureValid?: boolean
  /** Printed fields that differ from the chip (never shown to the citizen as such). */
  printedMismatch?: Array<keyof PersonData>
  /** 'VER-01' (success: "Chip leído: válido") · 'VER-03' · 'VER-04' · 'VER-07' */
  msg: 'VER-01' | 'VER-03' | 'VER-04' | 'VER-07'
  /** What the rules decided after this read. */
  outcome: 'continue' | 'fallback' | 'to_officer'
}

export interface AttemptResultOut {
  result: 'pass' | 'retry' | 'fail'
  attempt: number
  /** Simulated scores (face check only). Always shown with "valores simulados". */
  liveness?: number
  faceMatch?: number
  /** 'VER-02' (passed) · 'VER-05' (face retry) · 'VER-06' (DNI video retry) · 'FALL-01' (Fallback offered) */
  msg: 'VER-02' | 'VER-05' | 'VER-06' | 'FALL-01'
  outcome: 'continue' | 'fallback'
}

export interface SubmitResult { kind: 'auto_basic' | 'to_officer' | 'fallback' | 'continue'; ruleId: string | null }

export interface ClaveActions {
  /* ---- session ---- */
  setLang(lang: Lang): void
  officerSignIn(officerId: string): void
  officerSignOut(): void
  setActiveCitizenCase(caseId: string | null): void

  /* ---- citizen journey (draft) ---- */
  /** RA-02…06: stores the answers and the recommended route (RA-07A/B/C/F/X). Draft cases only. */
  setAnswers(caseId: string, answers: RouteAnswersInput): RouteRecommendation
  /** RA-05 only (re-runs the route recommendation). */
  setWho(caseId: string, who: Who): RouteRecommendation
  /** Assisted mode: the helper's name and relation (and their own mobile, which can never be the applicant's). */
  setHelper(caseId: string, helper: { name: string; relation: HelperRelation; mobile?: string }): void
  /** MSG-ASS-01: true = "Sí, quiero registrarme yo"; false = "No, parar". */
  confirmApplicant(caseId: string, proceed: boolean): void
  /** MIN-02: the minor's own data and document. The case becomes the minor's application (persona = minor). */
  setMinor(caseId: string, minor: PersonData & { document: { type: DocumentType; number: string; expiry: string; nationality?: string } }): void
  /** Guardian's own chip + face (one screen; does not register her). */
  recordGuardianCheck(caseId: string, camera?: CameraInput): { chip: 'ok' | 'failed'; face: 'pass' | 'retry' | 'fail'; passed: boolean }
  /** Route A: the mock national eID page returns the typed data. */
  recordEidLogin(caseId: string): PersonData
  /** CON-03 / CON-04 boxes. Required: face on B/X/C/minor, residence on A/B (not X). Status → 1 Received. */
  giveConsents(caseId: string, consents: { face?: boolean; residence?: boolean }): void
  /** "No acepto" → MSG-CON-06, Fallback offered (rule CONSENT-DECLINED). */
  declineConsent(caseId: string): void
  /** One "Read chip" press: the world answers for the subject document (route X: passport; minor: the minor's). */
  recordChipRead(caseId: string): ChipReadResult
  /** One face-check attempt with what the simulated camera sees. */
  recordFaceAttempt(caseId: string, camera: CameraInput): AttemptResultOut
  /** One DNI video attempt (route C). */
  recordVideoAttempt(caseId: string, camera: CameraInput): AttemptResultOut
  /** Route X: the passport whose chip is read (name and date of birth = the account's). */
  setPassport(caseId: string, passport: { number: string; expiry: string }): void
  uploadProof(caseId: string, file: UploadInput): void
  uploadRedCard(caseId: string, file: UploadInput, card: { number: string; expiry: string }): void
  uploadAppealDoc(caseId: string, file: UploadInput): void
  /** Mobile (+ email). The helper's number and a number already linked to another Cl@ve are refused. Returns the demo code. */
  setContact(caseId: string, contact: { mobile: string; email?: string }): { demoCode: string }
  /** True when code === '123456'. */
  confirmSms(caseId: string, code: string): boolean
  /** MSG-AI-04 box. */
  confirmReview(caseId: string): void
  /** "Enviar mi solicitud": runs evaluate + decide; statuses 1 → 2 → outcome with small delays. */
  submit(caseId: string): Promise<SubmitResult>
  /** FALL-01 "Unirme a la videollamada": waiting room, case to the officer (tier P5 unless High risk). */
  joinVideoCall(caseId: string): void
  /** FALL-01 "Volver más tarde": the case waits for an officer (status 2). */
  comeBackLater(caseId: string): void

  /* ---- citizen after a decision ---- */
  /** Status 3 'need_info': MSG-COR-01 → reply (text and/or image) → MSG-COR-02, status 2. */
  replyToInfoRequest(caseId: string, text: string, upload?: UploadInput): void
  /** Status 5: MSG-COR-03 (≤ 500 chars + optional image) → COR-04/COR-05, Appeals list. */
  requestReview(caseId: string, text: string, upload?: UploadInput): void

  /* ---- officer. All require a signed-in officer. ---- */
  officerStartVideoCall(caseId: string): void
  officerEndVideoCall(caseId: string): void
  officerApproveBasic(caseId: string, note?: string): void
  officerApproveAdvanced(caseId: string, note?: string): void
  /** Status 3 + MSG-COR-01; `message` fills {whatWeNeed}, `reason` fills {reason}. */
  officerRequestInfo(caseId: string, message: string, reason?: string): void
  /** reasonId REQUIRED (REJ-01…08); internal note never shown to the citizen. */
  officerRefuse(caseId: string, reasonId: RejectionReasonId, note?: string): void
  /** Revokes a granted level. Same rule: officer + reason. */
  officerRevoke(caseId: string, reasonId: RejectionReasonId, note?: string): void
  /** Appeals: must be an officer OTHER than the one who refused (throws ClaveRuleError otherwise). */
  officerDecideAppeal(caseId: string, decision: 'approve' | 'uphold', reasonId?: RejectionReasonId, note?: string): void

  /* ---- citizen accounts ---- */
  /** Sign in with document number (case/spaces ignored) + password. On success sets activeCitizenCaseId. */
  citizenSignIn(documentNumber: string, password: string): SignInResult
  /** Typed sign-up. Refuses a real DNI/NIE check letter and a duplicate document number. Signs the citizen in. */
  citizenSignUp(input: SignUpInput): SignUpResult
  citizenSignOut(): void
  /* ---- staff access ---- */
  officerSignInWithCertificate(certificateId: string, pin: string): StaffSignInResult
  officerSignInWithPassword(userId: string, password: string): StaffSignInResult
  officerCompleteProfile(officerId: string, method: 'certificate' | 'password', certificateId: string | null, input: OfficerProfileInput): void

  /* ---- demo ---- */
  /** Reset everything to buildSeedState(new Date()). Broadcast to all tabs. */
  resetDemo(): void
  /** Reset one preloaded or sign-up case back to 'draft'. */
  resetCase(caseId: string): void

  /* ---- @deprecated UI migration shims (delegate to the actions above) ---- */
  /** @deprecated UI migration: use setAnswers. */
  startCase(caseId: string, answers: AssistantAnswers, route: RouteId): void
  /** @deprecated UI migration: use giveConsents. Ticks every box the route needs. */
  giveConsent(caseId: string): void
  /** @deprecated UI migration: fills the steps the old screens do not record (chip read, camera 'person', SMS) and calls submit. */
  submitForVerification(caseId: string): Promise<void>
  /** @deprecated UI migration: use replyToInfoRequest. */
  respondToInfoRequest(caseId: string, text: string): void
  /** @deprecated UI migration: use requestReview. */
  fileAppeal(caseId: string, text: string): void
  /** @deprecated UI migration: use requestReview. */
  submitCorrection(caseId: string, note: string): Promise<void>
  /** @deprecated UI migration: use setHelper. */
  setAssistedHelper(caseId: string, helper: { helperName: string; relation: Bilingual; deviceOwner: string }): void
  /** @deprecated UI migration: use setContact. */
  setApplicantContact(caseId: string, contact: { phone?: string; noOwnPhone?: boolean }): void
  /** @deprecated UI migration: use setMinor. */
  setMinorApplicant(caseId: string, minor: { name: string; age: number }): void
  /** @deprecated UI migration: no effect (the failure simulator was removed). */
  setSimulatedFailure(caseId: string, failure: SimFailure | null): void
  /** @deprecated UI migration: stores the slot only; use joinVideoCall / comeBackLater. */
  bookVideoCall(caseId: string, slotIso: string): void
  /** @deprecated UI migration: approves basic, advanced or an open appeal (second-officer rule applies). */
  officerApprove(caseId: string, note?: string): void
  /** @deprecated UI migration: starts (if needed) and ends the video call. */
  officerCompleteVideoCall(caseId: string): void
}

/** Derived selectors exported from '@/core/selectors'. */
export interface ClaveSelectors {
  /** Cases waiting for an officer, sorted by priority tier (PRIORITY_TIERS); within a tier, oldest first. */
  officerQueue(state: AppState): Case[]
  /** The tier a queued case sits in (with the PRIORITY_AGE_BUMP_HOURS bump applied). */
  priorityOf(c: Case, now?: Date): PriorityTier
  caseAudit(state: AppState, caseId: string): AuditEvent[]
  /** Human relative time ("3 min ago" / "hace 3 min"). */
  relativeTime(iso: string, lang: Lang): string
}

/** Translation helper exported from '@/core/store': t(bilingual) uses the current lang. */
export type Translate = (b: Bilingual) => string

/* =============================================================== APP ROUTES
 * HashRouter (static hosting, no rewrites). Paths:
 */
export const PATHS = {
  landing: '/',                                  // screen 1   — citizen area exports <LandingPage/>
  citizen: '/citizen',                           // screens 2–5 — citizen area exports <CitizenApp/> (handles /citizen/*)
  citizenCase: (id: string) => `/citizen/case/${id}`,
  officer: '/officer',                           // screens 6–8 — officer area exports <OfficerApp/> (handles /officer/*)
  officerCase: (id: string) => `/officer/case/${id}`,
  officerAudit: '/officer/audit',
  officerDashboard: '/officer/dashboard',       // live dashboard inside the staff console
  officerAppeals: '/officer/appeals',            // queue filtered to open appeals
  officerAdvanced: '/officer/advanced',          // queue filtered to advanced-level reviews
  officerDocuments: '/officer/documents',       // applications organised by document used
  officerProfile: '/officer/profile',           // the officer's job details
  officerAll: '/officer/applications',          // every application, searchable
  dashboard: '/dashboard',                       // screen 9   — dashboard area exports <DashboardPage/>
} as const

/**
 * Required exports per area (default-free, named exports from the area's index.ts):
 *   '@/citizen'   → LandingPage, CitizenApp
 *   '@/officer'   → OfficerApp
 *   '@/dashboard' → DashboardPage
 *   '@/ui'        → the UI kit below
 * Query params: `?embed=1` hides the app chrome (used by the demo panel iframes).
 */

/* =================================================================== UI KIT
 * import { Button, Card, ... } from '@/ui'
 * Design owns the look; these props are the stable API. Stubs exist from Phase 0.
 *
 *  Button        ({ variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md'|'lg', asChild?, ...button props })
 *  Card          ({ className?, children })      CardHeader, CardTitle, CardContent
 *  Badge         ({ tone?: 'neutral'|'info'|'success'|'warning'|'danger', children })
 *  StatusPill    ({ status: StatusId|'draft' })
 *  RiskBadge     ({ risk: RiskLevel })
 *  RouteBadge    ({ route: RouteId })
 *  Avatar        ({ initials: string, hue: number, size?: number })  — generated, never a photo
 *  PhoneFrame    ({ children })                  — phone-sized frame for the citizen view on desktop
 *  EmptyState    ({ title, body?, icon? })
 *  Spinner       ({ size? })
 *  Footer        ()                              — persistent disclaimer footer (Platform mounts it)
 *  LangToggle    ()                              — EN/ES toggle bound to the store
 *  cn(...classes)                                — class merge helper
 * Colors come from CSS variables in src/ui/tokens.css (Tailwind v4 @theme): use Tailwind
 * classes like bg-surface, text-ink, text-muted, border-line, bg-brand, text-brand, bg-success-soft,
 * text-danger etc. (see tokens.css for the full list).
 */
