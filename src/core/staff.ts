/**
 * Staff access — simulated certificate sign-in and first-time job details (branch feature/staff-console).
 * Implements ClaveActions.officerSignInWithCertificate / officerCompleteProfile from contract/api.ts.
 *
 * Modelled on how Cl@ve registration staff really get in: an electronic certificate (public-employee
 * cryptocard, DNIe or another accepted certificate) AND an authorisation from their own organisation.
 * Everything is SIMULATED with fictional people and "DEMO-" identifiers. Every attempt is audited.
 *
 * Built as a factory so it has no import of store.ts (no circular import): store.ts spreads it into `actions`.
 */
import type { Actor, AppState, AuditAction, AuditEvent, OfficerProfile, OfficerProfileInput, StaffCertificate, StaffSignInResult } from '@/contract/types'
import type { ClaveActions } from '@/contract/api'
import { PERSONNEL_NUMBER_PATTERN, REGISTRATION_AUTHORITIES, STAFF_CERTIFICATES, STAFF_CREDENTIAL_LABELS, STAFF_OFFICES } from '@/contract/seed'

export interface StaffDeps {
  get: () => AppState
  commit: (next: AppState, caseId?: string | null, action?: AuditAction | null) => void
  audit: (caseId: string | null, actor: Actor, action: AuditAction, detail: string) => AuditEvent
  fail: (message: string) => never
  now?: () => Date
}

type StaffActions = Pick<ClaveActions, 'officerSignInWithCertificate' | 'officerCompleteProfile'>

export type DenialReason = Extract<StaffSignInResult, { status: 'not_authorised' }>['reason']

export function findCertificate(certificateId: string): StaffCertificate | undefined {
  return STAFF_CERTIFICATES.find(c => c.id === certificateId)
}

/** A certificate is valid through the end of its `validUntil` day (UTC). */
export function isCertificateExpired(cert: StaffCertificate, now: Date = new Date()): boolean {
  return new Date(`${cert.validUntil}T23:59:59Z`).getTime() < now.getTime()
}

/** The person on the certificate, as an audit actor. Staff are 'officer' actors; anyone else is recorded as a person, never as staff. */
export function certificateActor(cert: StaffCertificate): Actor {
  return cert.officerId
    ? { kind: 'officer', id: cert.officerId, name: cert.holderName }
    : { kind: 'citizen', id: cert.holderId, name: cert.holderName }
}

/** Pure check, same order as the real application: expired → not staff → not authorised by their organisation. */
export function screenCertificate(cert: StaffCertificate, now: Date = new Date()): DenialReason | null {
  if (isCertificateExpired(cert, now)) return 'expired'
  if (!cert.officerId) return 'not_staff'
  if (!cert.authorisedForClave) return 'not_authorised_for_clave'
  return null
}

const DENIAL_TEXT: Record<DenialReason, string> = {
  expired: 'certificate expired',
  not_staff: 'the certificate holder is not registered as staff of a Cl@ve registration authority',
  not_authorised_for_clave: 'their organisation has not authorised them for Cl@ve registration',
}

/** Validates job details; returns an error message or null. Shared by the action and the form. */
export function validateProfileInput(input: OfficerProfileInput): string | null {
  if (!REGISTRATION_AUTHORITIES.some(a => a.id === input.authorityId)) return 'Pick the organisation you work for.'
  const office = STAFF_OFFICES.find(o => o.code === input.officeCode)
  if (!office) return 'Pick your office.'
  if (office.authorityId !== input.authorityId) return 'That office does not belong to the organisation you picked.'
  if (!input.post?.trim()) return 'Pick your post.'
  if (!PERSONNEL_NUMBER_PATTERN.test(input.personnelNumber ?? '')) return 'The personnel number must look like DEMO-NRP-1234 (a demo number, never a real one).'
  if (input.role !== 'registrar' && input.role !== 'supervisor') return 'Pick your role.'
  return null
}

export function createStaffActions(d: StaffDeps): StaffActions {
  const now = () => (d.now ? d.now() : new Date())
  const credential = (c: StaffCertificate) => STAFF_CREDENTIAL_LABELS[c.credential].en

  return {
    officerSignInWithCertificate(certificateId: string): StaffSignInResult {
      const cert = findCertificate(certificateId)
      if (!cert) d.fail(`Unknown certificate "${certificateId}".`)
      const actor = certificateActor(cert!)
      const s = d.get()
      const denial = screenCertificate(cert!, now())
      const what = `${credential(cert!)}, ${cert!.holderId}, valid until ${cert!.validUntil} (simulated)`

      if (denial) {
        const ev = d.audit(null, actor, 'staff_access_denied', `Staff access denied to ${cert!.holderName}: ${DENIAL_TEXT[denial]}. Certificate: ${what}.`)
        d.commit({ ...s, audit: [...s.audit, ev] }, null, 'staff_access_denied')
        return { status: 'not_authorised', reason: denial }
      }

      const officerId = cert!.officerId!
      const profile = s.officerProfiles?.[officerId]
      if (profile) {
        const ev = d.audit(null, actor, 'staff_signed_in', `${cert!.holderName} signed in to the staff console with a ${credential(cert!)} (simulated). Office ${profile.officeCode}, NRP ${profile.personnelNumber}.`)
        d.commit({
          ...s,
          officerId,
          officerProfiles: { ...s.officerProfiles, [officerId]: { ...profile, certificateId: cert!.id } },
          audit: [...s.audit, ev],
        }, null, 'staff_signed_in')
        return { status: 'signed_in', officerId }
      }

      // Certificate and authorisation are fine, but this is the first sign-in: ask for job details first.
      const ev = d.audit(null, actor, 'staff_signed_in', `Certificate accepted for ${cert!.holderName} (${what}). First sign-in: job details requested before the console opens.`)
      d.commit({ ...s, audit: [...s.audit, ev] }, null, 'staff_signed_in')
      return { status: 'needs_profile', officerId, certificateId: cert!.id }
    },

    officerCompleteProfile(officerId: string, certificateId: string, input: OfficerProfileInput): void {
      const cert = findCertificate(certificateId)
      if (!cert || cert.officerId !== officerId) d.fail('This certificate does not belong to that officer.')
      const denial = screenCertificate(cert!, now())
      if (denial) d.fail(`Access not allowed: ${DENIAL_TEXT[denial]}.`)
      const clean: OfficerProfileInput = { ...input, personnelNumber: (input.personnelNumber ?? '').trim(), post: (input.post ?? '').trim() }
      const err = validateProfileInput(clean)
      if (err) d.fail(err)

      const s = d.get()
      const had = Boolean(s.officerProfiles?.[officerId])
      const profile: OfficerProfile = { ...clean, officerId, certificateId, completedAt: now().toISOString() }
      const authority = REGISTRATION_AUTHORITIES.find(a => a.id === clean.authorityId)!
      const ev = d.audit(null, certificateActor(cert!), 'staff_profile_completed',
        `${cert!.holderName} ${had ? 'updated' : 'confirmed'} job details: ${authority.short}, office ${clean.officeCode}, ${clean.post}, NRP ${clean.personnelNumber}, role ${clean.role}.${had ? '' : ' Signed in to the staff console.'}`)
      d.commit({
        ...s,
        officerId,
        officerProfiles: { ...(s.officerProfiles ?? {}), [officerId]: profile },
        audit: [...s.audit, ev],
      }, null, 'staff_profile_completed')
    },
  }
}
