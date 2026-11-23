/**
 * Citizen accounts — sign in, sign up, sign out (branch feature/citizen-accounts).
 *
 * Implements ClaveActions.citizenSignIn / citizenSignUp / citizenSignOut from contract/api.ts.
 * The store wires these in with one spread (see the end of `actions` in store.ts); this module never
 * imports the store, it receives its read/commit/audit helpers instead (no circular import).
 *
 * Prototype only: passwords are kept as demoHash(password), which is not a secure hash. Every generated
 * document number is fictional but realistic in shape: DNI/NIE-shaped numbers come from fictionalDniNie()
 * (deliberately wrong check letter), passports are 2 letters + 7 digits, EU eIDs 9 alphanumerics. Nothing leaves the browser.
 */
import type {
  Actor, AppState, AuditAction, AuditEvent, Case, CitizenAccount, DocumentType,
  SignInResult, SignUpCountry, SignUpFailure, SignUpInput, SignUpResult, TypedDocument,
} from '@/contract/types'
import type { ClaveActions } from '@/contract/api'
import {
  PASSWORD_MIN_LENGTH, SIGNUP_COUNTRIES, SIGNUP_DOCUMENTS, SIGNUP_MIN_AGE, demoHash, fictionalDniNie, hasDniNieShape, isFictionalDniNie,
  newDraftCase, normaliseDocNumber,
} from '@/contract/seed'
import { DEMO_PEOPLE } from '@/contract/world'

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

/** One name part (given names or surnames): letters, spaces, hyphens, apostrophes, dots; 1–60 chars. */
export function isValidNamePart(raw: string): boolean {
  const v = cleanName(raw ?? '')
  return v.length >= 1 && v.length <= 60 && /^[\p{L}\p{M}][\p{L}\p{M}' .’-]*$/u.test(v)
}

/** Given names + surnames from the input (old screens send fullName: first word + the rest). */
export function namesOf(input: SignUpInput): { givenNames: string; surnames: string } {
  if (input.givenNames !== undefined || input.surnames !== undefined) {
    return { givenNames: cleanName(input.givenNames ?? ''), surnames: cleanName(input.surnames ?? '') }
  }
  const words = cleanName(input.fullName ?? '').split(' ').filter(Boolean)
  return { givenNames: words[0] ?? '', surnames: words.slice(1).join(' ') }
}

/** Shape of a typed document number for its type. */
export function documentNumberShapeOk(type: DocumentType, number: string): boolean {
  const n = normaliseDocNumber(number)
  switch (type) {
    case 'DNI': return /^\d{8}[A-Z]$/.test(n)
    case 'TIE':
    case 'NIE_PAPER': return /^[XYZ]\d{7}[A-Z]$/.test(n)
    case 'RED_CARD': return /^[XYZ]\d{7}[A-Z]$/.test(n) || /^[A-Z0-9]{5,12}$/.test(n)
    case 'PASSPORT': return /^[A-Z0-9]{6,12}$/.test(n)
    case 'EU_EID': return /^[A-Z0-9]{6,12}$/.test(n)
  }
}

/** Same checks the action runs, in the same order (duplicates are checked against the state by the action). null when valid. */
export function validateSignUp(input: SignUpInput, today: Date = new Date()): SignUpFailure | null {
  const { givenNames, surnames } = namesOf(input)
  if (!isValidNamePart(givenNames) || !isValidNamePart(surnames)) return 'invalid_name'
  const age = ageOn(input.dateOfBirth ?? '', today)
  if (age === null || age < SIGNUP_MIN_AGE || age > SIGNUP_MAX_AGE) return 'underage'
  if (!isStrongEnough(input.password)) return 'weak_password'
  if (!Number.isInteger(input.countryIndex) || !documentsForCountry(input.countryIndex).includes(input.documentType)) {
    return 'invalid_document_for_country'
  }
  if (input.documentNumber !== undefined) {
    const n = normaliseDocNumber(input.documentNumber)
    // A DNI/NIE with a correct check letter could be a real person's number: always refused.
    if (hasDniNieShape(n) && !isFictionalDniNie(n)) return 'real_document_number'
    if (!documentNumberShapeOk(input.documentType, n)) return 'invalid_document_number'
  }
  if (input.expiryDate !== undefined && !parseIsoDate(input.expiryDate)) return 'invalid_expiry'
  return null
}

/* ------------------------------------------------- fictional identifiers */

const UPPER = 'ABCDEFGHJKLMNPRSTUVWXYZ'
const ALNUM = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
const digits = (n: number, rnd: () => number) => Array.from({ length: n }, () => Math.floor(rnd() * 10)).join('')
const pick = (set: string, n: number, rnd: () => number) => Array.from({ length: n }, () => set[Math.floor(rnd() * set.length)]).join('')
const nieDigits = (rnd: () => number) => 1_000_000 + Math.floor(rnd() * 9_000_000)

/**
 * A fictional document number with a realistic shape for the document type:
 * DNI 8 digits + wrong letter; TIE / NIE paper / red card X|Y|Z + 7 digits + wrong letter (both via fictionalDniNie);
 * passport 2 letters + 7 digits; EU national eID 9 alphanumerics (starting with a letter).
 */
export function fakeDocumentNumber(type: DocumentType, _country?: SignUpCountry, rnd: () => number = Math.random): string {
  switch (type) {
    case 'PASSPORT': return `${pick(UPPER, 2, rnd)}${digits(7, rnd)}`
    case 'EU_EID': return `${pick(UPPER, 1, rnd)}${pick(ALNUM, 8, rnd)}`
    case 'DNI': return fictionalDniNie('', 10_000_000 + Math.floor(rnd() * 89_999_999))
    case 'TIE':
    case 'NIE_PAPER':
    case 'RED_CARD': return fictionalDniNie((['X', 'Y', 'Z'] as const)[Math.floor(rnd() * 3)], nieDigits(rnd))
  }
}

/** Document number not used by any account or case yet. */
function uniqueDocumentNumber(s: AppState, type: DocumentType, country: SignUpCountry): string {
  const taken = takenNumbers(s)
  for (let i = 0; i < 200; i++) {
    const n = fakeDocumentNumber(type, country)
    if (!taken.has(normaliseDocNumber(n))) return n
  }
  // Practically unreachable: keep drawing until a free number appears.
  for (;;) {
    const n = fakeDocumentNumber(type, country)
    if (!taken.has(normaliseDocNumber(n))) return n
  }
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

/** The typed document of a valid sign-up. */
export function typedFromSignUp(input: SignUpInput, documentNumber: string, now: Date = new Date()): TypedDocument {
  const country = SIGNUP_COUNTRIES[input.countryIndex]
  const { givenNames, surnames } = namesOf(input)
  return {
    type: input.documentType,
    number: documentNumber,
    expiry: input.expiryDate ?? addYears(now, 5),
    nationality: country.name.en,
    data: { givenNames, surnames, dateOfBirth: input.dateOfBirth },
  }
}

/** Builds the new draft application for a valid sign-up. */
export function buildSignUpCase(id: string, input: SignUpInput, documentNumber: string, now: Date = new Date(), caseRef?: string): Case {
  return newDraftCase(id, 'signup', typedFromSignUp(input, documentNumber, now), now.toISOString(), { caseRef })
}

/**
 * Case reference of a new sign-up. Only the plan's demo people carry a GYC-NN reference: a sign-up whose typed
 * document number is exactly the demo number of a person the plan types in live (Giulia, GYC-01) gets that
 * reference while it is free. Every other new account gets a neutral "SOL-XXXX" derived from its case id.
 */
export function nextCaseRef(s: AppState, documentNumber?: string, caseId?: string): string {
  const used = new Set(Object.values(s.cases).map(c => c.caseRef).filter(Boolean))
  if (documentNumber) {
    const wanted = normaliseDocNumber(documentNumber)
    const demo = DEMO_PEOPLE.find(p => !p.caseId && normaliseDocNumber(p.account.documentNumber) === wanted)
    if (demo && !used.has(demo.caseRef)) return demo.caseRef
  }
  const base = (caseId ?? `su-${Date.now().toString(36)}`).replace(/[^a-z0-9]/gi, '').toUpperCase()
  let ref = `SOL-${base.slice(-4).padStart(4, '0')}`
  for (let n = 5; used.has(ref) && n <= base.length; n++) ref = `SOL-${base.slice(-n)}`
  return ref
}

/** Every document number already used by an account or a case. */
export function takenNumbers(s: AppState): Set<string> {
  return new Set<string>([
    ...Object.values(s.accounts ?? {}).map(a => normaliseDocNumber(a.documentNumber)),
    ...Object.values(s.cases).map(c => normaliseDocNumber(c.typed?.number ?? c.document.number)),
  ])
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
      let documentNumber: string
      if (input.documentNumber !== undefined) {
        documentNumber = normaliseDocNumber(input.documentNumber)
        if (takenNumbers(s).has(documentNumber)) return { ok: false, reason: 'duplicate_document' }
      } else {
        documentNumber = uniqueDocumentNumber(s, input.documentType, country) // @deprecated UI migration: old form has no number field
      }
      const id = newCaseId(s)
      const now = new Date()
      const c = buildSignUpCase(id, input, documentNumber, now, nextCaseRef(s, documentNumber, id))
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
        `${c.persona.name} created a citizen account (${country.name.en}, ${input.documentType} ${documentNumber}, expires ${c.typed.expiry}). Reference ${c.caseRef}.`)
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
