/**
 * Citizen accounts — sign in, sign up, sign out (branch feature/citizen-accounts).
 *
 * Implements ClaveActions.citizenSignIn / citizenSignUp / citizenSignOut from contract/api.ts.
 * The store wires these in with one spread (see the end of `actions` in store.ts); this module never
 * imports the store, it receives its read/commit/audit helpers instead (no circular import).
 *
 * DEMO ONLY: passwords are kept as demoHash(password), which is not a secure hash. Every generated
 * document number is fictional and starts with "DEMO-". Nothing leaves the browser.
 */
import type {
  Actor, AppState, AuditAction, AuditEvent, Case, CitizenAccount, DocumentType, IdentityDocument,
  SignInResult, SignUpCountry, SignUpInput, SignUpResult,
} from '@/contract/types'
import type { ClaveActions } from '@/contract/api'
import {
  DOCUMENTS, PASSWORD_MIN_LENGTH, SIGNUP_COUNTRIES, SIGNUP_DOCUMENTS, SIGNUP_MIN_AGE, demoHash, normaliseDocNumber,
} from '@/contract/seed'

/* ------------------------------------------------------------ validation */

export const NAME_MAX_LENGTH = 80
/** Oldest age the sign-up form accepts (a typo guard, not a rule). */
export const SIGNUP_MAX_AGE = 120

/** Trims and collapses inner whitespace. */
export const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ')

/** At least two words (first name + surname), letters plus spaces, hyphens, apostrophes and dots, ≤ 80 chars. */
export function isValidName(raw: string): boolean {
  const name = cleanName(raw)
  if (name.length < 3 || name.length > NAME_MAX_LENGTH) return false
  if (!/^[\p{L}\p{M}][\p{L}\p{M}' .’-]*$/u.test(name)) return false
  const words = name.split(' ').filter(w => /\p{L}/u.test(w))
  return words.length >= 2
}

/** Parses a strict YYYY-MM-DD date (local calendar). null when invalid. */
export function parseIsoDate(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s?.trim() ?? '')
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return { y, m: mo, d }
}

/** Whole years between the date of birth and `today`. null for an invalid date; negative for a future date. */
export function ageOn(dateOfBirth: string, today: Date = new Date()): number | null {
  const p = parseIsoDate(dateOfBirth)
  if (!p) return null
  const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate()
  let age = ty - p.y
  if (tm < p.m || (tm === p.m && td < p.d)) age--
  return age
}

export const isStrongEnough = (password: string) => typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH

/** Documents a sign-up may choose for SIGNUP_COUNTRIES[countryIndex]. Empty for an unknown country. */
export function documentsForCountry(countryIndex: number): DocumentType[] {
  const c = SIGNUP_COUNTRIES[countryIndex]
  return c ? SIGNUP_DOCUMENTS[c.group] : []
}

/** Same checks the action runs, in the same order. null when the input is valid. */
export function validateSignUp(input: SignUpInput, today: Date = new Date()): Exclude<SignUpResult, { ok: true }>['reason'] | null {
  if (!isValidName(input.fullName ?? '')) return 'invalid_name'
  const age = ageOn(input.dateOfBirth ?? '', today)
  if (age === null || age < SIGNUP_MIN_AGE || age > SIGNUP_MAX_AGE) return 'underage'
  if (!isStrongEnough(input.password)) return 'weak_password'
  if (!Number.isInteger(input.countryIndex) || !documentsForCountry(input.countryIndex).includes(input.documentType)) {
    return 'invalid_document_for_country'
  }
  return null
}

/* ------------------------------------------------- fictional identifiers */

/** ISO 3166 alpha-2 codes for the sign-up countries (by English name). "XX" = other. */
const COUNTRY_CODE: Record<string, string> = {
  Spain: 'ES', Italy: 'IT', France: 'FR', Germany: 'DE', Portugal: 'PT', Poland: 'PL', Romania: 'RO', Netherlands: 'NL',
  Morocco: 'MA', Colombia: 'CO', Venezuela: 'VE', Argentina: 'AR', Mexico: 'MX', 'United States': 'US',
  'United Kingdom': 'GB', China: 'CN', India: 'IN', Ukraine: 'UA', Nigeria: 'NG',
}
const countryCode = (c: SignUpCountry) => COUNTRY_CODE[c.name.en] ?? 'XX'

const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const digits = (n: number, rnd: () => number) => Array.from({ length: n }, () => Math.floor(rnd() * 10)).join('')
const letter = (rnd: () => number) => LETTERS[Math.floor(rnd() * LETTERS.length)]

/** A clearly fake document number in a format that hints at the document type. Always "DEMO-…". */
export function fakeDocumentNumber(type: DocumentType, country: SignUpCountry, rnd: () => number = Math.random): string {
  switch (type) {
    case 'PASSPORT': return `DEMO-P-${countryCode(country)}-${digits(6, rnd)}`
    case 'EU_EID': return `DEMO-EID-${countryCode(country)}-${digits(5, rnd)}`
    case 'DNI': return `DEMO-DNI-${digits(7, rnd)}-${letter(rnd)}`
    case 'TIE': return `DEMO-TIE-${'XYZ'[Math.floor(rnd() * 3)]}${digits(7, rnd)}-${letter(rnd)}`
    case 'NIE_PAPER': return `DEMO-NIE-${'XYZ'[Math.floor(rnd() * 3)]}${digits(7, rnd)}-${letter(rnd)}`
    case 'RED_CARD': return `DEMO-RC-${digits(4, rnd)}-${letter(rnd)}`
  }
}

/** Document number not used by any account or case yet. */
function uniqueDocumentNumber(s: AppState, type: DocumentType, country: SignUpCountry): string {
  const taken = new Set<string>([
    ...Object.values(s.accounts ?? {}).map(a => normaliseDocNumber(a.documentNumber)),
    ...Object.values(s.cases).map(c => normaliseDocNumber(c.document.number)),
  ])
  for (let i = 0; i < 200; i++) {
    const n = fakeDocumentNumber(type, country)
    if (!taken.has(normaliseDocNumber(n))) return n
  }
  // Practically unreachable: fall back to a time-based suffix.
  return `${fakeDocumentNumber(type, country)}-${Date.now().toString(36).toUpperCase()}`
}

function newCaseId(s: AppState): string {
  for (;;) {
    const id = `su-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`
    if (!s.cases[id] && !s.accounts?.[id]) return id
  }
}

/** Two-letter initials: first letter of the first and last words. */
export function initialsOf(name: string): string {
  const words = cleanName(name).split(' ').filter(Boolean)
  const first = words[0]?.[0] ?? '?'
  const last = words.length > 1 ? words[words.length - 1][0] : (words[0]?.[1] ?? '')
  return (first + last).toLocaleUpperCase()
}

/** Deterministic avatar hue from the name. */
export const hueOf = (name: string) => parseInt(demoHash(cleanName(name).toLowerCase()), 16) % 360

function addYears(d: Date, years: number): string {
  const x = new Date(d)
  x.setFullYear(x.getFullYear() + years)
  return x.toISOString().slice(0, 10)
}

const ISSUED_IN_SPAIN: DocumentType[] = ['DNI', 'TIE', 'NIE_PAPER', 'RED_CARD']

/** Builds the new draft application for a valid sign-up. */
export function buildSignUpCase(id: string, input: SignUpInput, documentNumber: string, now: Date = new Date()): Case {
  const country = SIGNUP_COUNTRIES[input.countryIndex]
  const name = cleanName(input.fullName)
  const doc = DOCUMENTS[input.documentType]
  const document: IdentityDocument = {
    type: input.documentType,
    number: documentNumber,
    issuingCountry: ISSUED_IN_SPAIN.includes(input.documentType) ? 'Spain' : country.name.en,
    expires: addYears(now, 5),
  }
  const at = now.toISOString()
  return {
    id,
    origin: 'signup',
    persona: {
      name,
      age: ageOn(input.dateOfBirth, now) ?? SIGNUP_MIN_AGE,
      nationality: country.nationality,
      initials: initialsOf(name),
      hue: hueOf(name),
      profile: {
        en: `New applicant · ${country.name.en} · ${doc.label.en}`,
        es: `Nueva solicitud · ${country.name.es} · ${doc.label.es}`,
      },
    },
    document,
    presetAnswers: {
      nationalityGroup: country.group,
      document: input.documentType,
      hasEuEid: input.documentType === 'EU_EID',
      assisted: false,
    },
    policyProposal: input.documentType === 'RED_CARD' || input.documentType === 'NIE_PAPER' ? true : undefined,
    scenario: {
      en: 'Created with the sign-up form on this device. Every simulated check passes by default.',
      es: 'Creada con el formulario de registro en este dispositivo. Todas las comprobaciones simuladas se superan por defecto.',
    },
    demoBeat: { en: 'New sign-up', es: 'Nuevo registro' },
    simulation: { attempts: [] },
    ...draftLiveState(at),
  }
}

/** The live-state fields of a fresh draft application. */
function draftLiveState(at: string): Pick<Case,
  'answers' | 'route' | 'status' | 'level' | 'advanced' | 'consentGiven' | 'attempt' | 'checks' | 'risk' | 'flags'
  | 'awaitingOfficer' | 'decisions' | 'correctedAfterRefusal' | 'updatedAt' | 'infoRequest' | 'appeal' | 'videoCallSlot' | 'submittedAt'> {
  return {
    answers: null, route: null, status: 'draft', level: 'none', advanced: 'not_requested', consentGiven: false,
    attempt: 0, checks: [], risk: 'low', flags: [], awaitingOfficer: false, decisions: [], correctedAfterRefusal: false,
    infoRequest: undefined, appeal: undefined, videoCallSlot: undefined, submittedAt: undefined, updatedAt: at,
  }
}

/** resetCase for a sign-up application: same person and document, back to a fresh draft. */
export function resetSignUpCase(c: Case, now: Date = new Date()): Case {
  return { ...c, ...draftLiveState(now.toISOString()) }
}

/* --------------------------------------------------------------- actions */

export interface AccountDeps {
  get: () => AppState
  commit: (next: AppState, caseId?: string | null, action?: AuditAction | null) => void
  audit: (caseId: string | null, actor: Actor, action: AuditAction, detail: string) => AuditEvent
}

type AccountActions = Pick<ClaveActions, 'citizenSignIn' | 'citizenSignUp' | 'citizenSignOut'>

export function createAccountActions({ get, commit, audit }: AccountDeps): AccountActions {
  return {
    citizenSignIn(documentNumber: string, password: string): SignInResult {
      const fail: SignInResult = { ok: false, reason: 'invalid_credentials' }
      if (typeof documentNumber !== 'string' || typeof password !== 'string' || !documentNumber.trim() || !password) return fail
      const s = get()
      const wanted = normaliseDocNumber(documentNumber)
      const hash = demoHash(password)
      const acc = Object.values(s.accounts ?? {}).find(
        a => normaliseDocNumber(a.documentNumber) === wanted && a.passwordHash === hash && Boolean(s.cases[a.caseId]),
      )
      // One generic failure: never say whether the number or the password was wrong.
      if (!acc) return fail
      commit({ ...s, activeCitizenCaseId: acc.caseId }, acc.caseId)
      return { ok: true, caseId: acc.caseId }
    },

    citizenSignUp(input: SignUpInput): SignUpResult {
      const invalid = validateSignUp(input)
      if (invalid) return { ok: false, reason: invalid }
      const s = get()
      const country = SIGNUP_COUNTRIES[input.countryIndex]
      const id = newCaseId(s)
      const documentNumber = uniqueDocumentNumber(s, input.documentType, country)
      const now = new Date()
      const c = buildSignUpCase(id, input, documentNumber, now)
      const account: CitizenAccount = {
        caseId: id,
        documentNumber,
        passwordHash: demoHash(input.password),
        createdAt: now.toISOString(),
        origin: 'signup',
      }
      const actor: Actor = { kind: 'citizen', id, name: c.persona.name }
      // Never put the password (or its hash) in the audit trail.
      const ev = audit(id, actor, 'account_created',
        `${c.persona.name} created a citizen account (${c.persona.nationality}, ${input.documentType}). Demo document number ${documentNumber} assigned.`)
      commit({
        ...s,
        cases: { ...s.cases, [id]: c },
        accounts: { ...(s.accounts ?? {}), [id]: account },
        activeCitizenCaseId: id,
        audit: [...s.audit, ev],
      }, id, 'account_created')
      return { ok: true, caseId: id, documentNumber }
    },

    citizenSignOut() {
      const s = get()
      if (s.activeCitizenCaseId === null) return
      commit({ ...s, activeCitizenCaseId: null })
    },
  }
}
