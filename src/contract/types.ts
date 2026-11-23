/**
 * CONTRACT — data shapes shared by core and the UI areas.
 *
 * Source of truth: the group's project plan (case library GYC-01…08, message bank, rejection list) and
 * docs/SPEC-rules.md. Everything here is fictional. Every check is SIMULATED.
 *
 * The one principle: no outcome is scripted per person. A case ends where the typed data, the simulated
 * outside world (src/contract/world.ts), the simulated camera input of each attempt, the general rules
 * (src/core/engine.ts) and an officer's decisions take it.
 */

export type Lang = 'en' | 'es'
/** Every citizen-facing string exists in both languages. */
export type Bilingual = { en: string; es: string }

/* ------------------------------------------------------------------ routes */

/**
 * A = EU digital ID (eIDAS) · B = document chip + face check · C = DNI + short video (today's route) ·
 * F = Fallback (video call with an officer, office as last option) · X = red card or NIE paper (passport chip
 * + face, an officer checks the card; proposed rule).
 */
export type RouteId = 'A' | 'B' | 'C' | 'F' | 'X'

export interface RouteDef {
  id: RouteId
  /** Short code shown in badges: "A", "B", "C", "Fallback", "X". */
  code: string
  /** Short route name (never the letter alone). */
  name: Bilingual
  /** Who the route is for. */
  forWhom: Bilingual
  /** The checks the simulated engine computes on this route, in order. */
  checks: CheckId[]
  /** Result message id in MSG (e.g. 'RA-07B'). */
  msg: string
}

/* ---------------------------------------------------------------- statuses */

/**
 * The five citizen-view statuses: 1 Received → 2 Checking → 3 We need something from you →
 * 4 Approved (4 basic / 4B basic + advanced under review / 4C advanced) → 5 Not approved, with reason and review.
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

/** Display form of a document (derived from the typed document). */
export interface IdentityDocument {
  type: DocumentType
  /** Fictional: DNI/NIE-shaped numbers always carry a wrong check letter (isFictionalDniNie). */
  number: string
  issuingCountry: string
  /** ISO date. */
  expires: string
}

/** Name and date of birth as written on a document or in a record. */
export interface PersonData {
  givenNames: string
  surnames: string
  /** YYYY-MM-DD */
  dateOfBirth: string
}

/** What the applicant typed about a document (printed data). */
export interface TypedDocument {
  type: DocumentType
  number: string
  /** YYYY-MM-DD, as printed. */
  expiry: string
  /** Nationality / issuing country (English short name, e.g. "Italy"). */
  nationality: string
  /** Name and date of birth as printed on the document. */
  data: PersonData
}

/* ------------------------------------------------------- simulated inputs */

/** What the simulated camera sees on one attempt. An INPUT chosen on the camera screen, never an outcome. */
export type CameraInput = 'person' | 'reflections' | 'synthetic'

/** A small image the citizen added. Stays in this browser (state), ≤ 1.5 MB. */
export interface Upload {
  name: string
  dataUrl: string
  at: string
  mime?: string
  size?: number
}

export type Who = 'self' | 'helping' | 'child'
export type YesNoUnsure = 'yes' | 'no' | 'unsure'
export type HelperRelation = 'family' | 'friend' | 'support'
export type FallbackReason = 'chip' | 'face' | 'no_nfc' | 'consent' | 'no_passport'
export type VideoCallState = 'waiting' | 'live' | 'ended'

export interface MinorData extends PersonData {
  document: TypedDocument
}

/** Everything the citizen did in the session. Inputs only: results are computed by the engine. */
export interface Session {
  /** Route the assistant recommended (the case's `route` becomes 'F' when the Fallback takes over). */
  route: RouteId | null
  who: Who
  nfc: YesNoUnsure | null
  euEid: YesNoUnsure | null
  consents: { face?: boolean; residence?: boolean; declined?: boolean; at?: string }
  /** Route A: the mock national eID page returned the typed data. */
  eidLogin?: { at: string; data: PersonData }
  /** One entry per "Read chip" press. */
  chipReads: Array<'ok' | 'failed'>
  /** One per face-check attempt (route B / X / minor). */
  faceAttempts: CameraInput[]
  /** DNI video attempts (route C). */
  videoAttempts: CameraInput[]
  helper?: { name: string; relation: HelperRelation; mobile?: string }
  /** MSG-ASS-01 answered "Sí, quiero registrarme yo". */
  applicantConfirmed?: boolean
  minor?: MinorData
  /** Guardian's own chip + face check (does not register her). */
  guardianChecks?: 'passed'
  uploads: {
    proof?: Upload
    redCard?: Upload & { number: string; expiry: string }
    appeal?: Upload
    info?: Upload
  }
  /** Route X: the passport whose chip is read. */
  passport?: TypedDocument
  contact?: { mobile: string; email?: string; smsConfirmed: boolean }
  fallback?: { offered: FallbackReason; joined: boolean; comeBackLater?: boolean; at: string }
  videoCall?: { state: VideoCallState; officerId?: string; officerName?: string; startedAt?: string; endedAt?: string }
  /** MSG-AI-04 box ticked. */
  confirmedReview?: boolean
}

/* ------------------------------------------------------------------ checks */

export type CheckId =
  | 'eidas_login'
  | 'chip_read'
  | 'chip_signature'
  | 'printed_vs_chip'
  | 'document_validity'
  | 'liveness'
  | 'face_match'
  | 'residence'
  | 'guardian_link'
  | 'red_card'
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
  /** 0–1 for scored checks (liveness, face_match). Always shown with "simulated values". */
  score?: number
  /** Officer-facing explanation of the result. */
  detail: Bilingual
  /** Differing fields (printed_vs_chip, residence). */
  fields?: Array<keyof PersonData>
}

/** One row of the officer's discrepancy table. */
export interface DiscrepancyRow {
  field: keyof PersonData
  /** Value on the document / chip. */
  document: string
  /** Value in the other source (chip data for printed_vs_chip, residence record for residence). */
  records: string
  source: 'chip' | 'residence'
}

/* -------------------------------------------------------------------- risk */

export type RiskLevel = 'low' | 'medium' | 'high'

export type FlagCode =
  | 'low_liveness'
  | 'low_face_match'
  | 'chip_signature_failed'
  | 'printed_vs_chip_mismatch'
  | 'chip_unreadable'
  | 'document_invalid'
  | 'residence_not_found'
  | 'residence_mismatch'
  | 'eid_data_mismatch'
  | 'minor_with_guardian'
  | 'assisted_shared_device'
  | 'policy_proposal_route'
  | 'red_card_check'
  | 'consent_declined'
  | 'no_nfc'
  | 'second_attempt'
  | 'appeal_filed'
  | 'advanced_level_review'

export interface Flag {
  code: FlagCode
  /** Why the engine flagged it — shown in the officer queue. */
  reason: Bilingual
  severity: RiskLevel
}

/* -------------------------------------------------------------- rejections */

/** The closed list (plan 3.4, provisional). Only an officer picks one. */
export type RejId = 'REJ-01' | 'REJ-02' | 'REJ-03' | 'REJ-04' | 'REJ-05' | 'REJ-06' | 'REJ-07' | 'REJ-08'
export type RejectionReasonId = RejId

export interface RejectionReason {
  id: RejId
  /** What the officer picks in the closed list. */
  officerLabel: Bilingual
  /** When an officer would pick it (proposed). */
  when: Bilingual
  /** Can the citizen correct it, and how. */
  canCorrect: Bilingual
  /** MSG id of the citizen text (e.g. 'REJ-05'). */
  msg: RejId
  /** The citizen message (MSG-REJ-0x, verbatim). */
  citizenMessage: Bilingual
  /** What the citizen can do next (= canCorrect, citizen wording). */
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
  office: Bilingual
}

/* ------------------------------------------------------------ staff access
 * Modelled on how Cl@ve registration staff really get in (researched Nov 2026):
 *  - they are public employees of a body enabled as a Cl@ve Registration Authority (AEAT, Social Security,
 *    SEPE, Government Delegations/Subdelegations, and many regional and local bodies);
 *  - they open the registration application with an electronic certificate: a public-employee certificate
 *    (on a cryptocard, it carries their identity, post and employing body), a DNIe, or another accepted
 *    personal certificate;
 *  - access works only if their organisation has authorised that person for Cl@ve registration.
 * Everything here is SIMULATED with fictional people and fictional identifiers (wrong check letters).
 */
export type StaffCredential = 'employee_certificate' | 'dnie' | 'personal_certificate'

export interface RegistrationAuthority {
  id: string
  name: Bilingual
  /** Short label, e.g. "AEAT". */
  short: string
}

export interface StaffOffice {
  /** DIR3-style unit code, fictional series "E04999…". */
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
  /** Fictional DNI/NIE read from the certificate (wrong check letter). */
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
  /** demoHash of the certificate's PIN (the cryptocard / DNIe PIN typed after picking the certificate). */
  pinHash: string
}

/** Staff user account for the "user + password" sign-in method. */
export interface StaffAccount {
  userId: string
  holderName: string
  holderId: string
  officerId?: string
  authorisedForClave: boolean
  passwordHash: string
}

export type StaffSignInMethod = 'certificate' | 'password'

export type OfficerRole = 'registrar' | 'supervisor'

/** Job details an officer confirms the first time they sign in. */
export interface OfficerProfile {
  officerId: string
  authorityId: string
  officeCode: string
  post: string
  /** Personnel registration number (NRP), fictional: see PERSONNEL_NUMBER_PATTERN / isFictionalPersonnelNumber. */
  personnelNumber: string
  role: OfficerRole
  /** How they signed in when they completed the profile; certificateId only for the certificate method. */
  signInMethod: StaffSignInMethod
  certificateId?: string
  completedAt: string
}

export type OfficerProfileInput = Omit<OfficerProfile, 'officerId' | 'completedAt' | 'certificateId' | 'signInMethod'>

export type StaffSignInResult =
  | { status: 'signed_in'; officerId: string }
  | { status: 'needs_profile'; officerId: string; method: StaffSignInMethod; certificateId?: string }
  /** Wrong PIN or wrong user/password. Generic on purpose: never says which part was wrong. */
  | { status: 'invalid_credentials' }
  | { status: 'not_authorised'; reason: 'not_staff' | 'not_authorised_for_clave' | 'expired' }

/** Queue priority tiers, highest first. Each queued case gets exactly one. */
export type PriorityTier = 'p1_high_risk' | 'p2_appeal' | 'p3_citizen_replied' | 'p4_medium_risk' | 'p5_video_call' | 'p6_advanced_review'

export type DecisionOutcome = 'approved_basic' | 'approved_advanced' | 'refused' | 'revoked'

export interface Decision {
  outcome: DecisionOutcome
  by: Actor
  /** REQUIRED when outcome is 'refused' or 'revoked'. Enforced in core. */
  reasonId?: RejId
  /** Officer's internal note. The citizen never sees it. */
  note?: string
  /** Rule that applied (engine decisions) or the context ('APPEAL', 'INFO-REQUEST', 'VIDEO-CALL'). */
  ruleId?: string
  /** 'advanced' when only the advanced level was refused (the basic level stays). */
  scope?: 'advanced'
  at: string
}

export interface InfoRequest {
  /** What the officer asks for: fills {whatWeNeed} in MSG-COR-01. */
  message: string
  /** Why, in one sentence: fills {reason} in MSG-COR-01. */
  reason?: string
  at: string
  by: Actor
  response?: { text: string; at: string; upload?: Upload }
}

/**
 * A review request ("Pedir una revisión") after a refusal.
 * state: 'open' → waiting · 'upheld' = the review approved (refusal corrected, MSG-COR-06) ·
 * 'dismissed' = the original refusal was kept (MSG-COR-07).
 */
export interface Appeal {
  text: string
  at: string
  state: 'open' | 'upheld' | 'dismissed'
  upload?: Upload
  /** Officer who took the refusal under review: must not decide the appeal. */
  refusedBy?: string
  refusedReasonId?: RejId
  decidedBy?: Actor
  decidedAt?: string
  /** Reason kept when dismissed. */
  keptReasonId?: RejId
  /** 'advanced' when the review is about an advanced-only refusal (the basic level stays). */
  scope?: 'advanced'
}

export interface Persona {
  name: string
  age: number
  nationality: string
  /** e.g. "Japanese · TIE". */
  profile: Bilingual
  /** Two-letter initials for the generated avatar (no real faces). */
  initials: string
  /** Hue 0–360 for the generated avatar. */
  hue: number
}

/** Answers the route assistant collects (RA-02…RA-06). */
export interface AssistantAnswers {
  nationalityGroup: 'spanish' | 'eu' | 'non_eu'
  /** Country short name (EN), when known. */
  nationality?: string
  document: DocumentType
  /** RA-03 "No lo sé": the citizen does not know which document → Fallback. */
  documentUnsure?: boolean
  /** RA-04 (EU only). */
  euEid?: YesNoUnsure | null
  /** RA-05. */
  who?: Who
  /** RA-06 (only when route B is possible). */
  nfc?: YesNoUnsure | null
  /** Legacy booleans, kept in sync by core (UI migration). */
  hasEuEid: boolean
  assisted: boolean
  forMinor?: boolean
}

/** @deprecated UI migration: derived view of session.helper. */
export interface Assisted {
  helperName: string
  relation: Bilingual
  deviceOwner: string
  applicantPhone?: string
  noOwnPhone?: boolean
}

/** @deprecated UI migration: derived view of the guardian (the account holder) when registering a minor. */
export interface Guardian {
  name: string
  relation: Bilingual
  document: IdentityDocument
  route: RouteId
}

export type CaseOrigin = 'library' | 'background' | 'signup'

/** @deprecated UI migration: the "simulate a failure" control was removed; outcomes come from the rules. */
export type SimFailure = 'chip_unreadable' | 'chip_signature' | 'liveness' | 'data_mismatch'

export interface Case {
  id: string
  /** 'library' = preloaded demo account; 'signup' = created live; 'background' = queue filler. */
  origin: CaseOrigin
  /** Display reference (GYC-02…); sign-ups get the lowest free GYC number. */
  caseRef?: string
  /** Officer-side label when the applicant is unknown (e.g. "Applicant X"). */
  caseLabel?: string
  /** What the account holder typed at sign-up. */
  typed: TypedDocument
  /** Derived display data (the applicant: the minor once setMinor ran). */
  persona: Persona
  document: IdentityDocument
  /** Answers derived from the typed data (prefill for the assistant). */
  presetAnswers: AssistantAnswers
  scenario: Bilingual
  demoBeat: Bilingual
  session: Session

  /** @deprecated UI migration: derived from session.helper. */
  assisted?: Assisted
  /** @deprecated UI migration: derived from session.minor. */
  guardian?: Guardian
  /** True when the case runs on a proposed rule (B, C-assisted, X, F for foreigners). */
  policyProposal?: boolean
  /** @deprecated UI migration: no effect. */
  simulatedFailure?: SimFailure
  /** @deprecated UI migration: kept for the old booking widget. */
  videoCallSlot?: string

  /* ---------- live state (mutated only through core actions) ---------- */
  answers: AssistantAnswers | null
  route: RouteId | null
  status: StatusId | 'draft'
  level: Level
  advanced: AdvancedState
  consentGiven: boolean
  /** Number of submissions (1 after submit). */
  attempt: number
  checks: CheckResult[]
  risk: RiskLevel
  flags: Flag[]
  /** Officer-facing one-sentence reason (EN/ES) from the rule that applied. */
  aiReason?: Bilingual
  discrepancies?: DiscrepancyRow[]
  /** Hint for the officer, never preselected. */
  suggestedReason?: RejId
  /** Rule that decided the current state (e.g. 'A-OK', 'CHIP-TWICE'). */
  ruleId?: string
  /** MSG ids the citizen should see now, in order (e.g. ['STA-3', 'FALL-01']). */
  citizenMsgs: string[]
  /** True while the case sits in the officer queue waiting for a person. */
  awaitingOfficer: boolean
  decisions: Decision[]
  infoRequest?: InfoRequest
  appeal?: Appeal
  /** True once a refusal on this case was later corrected and approved (dashboard indicator). */
  correctedAfterRefusal: boolean
  submittedAt?: string
  updatedAt: string
}

/* ------------------------------------------------------------------ audit */

export type AuditAction =
  | 'case_started'
  | 'route_selected'
  | 'consent_given'
  | 'consent_declined'
  | 'chip_read'
  | 'face_attempt'
  | 'video_attempt'
  | 'upload_added'
  | 'contact_confirmed'
  | 'submitted'
  | 'fallback_offered'
  | 'video_call_joined'
  | 'video_call_started'
  | 'video_call_ended'
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
  | 'appeal_decided'
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
  reasonId?: RejId
  /** Rule id that applied, when any. */
  ruleId?: string
  /** Tags such as 'Refusal corrected on review', 'Proposed rule', 'Assisted session'. */
  tags?: string[]
}

/* -------------------------------------------------------- decision rules */

export interface DecisionRule {
  /** Rule id used in audit entries. */
  id: string
  /** Position in the ordered list (SPEC §4). */
  order: number
  situation: Bilingual
  route: RouteId | null
  automaticOutcome: Bilingual
  toOfficerWhen: Bilingual
}

/** Thresholds the simulated engine uses. */
export interface EngineThresholds {
  livenessMin: number
  faceMatchMin: number
  /** Failed attempts after which the Fallback is offered. */
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

/** A citizen's sign-in to the platform. One account = one application (case) in this prototype. */
export interface CitizenAccount {
  /** Same id as the case it owns. */
  caseId: string
  /** Sign-in identifier: the typed (fictional) document number. */
  documentNumber: string
  /** demoHash(password). Demo only, not a secure password store. */
  passwordHash: string
  createdAt: string
  origin: 'library' | 'signup'
}

export type NationalityGroup = AssistantAnswers['nationalityGroup']

export interface SignUpCountry {
  /** English short name, also used as the typed nationality. */
  name: Bilingual
  /** Nationality adjective shown on the case, e.g. "Italian". */
  nationality: string
  group: NationalityGroup
}

export interface SignUpInput {
  givenNames?: string
  surnames?: string
  /** @deprecated UI migration: split into givenNames (first word) + surnames (rest) when the two fields are missing. */
  fullName?: string
  /** ISO date (YYYY-MM-DD). */
  dateOfBirth: string
  /** Index into SIGNUP_COUNTRIES. */
  countryIndex: number
  documentType: DocumentType
  /** Typed document number. When missing (old UI), a fictional one is generated. */
  documentNumber?: string
  /** YYYY-MM-DD as printed. When missing (old UI), today + 5 years. */
  expiryDate?: string
  password: string
}

export type SignInResult = { ok: true; caseId: string } | { ok: false; reason: 'invalid_credentials' }
export type SignUpFailure =
  | 'underage'
  | 'invalid_name'
  | 'weak_password'
  | 'invalid_document_for_country'
  | 'invalid_document_number'
  | 'real_document_number'
  | 'duplicate_document'
  | 'invalid_expiry'
export type SignUpResult =
  | { ok: true; caseId: string; documentNumber: string }
  | { ok: false; reason: SignUpFailure }

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
