/**
 * Closed-list refusal prerequisites and post-refusal video-call offer matrix.
 * Only an officer refuses; these helpers decide when a REJ id is allowed and when
 * the citizen may be offered a video call afterwards.
 */
import type { Case, CheckId, RejId } from '@/contract/types'

/** After a refusal, offer a video call only for these reasons (REJ-01: when no other document). */
const OFFER_CALL_AFTER: ReadonlySet<RejId> = new Set(['REJ-01', 'REJ-02', 'REJ-03', 'REJ-06', 'REJ-07'])

/** Checks that count as independent adverse signals for REJ-07. */
const SIGNAL_CHECKS: ReadonlySet<CheckId> = new Set([
  'liveness', 'face_match', 'chip_signature', 'printed_vs_chip', 'dni_video', 'document_validity',
])

/** True when a video call was already offered to the citizen (Fallback) or started by an officer. */
export function videoCallOffered(c: Case): boolean {
  return Boolean(c.session.fallback || c.session.videoCall)
}

/** Officer asked for more information and the citizen answered. */
export function infoCycleDone(c: Case): boolean {
  return Boolean(c.infoRequest?.response)
}

/** Residence (or chip) discrepancy table already shows a concrete conflict. */
export function discrepancyConflictVisible(c: Case): boolean {
  return (c.discrepancies ?? []).some(d => d.document !== d.records)
}

/** Distinct failed/warn checks (and matching flags) that support REJ-07. */
export function independentSignalCount(c: Case): number {
  const ids = new Set<CheckId>()
  for (const k of c.checks) {
    if ((k.outcome === 'fail' || k.outcome === 'warn') && SIGNAL_CHECKS.has(k.id)) ids.add(k.id)
  }
  for (const f of c.flags) {
    if (f.code === 'low_liveness') ids.add('liveness')
    if (f.code === 'low_face_match') ids.add('face_match')
  }
  return ids.size
}

/** Synthetic-video / deepfake signal on the case (camera input). */
export function isDeepfakeCase(c: Case): boolean {
  return c.session.faceAttempts.includes('synthetic') || c.session.videoAttempts.includes('synthetic')
}

/**
 * English technical message when a refusal is not yet allowed for this reason.
 * Thrown as ClaveRuleError from the store; officer UI maps it via plainRuleError.
 */
export function refusePrerequisiteError(c: Case, reason: RejId): string | null {
  switch (reason) {
    case 'REJ-04':
    case 'REJ-08':
      if (!infoCycleDone(c)) {
        return 'Ask for more information first: the citizen must answer before you can refuse with this reason.'
      }
      return null
    case 'REJ-05':
      if (discrepancyConflictVisible(c)) return null
      if (!infoCycleDone(c)) {
        return 'Ask for more information first, or refuse only when the discrepancy table already shows a conflict.'
      }
      return null
    case 'REJ-02':
    case 'REJ-03':
      if (!videoCallOffered(c)) {
        return 'Offer a video call first: start or wait for the video call before refusing with this reason.'
      }
      return null
    case 'REJ-07':
      if (!videoCallOffered(c)) {
        return 'Offer a video call first: start or wait for the video call before refusing with this reason.'
      }
      if (independentSignalCount(c) < 2) {
        return 'REJ-07 needs two independent signals (for example liveness and face match). One signal is not enough.'
      }
      return null
    default:
      return null
  }
}

/** Citizen-facing: show "Book a video call" after this refusal reason. */
export function offersVideoAfterRefusal(reasonId: RejId | undefined | null): boolean {
  if (!reasonId) return false
  return OFFER_CALL_AFTER.has(reasonId)
}

/** Short citizen-safe reason line for COR-07 (never the officer word "fraud"). */
export function citizenReasonShort(reasonId: RejId, lang: 'en' | 'es'): string {
  const rows: Record<RejId, { en: string; es: string }> = {
    'REJ-01': { en: 'document expired or not valid', es: 'documento caducado o no válido' },
    'REJ-02': { en: 'face does not match the document', es: 'la cara no coincide con el documento' },
    'REJ-03': { en: 'live-person check not completed', es: 'comprobación de persona real no completada' },
    'REJ-04': { en: 'residence not found in the records', es: 'residencia no encontrada en los registros' },
    'REJ-05': { en: 'data does not match the records', es: 'los datos no coinciden con los registros' },
    'REJ-06': { en: 'document could not be verified', es: 'no se ha podido verificar el documento' },
    'REJ-07': {
      en: 'we could not confirm the identity of the person making the request',
      es: 'no hemos podido confirmar la identidad de quien hace la solicitud',
    },
    'REJ-08': { en: 'proof of parental authority missing or not valid', es: 'acreditación de patria potestad ausente o no válida' },
  }
  return rows[reasonId][lang]
}
