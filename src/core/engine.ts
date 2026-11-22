/**
 * Simulated decision engine — Platform agent (A).
 *
 * Pure, deterministic functions. Nothing here is real: every check result comes from the case's
 * `simulation.attempts` script (or a default pass). Semantics follow the comment above
 * DECISION_RULES in contract/seed.ts.
 *
 * KEY RULE: this module can only APPROVE automatically or SEND TO AN OFFICER. It has no code
 * path that refuses, revokes or sets the 'not_approved' status. Only officer actions in
 * store.ts can do that.
 */
import type { Bilingual, Case, CheckId, CheckResult, Flag, FlagCode, RiskLevel } from '@/contract/types'
import { CHECKS, ENGINE, ROUTES } from '@/contract/seed'

/* ------------------------------------------------------------ check list */

/** Checks the engine runs for this case and attempt, in order. */
export function checksForCase(c: Case): CheckId[] {
  if (!c.route) return []
  const base = [...ROUTES[c.route].checks]
  if (c.route === 'FALLBACK') {
    // The fallback route only has the officer video call; any other scripted checks for this
    // attempt (e.g. "no chip", residence) are shown first so the officer sees them.
    const scripted: CheckId[] = (Object.keys(scriptFor(c)) as CheckId[]).filter(id => id !== 'officer_video')
    const ordered = (Object.keys(CHECKS) as CheckId[]).filter(id => scripted.includes(id))
    base.splice(0, 0, ...ordered)
  }
  if (c.guardian && !base.includes('guardian_link')) base.push('guardian_link')
  return base
}

function scriptFor(c: Case): Partial<Record<CheckId, Omit<CheckResult, 'id'>>> {
  return c.simulation.attempts[Math.max(0, c.attempt - 1)] ?? {}
}

const DEFAULT_PASS: Record<CheckId, Omit<CheckResult, 'id'>> = {
  eidas_login: { outcome: 'pass', detail: { en: 'Identity confirmed by the home country through eIDAS', es: 'Identidad confirmada por el país de origen a través de eIDAS' } },
  chip_read: { outcome: 'pass', detail: { en: 'Chip read correctly', es: 'Chip leído correctamente' } },
  chip_signature: { outcome: 'pass', detail: { en: 'Valid signature from the issuing country', es: 'Firma válida del país emisor' } },
  document_validity: { outcome: 'pass', detail: { en: 'Document in date', es: 'Documento en vigor' } },
  liveness: { outcome: 'pass', score: 0.95, detail: { en: 'Live person in front of the camera', es: 'Persona real ante la cámara' } },
  face_match: { outcome: 'pass', score: 0.93, detail: { en: 'Matches chip photo', es: 'Coincide con la foto del chip' } },
  residence: { outcome: 'pass', detail: { en: 'Residence details confirmed', es: 'Datos de residencia confirmados' } },
  guardian_link: { outcome: 'pass', detail: { en: 'Parent or guardian link confirmed', es: 'Vínculo con madre, padre o tutor confirmado' } },
  dni_video: { outcome: 'pass', detail: { en: 'DNI video identification completed', es: 'Videoidentificación con DNI completada' } },
  officer_video: { outcome: 'pending', detail: { en: 'Waiting for officer video call', es: 'Esperando videollamada con una persona funcionaria' } },
}

/** Result of one check for the case's current attempt. officer_video is always pending until an officer completes it. */
export function runCheck(c: Case, id: CheckId): CheckResult {
  if (id === 'officer_video') return { id, ...DEFAULT_PASS.officer_video }
  const scripted = scriptFor(c)[id]
  return { id, ...(scripted ?? DEFAULT_PASS[id]) }
}

export const OFFICER_VIDEO_DONE: CheckResult = {
  id: 'officer_video',
  outcome: 'pass',
  detail: { en: 'Officer confirmed document and identity on the video call', es: 'La persona funcionaria confirmó documento e identidad en la videollamada' },
}

/* ------------------------------------------------------------------ flags */

const pct = (n: number) => n.toFixed(2)
const pctEs = (n: number) => n.toFixed(2).replace('.', ',')

function flag(code: FlagCode, severity: RiskLevel, reason: Bilingual): Flag {
  return { code, severity, reason }
}

/** True when the case runs on a proposed rule change (red card, NIE paper). */
export function isPolicyProposal(c: Case): boolean {
  const doc = c.answers?.document ?? c.document.type
  return Boolean(c.policyProposal) || doc === 'RED_CARD' || doc === 'NIE_PAPER'
}

export function isAssisted(c: Case): boolean {
  return Boolean(c.answers?.assisted)
}

export function hadRefusal(c: Case): boolean {
  return c.decisions.some(d => d.outcome === 'refused' || d.outcome === 'revoked')
}

/** Flags explained in EN + ES, derived from the check results and the case context. */
export function deriveFlags(c: Case, checks: CheckResult[]): Flag[] {
  const flags: Flag[] = []
  for (const r of checks) {
    const d = r.detail
    switch (r.id) {
      case 'liveness': {
        const low = r.score !== undefined && r.score < ENGINE.livenessMin
        if (r.outcome === 'fail' || low) {
          const s = r.score ?? 0
          flags.push(flag('low_liveness', 'high', {
            en: `Liveness ${pct(s)} is below the ${pct(ENGINE.livenessMin)} minimum: ${d.en}`,
            es: `Prueba de vida ${pctEs(s)} por debajo del mínimo ${pctEs(ENGINE.livenessMin)}: ${d.es}`,
          }))
        } else if (r.outcome === 'warn') {
          flags.push(flag('low_liveness', 'medium', { en: `Liveness warning: ${d.en}`, es: `Aviso en la prueba de vida: ${d.es}` }))
        }
        break
      }
      case 'face_match': {
        const s = r.score
        const low = s !== undefined && s < ENGINE.faceMatchMin
        if (r.outcome === 'fail') {
          flags.push(flag('low_face_match', 'high', { en: `Face does not match the chip photo: ${d.en}`, es: `La cara no coincide con la foto del chip: ${d.es}` }))
        } else if (low || r.outcome === 'warn') {
          flags.push(flag('low_face_match', 'medium', s !== undefined
            ? { en: `Face match ${pct(s)} is below the ${pct(ENGINE.faceMatchMin)} threshold: ${d.en}`, es: `Coincidencia facial ${pctEs(s)} por debajo del umbral ${pctEs(ENGINE.faceMatchMin)}: ${d.es}` }
            : { en: `Face match warning: ${d.en}`, es: `Aviso en la coincidencia facial: ${d.es}` }))
        }
        break
      }
      case 'chip_signature':
        if (r.outcome === 'fail') flags.push(flag('chip_signature_failed', 'high', { en: `Chip signature failed: ${d.en}`, es: `Falla la firma del chip: ${d.es}` }))
        else if (r.outcome === 'warn') flags.push(flag('chip_signature_failed', 'medium', { en: `Chip signature warning: ${d.en}`, es: `Aviso en la firma del chip: ${d.es}` }))
        break
      case 'chip_read':
        if (r.outcome === 'fail') flags.push(flag('chip_unreadable', 'medium', { en: `Chip could not be read: ${d.en}`, es: `No se pudo leer el chip: ${d.es}` }))
        break
      case 'document_validity':
        if (r.outcome === 'fail') flags.push(flag('document_invalid', 'high', { en: `Document not valid: ${d.en}`, es: `Documento no válido: ${d.es}` }))
        else if (r.outcome === 'warn') flags.push(flag('document_invalid', 'medium', { en: `Document data inconsistent: ${d.en}`, es: `Datos del documento incoherentes: ${d.es}` }))
        break
      case 'residence':
        if (r.outcome === 'fail') flags.push(flag('residence_not_found', 'high', { en: `Residence check failed: ${d.en}`, es: `Fallan los datos de residencia: ${d.es}` }))
        else if (r.outcome === 'warn') flags.push(flag('residence_not_found', 'medium', { en: `Residence record needs a look: ${d.en}`, es: `Los datos de residencia necesitan revisión: ${d.es}` }))
        break
      case 'eidas_login':
        if (r.outcome === 'fail') flags.push(flag('eid_data_mismatch', 'high', { en: `eID login failed: ${d.en}`, es: `Falla el acceso con eID: ${d.es}` }))
        else if (r.outcome === 'warn') flags.push(flag('eid_data_mismatch', 'medium', { en: `eID data does not match the records: ${d.en}`, es: `Los datos del eID no coinciden con los registros: ${d.es}` }))
        break
      case 'guardian_link':
        if (r.outcome === 'fail') flags.push(flag('minor_with_guardian', 'high', { en: `Guardian link not confirmed: ${d.en}`, es: `Vínculo con el tutor no confirmado: ${d.es}` }))
        break
      case 'dni_video':
        if (r.outcome === 'fail') flags.push(flag('eid_data_mismatch', 'high', { en: `DNI video identification failed: ${d.en}`, es: `Falla la videoidentificación con DNI: ${d.es}` }))
        break
      case 'officer_video':
        break
    }
  }

  if (c.guardian) {
    flags.push(flag('minor_with_guardian', 'medium', {
      en: `Minor (${c.persona.age}) registering with ${c.guardian.relation.en} ${c.guardian.name}: an officer always confirms the link`,
      es: `Menor (${c.persona.age}) que se registra con su ${c.guardian.relation.es} ${c.guardian.name}: una persona funcionaria siempre confirma el vínculo`,
    }))
  }
  if (isAssisted(c)) {
    const helper = c.assisted
    flags.push(flag('assisted_shared_device', 'medium', helper
      ? {
          en: `Assisted mode on ${helper.deviceOwner}'s phone (${helper.relation.en}). The applicant did the face check himself or herself`,
          es: `Modo asistido en el móvil de ${helper.deviceOwner} (${helper.relation.es}). La persona solicitante hizo ella misma la comprobación facial`,
        }
      : { en: 'Assisted mode on someone else’s phone', es: 'Modo asistido en el móvil de otra persona' }))
  }
  if (isPolicyProposal(c)) {
    flags.push(flag('policy_proposal_route', 'medium', {
      en: 'Document without a chip: identity is confirmed by an officer on a video call',
      es: 'Documento sin chip: una persona funcionaria confirma la identidad por videollamada',
    }))
  }
  if (c.attempt >= 2) {
    flags.push(flag('second_attempt', 'medium', hadRefusal(c)
      ? { en: `Attempt ${c.attempt} after a refusal: the citizen says the cause was corrected, an officer must re-approve`, es: `Intento ${c.attempt} tras una denegación: la persona dice haberlo corregido, debe reaprobarlo una persona funcionaria` }
      : { en: `Attempt ${c.attempt}`, es: `Intento ${c.attempt}` }))
  }
  if (c.appeal?.state === 'open') {
    flags.push(flag('appeal_filed', 'medium', { en: 'Appeal filed against the refusal', es: 'Recurso presentado contra la denegación' }))
  }
  return flags
}

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 }
export function riskOf(flags: Flag[]): RiskLevel {
  return flags.reduce<RiskLevel>((acc, f) => (RANK[f.severity] > RANK[acc] ? f.severity : acc), 'low')
}

export const ADVANCED_REVIEW_FLAG: Flag = flag('advanced_level_review', 'low', {
  en: 'Advanced level always gets a human review',
  es: 'El nivel avanzado siempre lo revisa una persona',
})

/* --------------------------------------------------------------- outcome */

/**
 * What the engine decides once all checks are in. Only two kinds of outcome exist:
 *  - 'auto_basic'  : grant the basic level automatically (optionally queue advanced for review)
 *  - 'to_officer'  : no automatic outcome, a person decides
 * There is deliberately no 'refuse' outcome.
 */
export type EngineOutcome =
  | { kind: 'auto_basic'; advancedReview: boolean; flags: Flag[]; risk: RiskLevel; evidence: CheckId[] }
  | { kind: 'to_officer'; toFallback: boolean; flags: Flag[]; risk: RiskLevel; evidence: CheckId[]; why: string }

export function decide(c: Case, checks: CheckResult[]): EngineOutcome {
  let flags = deriveFlags(c, checks)
  const evidence = checks.map(r => r.id)
  const failed = checks.filter(r => r.outcome === 'fail')
  const liveness = checks.find(r => r.id === 'liveness')
  const face = checks.find(r => r.id === 'face_match')
  const lowLive = liveness?.score !== undefined && liveness.score < ENGINE.livenessMin
  const lowFace = face?.score !== undefined && face.score < ENGINE.faceMatchMin
  const anyHigh = flags.some(f => f.severity === 'high')

  // Rule 2: any fail / low liveness / low face match / high flag → officer.
  if (failed.length || lowLive || lowFace || anyHigh) {
    // An unreadable chip already failed twice on the phone: go straight to the video call.
    const chipUnreadable = failed.some(r => r.id === 'chip_read')
    const toFallback = (chipUnreadable || c.attempt >= ENGINE.maxAttemptsBeforeFallback) && c.route !== 'FALLBACK'
    if (toFallback) {
      flags = [...flags.filter(f => f.code !== 'second_attempt'), flag('second_attempt', 'medium', {
        en: chipUnreadable ? 'Chip unreadable twice: moved to Fallback (video call with an officer)' : `Checks failed ${c.attempt} times: moved to Fallback (video call with an officer)`,
        es: chipUnreadable ? 'Chip ilegible dos veces: pasa a la vía alternativa (videollamada con una persona funcionaria)' : `Comprobaciones fallidas ${c.attempt} veces: pasa a la vía alternativa (videollamada con una persona funcionaria)`,
      })]
    }
    const reasons = [
      ...failed.map(r => `${r.id} failed`),
      ...(lowLive && !failed.some(r => r.id === 'liveness') ? ['liveness below minimum'] : []),
      ...(lowFace && !failed.some(r => r.id === 'face_match') ? ['face match below threshold'] : []),
    ]
    return {
      kind: 'to_officer', toFallback, flags, risk: riskOf(flags),
      evidence: failed.length ? failed.map(r => r.id) : evidence,
      why: `No automatic outcome (${reasons.join(', ') || 'high-risk flag'}); sent to an officer`,
    }
  }

  // Rule 5: minor, policy proposal, fallback route → never automatic.
  if (c.guardian || isPolicyProposal(c) || c.route === 'FALLBACK') {
    const why = c.guardian ? 'Minor with guardian: an officer always confirms the link'
      : c.route === 'FALLBACK' ? 'Fallback route: video call with an officer required'
      : 'Policy-proposal route: never automatic'
    return { kind: 'to_officer', toFallback: false, flags, risk: riskOf(flags), evidence, why }
  }

  // A corrected case after a refusal must be re-approved by a person, never auto-approved.
  if (hadRefusal(c)) {
    return { kind: 'to_officer', toFallback: false, flags, risk: riskOf(flags), evidence, why: 'Checks now pass after a refusal: an officer must re-approve' }
  }

  // Rules 3, 4, 6: automatic basic level. Route B and C (and assisted cases) queue advanced.
  const advancedReview = c.route === 'B' || c.route === 'C' || isAssisted(c)
  if (advancedReview) flags = [...flags, ADVANCED_REVIEW_FLAG]
  return { kind: 'auto_basic', advancedReview, flags, risk: riskOf(flags), evidence }
}
