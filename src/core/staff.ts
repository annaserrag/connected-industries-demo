/**
 * Staff access: certificate + PIN or staff user + password, then first-time job details.
 * Implements ClaveActions.officerSignInWithCertificate / officerSignInWithPassword / officerCompleteProfile.
 *
 * Modelled on how Cl@ve registration staff really get in: an electronic certificate (public-employee
 * cryptocard, DNIe or another accepted certificate, unlocked with its PIN) or a corporate user account,
 * AND an authorisation from their own organisation. People and identifiers are fictional (DNI-shaped
 * numbers carry a wrong check letter). Every attempt is audited with the method, never the PIN or password.
 *
 * Built as a factory so it has no import of store.ts (no circular import): store.ts spreads it into `actions`.
 */
import type {
  Actor, AppState, AuditAction, AuditEvent, OfficerProfile, OfficerProfileInput, StaffAccount, StaffCertificate,
  StaffSignInMethod, StaffSignInResult,
} from '@/contract/types'
import type { ClaveActions } from '@/contract/api'
import {
  REGISTRATION_AUTHORITIES, STAFF_ACCOUNTS, STAFF_CERTIFICATES, STAFF_CREDENTIAL_LABELS, STAFF_OFFICES,
  demoHash, isFictionalPersonnelNumber,
} from '@/contract/seed'

export interface StaffDeps {
  get: () => AppState
  commit: (next: AppState, caseId?: string | null, action?: AuditAction | null) => void
  audit: (caseId: string | null, actor: Actor, action: AuditAction, detail: string) => AuditEvent
  fail: (message: string) => never
  now?: () => Date
}

type StaffActions = Pick<ClaveActions, 'officerSignInWithCertificate' | 'officerSignInWithPassword' | 'officerCompleteProfile'>

export type DenialReason = Extract<StaffSignInResult, { status: 'not_authorised' }>['reason']

export function findCertificate(certificateId: string): StaffCertificate | undefined {
  return STAFF_CERTIFICATES.find(c => c.id === certificateId)
}

/** User IDs are matched ignoring case and surrounding spaces, like most corporate directories. */
export function findAccount(userId: string): StaffAccount | undefined {
  const u = (userId ?? '').trim().toLowerCase()
  return u ? STAFF_ACCOUNTS.find(a => a.userId === u) : undefined
}

/** The staff account that belongs to an officer, if any. */
export function accountOfOfficer(officerId: string): StaffAccount | undefined {
  return STAFF_ACCOUNTS.find(a => a.officerId === officerId)
}

/** A certificate is valid through the end of its `validUntil` day (UTC). */
export function isCertificateExpired(cert: StaffCertificate, now: Date = new Date()): boolean {
  return new Date(`${cert.validUntil}T23:59:59Z`).getTime() < now.getTime()
}

/** The person on the certificate / account, as an audit actor. Staff are 'officer' actors; anyone else is recorded as a person, never as staff. */
export function certificateActor(cert: Pick<StaffCertificate, 'officerId' | 'holderId' | 'holderName'>): Actor {
  return cert.officerId
    ? { kind: 'officer', id: cert.officerId, name: cert.holderName }
    : { kind: 'citizen', id: cert.holderId, name: cert.holderName }
}
export const accountActor = (a: StaffAccount): Actor => certificateActor(a)

/** Pure check, same order as the real application: expired → not staff → not authorised by their organisation. */
export function screenCertificate(cert: StaffCertificate, now: Date = new Date()): DenialReason | null {
  if (isCertificateExpired(cert, now)) return 'expired'
  return screenAccount(cert)
}

/** Authorisation part only (accounts don't expire in the prototype). */
export function screenAccount(a: Pick<StaffAccount, 'officerId' | 'authorisedForClave'>): DenialReason | null {
  if (!a.officerId) return 'not_staff'
  if (!a.authorisedForClave) return 'not_authorised_for_clave'
  return null
}

/** PINs are 4 to 8 digits (DNIe / cryptocard style). */
export const PIN_PATTERN = /^\d{4,8}$/
export const checkPin = (cert: StaffCertificate, pin: string) => PIN_PATTERN.test(pin ?? '') && demoHash(pin) === cert.pinHash
export const checkPassword = (a: StaffAccount, password: string) => Boolean(password) && demoHash(password) === a.passwordHash

const DENIAL_TEXT: Record<DenialReason, string> = {
  expired: 'certificate expired',
  not_staff: 'the holder is not registered as staff of a Cl@ve registration authority',
  not_authorised_for_clave: 'their organisation has not authorised them for Cl@ve registration',
}

/** Personnel number as typed → canonical form (upper case, no spaces). */
export const normaliseNrp = (v: string) => (v ?? '').toUpperCase().replace(/\s+/g, '')

/**
 * Validates job details; returns an error message (EN) or null. Shared by the action and the form.
 * `holderId`, when given, is the DNI read from the certificate / account: the NRP starts with it.
 */
export function validateProfileInput(input: OfficerProfileInput, holderId?: string): string | null {
  if (!REGISTRATION_AUTHORITIES.some(a => a.id === input.authorityId)) return 'Pick the organisation you work for.'
  const office = STAFF_OFFICES.find(o => o.code === input.officeCode)
  if (!office) return 'Pick your office.'
  if (office.authorityId !== input.authorityId) return 'That office does not belong to the organisation you picked.'
  if (!input.post?.trim()) return 'Pick your post.'
  const nrp = normaliseNrp(input.personnelNumber)
  if (!isFictionalPersonnelNumber(nrp)) return 'Enter a valid personnel number: your DNI number and letter, "A", and your 4-digit body code.'
  if (holderId && nrp.slice(0, 9) !== holderId.toUpperCase()) return 'The personnel number must start with your own DNI number and letter.'
  if (input.role !== 'registrar' && input.role !== 'supervisor') return 'Pick your role.'
  return null
}

export function createStaffActions(d: StaffDeps): StaffActions {
  const now = () => (d.now ? d.now() : new Date())
  const credential = (c: StaffCertificate) => STAFF_CREDENTIAL_LABELS[c.credential].en

  const record = (actor: Actor, action: AuditAction, detail: string, patch?: Partial<AppState>) => {
    const s = d.get()
    const ev = d.audit(null, actor, action, detail)
    d.commit({ ...s, ...patch, audit: [...s.audit, ev] }, null, action)
  }

  /** Shared tail of both methods once the credentials are right: authorisation, then signed in or job details. */
  const admit = (
    who: { officerId?: string; authorisedForClave: boolean; holderName: string },
    actor: Actor,
    method: StaffSignInMethod,
    what: string,
    denial: DenialReason | null,
    certificateId?: string,
  ): StaffSignInResult => {
    if (denial) {
      record(actor, 'staff_access_denied', `Staff access denied to ${who.holderName} (${what}): ${DENIAL_TEXT[denial]}.`)
      return { status: 'not_authorised', reason: denial }
    }
    const officerId = who.officerId!
    const s = d.get()
    const profile = s.officerProfiles?.[officerId]
    if (profile) {
      const next: OfficerProfile = { ...profile, signInMethod: method }
      if (certificateId) next.certificateId = certificateId
      else delete next.certificateId
      record(actor, 'staff_signed_in',
        `${who.holderName} signed in to the staff console (${what}). Office ${profile.officeCode}, NRP ${profile.personnelNumber}.`,
        { officerId, officerProfiles: { ...s.officerProfiles, [officerId]: next } })
      return { status: 'signed_in', officerId }
    }
    // Credentials and authorisation are fine, but this is the first sign-in: ask for job details first.
    record(actor, 'staff_signed_in', `Credentials accepted for ${who.holderName} (${what}). First sign-in: job details requested before the console opens.`)
    return certificateId
      ? { status: 'needs_profile', officerId, method, certificateId }
      : { status: 'needs_profile', officerId, method }
  }

  return {
    officerSignInWithCertificate(certificateId: string, pin: string): StaffSignInResult {
      const cert = findCertificate(certificateId)
      if (!cert) d.fail(`Unknown certificate "${certificateId}".`)
      const actor = certificateActor(cert!)
      const what = `method: certificate + PIN · ${credential(cert!)}, ${cert!.holderId}, valid until ${cert!.validUntil}`
      // The PIN unlocks the certificate: nothing about it (expiry, authorisation) is revealed before that.
      if (!checkPin(cert!, pin)) {
        record(actor, 'staff_access_denied', `Staff sign-in failed for ${cert!.holderName} (method: certificate + PIN): wrong PIN.`)
        return { status: 'invalid_credentials' }
      }
      return admit(cert!, actor, 'certificate', what, screenCertificate(cert!, now()), cert!.id)
    },

    officerSignInWithPassword(userId: string, password: string): StaffSignInResult {
      const acc = findAccount(userId)
      if (!acc || !checkPassword(acc, password)) {
        const typed = String(userId ?? '').trim().slice(0, 40)
        const actor: Actor = acc ? accountActor(acc) : { kind: 'citizen', id: `user:${typed}`, name: typed ? `Staff user "${typed}"` : 'Staff user (blank)' }
        record(actor, 'staff_access_denied', `Staff sign-in failed for user "${typed}" (method: user + password): ${acc ? 'wrong password' : 'unknown user'}.`)
        return { status: 'invalid_credentials' }
      }
      const what = `method: user + password · user ${acc.userId}, ${acc.holderId}`
      return admit(acc, accountActor(acc), 'password', what, screenAccount(acc))
    },

    officerCompleteProfile(officerId: string, method: StaffSignInMethod, certificateId: string | null, input: OfficerProfileInput): void {
      let actor: Actor
      let holderId: string
      let holderName: string
      if (method === 'certificate') {
        const cert = certificateId ? findCertificate(certificateId) : undefined
        if (!cert || cert.officerId !== officerId) d.fail('This certificate does not belong to that officer.')
        const denial = screenCertificate(cert!, now())
        if (denial) d.fail(`Access not allowed: ${DENIAL_TEXT[denial]}.`)
        actor = certificateActor(cert!); holderId = cert!.holderId; holderName = cert!.holderName
      } else if (method === 'password') {
        const acc = accountOfOfficer(officerId)
        if (!acc) d.fail('This officer has no staff user account.')
        const denial = screenAccount(acc!)
        if (denial) d.fail(`Access not allowed: ${DENIAL_TEXT[denial]}.`)
        actor = accountActor(acc!); holderId = acc!.holderId; holderName = acc!.holderName
      } else {
        d.fail(`Unknown sign-in method "${String(method)}".`)
      }
      const clean: OfficerProfileInput = { ...input, personnelNumber: normaliseNrp(input.personnelNumber), post: (input.post ?? '').trim() }
      const err = validateProfileInput(clean, holderId!)
      if (err) d.fail(err)

      const s = d.get()
      const had = Boolean(s.officerProfiles?.[officerId])
      const profile: OfficerProfile = { ...clean, officerId, signInMethod: method, completedAt: now().toISOString() }
      if (method === 'certificate') profile.certificateId = certificateId!
      const authority = REGISTRATION_AUTHORITIES.find(a => a.id === clean.authorityId)!
      const ev = d.audit(null, actor!, 'staff_profile_completed',
        `${holderName!} ${had ? 'updated' : 'confirmed'} job details (method: ${method === 'certificate' ? 'certificate + PIN' : 'user + password'}): ${authority.short}, office ${clean.officeCode}, ${clean.post}, NRP ${clean.personnelNumber}, role ${clean.role}.${had ? '' : ' Signed in to the staff console.'}`)
      d.commit({
        ...s,
        officerId,
        officerProfiles: { ...(s.officerProfiles ?? {}), [officerId]: profile },
        audit: [...s.audit, ev],
      }, null, 'staff_profile_completed')
    },
  }
}
