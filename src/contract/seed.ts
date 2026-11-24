/**
 * CONTRACT — static data and the seed state.
 *
 * All people, documents and numbers are FICTIONAL. DNI/NIE-shaped numbers always carry a wrong check letter
 * (see isFictionalDniNie), so none can be a real person's number.
 * Real figures appear only in REFERENCE_FIGURES, exactly as in the plan's reference sheet.
 *
 * No outcome is scripted here: preloaded accounts hold only what their owner typed at sign-up. World facts
 * live in ./world.ts, the rules in src/core/engine.ts, the citizen texts in ./messages.ts.
 */
import type {
  StaffAccount,
  PriorityTier,
  RegistrationAuthority,
  StaffCertificate,
  StaffOffice,
  AppState,
  CitizenAccount,
  SignUpCountry,
  AssistantAnswers,
  Bilingual,
  Case,
  CheckDef,
  CheckId,
  DecisionRule,
  DocumentDef,
  DocumentType,
  EngineThresholds,
  IdentityDocument,
  Officer,
  ReferenceFigure,
  RejectionReason,
  RejId,
  RouteDef,
  RouteId,
  Session,
  SimulatedIndicator,
  StatusDef,
  StatusId,
  AdvancedState,
  SimFailure,
  TypedDocument,
  PersonData,
  Persona,
} from './types'
import { MSG, REJ_REASONS, PROPOSED_RULE_TAG, HELPER_RELATION_LABELS } from './messages'
import { DEMO_PEOPLE } from './world'
import { demoHash, fictionalDniNie, isFictionalDniNie, normaliseDocNumber } from './ids'

export { demoHash, normaliseDocNumber, hasDniNieShape, hasValidDniNieLetter, isFictionalDniNie, fictionalDniNie, normaliseName } from './ids'

export const SERVICE_NAME = 'Get your Cl@ve'
export const STATE_VERSION = 7

/* ------------------------------------------------------------- key rule */

export const KEY_RULE: Bilingual = {
  en: 'The platform can approve automatically; only an officer can refuse or revoke, always with a reason, and the citizen can always ask for a review.',
  es: 'La plataforma puede aprobar automáticamente; solo una persona de la Administración puede denegar o revocar, siempre con un motivo, y siempre puedes pedir una revisión.',
}

/* ---------------------------------------------------------------- routes */

export const ROUTES: Record<RouteId, RouteDef> = {
  A: {
    id: 'A', code: 'A', msg: 'RA-07A',
    name: { en: 'Your EU digital ID', es: 'Tu identidad digital de la UE' },
    forWhom: { en: 'EU citizens who can log in with their own national eID.', es: 'Ciudadanía de la UE que puede iniciar sesión con su identidad electrónica nacional.' },
    checks: ['eidas_login', 'residence'],
  },
  B: {
    id: 'B', code: 'B', msg: 'RA-07B',
    name: { en: 'Your document chip and a face check', es: 'El chip de tu documento y una comprobación facial' },
    forWhom: { en: 'Anyone with a passport or TIE and a phone that can read it.', es: 'Cualquier persona con pasaporte o TIE y un móvil que pueda leerlo.' },
    checks: ['chip_read', 'chip_signature', 'printed_vs_chip', 'document_validity', 'liveness', 'face_match', 'residence'],
  },
  C: {
    id: 'C', code: 'C', msg: 'RA-07C',
    name: { en: 'Your DNI and a short video', es: 'Tu DNI y un vídeo corto' },
    forWhom: { en: "Spaniards with a DNI. Today's route, kept as it is.", es: 'Personas españolas con DNI. La vía de hoy, sin cambios.' },
    checks: ['dni_video', 'document_validity', 'residence'],
  },
  F: {
    id: 'F', code: 'Fallback', msg: 'RA-07F',
    name: { en: 'A video call with an officer', es: 'Una videollamada con una persona de la Administración' },
    forWhom: { en: 'Anyone who cannot finish on their own: an office appointment is the last option.', es: 'Quien no puede terminar por su cuenta: la cita en oficina es la última opción.' },
    checks: ['officer_video'],
  },
  X: {
    id: 'X', code: 'X', msg: 'RA-07X',
    name: { en: 'Register with your passport', es: 'Regístrate con tu pasaporte' },
    forWhom: { en: 'Red-card or NIE-paper holders with a passport: a person checks the card.', es: 'Titulares de tarjeta roja o documento de NIE con pasaporte: una persona revisa la tarjeta.' },
    checks: ['chip_read', 'chip_signature', 'printed_vs_chip', 'document_validity', 'liveness', 'face_match', 'red_card'],
  },
}
export const ROUTE_ORDER: RouteId[] = ['A', 'B', 'C', 'X', 'F']

/* -------------------------------------------------------------- statuses */

const sta = (id: 'STA-1' | 'STA-2' | 'STA-3' | 'STA-4' | 'STA-5'): Bilingual => ({ en: MSG[id].en, es: MSG[id].es })
export const STATUSES: Record<StatusId, StatusDef> = {
  received: { id: 'received', step: 1, label: MSG['STA-1'].title, message: sta('STA-1') },
  checking: { id: 'checking', step: 2, label: MSG['STA-2'].title, message: sta('STA-2') },
  need_info: { id: 'need_info', step: 3, label: MSG['STA-3'].title, message: sta('STA-3') },
  approved: { id: 'approved', step: 4, label: { en: 'Approved', es: 'Aprobada' }, message: sta('STA-4') },
  not_approved: { id: 'not_approved', step: 5, label: MSG['STA-5'].title, message: sta('STA-5') },
}
export const STATUS_ORDER: StatusId[] = ['received', 'checking', 'need_info', 'approved', 'not_approved']

/** Short route code for lists: A, B, C, X, and the Fallback in words (never the English word in Spanish). */
export function routeCode(r: RouteId): Bilingual {
  return r === 'F' ? { en: 'Fallback', es: 'Alternativa' } : { en: ROUTES[r].code, es: ROUTES[r].code }
}

/** MSG id of the status text for a case (4 / 4B / 4C for approvals). */
export function statusMsgId(status: StatusId, advanced?: AdvancedState): 'STA-1' | 'STA-2' | 'STA-3' | 'STA-4' | 'STA-4B' | 'STA-4C' | 'STA-5' {
  switch (status) {
    case 'received': return 'STA-1'
    case 'checking': return 'STA-2'
    case 'need_info': return 'STA-3'
    case 'not_approved': return 'STA-5'
    case 'approved': return advanced === 'granted' ? 'STA-4C' : advanced === 'pending_review' ? 'STA-4B' : 'STA-4'
  }
}

/**
 * The status the CITIZEN sees. Same as the case status, except while a video call with an officer is the thing to
 * do (Fallback offered, waiting room or live call): that is status 3 "We need something from you" (MSG-STA-3 +
 * MSG-FALL-01, plan GYC-02), even though, for the officer, the case is already waiting in the queue. After "Come
 * back later" (GYC-06) or once the call has ended, the citizen is back at status 2 while a person reviews.
 */
export function citizenStatus(c: Pick<Case, 'status' | 'session'>): StatusId | 'draft' {
  if (c.status === 'approved' || c.status === 'not_approved' || c.status === 'draft' && !c.session?.fallback) return c.status
  const fb = c.session?.fallback
  const call = c.session?.videoCall?.state
  if (fb && !fb.comeBackLater && call !== 'ended') return 'need_info'
  return c.status
}

/** Full status name shown to citizens and staff; 'approved' says which level. */
export function statusLabel(status: StatusId, advanced?: AdvancedState): Bilingual {
  return MSG[statusMsgId(status, advanced)].title
}

/** Shown next to every liveness / face-match score. */
export const SIMULATED_VALUES: Bilingual = { en: 'simulated values', es: 'valores simulados' }

/** Tag on everything that depends on a rule change we propose (route B, C-assisted, X, Fallback for foreigners). */
export const PROPOSED_RULE: Bilingual = PROPOSED_RULE_TAG

/** True when the route or mode only exists under a proposed rule change. */
export function isProposedRule(route: RouteId | null | undefined, answers?: Pick<AssistantAnswers, 'assisted' | 'document' | 'nationalityGroup'> & { who?: AssistantAnswers['who'] } | null): boolean {
  const helping = answers?.who ? answers.who === 'helping' : Boolean(answers?.assisted)
  if (route === 'A' || route === 'B' || route === 'X') return true
  if (route === 'C') return helping
  if (route === 'F') return answers?.nationalityGroup !== 'spanish'
  if (answers?.document === 'RED_CARD' || answers?.document === 'NIE_PAPER') return true
  return false
}

/** @deprecated UI migration: relations for the old helper form. New code uses HELPER_RELATION_LABELS (family · friend · support). */
export const HELPER_RELATIONS: Bilingual[] = [HELPER_RELATION_LABELS.family, HELPER_RELATION_LABELS.friend, HELPER_RELATION_LABELS.support]

/* ------------------------------------------------ removed: simulated failures */

/** @deprecated UI migration: the "simulate a failure" control was removed (outcomes come from the rules). No route offers any. */
export const SIM_FAILURES: Record<SimFailure, { label: Bilingual; hint: Bilingual; routes: RouteId[] }> = {
  chip_unreadable: { label: { en: 'Chip cannot be read', es: 'Chip no legible' }, hint: { en: '', es: '' }, routes: [] },
  chip_signature: { label: { en: 'Chip signature invalid', es: 'Firma del chip inválida' }, hint: { en: '', es: '' }, routes: [] },
  liveness: { label: { en: 'Liveness check fails', es: 'Prueba de vida fallida' }, hint: { en: '', es: '' }, routes: [] },
  data_mismatch: { label: { en: 'Data does not match', es: 'Datos que no coinciden' }, hint: { en: '', es: '' }, routes: [] },
}
/** @deprecated UI migration: empty. */
export const SIM_FAILURE_ORDER: SimFailure[] = []

export const LEVEL_LABELS: Record<'basic' | 'advanced', Bilingual> = {
  basic: { en: 'Basic level', es: 'Nivel básico' },
  advanced: { en: 'Advanced level', es: 'Nivel avanzado' },
}

/* ------------------------------------------------------------- documents */

export const DOCUMENTS: Record<DocumentType, DocumentDef> = {
  DNI: { type: 'DNI', label: { en: 'Spanish DNI', es: 'DNI español' }, hasChip: true },
  EU_EID: { type: 'EU_EID', label: { en: 'EU national eID', es: 'eID nacional de la UE' }, hasChip: true },
  PASSPORT: { type: 'PASSPORT', label: { en: 'Passport', es: 'Pasaporte' }, hasChip: true },
  TIE: { type: 'TIE', label: { en: 'TIE (foreigner identity card)', es: 'TIE (tarjeta de identidad de extranjero)' }, hasChip: true },
  NIE_PAPER: { type: 'NIE_PAPER', label: { en: 'NIE paper certificate', es: 'Certificado de NIE en papel' }, hasChip: false },
  RED_CARD: {
    type: 'RED_CARD',
    label: { en: 'Red card (international protection applicant)', es: 'Tarjeta roja (solicitante de protección internacional)' },
    hasChip: false,
  },
}

/* ---------------------------------------------------------------- checks */

const sim = true as const
export const CHECKS: Record<CheckId, CheckDef> = {
  eidas_login: {
    id: 'eidas_login', simulated: sim,
    label: { en: 'EU eID login (eIDAS)', es: 'Acceso con eID de la UE (eIDAS)' },
    explains: { en: 'Your own country confirms who you are through eIDAS.', es: 'Tu propio país confirma quién eres a través de eIDAS.' },
  },
  chip_read: {
    id: 'chip_read', simulated: sim,
    label: { en: 'Chip read (NFC)', es: 'Lectura del chip (NFC)' },
    explains: { en: 'The phone reads the chip inside your passport or TIE.', es: 'El móvil lee el chip de tu pasaporte o TIE.' },
  },
  chip_signature: {
    id: 'chip_signature', simulated: sim,
    label: { en: 'Chip signature', es: 'Firma del chip' },
    explains: { en: 'The chip data was signed by the issuing country and not changed.', es: 'Los datos del chip los firmó el país emisor y no se han alterado.' },
  },
  document_validity: {
    id: 'document_validity', simulated: sim,
    label: { en: 'Document in date', es: 'Documento en vigor' },
    explains: { en: 'The document has not expired.', es: 'El documento no ha caducado.' },
  },
  liveness: {
    id: 'liveness', simulated: sim,
    label: { en: 'Liveness', es: 'Prueba de vida' },
    explains: { en: 'A real person is in front of the camera, not a photo, screen or video.', es: 'Hay una persona real ante la cámara, no una foto, pantalla o vídeo.' },
  },
  face_match: {
    id: 'face_match', simulated: sim,
    label: { en: 'Face match', es: 'Coincidencia facial' },
    explains: { en: 'Your face matches the photo stored in the chip.', es: 'Tu cara coincide con la foto guardada en el chip.' },
  },
  residence: {
    id: 'residence', simulated: sim,
    label: { en: 'Residence details (with consent)', es: 'Datos de residencia (con tu consentimiento)' },
    explains: { en: 'With your consent, we check your residence details in other public bodies’ records.', es: 'Con tu consentimiento, comprobamos tus datos de residencia en registros de otros organismos.' },
  },
  guardian_link: {
    id: 'guardian_link', simulated: sim,
    label: { en: 'Parent or guardian link', es: 'Vínculo con madre, padre o tutor' },
    explains: { en: 'A parent or guardian signs in and confirms the minor.', es: 'Una madre, padre o tutor entra y confirma al menor.' },
  },
  dni_video: {
    id: 'dni_video', simulated: sim,
    label: { en: 'DNI video call', es: 'Videollamada con DNI' },
    explains: { en: "Today's video identification for DNI holders.", es: 'La videoidentificación actual para titulares de DNI.' },
  },
  printed_vs_chip: {
    id: 'printed_vs_chip', simulated: sim,
    label: { en: 'Printed data vs chip data', es: 'Datos impresos frente a datos del chip' },
    explains: { en: 'The name and date of birth printed on the document match the ones stored in the chip.', es: 'El nombre y la fecha de nacimiento impresos coinciden con los guardados en el chip.' },
  },
  red_card: {
    id: 'red_card', simulated: sim,
    label: { en: 'Red card or NIE paper', es: 'Tarjeta roja o documento de NIE' },
    explains: { en: 'No register can confirm it automatically: a person checks the card image, number and expiry.', es: 'Ningún registro puede confirmarla automáticamente: una persona revisa la imagen, el número y la caducidad.' },
  },
  officer_video: {
    id: 'officer_video', simulated: sim,
    label: { en: 'Video call with an officer', es: 'Videollamada con una persona de la Administración' },
    explains: { en: 'An officer checks your document and identity live.', es: 'Una persona funcionaria comprueba tu documento e identidad en directo.' },
  },
}

export const ENGINE: EngineThresholds = {
  livenessMin: 0.85,
  faceMatchMin: 0.9,
  maxAttemptsBeforeFallback: 2,
}

/* ---------------------------------------------------------- decision rules
 * SPEC §4, in order; first match wins. The engine (src/core/engine.ts) implements exactly this list.
 * The platform may approve; only an officer refuses or revokes, always with a REJ reason.
 */
const r = (id: string, order: number, route: RouteId | null, situation: Bilingual, automaticOutcome: Bilingual, toOfficerWhen: Bilingual): DecisionRule =>
  ({ id, order, route, situation, automaticOutcome, toOfficerWhen })
const NONE: Bilingual = { en: 'None', es: 'Ninguno' }
export const DECISION_RULES: DecisionRule[] = [
  r('CONSENT-DECLINED', 1, null, { en: 'Consent declined', es: 'Consentimiento no aceptado' }, NONE, { en: 'No checks run; the citizen can choose a video call (Fallback)', es: 'No se hace ninguna comprobación; puede elegir una videollamada (vía alternativa)' }),
  r('CHIP-TWICE', 2, 'B', { en: 'Chip read failed twice', es: 'Lectura del chip fallida dos veces' }, NONE, { en: 'Video call offered; risk Medium; officer approves on the call', es: 'Se ofrece videollamada; riesgo medio; la persona aprueba en la llamada' }),
  r('NO-NFC', 3, 'F', { en: 'Phone without NFC, or document unknown', es: 'Móvil sin NFC o documento desconocido' }, NONE, { en: 'Always: video call with an officer', es: 'Siempre: videollamada con una persona' }),
  r('FACE-TWICE', 4, 'B', { en: 'Face check failed twice', es: 'Comprobación facial fallida dos veces' }, NONE, { en: 'Video call offered; High risk when an attempt was synthetic, otherwise Medium. Never auto-refused', es: 'Se ofrece videollamada; riesgo alto si algún intento fue sintético, si no medio. Nunca se deniega automáticamente' }),
  r('CHIP-INTEGRITY', 5, 'B', { en: 'Chip signature invalid or printed data differs from the chip', es: 'Firma del chip no válida o datos impresos distintos del chip' }, NONE, { en: 'Always, risk High; the citizen sees MSG-VER-07', es: 'Siempre, riesgo alto; la persona ve MSG-VER-07' }),
  r('DOC-EXPIRED', 6, null, { en: 'Document expired', es: 'Documento caducado' }, NONE, { en: 'Always, risk Medium; suggested REJ-01', es: 'Siempre, riesgo medio; sugerido REJ-01' }),
  r('RES-NOT-FOUND', 7, null, { en: 'No residence record', es: 'Sin registro de residencia' }, NONE, { en: 'Always, risk Medium; suggested REJ-04', es: 'Siempre, riesgo medio; sugerido REJ-04' }),
  r('RES-MISMATCH', 7, null, { en: 'Residence record differs from the document', es: 'El registro de residencia difiere del documento' }, NONE, { en: 'Always, risk Medium, discrepancy table; suggested REJ-05', es: 'Siempre, riesgo medio, tabla de diferencias; sugerido REJ-05' }),
  r('MINOR', 8, 'B', { en: 'Minor registered by a parent or guardian', es: 'Menor registrado por su madre, padre o tutor' }, NONE, { en: 'Always: a person checks the proof of parental authority', es: 'Siempre: una persona revisa la acreditación de patria potestad' }),
  r('RED-CARD', 9, 'X', { en: 'Red card or NIE paper (proposed rule)', es: 'Tarjeta roja o documento de NIE (norma propuesta)' }, NONE, { en: 'Always: a person checks the card; passport chip and face must pass', es: 'Siempre: una persona revisa la tarjeta; el chip del pasaporte y la cara deben superarse' }),
  r('A-OK', 10, 'A', { en: 'EU eID login and residence record match', es: 'Acceso con eID de la UE y residencia coincidente' }, { en: 'Basic level, automatically', es: 'Nivel básico, automático' }, { en: 'Any check above', es: 'Cualquiera de las anteriores' }),
  r('B-OK', 10, 'B', { en: 'Chip, face and residence pass', es: 'Chip, cara y residencia superados' }, { en: 'Basic level automatically; advanced level to review', es: 'Nivel básico automático; nivel avanzado a revisión' }, { en: 'Any check above', es: 'Cualquiera de las anteriores' }),
  r('C-OK', 10, 'C', { en: 'DNI video passes', es: 'Vídeo con DNI superado' }, { en: 'Basic level automatically; advanced level to review (as today)', es: 'Nivel básico automático; nivel avanzado a revisión (como hoy)' }, { en: 'Any check above', es: 'Cualquiera de las anteriores' }),
  r('APPEAL-SECOND-OFFICER', 11, null, { en: 'Review request after a refusal', es: 'Solicitud de revisión tras una denegación' }, NONE, { en: 'Always: decided by an officer other than the one who refused', es: 'Siempre: decide una persona distinta de la que denegó' }),
  r('INFO-REQUEST', 12, null, { en: 'Officer asks for more information', es: 'La persona pide más información' }, NONE, { en: 'The citizen replies; back to the officer', es: 'La persona responde; vuelve a quien revisa' }),
]

/* ------------------------------------------------------ rejection reasons
 * Closed list REJ-01…08 (plan 3.4, provisional). One citizen message per reason (MSG-REJ-0x).
 */
export const REJECTION_REASONS: Record<RejId, RejectionReason> = Object.fromEntries(
  Object.values(REJ_REASONS).map(x => [x.id, {
    id: x.id,
    officerLabel: x.officerLabel,
    when: x.when,
    canCorrect: x.canCorrect,
    msg: x.id,
    citizenMessage: { en: MSG[x.id].en, es: MSG[x.id].es },
    howToFix: x.canCorrect,
  } satisfies RejectionReason]),
) as Record<RejId, RejectionReason>

/* ------------------------------------------------- other citizen messages */

export const CITIZEN_MESSAGES = {
  consentTitle: { en: 'Before we check, we need your consent', es: 'Antes de comprobar, necesitamos tu consentimiento' },
  consentBody: {
    en: 'To confirm who you are, we will do the checks listed below. You can see every check we did on your status page.',
    es: 'Para confirmar quién eres, haremos las comprobaciones que ves abajo. Puedes ver cada comprobación en tu página de estado.',
  },
  consentAccept: { en: 'I agree, start the checks', es: 'Acepto, empezar las comprobaciones' },
  appealConfirmation: {
    en: 'Your appeal is registered. A different officer will review it, and you will see the answer on this page.',
    es: 'Tu recurso está registrado. Lo revisará otra persona funcionaria y verás la respuesta en esta página.',
  },
  ownAiAssistant: {
    en: 'You can ask your own AI assistant to prepare this form for you: every field has a plain name it can fill. We always check everything ourselves.',
    es: 'Puedes pedir a tu propio asistente de IA que prepare este formulario: cada campo tiene un nombre claro que puede rellenar. Nosotros siempre lo comprobamos todo.',
  },
  assistedNote: {
    en: 'Helping someone? Say so here. They still do the face check themselves, and the Cl@ve will be theirs, not yours.',
    es: '¿Ayudas a otra persona? Indícalo aquí. Ella hace la comprobación facial y la Cl@ve será suya, no tuya.',
  },
  correctionSubmitted: {
    en: 'Thanks. We are checking again with your correction.',
    es: 'Gracias. Volvemos a comprobarlo con tu corrección.',
  },
} satisfies Record<string, Bilingual>

/** Route-assistant questions (screen 2). */
export const ASSISTANT_QUESTIONS = {
  nationality: { en: 'Where is your nationality from?', es: '¿De dónde es tu nacionalidad?' },
  nationalityOptions: {
    spanish: { en: 'Spain', es: 'España' },
    eu: { en: 'Another EU country', es: 'Otro país de la UE' },
    non_eu: { en: 'Outside the EU', es: 'Fuera de la UE' },
  },
  document: { en: 'Which document do you have with you?', es: '¿Qué documento tienes a mano?' },
  hasEuEid: { en: 'Can you log in with your own country’s digital ID?', es: '¿Puedes entrar con la identidad digital de tu país?' },
  assisted: { en: 'How will you register?', es: '¿Cómo vas a hacer el registro?' },
} as const

/**
 * Route recommendation (RA-07A/B/C/F/X). Deterministic.
 *   red card / NIE paper → X · document "I am not sure" → F · DNI → C · EU national with an EU eID (not for a
 *   minor) → A · NFC "No" → F · otherwise (passport, TIE, EU eID card) → B.
 */
export function recommendRoute(a: AssistantAnswers): { route: RouteId; msg: string; reason: Bilingual; policyProposal: boolean } {
  const who = a.who ?? (a.forMinor ? 'child' : a.assisted ? 'helping' : 'self')
  const euEid = a.euEid ?? (a.hasEuEid ? 'yes' : null)
  const pick = (route: RouteId) => {
    const m = MSG[ROUTES[route].msg as 'RA-07A' | 'RA-07F'] as { title: Bilingual; why?: Bilingual }
    const why = m.why ?? m.title
    return { route, msg: ROUTES[route].msg, reason: why, policyProposal: isProposedRule(route, { ...a, who }) }
  }
  if (a.document === 'RED_CARD' || a.document === 'NIE_PAPER') return pick('X')
  if (a.documentUnsure) return pick('F')
  if (a.document === 'DNI') return pick('C')
  if (a.nationalityGroup === 'eu' && euEid === 'yes' && who !== 'child') return pick('A')
  if (a.nfc === 'no') return pick('F')
  return pick('B')
}

/** The two rule changes the plan proposes openly. Show them as proposals, never as current rules. */
export const POLICY_PROPOSALS: Bilingual[] = [
  {
    en: 'Open video identification to foreign documents (passport and TIE), not only the Spanish DNI.',
    es: 'Abrir la videoidentificación a documentos extranjeros (pasaporte y TIE), no solo al DNI.',
  },
  {
    en: 'Include red-card and NIE-paper holders, who cannot register today.',
    es: 'Incluir a titulares de tarjeta roja y de NIE en papel, que hoy no pueden registrarse.',
  },
]

/** Facts the plan says NOT to claim until confirmed. UI must label these as assumptions. */
export const PENDING_FACT_CHECKS: Bilingual[] = [
  { en: 'Assumption: the TIE chip can be read by a phone with the printed CAN (pending confirmation).', es: 'Supuesto: el chip de la TIE puede leerse con un móvil usando el CAN impreso (pendiente de confirmar).' },
  { en: 'Assumption: a national electronic ID from another EU country can be used to log in online (pending confirmation).', es: 'Supuesto: una identidad electrónica nacional de otro país de la UE puede usarse para iniciar sesión en línea (pendiente de confirmar).' },
]

/* ---------------------------------------------------- reference figures */

const OBSAE = 'https://dataobsae.administracionelectronica.gob.es/cmobsae3/dashboard/Dashboard.action?selectedScope=15&selectedLevel=L0&selectedUnit=TOTAL&selectedTemporalScope=2&selectedTemporal=31/12/2024'
const INE = 'https://www.ine.es/dyngs/Prensa/TICH2025.htm'
const DD = 'https://digital.gob.es/content/dam/portal-mtdfp/comunicacion/comunicacion_sedia/2025/06/16-06-2025/20250616InformeEspanaDecadaDigitalSDD25.pdf'

/** Only these real numbers may appear in the app, always with year and source. Source URLs are shown as text, never fetched. */
export const REFERENCE_FIGURES: ReferenceFigure[] = [
  { id: 'users', label: { en: 'Registered Cl@ve users', es: 'Usuarios registrados en Cl@ve' }, value: '21,558,192 (+10.4%)', year: '2024', source: 'OBSAE', sourceUrl: OBSAE },
  { id: 'logins', label: { en: 'Logins through the Cl@ve gateway', es: 'Accesos a través de la pasarela Cl@ve' }, value: '1,020,194,629 (+26%)', year: '2024', source: 'OBSAE', sourceUrl: OBSAE },
  { id: 'movil', label: { en: 'Cl@ve Móvil logins', es: 'Accesos con Cl@ve Móvil' }, value: '9,235,043 → 41,383,759', year: '2023 → 2024', source: 'OBSAE', sourceUrl: OBSAE },
  { id: 'pin', label: { en: 'Cl@ve PIN logins', es: 'Accesos con Cl@ve PIN' }, value: '53,362,134 → 47,920,189', year: '2023 → 2024', source: 'OBSAE', sourceUrl: OBSAE },
  { id: 'eidas', label: { en: "Logins with another EU country's ID (eIDAS)", es: 'Accesos con la identidad de otro país de la UE (eIDAS)' }, value: '71,063', year: '2024', source: 'OBSAE', sourceUrl: OBSAE },
  { id: 'residence', label: { en: 'Residence checks between administrations', es: 'Consultas de residencia entre administraciones' }, value: '29,521,948 (+53%)', year: '2024', source: 'OBSAE', sourceUrl: OBSAE },
  { id: 'online', label: { en: 'People 16–74 who dealt with the administration online', es: 'Personas de 16 a 74 años que se relacionaron en línea con la administración' }, value: '80.7%', year: '2025', source: 'INE TIC-H', sourceUrl: INE },
  { id: 'eid_used', label: { en: 'Spaniards who used their eID', es: 'Españoles que usaron su eID' }, value: '54.43% (EU 41.11%)', year: '2023', source: 'Digital Decade', sourceUrl: DD },
  { id: 'no_eid', label: { en: "Spaniards without an eID, so didn't use one", es: 'Españoles sin eID, que por tanto no lo usaron' }, value: '13.99%', year: '2023', source: 'Digital Decade', sourceUrl: DD },
  { id: 'dps_score', label: { en: 'Digital public services score for citizens', es: 'Puntuación de servicios públicos digitales para la ciudadanía' }, value: '88.75 (EU 82.32)', year: '2024', source: 'Digital Decade', sourceUrl: DD },
]

/* ------------------------------------------------- simulated dashboard data
 * Illustrative post-launch figures for the statistics page; disclosed on the About page.
 */
export const SIMULATED_INDICATORS: SimulatedIndicator[] = [
  { id: 'time_to_advanced', simulated: true, label: { en: 'Time to advanced level: foreigners vs Spaniards', es: 'Tiempo hasta el nivel avanzado: extranjeros frente a españoles' } },
  { id: 'share_needing_office', simulated: true, label: { en: 'Share of registrations still needing an office visit', es: 'Porcentaje de registros que aún necesitan ir a una oficina' } },
  { id: 'corrected_rejections', simulated: true, label: { en: 'Rejections later corrected', es: 'Denegaciones corregidas después' } },
  { id: 'appeals', simulated: true, label: { en: 'Appeals and their outcome', es: 'Recursos y su resultado' } },
]

/** 12 simulated weeks: 'before' = today's service baseline, then the new service from week 5. */
export const SIMULATED_DASHBOARD = {
  weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
  launchWeekIndex: 4,
  /** Median hours from application to advanced level. */
  hoursToAdvanced: {
    foreigners: [552, 540, 566, 548, 96, 52, 30, 22, 17, 14, 12, 11],
    spaniards: [26, 24, 25, 23, 14, 12, 11, 10, 9, 9, 8, 8],
  },
  /** % of registrations that still needed an in-person office visit. */
  shareNeedingOfficePct: [64, 63, 65, 62, 31, 19, 13, 10, 8, 7, 6, 6],
  rejections: { total: 412, correctedAndApproved: 167 },
  appeals: { filed: 58, upheld: 21, dismissed: 29, open: 8 },
  /** Registrations per route over the 8 weeks after launch. */
  byRoute: { A: 1840, B: 6215, C: 9930, X: 214, F: 702 } as Record<RouteId, number>,
}

/* ---------------------------------------------------------------- officers */

export const OFFICERS: Officer[] = [
  { id: 'OF-DEMO-07', name: 'Lucía Vega', office: { en: 'Registration office · Madrid Centro', es: 'Oficina de registro · Madrid Centro' } },
  { id: 'OF-DEMO-12', name: 'Andrés Ortiz', office: { en: 'Registration office · Madrid Centro', es: 'Oficina de registro · Madrid Centro' } },
  { id: 'OF-DEMO-21', name: 'Marta Gil Herrero', office: { en: 'Registration office · Sevilla', es: 'Oficina de registro · Sevilla' } },
]

/* ------------------------------------------------------------ staff access (simulated) */

/** Bodies enabled as Cl@ve Registration Authorities (names as text only, no logos). */
export const REGISTRATION_AUTHORITIES: RegistrationAuthority[] = [
  { id: 'aeat', short: 'AEAT', name: { en: 'Tax Agency (Agencia Tributaria)', es: 'Agencia Tributaria' } },
  { id: 'seg_social', short: 'Seg. Social', name: { en: 'Social Security', es: 'Seguridad Social' } },
  { id: 'sepe', short: 'SEPE', name: { en: 'State Public Employment Service (SEPE)', es: 'Servicio Público de Empleo Estatal (SEPE)' } },
  { id: 'delegacion', short: 'Delegación', name: { en: 'Government Delegation / Subdelegation, citizen information office', es: 'Delegación / Subdelegación del Gobierno, oficina de información' } },
]

export const STAFF_OFFICES: StaffOffice[] = [
  { code: 'E04999101', name: { en: 'Registration office · Madrid Centro', es: 'Oficina de registro · Madrid Centro' }, authorityId: 'aeat', city: 'Madrid' },
  { code: 'E04999214', name: { en: 'Registration office · Valencia Ruzafa', es: 'Oficina de registro · Valencia Ruzafa' }, authorityId: 'seg_social', city: 'Valencia' },
  { code: 'E04999377', name: { en: 'Registration office · Sevilla Triana', es: 'Oficina de registro · Sevilla Triana' }, authorityId: 'delegacion', city: 'Sevilla' },
  { code: 'E04999452', name: { en: 'Employment office · Zaragoza', es: 'Oficina de empleo · Zaragoza' }, authorityId: 'sepe', city: 'Zaragoza' },
]

export const STAFF_POSTS: Bilingual[] = [
  { en: 'Cl@ve registration officer', es: 'Registrador/a Cl@ve' },
  { en: 'Citizen information officer', es: 'Técnico/a de información al ciudadano' },
  { en: 'Office supervisor', es: 'Jefe/a de oficina' },
]

export const STAFF_CREDENTIAL_LABELS: Record<StaffCertificate['credential'], Bilingual> = {
  employee_certificate: { en: 'Public employee certificate (cryptocard)', es: 'Certificado de empleado público (tarjeta criptográfica)' },
  dnie: { en: 'Electronic DNI (DNIe)', es: 'DNI electrónico (DNIe)' },
  personal_certificate: { en: 'Personal electronic certificate', es: 'Certificado electrónico personal' },
}

/**
 * Staff secrets for the team, documented in the README and in the visible demo-access box (all fictional).
 * Certificate PINs and staff user passwords. Stored in state/seed only as demoHash.
 */
export const STAFF_DEMO_SECRETS = {
  pins: { 'cert-vega': '2580', 'cert-ortiz': '1357', 'cert-marta': '4826', 'cert-diego': '9031', 'cert-old': '2580' } as Record<string, string>,
  passwords: { lvega: 'Vega-2026', aortiz: 'Ortiz-2026', mgil: 'GilHerrero-2026', dromero: 'Romero-2026' } as Record<string, string>,
}

/**
 * Staff user accounts for the "user + password" sign-in method.
 * Same authorisation rules as certificates: Diego has an account but is not authorised for Cl@ve registration.
 */
export const STAFF_ACCOUNTS: StaffAccount[] = [
  { userId: 'lvega', holderName: 'Lucía Vega', holderId: '50731842J', officerId: 'OF-DEMO-07', authorisedForClave: true, passwordHash: demoHash(STAFF_DEMO_SECRETS.passwords.lvega) },
  { userId: 'aortiz', holderName: 'Andrés Ortiz', holderId: '29640157H', officerId: 'OF-DEMO-12', authorisedForClave: true, passwordHash: demoHash(STAFF_DEMO_SECRETS.passwords.aortiz) },
  { userId: 'mgil', holderName: 'Marta Gil Herrero', holderId: '71385096A', officerId: 'OF-DEMO-21', authorisedForClave: true, passwordHash: demoHash(STAFF_DEMO_SECRETS.passwords.mgil) },
  { userId: 'dromero', holderName: 'Diego Romero', holderId: '33918274C', authorisedForClave: false, passwordHash: demoHash(STAFF_DEMO_SECRETS.passwords.dromero) },
]

/**
 * What the simulated certificate picker offers: two staff who sign in directly once their profile exists, one more
 * authorised officer, one person with a valid certificate who is NOT authorised for Cl@ve, and one expired certificate.
 */
export const STAFF_CERTIFICATES: StaffCertificate[] = [
  { id: 'cert-vega', credential: 'employee_certificate', holderName: 'Lucía Vega', holderId: '50731842J', authorityId: 'aeat', post: STAFF_POSTS[0], validUntil: '2028-06-30', officerId: 'OF-DEMO-07', authorisedForClave: true, pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-vega']) },
  { id: 'cert-ortiz', credential: 'dnie', holderName: 'Andrés Ortiz', holderId: '29640157H', validUntil: '2029-02-14', officerId: 'OF-DEMO-12', authorisedForClave: true, pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-ortiz']) },
  { id: 'cert-marta', credential: 'employee_certificate', holderName: 'Marta Gil Herrero', holderId: '71385096A', authorityId: 'delegacion', post: STAFF_POSTS[2], validUntil: '2027-11-02', officerId: 'OF-DEMO-21', authorisedForClave: true, pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-marta']) },
  { id: 'cert-diego', credential: 'personal_certificate', holderName: 'Diego Romero', holderId: '33918274C', validUntil: '2027-05-20', authorisedForClave: false, pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-diego']) },
  { id: 'cert-old', credential: 'employee_certificate', holderName: 'Lucía Vega', holderId: '50731842J', authorityId: 'aeat', post: STAFF_POSTS[0], validUntil: '2025-06-30', officerId: 'OF-DEMO-07', authorisedForClave: true, pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-old']) },
]

/**
 * Personnel registration number (NRP) shape used in the prototype: the holder's 8-digit DNI number with its
 * letter, then "A", then a 4-digit body code, e.g. 50731842J A0611 → typed "50731842JA0611".
 * Valid only when the embedded DNI part is fictional (wrong check letter).
 */
export const PERSONNEL_NUMBER_PATTERN = /^\d{8}[A-Z]A\d{4}$/
export const isFictionalPersonnelNumber = (v: string) => {
  const s = v.trim().toUpperCase().replace(/\s+/g, '')
  return PERSONNEL_NUMBER_PATTERN.test(s) && isFictionalDniNie(s.slice(0, 9))
}
/** Queue priority tiers, highest first, with the reason shown to officers. */
export const PRIORITY_TIERS: Array<{ id: PriorityTier; label: Bilingual; why: Bilingual }> = [
  { id: 'p1_high_risk', label: { en: 'P1 · High risk', es: 'P1 · Riesgo alto' }, why: { en: 'Possible fraud: decide before anything else so nothing is granted by mistake.', es: 'Posible fraude: se decide antes que nada para no conceder nada por error.' } },
  { id: 'p2_appeal', label: { en: 'P2 · Appeal', es: 'P2 · Recurso' }, why: { en: 'A citizen contested a refusal and is waiting for a person.', es: 'Una persona recurrió una denegación y espera respuesta.' } },
  { id: 'p3_citizen_replied', label: { en: 'P3 · Citizen replied', es: 'P3 · Respuesta recibida' }, why: { en: 'The citizen answered your request for information.', es: 'La persona respondió a tu petición de información.' } },
  { id: 'p4_medium_risk', label: { en: 'P4 · Needs a check', es: 'P4 · Requiere revisión' }, why: { en: 'A check was below its threshold or the case needs a human by rule.', es: 'Una comprobación quedó bajo el umbral o la norma exige revisión humana.' } },
  { id: 'p5_video_call', label: { en: 'P5 · Video call', es: 'P5 · Videollamada' }, why: { en: 'Fallback route: the citizen is waiting for a video call.', es: 'Vía alternativa: la persona espera una videollamada.' } },
  { id: 'p6_advanced_review', label: { en: 'P6 · Advanced level', es: 'P6 · Nivel avanzado' }, why: { en: 'Basic level already granted; advanced level always gets a human review.', es: 'Nivel básico ya concedido; el avanzado siempre lo revisa una persona.' } },
]
/** A case waiting longer than this goes first within its own priority tier. */
export const PRIORITY_AGE_BUMP_HOURS = 24
export const SYSTEM_ACTOR = { kind: 'system' as const, id: 'ENGINE', name: 'Verification engine (simulated)' }

/* ------------------------------------------------------- citizen accounts */

export const PASSWORD_MIN_LENGTH = 8
export const SIGNUP_MIN_AGE = 18

/** Countries offered in sign-up (fictional applicants only). Group decides the route assistant defaults. */
export const SIGNUP_COUNTRIES: SignUpCountry[] = [
  { name: { en: 'Spain', es: 'España' }, nationality: 'Spanish', group: 'spanish' },
  { name: { en: 'Italy', es: 'Italia' }, nationality: 'Italian', group: 'eu' },
  { name: { en: 'France', es: 'Francia' }, nationality: 'French', group: 'eu' },
  { name: { en: 'Germany', es: 'Alemania' }, nationality: 'German', group: 'eu' },
  { name: { en: 'Portugal', es: 'Portugal' }, nationality: 'Portuguese', group: 'eu' },
  { name: { en: 'Poland', es: 'Polonia' }, nationality: 'Polish', group: 'eu' },
  { name: { en: 'Romania', es: 'Rumanía' }, nationality: 'Romanian', group: 'eu' },
  { name: { en: 'Netherlands', es: 'Países Bajos' }, nationality: 'Dutch', group: 'eu' },
  { name: { en: 'Morocco', es: 'Marruecos' }, nationality: 'Moroccan', group: 'non_eu' },
  { name: { en: 'Colombia', es: 'Colombia' }, nationality: 'Colombian', group: 'non_eu' },
  { name: { en: 'Venezuela', es: 'Venezuela' }, nationality: 'Venezuelan', group: 'non_eu' },
  { name: { en: 'Argentina', es: 'Argentina' }, nationality: 'Argentine', group: 'non_eu' },
  { name: { en: 'Mexico', es: 'México' }, nationality: 'Mexican', group: 'non_eu' },
  { name: { en: 'United States', es: 'Estados Unidos' }, nationality: 'American', group: 'non_eu' },
  { name: { en: 'United Kingdom', es: 'Reino Unido' }, nationality: 'British', group: 'non_eu' },
  { name: { en: 'China', es: 'China' }, nationality: 'Chinese', group: 'non_eu' },
  { name: { en: 'Japan', es: 'Japón' }, nationality: 'Japanese', group: 'non_eu' },
  { name: { en: 'Brazil', es: 'Brasil' }, nationality: 'Brazilian', group: 'non_eu' },
  { name: { en: 'India', es: 'India' }, nationality: 'Indian', group: 'non_eu' },
  { name: { en: 'Ukraine', es: 'Ucrania' }, nationality: 'Ukrainian', group: 'non_eu' },
  { name: { en: 'Nigeria', es: 'Nigeria' }, nationality: 'Nigerian', group: 'non_eu' },
  { name: { en: 'Other country outside the EU', es: 'Otro país fuera de la UE' }, nationality: 'Non-EU national', group: 'non_eu' },
]

/** Which documents a sign-up may choose, by nationality group (DNI only for Spaniards, EU eID only for EU). */
export const SIGNUP_DOCUMENTS: Record<SignUpCountry['group'], DocumentType[]> = {
  spanish: ['DNI', 'PASSPORT'],
  eu: ['EU_EID', 'PASSPORT', 'TIE'],
  non_eu: ['PASSPORT', 'TIE', 'NIE_PAPER', 'RED_CARD'],
}

/** Country row for a typed nationality (English short name). */
export function countryByName(name: string): SignUpCountry | undefined {
  const n = (name ?? '').trim().toLowerCase()
  return SIGNUP_COUNTRIES.find(c => c.name.en.toLowerCase() === n || c.name.es.toLowerCase() === n)
}

/* ------------------------------------------------------ building a case */

export function emptySession(): Session {
  return { route: null, who: 'self', nfc: null, euEid: null, consents: {}, chipReads: [], faceAttempts: [], videoAttempts: [], uploads: {} }
}

export const fullName = (p: Pick<PersonData, 'givenNames' | 'surnames'>) => `${p.givenNames} ${p.surnames}`.replace(/\s+/g, ' ').trim()

/** Whole years between the date of birth and `today` (null for an invalid date). */
export function ageFrom(dateOfBirth: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth ?? '')
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--
  return age
}

const initialsOfName = (name: string) => {
  const w = name.split(' ').filter(Boolean)
  return ((w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1][0] : (w[0]?.[1] ?? ''))).toUpperCase()
}
const hueOfName = (name: string) => parseInt(demoHash(name.toLowerCase()), 16) % 360
const ISSUED_IN_SPAIN: DocumentType[] = ['DNI', 'TIE', 'NIE_PAPER', 'RED_CARD']

/** Display persona for a typed person + document. */
export function personaOf(data: PersonData, doc: TypedDocument, now: Date = new Date()): Persona {
  const name = fullName(data)
  const country = countryByName(doc.nationality)
  return {
    name,
    age: ageFrom(data.dateOfBirth, now) ?? 0,
    nationality: country?.nationality ?? doc.nationality,
    initials: initialsOfName(name),
    hue: hueOfName(name),
    profile: { en: `${country?.nationality ?? doc.nationality} · ${DOCUMENTS[doc.type].label.en}`, es: `${country?.name.es ?? doc.nationality} · ${DOCUMENTS[doc.type].label.es}` },
  }
}

export function displayDocument(doc: TypedDocument): IdentityDocument {
  return { type: doc.type, number: doc.number, issuingCountry: ISSUED_IN_SPAIN.includes(doc.type) ? 'Spain' : doc.nationality, expires: doc.expiry }
}

/** Assistant prefill derived from the typed data. */
export function presetAnswersFor(doc: TypedDocument): AssistantAnswers {
  const group = countryByName(doc.nationality)?.group ?? 'non_eu'
  return {
    nationalityGroup: group, nationality: doc.nationality, document: doc.type,
    euEid: group === 'eu' ? (doc.type === 'EU_EID' ? 'yes' : null) : null, who: 'self', nfc: null,
    hasEuEid: doc.type === 'EU_EID', assisted: false, forMinor: false,
  }
}

/** A fresh draft application for a typed account. */
export function newDraftCase(id: string, origin: Case['origin'], typed: TypedDocument, at: string, extra: Partial<Case> = {}): Case {
  return {
    id, origin, typed,
    persona: personaOf(typed.data, typed, new Date(at)),
    document: displayDocument(typed),
    presetAnswers: presetAnswersFor(typed),
    scenario: { en: 'Typed at sign-up. What happens next depends on the checks and the rules.', es: 'Datos escritos al registrarse. Lo que pase después depende de las comprobaciones y las normas.' },
    demoBeat: origin === 'signup' ? { en: 'New sign-up', es: 'Nuevo registro' } : { en: 'Preloaded demo account', es: 'Cuenta de demo precargada' },
    session: emptySession(),
    answers: null, route: null, status: 'draft', level: 'none', advanced: 'not_requested', consentGiven: false,
    attempt: 0, checks: [], risk: 'low', flags: [], citizenMsgs: [], awaitingOfficer: false, decisions: [], correctedAfterRefusal: false,
    updatedAt: at,
    ...extra,
  }
}

/* ------------------------------------------------------------ preloaded accounts
 * SPEC §7: all in DRAFT (nobody has done anything yet). Giulia is NOT preloaded: she is typed in live.
 * Passwords are documented in the README (and DEMO_PEOPLE in ./world.ts).
 */
export const DEMO_ACCOUNT_PASSWORDS: Record<string, string> = Object.fromEntries(
  DEMO_PEOPLE.filter(p => p.caseId).map(p => [p.caseId!, p.account.password]),
)

export function typedFromDemo(p: (typeof DEMO_PEOPLE)[number]): TypedDocument {
  const a = p.account
  return {
    type: a.documentType, number: a.documentNumber, expiry: a.expiryDate, nationality: a.country,
    data: { givenNames: a.givenNames, surnames: a.surnames, dateOfBirth: a.dateOfBirth },
    ...(a.can ? { can: a.can } : {}),
  }
}

/** @deprecated UI migration: the old persona library is gone. Preloaded accounts, as draft cases. */
export const CASE_LIBRARY: Array<Pick<Case, 'id' | 'caseRef' | 'caseLabel' | 'typed'>> = DEMO_PEOPLE.filter(p => p.caseId).map(p => ({
  id: p.caseId!, caseRef: p.caseRef, caseLabel: p.caseLabel, typed: typedFromDemo(p),
}))

/* ---------------------------------------------------- background cases
 * Filler so the officer queue looks alive. Not runnable from the citizen side. Already decided or waiting.
 */
interface BackgroundSeed {
  id: string
  givenNames: string; surnames: string; dob: string; country: string
  doc: { type: DocumentType; number: string; expiry: string }
  route: RouteId
  status: StatusId
  level: Case['level']
  advanced: Case['advanced']
  awaitingOfficer: boolean
  minutesAgo: number
  checks: Array<[CheckId, Case['checks'][number]['outcome'], number | undefined, string]>
  flags: Case['flags']
  risk: Case['risk']
  aiReason?: string
  infoRequest?: string
  refusedWith?: RejId
  appeal?: string
}

const bg = (x: BackgroundSeed) => x
const ADV: Case['flags'][number] = { code: 'advanced_level_review', severity: 'low', reason: { en: 'Advanced level always gets a human review', es: 'El nivel avanzado siempre lo revisa una persona' } }
const BACKGROUND: BackgroundSeed[] = [
  bg({ id: 'bg-01', givenNames: 'Amélie', surnames: 'Laurent', dob: '1999-02-11', country: 'France', doc: { type: 'EU_EID', number: 'X4RT90213', expiry: '2031-01-10' }, route: 'A', status: 'approved', level: 'basic', advanced: 'not_requested', awaitingOfficer: false, minutesAgo: 14, checks: [['eidas_login', 'pass', undefined, 'French eID confirmed via eIDAS'], ['residence', 'pass', undefined, 'Residence record matched (Madrid)']], flags: [], risk: 'low' }),
  bg({ id: 'bg-02', givenNames: 'Julián', surnames: 'Rendón', dob: '1992-06-01', country: 'Colombia', doc: { type: 'TIE', number: fictionalDniNie('Y', 8063377), expiry: '2028-06-01' }, route: 'B', status: 'approved', level: 'basic', advanced: 'pending_review', awaitingOfficer: true, minutesAgo: 22, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['printed_vs_chip', 'pass', undefined, 'Printed data matches the chip'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.96, 'Live person'], ['face_match', 'pass', 0.95, 'Matches chip photo'], ['residence', 'pass', undefined, 'Residence record matched (Zaragoza)']], flags: [ADV], risk: 'low' }),
  bg({ id: 'bg-03', givenNames: 'Priya', surnames: 'Nair', dob: '1995-09-23', country: 'India', doc: { type: 'PASSPORT', number: 'K7712093', expiry: '2033-08-19' }, route: 'B', status: 'checking', level: 'none', advanced: 'not_requested', awaitingOfficer: true, minutesAgo: 9, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['printed_vs_chip', 'pass', undefined, 'Printed data matches the chip'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.93, 'Live person'], ['face_match', 'pass', 0.94, 'Matches chip photo'], ['residence', 'fail', undefined, 'No residence record found']], flags: [{ code: 'residence_not_found', severity: 'medium', reason: { en: 'No residence record was found for this document. Other checks passed.', es: 'No se ha encontrado registro de residencia para este documento. El resto de comprobaciones se superaron.' } }], risk: 'medium', aiReason: 'No residence record was found for this document. Other checks passed.' }),
  bg({ id: 'bg-04', givenNames: 'Oluwaseun', surnames: 'Adeyemi', dob: '2000-01-30', country: 'Nigeria', doc: { type: 'TIE', number: fictionalDniNie('Y', 8071240), expiry: '2027-07-15' }, route: 'B', status: 'need_info', level: 'none', advanced: 'not_requested', awaitingOfficer: false, minutesAgo: 75, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['printed_vs_chip', 'pass', undefined, 'Printed data matches the chip'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.95, 'Live person'], ['face_match', 'pass', 0.93, 'Matches chip photo'], ['residence', 'warn', undefined, 'Two residence records found (old and new address)']], flags: [{ code: 'residence_mismatch', severity: 'medium', reason: { en: 'Two residence records found', es: 'Dos registros de residencia' } }], risk: 'medium', infoRequest: 'a document that shows which of your two addresses is current' }),
  bg({ id: 'bg-05', givenNames: 'Carmen', surnames: 'Ruiz Ortega', dob: '1981-03-12', country: 'Spain', doc: { type: 'DNI', number: fictionalDniNie('', 48219360), expiry: '2030-04-04' }, route: 'C', status: 'approved', level: 'advanced', advanced: 'granted', awaitingOfficer: false, minutesAgo: 140, checks: [['dni_video', 'pass', undefined, 'DNI video identification completed'], ['document_validity', 'pass', undefined, 'In date'], ['residence', 'pass', undefined, 'Residence record matched (Madrid)']], flags: [], risk: 'low' }),
  bg({ id: 'bg-06', givenNames: 'Tomás', surnames: 'Ferreira', dob: '1988-12-02', country: 'Portugal', doc: { type: 'EU_EID', number: '152198027ZX4', expiry: '2029-10-10' }, route: 'A', status: 'checking', level: 'none', advanced: 'not_requested', awaitingOfficer: true, minutesAgo: 31, checks: [['eidas_login', 'pass', undefined, 'Portuguese eID confirmed via eIDAS'], ['residence', 'fail', undefined, 'Surname order differs from the residence record']], flags: [{ code: 'residence_mismatch', severity: 'medium', reason: { en: 'The residence record differs from the document in: surnames. Other checks passed.', es: 'El registro de residencia difiere del documento en: apellidos. El resto de comprobaciones se superaron.' } }], risk: 'medium', aiReason: 'The residence record differs from the document in: surnames. Other checks passed.' }),
  bg({ id: 'bg-07', givenNames: 'Aisha', surnames: 'Rahman', dob: '1997-04-04', country: 'Other country outside the EU', doc: { type: 'PASSPORT', number: 'A11902588', expiry: '2026-10-30' }, route: 'B', status: 'not_approved', level: 'none', advanced: 'not_requested', awaitingOfficer: false, minutesAgo: 1440, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['printed_vs_chip', 'pass', undefined, 'Printed data matches the chip'], ['document_validity', 'fail', undefined, 'Passport expired on 30 Oct 2026'], ['liveness', 'pass', 0.97, 'Live person'], ['face_match', 'pass', 0.95, 'Matches chip photo'], ['residence', 'pass', undefined, 'Residence record matched (Madrid)']], flags: [{ code: 'appeal_filed', severity: 'medium', reason: { en: 'Review requested against the refusal', es: 'Revisión solicitada contra la denegación' } }], risk: 'medium', refusedWith: 'REJ-01', appeal: 'My passport renewal is in progress; I attach the consulate receipt.' }),
  bg({ id: 'bg-08', givenNames: 'Jonas', surnames: 'Lindqvist', dob: '1974-07-19', country: 'Other country outside the EU', doc: { type: 'PASSPORT', number: '99821470', expiry: '2032-03-03' }, route: 'B', status: 'approved', level: 'advanced', advanced: 'granted', awaitingOfficer: false, minutesAgo: 300, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['printed_vs_chip', 'pass', undefined, 'Printed data matches the chip'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.95, 'Live person'], ['face_match', 'pass', 0.94, 'Matches chip photo'], ['residence', 'pass', undefined, 'Residence record matched (Málaga)']], flags: [], risk: 'low' }),
  bg({ id: 'bg-09', givenNames: 'Larissa', surnames: 'Prado', dob: '2007-05-05', country: 'Brazil', doc: { type: 'TIE', number: fictionalDniNie('Y', 8090011), expiry: '2027-09-30' }, route: 'F', status: 'checking', level: 'none', advanced: 'not_requested', awaitingOfficer: true, minutesAgo: 48, checks: [['chip_read', 'fail', undefined, 'Chip could not be read twice'], ['officer_video', 'pending', undefined, 'Waiting for the officer to start the video call']], flags: [{ code: 'chip_unreadable', severity: 'medium', reason: { en: 'Chip could not be read twice; document integrity not verified', es: 'El chip no se pudo leer dos veces; integridad del documento no verificada' } }], risk: 'medium', aiReason: 'Chip could not be read twice; document integrity not verified' }),
  bg({ id: 'bg-10', givenNames: 'Marek', surnames: 'Nowak', dob: '1986-11-11', country: 'Poland', doc: { type: 'PASSPORT', number: 'EP4401872', expiry: '2030-12-12' }, route: 'B', status: 'approved', level: 'basic', advanced: 'pending_review', awaitingOfficer: true, minutesAgo: 5, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['printed_vs_chip', 'pass', undefined, 'Printed data matches the chip'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.97, 'Live person'], ['face_match', 'pass', 0.96, 'Matches chip photo'], ['residence', 'pass', undefined, 'Residence record matched (Valencia)']], flags: [ADV], risk: 'low' }),
]

const both = (s: string): Bilingual => ({ en: s, es: s })

/**
 * Builds the initial state. Deterministic for a given `now`.
 * Preloaded accounts start as 'draft'. Background cases start mid-flow.
 */
export function buildSeedState(now: Date = new Date()): AppState {
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString()
  const cases: Record<string, Case> = {}
  const accounts: Record<string, CitizenAccount> = {}

  for (const p of DEMO_PEOPLE) {
    if (!p.caseId) continue
    const typed = typedFromDemo(p)
    cases[p.caseId] = newDraftCase(p.caseId, 'library', typed, iso(0), { caseRef: p.caseRef, caseLabel: p.caseLabel })
    accounts[p.caseId] = { caseId: p.caseId, documentNumber: typed.number, passwordHash: demoHash(p.account.password), createdAt: iso(0), origin: 'library' }
  }

  const marta = OFFICERS[2]
  const martaActor = { kind: 'officer' as const, id: marta.id, name: marta.name }
  for (const b of BACKGROUND) {
    const at = iso(b.minutesAgo)
    const typed: TypedDocument = { type: b.doc.type, number: b.doc.number, expiry: b.doc.expiry, nationality: b.country, data: { givenNames: b.givenNames, surnames: b.surnames, dateOfBirth: b.dob } }
    const decisions: Case['decisions'] = []
    if (b.level === 'basic' || b.level === 'advanced') decisions.push({ outcome: 'approved_basic', by: SYSTEM_ACTOR, at, ruleId: `${b.route}-OK` })
    if (b.advanced === 'granted') decisions.push({ outcome: 'approved_advanced', by: martaActor, at })
    if (b.refusedWith) decisions.push({ outcome: 'refused', by: martaActor, reasonId: b.refusedWith, at })
    const answers: AssistantAnswers = { ...presetAnswersFor(typed), nfc: b.route === 'B' ? 'yes' : null }
    const session: Session = {
      ...emptySession(),
      route: b.route,
      consents: { face: b.route !== 'A', residence: true, at },
      chipReads: b.route === 'F' ? ['failed', 'failed'] : b.route === 'B' ? ['ok'] : [],
      faceAttempts: b.route === 'B' ? ['person'] : [],
      videoAttempts: b.route === 'C' ? ['person'] : [],
      fallback: b.route === 'F' ? { offered: 'chip', joined: true, at } : undefined,
      videoCall: b.route === 'F' ? { state: 'waiting' } : undefined,
      contact: { mobile: '+34 600 000 9' + b.id.slice(-2), smsConfirmed: true },
      confirmedReview: true,
    }
    cases[b.id] = {
      ...newDraftCase(b.id, 'background', typed, at),
      demoBeat: both('Background case'),
      scenario: both('Background case (queue filler)'),
      session,
      answers,
      route: b.route,
      status: b.status,
      level: b.level,
      advanced: b.advanced,
      consentGiven: true,
      attempt: 1,
      checks: b.checks.map(([id, outcome, score, detail]) => ({ id, outcome, score, detail: both(detail) })),
      risk: b.risk,
      flags: b.flags,
      aiReason: b.aiReason ? both(b.aiReason) : undefined,
      awaitingOfficer: b.awaitingOfficer || Boolean(b.appeal),
      decisions,
      infoRequest: b.infoRequest ? { message: b.infoRequest, at, by: martaActor } : undefined,
      appeal: b.appeal ? { text: b.appeal, at, state: 'open', refusedBy: marta.id, refusedReasonId: b.refusedWith } : undefined,
      policyProposal: isProposedRule(b.route, answers),
      submittedAt: at,
      updatedAt: at,
    }
  }

  return {
    version: STATE_VERSION,
    cases,
    audit: [],
    lang: 'en',
    officerId: null,
    activeCitizenCaseId: null,
    accounts,
    officerProfiles: {},
  }
}

/** True for a typed DNI/NIE-shaped number that could be real (correct check letter): sign-up refuses it. */
export const isRealLookingDniNie = (v: string) => !isFictionalDniNie(v) && /^(\d{8}|[XYZ]\d{7})[A-Z]$/.test(normaliseDocNumber(v))

/** localStorage key and BroadcastChannel name. */
export const STORAGE_KEY = 'getyourclave.state.v1'
export const CHANNEL_NAME = 'getyourclave.sync'
