/**
 * CONTRACT — owned by the orchestrator. Subagents must NOT edit it.
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
  Case,
  Lang,
  RejectionReasonId,
  RouteId,
} from './types'

/* ================================================================ STORE API
 * import { useClave, actions, t } from '@/core/store'
 *
 *   const cases = useClave(s => s.cases)           // zustand-style selector hook over AppState
 *   actions.startCase('giulia', answers)
 *
 * Every action: updates state, appends AuditEvent(s), persists to localStorage, broadcasts to
 * other tabs (BroadcastChannel). Other tabs re-render within ~100 ms.
 * Actions that are not allowed in the current state throw ClaveRuleError (UI should prevent them).
 */
export interface ClaveActions {
  /* ---- session ---- */
  setLang(lang: Lang): void
  officerSignIn(officerId: string): void
  officerSignOut(): void
  setActiveCitizenCase(caseId: string | null): void

  /* ---- citizen flow (screens 2–5) ---- */
  /** Screen 2: store answers + chosen route (normally recommendRoute(answers).route). Status stays 'draft'. */
  startCase(caseId: string, answers: AssistantAnswers, route: RouteId): void
  /** Screen 3: consent screen accepted. */
  giveConsent(caseId: string): void
  /**
   * Screen 3: submit for verification. Sets status 'received', then the engine runs the checks
   * asynchronously: status 'checking' after ~600 ms, each check result appears one by one
   * (~500 ms apart, so the UI can animate), then the rules apply (auto-approve or officer queue).
   * Returns a promise that resolves when the engine is done.
   */
  submitForVerification(caseId: string): Promise<void>
  /** Status 3 'need_info': citizen answers the officer's request → back to 'checking', officer queue. */
  respondToInfoRequest(caseId: string, text: string): void
  /** Status 5: citizen appeals. Case goes back to the officer queue with an 'appeal_filed' flag. */
  fileAppeal(caseId: string, text: string): void
  /** Status 5: citizen says they corrected the cause (e.g. padrón). Runs attempt N+1 of the script. */
  submitCorrection(caseId: string, note: string): Promise<void>
  /** Citizen books one of the simulated video-call slots; officers see it on the case. */
  bookVideoCall(caseId: string, slotIso: string): void

  /* ---- officer (screens 6–8). All require a signed-in officer. ---- */
  /** Grants basic (if level 'none') or advanced (if advanced 'pending_review'). */
  officerApprove(caseId: string, note?: string): void
  officerRequestInfo(caseId: string, message: string): void
  /** reasonId is REQUIRED; throws ClaveRuleError without it or without a signed-in officer. */
  officerRefuse(caseId: string, reasonId: RejectionReasonId, note?: string): void
  /** Revokes a granted level. Same rule: officer + reason. */
  officerRevoke(caseId: string, reasonId: RejectionReasonId, note?: string): void
  /** Red-card / Fallback: officer completes the simulated video call (sets officer_video = pass). */
  officerCompleteVideoCall(caseId: string): void

  /* ---- citizen accounts (branch feature/citizen-accounts) ---- */
  /** Sign in with document number (case/spaces ignored) + password. On success sets activeCitizenCaseId. */
  citizenSignIn(documentNumber: string, password: string): SignInResult
  /**
   * Create an account + a new draft application (origin 'signup'). Assigns a fictional document number (realistic shape; DNI/NIE-shaped ones use fictionalDniNie),
   * generated initials/hue, presetAnswers from the country group, and an empty simulation script (every check
   * passes by default). Signs the new citizen in. Audits 'account_created'.
   */
  citizenSignUp(input: SignUpInput): SignUpResult
  /** Ends the citizen session (activeCitizenCaseId = null). */
  citizenSignOut(): void
  /* ---- staff access (branch feature/staff-console) ---- */
  /**
   * Simulated certificate sign-in. Wrong PIN → invalid_credentials (generic). Expired → not_authorised/expired.
   * No officerId → not_authorised/not_staff.
   * authorisedForClave false → not_authorised/not_authorised_for_clave. Officer with a saved profile →
   * signed_in (sets officerId). Otherwise → needs_profile (does NOT sign in yet). Audits every attempt.
   */
  officerSignInWithCertificate(certificateId: string, pin: string): StaffSignInResult
  /**
   * Staff user + password (STAFF_ACCOUNTS). Wrong user or password → invalid_credentials (generic).
   * Then the same authorisation rules and outcomes as the certificate method. Audits every attempt
   * (never the password).
   */
  officerSignInWithPassword(userId: string, password: string): StaffSignInResult
  /**
   * First sign-in: save the officer's job details and sign them in. Throws ClaveRuleError when the
   * personnel number doesn't match PERSONNEL_NUMBER_PATTERN, the office doesn't belong to the authority,
   * or the certificate doesn't belong to that officer.
   */
  officerCompleteProfile(officerId: string, method: 'certificate' | 'password', certificateId: string | null, input: OfficerProfileInput): void

  /* ---- demo ---- */
  /** Reset everything to buildSeedState(new Date()). Broadcast to all tabs. */
  resetDemo(): void
  /** Reset a single library case back to 'draft'. */
  resetCase(caseId: string): void
}

/** Derived selectors exported from '@/core/selectors'. */
export interface ClaveSelectors {
  /** Cases waiting for an officer, sorted by priority tier (PRIORITY_TIERS, with the age bump), then oldest first. */
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
