/**
 * CONTRACT — owned by the orchestrator. Subagents import from here and must NOT edit it.
 * Need a change? Ask the orchestrator.
 *
 * Source of truth: "Group 10 – Get your Cl@ve – Project plan", Shared reference sheet + Part 1.
 * Everything here is fictional. Every check is SIMULATED.
 */

export type Lang = 'en' | 'es'
/** Every citizen-facing string exists in both languages. */
export type Bilingual = { en: string; es: string }

/* ------------------------------------------------------------------ routes */

/** Routes exactly as in the reference sheet. */
export type RouteId = 'A' | 'B' | 'C' | 'FALLBACK'

export interface RouteDef {
  id: RouteId
  /** Short code shown in badges: "A", "B", "C", "Fallback". */
  code: string
  /** Exact reference-sheet name. */
  name: Bilingual
  /** Who the route is for. */
  forWhom: Bilingual
  /** The checks the simulated engine runs on this route, in order. */
  checks: CheckId[]
}

/* ---------------------------------------------------------------- statuses */

/**
 * The five citizen-view statuses, exactly as in the reference sheet:
 * 1. Received → 2. Checking → 3. We need something from you →
 * 4. Approved (basic / advanced level) → 5. Not approved, with the reason and how to appeal.
 */
export type StatusId = 'received' | 'checking' | 'need_info' | 'approved' | 'not_approved'

export interface StatusDef {
  id: StatusId
  step: 1 | 2 | 3 | 4 | 5
  label: Bilingual
  /** Plain-language message the citizen reads in the status tracker. */
  message: Bilingual
}

/** Level of access. Basic can be granted automatically; advanced always gets a human review. */
export type Level = 'none' | 'basic' | 'advanced'
export type AdvancedState = 'not_requested' | 'pending_review' | 'granted'

/* --------------------------------------------------------------- documents */

export type DocumentType = 'DNI' | 'EU_EID' | 'PASSPORT' | 'TIE' | 'NIE_PAPER' | 'RED_CARD'

export interface DocumentDef {
  type: DocumentType
  label: Bilingual
  /** Has an NFC chip the phone could read (simulated). */
  hasChip: boolean
}

export interface IdentityDocument {
  type: DocumentType
  /** Clearly fake, always starts with "DEMO-". */
  number: string
  issuingCountry: string
  /** ISO date. */
  expires: string
}

/* ------------------------------------------------------------------ checks */

export type CheckId =
  | 'eidas_login'
  | 'chip_read'
  | 'chip_signature'
  | 'document_validity'
  | 'liveness'
  | 'face_match'
  | 'residence'
  | 'guardian_link'
  | 'dni_video'
  | 'officer_video'

export type CheckOutcome = 'pass' | 'fail' | 'warn' | 'pending' | 'skipped'

export interface CheckDef {
  id: CheckId
  label: Bilingual
  /** One line on what it checks, for the officer view and consent screen. */
  explains: Bilingual
  /** True for every check: nothing is real in this prototype. */
  simulated: true
}

export interface CheckResult {
  id: CheckId
  outcome: CheckOutcome
  /** 0–1 for scored checks (liveness, face_match). */
  score?: number
  /** Officer-facing explanation of the result ("Chip signature not issued by a trusted authority"). */
  detail: Bilingual
}

/* -------------------------------------------------------------------- risk */

export type RiskLevel = 'low' | 'medium' | 'high'

export type FlagCode =
  | 'low_liveness'
  | 'low_face_match'
  | 'chip_signature_failed'
  | 'chip_unreadable'
  | 'document_invalid'
  | 'residence_not_found'
  | 'eid_data_mismatch'
  | 'minor_with_guardian'
  | 'assisted_shared_device'
  | 'policy_proposal_route'
  | 'second_attempt'
  | 'appeal_filed'
  | 'advanced_level_review'

export interface Flag {
  code: FlagCode
  /** Why the AI engine flagged it — shown in the officer queue. */
  reason: Bilingual
  severity: RiskLevel
}

/* -------------------------------------------------------------- rejections */

export type RejectionReasonId =
  | 'document_expired'
  | 'face_mismatch'
  | 'liveness_failed'
  | 'chip_invalid'
  | 'residence_not_found'
  | 'data_mismatch'
  | 'suspected_fraud'

export interface RejectionReason {
  id: RejectionReasonId
  /** What the officer picks in the closed list. */
  officerLabel: Bilingual
  /** The ONE citizen message for this reason. */
  citizenMessage: Bilingual
  /** What the citizen can do next (correct, retry, video call). */
  howToFix: Bilingual
}

/* --------------------------------------------------------------- the case */

export type ActorKind = 'system' | 'officer' | 'citizen'

export interface Actor {
  kind: ActorKind
  id: string
  name: string
}

export interface Officer {
  id: string
  name: string
  office: string
}

/* ------------------------------------------------------------ staff access
 * Modelled on how Cl@ve registration staff really get in (researched Nov 2026):
 *  - they are public employees of a body enabled as a Cl@ve Registration Authority (AEAT, Social Security,
 *    SEPE, Government Delegations/Subdelegations, and many regional and local bodies);
 *  - they open the registration application with an electronic certificate: a public-employee certificate
 *    (on a cryptocard, it carries their identity, post and employing body), a DNIe, or another accepted
 *    personal certificate;
 *  - access works only if their organisation has authorised that person for Cl@ve registration.
 * Everything here is SIMULATED with fictional people and "DEMO-" identifiers.
 */
export type StaffCredential = 'employee_certificate' | 'dnie' | 'personal_certificate'

export interface RegistrationAuthority {
  id: string
  name: Bilingual
  /** Short label, e.g. "AEAT". */
  short: string
}

export interface StaffOffice {
  /** DIR3-style unit code, fake: "DEMO-E0…" */
  code: string
  name: Bilingual
  authorityId: string
  city: string
}

/** A certificate the simulated certificate picker offers (like the browser's certificate dialog). */
export interface StaffCertificate {
  id: string
  credential: StaffCredential
  holderName: string
  /** Fake personal ID read from the certificate. Always "DEMO-…". */
  holderId: string
  /** Employing body printed in the certificate (employee certificates only). */
  authorityId?: string
  /** Post printed in the certificate (employee certificates only). */
  post?: Bilingual
  validUntil: string
  /** Officer record this certificate belongs to, if the person is staff at all. */
  officerId?: string
  /** Simulated authorisation list: the person's organisation has authorised them for Cl@ve registration. */
  authorisedForClave: boolean
}

export type OfficerRole = 'registrar' | 'supervisor'

/** Job details an officer confirms the first time they sign in. */
export interface OfficerProfile {
  officerId: string
  authorityId: string
  officeCode: string
  post: string
  /** Personnel registration number (NRP), fake: "DEMO-NRP-…" */
  personnelNumber: string
  role: OfficerRole
  /** Which certificate they signed in with. */
  certificateId: string
  completedAt: string
}

export type OfficerProfileInput = Omit<OfficerProfile, 'officerId' | 'completedAt' | 'certificateId'>

export type StaffSignInResult =
  | { status: 'signed_in'; officerId: string }
  | { status: 'needs_profile'; officerId: string; certificateId: string }
  | { status: 'not_authorised'; reason: 'not_staff' | 'not_authorised_for_clave' | 'expired' }

/** Queue priority tiers, highest first. Each queued case gets exactly one. */
export type PriorityTier = 'p1_high_risk' | 'p2_appeal' | 'p3_citizen_replied' | 'p4_medium_risk' | 'p5_video_call' | 'p6_advanced_review'

export type DecisionOutcome = 'approved_basic' | 'approved_advanced' | 'refused' | 'revoked'

export interface Decision {
  outcome: DecisionOutcome
  by: Actor
  /** REQUIRED when outcome is 'refused' or 'revoked'. Enforced in core. */
  reasonId?: RejectionReasonId
  note?: string
  at: string
}

export interface InfoRequest {
  /** What the officer asks for, shown to the citizen. */
  message: string
  at: string
  by: Actor
  response?: { text: string; at: string }
}

export interface Appeal {
  text: string
  at: string
  state: 'open' | 'upheld' | 'dismissed'
}

export interface Persona {
  name: string
  age: number
  nationality: string
  /** e.g. "Italian master's student in Madrid". */
  profile: Bilingual
  /** Two-letter initials for the generated avatar (no real faces). */
  initials: string
  /** Hue 0–360 for the generated avatar. */
  hue: number
}

/** Answers the route assistant collects (screen 2). */
export interface AssistantAnswers {
  nationalityGroup: 'spanish' | 'eu' | 'non_eu'
  document: DocumentType
  hasEuEid: boolean
  /** Registering on someone else's phone, with their help. */
  assisted: boolean
}

/**
 * The deterministic script the simulated engine reads. For each check, the result per attempt
 * (attempt 1 = first submission, attempt 2 = after a correction / resubmission).
 * If a check has no entry for an attempt, it passes.
 */
export interface SimulationScript {
  attempts: Array<Partial<Record<CheckId, Omit<CheckResult, 'id'>>>>
}

export interface Assisted {
  helperName: string
  relation: Bilingual
  /** Whose phone it is. */
  deviceOwner: string
}

export interface Guardian {
  name: string
  relation: Bilingual
  document: IdentityDocument
  /** Guardian signs in by this route (e.g. 'A' with their EU eID). */
  route: RouteId
}

export type CaseOrigin = 'library' | 'background' | 'signup'

export interface Case {
  id: string
  /** 'library' = runnable persona from the case library; 'background' = filler for the officer queue. */
  origin: CaseOrigin
  persona: Persona
  document: IdentityDocument
  /** Extra document the persona also holds (e.g. Giulia's Italian eID without PIN). */
  otherDocuments?: IdentityDocument[]
  /** The answers this persona gives in the route assistant (demo prefill; user can change them). */
  presetAnswers: AssistantAnswers
  assisted?: Assisted
  guardian?: Guardian
  /** True for the red-card case: runs on a proposed rule change, not current rules. */
  policyProposal?: boolean
  /** One-line summary of the scenario, for the demo panel. */
  scenario: Bilingual
  /** Which beat this case shows in the video/guide. */
  demoBeat: Bilingual
  simulation: SimulationScript

  /* ---------- live state (mutated only through core actions) ---------- */
  /** null until the citizen starts. */
  answers: AssistantAnswers | null
  route: RouteId | null
  status: StatusId | 'draft'
  level: Level
  advanced: AdvancedState
  consentGiven: boolean
  attempt: number
  checks: CheckResult[]
  risk: RiskLevel
  flags: Flag[]
  /** True while the case sits in the officer queue waiting for a person. */
  awaitingOfficer: boolean
  decisions: Decision[]
  infoRequest?: InfoRequest
  appeal?: Appeal
  /** True once a refusal on this case was later corrected and approved (dashboard indicator). */
  correctedAfterRefusal: boolean
  /** ISO time of a video call the citizen booked with an officer (Fallback route or after a refusal). */
  videoCallSlot?: string
  submittedAt?: string
  updatedAt: string
}

/* ------------------------------------------------------------------ audit */

export type AuditAction =
  | 'case_started'
  | 'route_selected'
  | 'consent_given'
  | 'check_completed'
  | 'auto_approved_basic'
  | 'escalated_to_officer'
  | 'officer_approved_basic'
  | 'officer_approved_advanced'
  | 'info_requested'
  | 'info_provided'
  | 'officer_refused'
  | 'officer_revoked'
  | 'appeal_filed'
  | 'correction_submitted'
  | 'video_call_booked'
  | 'account_created'
  | 'staff_signed_in'
  | 'staff_access_denied'
  | 'staff_profile_completed'
  | 'demo_reset'

export interface AuditEvent {
  id: string
  caseId: string | null
  at: string
  actor: Actor
  action: AuditAction
  /** Human-readable, EN (officer tool is EN/ES; audit is stored in EN). */
  detail: string
  /** Which checks the decision rested on. */
  evidence?: CheckId[]
  reasonId?: RejectionReasonId
}

/* -------------------------------------------------------- decision rules */

export interface DecisionRule {
  situation: Bilingual
  route: RouteId
  automaticOutcome: Bilingual
  toOfficerWhen: Bilingual
}

/** Thresholds the simulated engine uses. */
export interface EngineThresholds {
  livenessMin: number
  faceMatchMin: number
  /** Failed attempts after which the case goes to the Fallback route. */
  maxAttemptsBeforeFallback: number
}

/* ------------------------------------------------------- reference sheet */

export interface ReferenceFigure {
  id: string
  label: Bilingual
  value: string
  year: string
  source: string
  sourceUrl: string
}

/* ------------------------------------------------------- dashboard (sim) */

export interface SimulatedIndicator {
  id:
    | 'time_to_advanced'
    | 'share_needing_office'
    | 'corrected_rejections'
    | 'appeals'
  label: Bilingual
  simulated: true
}

/* ------------------------------------------------------- citizen accounts */

/**
 * A citizen's sign-in to the platform. One account = one application (case) in this prototype.
 * The 8 library personas have saved accounts (credentials only in the README, never in the UI).
 */
export interface CitizenAccount {
  /** Same id as the case it owns. */
  caseId: string
  /** Sign-in identifier: the case's document number (always "DEMO-…"). */
  documentNumber: string
  /** demoHash(password). Demo only, not a secure password store. */
  passwordHash: string
  createdAt: string
  origin: 'library' | 'signup'
}

export type NationalityGroup = AssistantAnswers['nationalityGroup']

export interface SignUpCountry {
  /** English short name, also used as the persona's nationality adjective source. */
  name: Bilingual
  /** Nationality adjective shown on the case, e.g. "Italian". */
  nationality: string
  group: NationalityGroup
}

export interface SignUpInput {
  fullName: string
  /** ISO date (YYYY-MM-DD). */
  dateOfBirth: string
  /** Index into SIGNUP_COUNTRIES. */
  countryIndex: number
  documentType: DocumentType
  password: string
}

export type SignInResult = { ok: true; caseId: string } | { ok: false; reason: 'invalid_credentials' }
export type SignUpResult =
  | { ok: true; caseId: string; documentNumber: string }
  | { ok: false; reason: 'underage' | 'invalid_name' | 'weak_password' | 'invalid_document_for_country' }

/* ------------------------------------------------------------ app state */

export interface AppState {
  version: number
  cases: Record<string, Case>
  audit: AuditEvent[]
  lang: Lang
  /** Officer currently signed in (simulated login), or null. */
  officerId: string | null
  /** Officer job profiles, keyed by officerId (filled the first time each officer signs in). */
  officerProfiles: Record<string, OfficerProfile>
  /** Case of the signed-in citizen (the citizen session), or null when signed out. */
  activeCitizenCaseId: string | null
  /** Citizen accounts, keyed by caseId. */
  accounts: Record<string, CitizenAccount>
}
