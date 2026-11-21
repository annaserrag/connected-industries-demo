/**
 * CONTRACT — owned by the orchestrator. Subagents import from here and must NOT edit it.
 *
 * All people, documents and numbers are FICTIONAL. Document numbers always start with "DEMO-".
 * Real figures appear only in REFERENCE_FIGURES, exactly as in the plan's reference sheet.
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
  RouteDef,
  RouteId,
  SimulatedIndicator,
  StatusDef,
  StatusId,
} from './types'

export const SERVICE_NAME = 'Get your Cl@ve'
export const FOOTER_DISCLAIMER: Bilingual = {
  en: 'Student prototype — not an official Government of Spain service.',
  es: 'Prototipo de estudiantes — no es un servicio oficial del Gobierno de España.',
}
export const SIMULATED_LABEL: Bilingual = { en: 'Simulated', es: 'Simulado' }
export const POLICY_PROPOSAL_LABEL: Bilingual = { en: 'Policy proposal', es: 'Propuesta normativa' }
export const STATE_VERSION = 4

/* ------------------------------------------------------------- key rule */

export const KEY_RULE: Bilingual = {
  en: 'The platform can approve automatically; only an officer can refuse or revoke, always with a reason and a way to appeal.',
  es: 'La plataforma puede aprobar automáticamente; solo una persona funcionaria puede denegar o revocar, siempre con un motivo y una forma de recurrir.',
}

/* ---------------------------------------------------------------- routes */

export const ROUTES: Record<RouteId, RouteDef> = {
  A: {
    id: 'A',
    code: 'A',
    name: { en: 'EU digital ID (eIDAS)', es: 'Identidad digital de la UE (eIDAS)' },
    forWhom: {
      en: 'EU citizens who can log in with their own national eID.',
      es: 'Ciudadanos de la UE que pueden entrar con su identidad electrónica nacional.',
    },
    checks: ['eidas_login', 'residence'],
  },
  B: {
    id: 'B',
    code: 'B',
    name: { en: 'Passport or TIE chip + face check', es: 'Chip del pasaporte o TIE + comprobación facial' },
    forWhom: {
      en: 'Anyone with a passport or TIE: the phone reads the chip and checks your face (reading the TIE chip by phone is still being confirmed).',
      es: 'Cualquier persona con pasaporte o TIE: el móvil lee el chip y comprueba tu cara (la lectura del chip de la TIE con el móvil está pendiente de confirmar).',
    },
    checks: ['chip_read', 'chip_signature', 'document_validity', 'liveness', 'face_match', 'residence'],
  },
  C: {
    id: 'C',
    code: 'C',
    name: { en: 'DNI video call', es: 'Videollamada con DNI' },
    forWhom: {
      en: "Spaniards with a DNI. Today's route, kept as it is.",
      es: 'Españoles con DNI. La vía de hoy, sin cambios.',
    },
    checks: ['dni_video'],
  },
  FALLBACK: {
    id: 'FALLBACK',
    code: 'Fallback',
    name: {
      en: 'Video call with an officer, then office',
      es: 'Videollamada con una persona funcionaria y, si hace falta, oficina',
    },
    forWhom: {
      en: 'Cases that fail twice, documents without a chip, or anything that looks like fraud.',
      es: 'Casos que fallan dos veces, documentos sin chip o cualquier indicio de fraude.',
    },
    checks: ['officer_video'],
  },
}
export const ROUTE_ORDER: RouteId[] = ['A', 'B', 'C', 'FALLBACK']

/* -------------------------------------------------------------- statuses */

export const STATUSES: Record<StatusId, StatusDef> = {
  received: {
    id: 'received',
    step: 1,
    label: { en: 'Received', es: 'Recibida' },
    message: {
      en: 'We have your application. You do not need to do anything right now.',
      es: 'Tenemos tu solicitud. Ahora mismo no tienes que hacer nada.',
    },
  },
  checking: {
    id: 'checking',
    step: 2,
    label: { en: 'Checking', es: 'Comprobando' },
    message: {
      en: 'We are checking your document, your face and your residence record. Most checks finish in a few minutes. If a person needs to look at it, we will tell you here.',
      es: 'Estamos comprobando tu documento, tu cara y tu empadronamiento. La mayoría termina en pocos minutos. Si tiene que revisarlo una persona, te lo diremos aquí.',
    },
  },
  need_info: {
    id: 'need_info',
    step: 3,
    label: { en: 'We need something from you', es: 'Necesitamos algo de ti' },
    message: {
      en: 'An officer needs one more thing before deciding. Read what they ask below and answer from this screen. Your application stays open.',
      es: 'Una persona funcionaria necesita una cosa más antes de decidir. Lee lo que te pide abajo y responde desde esta pantalla. Tu solicitud sigue abierta.',
    },
  },
  approved: {
    id: 'approved',
    step: 4,
    label: { en: 'Approved', es: 'Aprobada' },
    message: {
      en: 'You have Cl@ve. With the basic level you can already use most online services; the advanced level, if pending, is reviewed by a person and you will see it here.',
      es: 'Ya tienes Cl@ve. Con el nivel básico ya puedes usar la mayoría de servicios en línea; el nivel avanzado, si está pendiente, lo revisa una persona y lo verás aquí.',
    },
  },
  not_approved: {
    id: 'not_approved',
    step: 5,
    label: { en: 'Not approved', es: 'No aprobada' },
    message: {
      en: 'A person reviewed your application and could not approve it. Below you can see the exact reason, how to fix it and how to appeal.',
      es: 'Una persona revisó tu solicitud y no pudo aprobarla. Abajo tienes el motivo exacto, cómo corregirlo y cómo recurrir.',
    },
  },
}
export const STATUS_ORDER: StatusId[] = ['received', 'checking', 'need_info', 'approved', 'not_approved']

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
    label: { en: 'Residence record (with consent)', es: 'Empadronamiento (con tu consentimiento)' },
    explains: { en: 'With your consent, we check you are registered as living in Spain.', es: 'Con tu consentimiento, comprobamos que estás empadronado en España.' },
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
  officer_video: {
    id: 'officer_video', simulated: sim,
    label: { en: 'Video call with an officer', es: 'Videollamada con una persona funcionaria' },
    explains: { en: 'An officer checks your document and identity live.', es: 'Una persona funcionaria comprueba tu documento e identidad en directo.' },
  },
}

export const ENGINE: EngineThresholds = {
  livenessMin: 0.85,
  faceMatchMin: 0.9,
  maxAttemptsBeforeFallback: 2,
}

/* ---------------------------------------------------------- decision rules
 * The first four rows are the plan's table (Part 3, section 2). The last two are how the
 * prototype handles the minor and red-card cases; the red-card row is a POLICY PROPOSAL.
 *
 * Engine semantics (core must implement exactly this):
 *  1. Run the route's checks (plus guardian_link for minors) reading `simulation.attempts[attempt-1]`.
 *  2. Any check 'fail', liveness < livenessMin, face_match < faceMatchMin, or any 'high' flag →
 *     NO automatic outcome; case goes to the officer queue (awaitingOfficer = true), status 'checking'.
 *     If this was attempt >= maxAttemptsBeforeFallback, the route becomes 'FALLBACK'.
 *  3. Route A, all pass → auto 'approved_basic'; advanced 'not_requested'.
 *  4. Route B, all pass (warn allowed) → auto 'approved_basic'; advanced 'pending_review' and the case
 *     joins the officer queue as a low-risk advanced-level review.
 *  5. Minor, red card (FALLBACK/policy proposal) → never automatic; always officer.
 *  6. Route C → as today: simulated DNI video passes → auto 'approved_basic', advanced 'pending_review'.
 *  7. The system NEVER refuses or revokes. Only `officerRefuse` / `officerRevoke` with a reasonId can.
 */
export const DECISION_RULES: DecisionRule[] = [
  {
    situation: { en: 'EU citizen with national eID', es: 'Ciudadano de la UE con eID nacional' },
    route: 'A',
    automaticOutcome: { en: 'Basic level granted', es: 'Nivel básico concedido' },
    toOfficerWhen: { en: 'eID data does not match the records', es: 'Los datos del eID no coinciden con los registros' },
  },
  {
    situation: { en: 'Passport or TIE with readable chip', es: 'Pasaporte o TIE con chip legible' },
    route: 'B',
    automaticOutcome: { en: 'Basic level granted; advanced level queued', es: 'Nivel básico concedido; nivel avanzado en cola' },
    toOfficerWhen: {
      en: 'Face match or liveness is low, chip signature fails, residence check fails',
      es: 'Coincidencia facial o prueba de vida baja, falla la firma del chip o falla el empadronamiento',
    },
  },
  {
    situation: { en: 'Spaniard with DNI', es: 'Español con DNI' },
    route: 'C',
    automaticOutcome: { en: 'As today', es: 'Como hoy' },
    toOfficerWhen: { en: 'As today', es: 'Como hoy' },
  },
  {
    situation: { en: 'Chip unreadable or checks failed twice', es: 'Chip ilegible o comprobaciones fallidas dos veces' },
    route: 'FALLBACK',
    automaticOutcome: { en: 'None', es: 'Ninguno' },
    toOfficerWhen: {
      en: 'Always: video call with an officer, then office if needed',
      es: 'Siempre: videollamada con una persona funcionaria y, si hace falta, oficina',
    },
  },
  {
    situation: { en: 'Minor registering with a parent (prototype rule)', es: 'Menor que se registra con su madre o padre (regla del prototipo)' },
    route: 'B',
    automaticOutcome: { en: 'None', es: 'Ninguno' },
    toOfficerWhen: { en: 'Always: an officer confirms the guardian link', es: 'Siempre: una persona funcionaria confirma el vínculo' },
  },
  {
    situation: { en: 'Red-card holder (policy proposal)', es: 'Titular de tarjeta roja (propuesta normativa)' },
    route: 'FALLBACK',
    automaticOutcome: { en: 'None', es: 'Ninguno' },
    toOfficerWhen: { en: 'Always: video call with an officer', es: 'Siempre: videollamada con una persona funcionaria' },
  },
]

/* ------------------------------------------------------ rejection reasons
 * Closed list. Exactly one citizen message per reason (EN + ES).
 */
export const REJECTION_REASONS: Record<import('./types').RejectionReasonId, RejectionReason> = {
  document_expired: {
    id: 'document_expired',
    officerLabel: { en: 'Document expired', es: 'Documento caducado' },
    citizenMessage: {
      en: 'The document you used has expired, so we cannot use it to confirm who you are.',
      es: 'El documento que usaste está caducado, así que no podemos usarlo para confirmar quién eres.',
    },
    howToFix: {
      en: 'Apply again with a document that is in date, or appeal if you think the date is wrong.',
      es: 'Vuelve a solicitarlo con un documento en vigor, o recurre si crees que la fecha es errónea.',
    },
  },
  face_mismatch: {
    id: 'face_mismatch',
    officerLabel: { en: 'Face does not match', es: 'La cara no coincide' },
    citizenMessage: {
      en: 'The face in the camera did not match the photo stored in your document chip.',
      es: 'La cara de la cámara no coincidía con la foto guardada en el chip de tu documento.',
    },
    howToFix: {
      en: 'Try again in good light without glasses, or book a video call with an officer.',
      es: 'Inténtalo de nuevo con buena luz y sin gafas, o pide una videollamada con una persona funcionaria.',
    },
  },
  liveness_failed: {
    id: 'liveness_failed',
    officerLabel: { en: 'Liveness failed', es: 'Prueba de vida fallida' },
    citizenMessage: {
      en: 'We could not confirm that a real person was in front of the camera.',
      es: 'No pudimos confirmar que hubiera una persona real ante la cámara.',
    },
    howToFix: {
      en: 'Book a video call with an officer, who can confirm it with you live.',
      es: 'Pide una videollamada con una persona funcionaria, que puede confirmarlo contigo en directo.',
    },
  },
  chip_invalid: {
    id: 'chip_invalid',
    officerLabel: { en: 'Chip signature invalid', es: 'Firma del chip no válida' },
    citizenMessage: {
      en: 'The chip in your document did not carry a valid signature from the country that issued it.',
      es: 'El chip de tu documento no tenía una firma válida del país que lo emitió.',
    },
    howToFix: {
      en: 'If your document is genuine, book a video call so an officer can check it, or appeal.',
      es: 'Si tu documento es auténtico, pide una videollamada para que una persona lo revise, o recurre.',
    },
  },
  residence_not_found: {
    id: 'residence_not_found',
    officerLabel: { en: 'Residence not found', es: 'Empadronamiento no encontrado' },
    citizenMessage: {
      en: 'We could not find you registered as living at the address you gave (padrón).',
      es: 'No te encontramos empadronado en la dirección que indicaste.',
    },
    howToFix: {
      en: 'If you registered recently, update your padrón and press "I have corrected it" so we check again.',
      es: 'Si te empadronaste hace poco, actualiza tu padrón y pulsa «Ya lo he corregido» para que volvamos a comprobarlo.',
    },
  },
  data_mismatch: {
    id: 'data_mismatch',
    officerLabel: { en: 'Data mismatch', es: 'Los datos no coinciden' },
    citizenMessage: {
      en: 'Your name or date of birth is different in your document and in our records.',
      es: 'Tu nombre o fecha de nacimiento no coincide entre tu documento y nuestros registros.',
    },
    howToFix: {
      en: 'Tell us which one is right and send proof, or appeal.',
      es: 'Indícanos cuál es el correcto y envía una prueba, o recurre.',
    },
  },
  suspected_fraud: {
    id: 'suspected_fraud',
    officerLabel: { en: 'Suspected fraud', es: 'Sospecha de fraude' },
    citizenMessage: {
      en: 'Our checks found signs that the identity or document may not be genuine.',
      es: 'Nuestras comprobaciones encontraron indicios de que la identidad o el documento pueden no ser auténticos.',
    },
    howToFix: {
      en: 'If this is a mistake, appeal and book a video call; an officer will review it with you.',
      es: 'Si es un error, recurre y pide una videollamada; una persona funcionaria lo revisará contigo.',
    },
  },
}

/* ------------------------------------------------- other citizen messages */

export const CITIZEN_MESSAGES = {
  consentTitle: { en: 'Before we check, we need your consent', es: 'Antes de comprobar, necesitamos tu consentimiento' },
  consentBody: {
    en: 'To confirm who you are, we will read the chip in your document, take a short face video and check your residence record (padrón) with the town hall. We only use this to give you Cl@ve, and you can see every check we did in your status page.',
    es: 'Para confirmar quién eres, leeremos el chip de tu documento, grabaremos un breve vídeo de tu cara y consultaremos tu empadronamiento con el ayuntamiento. Solo lo usamos para darte Cl@ve, y puedes ver cada comprobación en tu página de estado.',
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
  assisted: { en: 'Is someone helping you on their phone?', es: '¿Te ayuda alguien desde su móvil?' },
} as const

/**
 * Route recommendation used by the assistant. Deterministic.
 * Returns the route and the reason shown to the citizen.
 */
export function recommendRoute(a: AssistantAnswers): { route: RouteId; reason: Bilingual; policyProposal: boolean } {
  if (a.document === 'RED_CARD' || a.document === 'NIE_PAPER') {
    return {
      route: 'FALLBACK',
      policyProposal: true,
      reason: {
        en: 'Your document has no chip, so an officer confirms your identity on a video call. Under current rules this document is excluded; we propose to include it.',
        es: 'Tu documento no tiene chip, así que una persona funcionaria confirma tu identidad por videollamada. Con las normas actuales este documento está excluido; proponemos incluirlo.',
      },
    }
  }
  if (a.nationalityGroup === 'spanish' && a.document === 'DNI') {
    return {
      route: 'C',
      policyProposal: false,
      reason: { en: 'You have a DNI, so you can use today’s DNI video call.', es: 'Tienes DNI, así que puedes usar la videollamada con DNI de hoy.' },
    }
  }
  if (a.nationalityGroup === 'eu' && a.hasEuEid) {
    return {
      route: 'A',
      policyProposal: false,
      reason: {
        en: 'Your country’s digital ID already works with Cl@ve, so it is the fastest way: no chip, no camera.',
        es: 'La identidad digital de tu país ya funciona con Cl@ve, así que es lo más rápido: sin chip ni cámara.',
      },
    }
  }
  if (a.document === 'TIE') {
    return {
      route: 'B',
      policyProposal: true,
      reason: {
        en: 'Your phone reads the chip in your TIE, then a short face check. No appointment needed. (Reading the TIE chip by phone is an assumption we are still confirming.)',
        es: 'Tu móvil lee el chip de tu TIE y luego hace una breve comprobación facial. Sin cita. (La lectura del chip de la TIE con el móvil es un supuesto pendiente de confirmar.)',
      },
    }
  }
  return {
    route: 'B',
    policyProposal: true,
    reason: {
      en: 'Your passport has a chip your phone can read, then a short face check. No appointment needed.',
      es: 'Tu pasaporte tiene un chip que tu móvil puede leer, y luego una breve comprobación facial. Sin cita.',
    },
  }
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
  { en: 'Assumption: the TIE chip can be read by a phone (pending confirmation).', es: 'Supuesto: el chip de la TIE puede leerse con un móvil (pendiente de confirmar).' },
  { en: 'Assumption: MiDNI allows online login (pending confirmation).', es: 'Supuesto: MiDNI permite el acceso en línea (pendiente de confirmar).' },
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
 * Every number below is SIMULATED and must be labelled "Simulated" wherever shown.
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
  byRoute: { A: 1840, B: 6215, C: 9930, FALLBACK: 702 },
}

/* ---------------------------------------------------------------- officers */

export const OFFICERS: Officer[] = [
  { id: 'OF-DEMO-07', name: 'Laura Navarro', office: 'Registration office · Madrid' },
  { id: 'OF-DEMO-12', name: 'Javier Prieto', office: 'Registration office · Valencia' },
  { id: 'OF-DEMO-21', name: 'Marta Gil Herrero', office: 'Registration office · Sevilla' },
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
 * What the simulated certificate picker offers. Covers every outcome: two staff who sign in directly
 * once their profile exists, one authorised officer signing in for the first time, one person with a valid
 * certificate who is NOT authorised for Cl@ve, and one expired certificate.
 */
/**
 * Staff secrets for the team, documented ONLY in the README (never rendered in the app).
 * Certificate PINs and staff user passwords. Stored in state/seed only as demoHash.
 */
export const STAFF_DEMO_SECRETS = {
  pins: { 'cert-laura': '2580', 'cert-javier': '1357', 'cert-marta': '4826', 'cert-diego': '9031', 'cert-old': '2580' } as Record<string, string>,
  passwords: { lnavarro: 'Navarro-2026', jprieto: 'Prieto-2026', mgil: 'GilHerrero-2026', dromero: 'Romero-2026' } as Record<string, string>,
}

/**
 * Staff user accounts for the "user + password" sign-in method (the second card on the staff sign-in page).
 * Same authorisation rules as certificates: Diego has an account but is not authorised for Cl@ve registration.
 */
export const STAFF_ACCOUNTS: StaffAccount[] = [
  { userId: 'lnavarro', holderName: 'Laura Navarro', holderId: '50731842J', officerId: 'OF-DEMO-07', authorisedForClave: true, passwordHash: demoHash(STAFF_DEMO_SECRETS.passwords.lnavarro) },
  { userId: 'jprieto', holderName: 'Javier Prieto', holderId: '29640157H', officerId: 'OF-DEMO-12', authorisedForClave: true, passwordHash: demoHash(STAFF_DEMO_SECRETS.passwords.jprieto) },
  { userId: 'mgil', holderName: 'Marta Gil Herrero', holderId: '71385096A', officerId: 'OF-DEMO-21', authorisedForClave: true, passwordHash: demoHash(STAFF_DEMO_SECRETS.passwords.mgil) },
  { userId: 'dromero', holderName: 'Diego Romero', holderId: '33918274C', authorisedForClave: false, passwordHash: demoHash(STAFF_DEMO_SECRETS.passwords.dromero) },
]

export const STAFF_CERTIFICATES: StaffCertificate[] = [
  { id: 'cert-laura', credential: 'employee_certificate', holderName: 'Laura Navarro', holderId: '50731842J', authorityId: 'aeat', post: STAFF_POSTS[0], validUntil: '2028-06-30', officerId: 'OF-DEMO-07', authorisedForClave: true , pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-laura'])},
  { id: 'cert-javier', credential: 'dnie', holderName: 'Javier Prieto', holderId: '29640157H', validUntil: '2029-02-14', officerId: 'OF-DEMO-12', authorisedForClave: true , pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-javier'])},
  { id: 'cert-marta', credential: 'employee_certificate', holderName: 'Marta Gil Herrero', holderId: '71385096A', authorityId: 'delegacion', post: STAFF_POSTS[2], validUntil: '2027-11-02', officerId: 'OF-DEMO-21', authorisedForClave: true , pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-marta'])},
  { id: 'cert-diego', credential: 'personal_certificate', holderName: 'Diego Romero', holderId: '33918274C', validUntil: '2027-05-20', authorisedForClave: false , pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-diego'])},
  { id: 'cert-old', credential: 'employee_certificate', holderName: 'Laura Navarro', holderId: '50731842J', authorityId: 'aeat', post: STAFF_POSTS[0], validUntil: '2025-06-30', officerId: 'OF-DEMO-07', authorisedForClave: true , pinHash: demoHash(STAFF_DEMO_SECRETS.pins['cert-old'])},
]

/** Fake personnel-number format (NRP). Real formats must never be typed into the prototype. */
/* ------------------------------------------------- fictional identifiers
 * The app shows realistic-looking identifiers, but every DNI/NIE-shaped value carries a WRONG check letter,
 * so it can never be a real person's number. Anything a user types in a DNI/NIE/NRP-shaped field must
 * fail the real check-letter test (isFictionalDniNie), otherwise the app refuses it.
 */
const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
/** True when value has DNI (8 digits + letter) or NIE (X/Y/Z + 7 digits + letter) shape. */
export const hasDniNieShape = (v: string) => /^(\d{8}|[XYZ]\d{7})[A-Z]$/.test(v.trim().toUpperCase())
/** True when the check letter is the real one (i.e. could be a real person's number). */
export function hasValidDniNieLetter(v: string): boolean {
  const s = v.trim().toUpperCase()
  if (!hasDniNieShape(s)) return false
  const digits = s[0] >= 'X' && s[0] <= 'Z' ? String('XYZ'.indexOf(s[0])) + s.slice(1, 8) : s.slice(0, 8)
  return DNI_LETTERS[Number(digits) % 23] === s[8]
}
/** Fictional = has the shape but a wrong check letter. */
export const isFictionalDniNie = (v: string) => hasDniNieShape(v) && !hasValidDniNieLetter(v)

/** Builds a fictional DNI/NIE from digits: same shape as a real one, deliberately wrong check letter. */
export function fictionalDniNie(prefix: '' | 'X' | 'Y' | 'Z', digits: number): string {
  const body = prefix ? String(digits).padStart(7, '0').slice(-7) : String(digits).padStart(8, '0').slice(-8)
  const n = Number((prefix ? String('XYZ'.indexOf(prefix)) : '') + body)
  const ok = DNI_LETTERS[n % 23]
  const wrong = DNI_LETTERS[(n % 23 + 7) % 23]
  return `${prefix}${body}${wrong === ok ? 'Z' : wrong}`
}

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
/** A case waiting longer than this moves up one priority tier. */
export const PRIORITY_AGE_BUMP_HOURS = 24
export const SYSTEM_ACTOR = { kind: 'system' as const, id: 'ENGINE', name: 'Verification engine (simulated)' }

/* -------------------------------------------------------------- the cases */

const d = (type: DocumentType, number: string, issuingCountry: string, expires: string): IdentityDocument => ({ type, number, issuingCountry, expires })

type LibrarySeed = Omit<Case, 'answers' | 'route' | 'status' | 'level' | 'advanced' | 'consentGiven' | 'attempt' | 'checks' | 'risk' | 'flags' | 'awaitingOfficer' | 'decisions' | 'correctedAfterRefusal' | 'updatedAt'>

/** The case library (plan Part 2): 8 runnable personas. Order = order in the demo panel. */
export const CASE_LIBRARY: LibrarySeed[] = [
  {
    id: 'giulia',
    origin: 'library',
    persona: {
      name: 'Giulia Ferraro', age: 24, nationality: 'Italian', initials: 'GF', hue: 12,
      profile: { en: "Italian master's student in Madrid", es: 'Estudiante italiana de máster en Madrid' },
    },
    document: d('PASSPORT', 'YB4829137', 'Italy', '2031-03-14'),
    otherDocuments: [d('EU_EID', 'CA77310XK', 'Italy', '2030-09-01')],
    presetAnswers: { nationalityGroup: 'eu', document: 'PASSPORT', hasEuEid: false, assisted: false },
    scenario: {
      en: 'Her Italian eID PIN is at home, so she uses her passport chip + face check. Basic level in minutes; an officer approves the advanced level live.',
      es: 'El PIN de su eID italiano está en casa, así que usa el chip del pasaporte + cara. Nivel básico en minutos; una funcionaria aprueba el avanzado en directo.',
    },
    demoBeat: { en: "Video 0:40–2:00 · Giulia's new journey", es: 'Vídeo 0:40–2:00 · El nuevo recorrido de Giulia' },
    simulation: {
      attempts: [{
        eidas_login: { outcome: 'pass', detail: { en: 'Italian eID confirmed identity via eIDAS node', es: 'El eID italiano confirmó la identidad por el nodo eIDAS' } },
        chip_read: { outcome: 'pass', detail: { en: 'Chip read in 2.1 s', es: 'Chip leído en 2,1 s' } },
        liveness: { outcome: 'pass', score: 0.98, detail: { en: 'Natural micro-movement and depth', es: 'Micromovimiento y profundidad naturales' } },
        face_match: { outcome: 'pass', score: 0.96, detail: { en: 'Matches chip photo', es: 'Coincide con la foto del chip' } },
        residence: { outcome: 'pass', detail: { en: 'Registered in Madrid (padrón)', es: 'Empadronada en Madrid' } },
      }],
    },
  },
  {
    id: 'daniel',
    origin: 'library',
    persona: {
      name: 'Daniel Mwangi', age: 23, nationality: 'Kenyan', initials: 'DM', hue: 150,
      profile: { en: "Kenyan master's student with a TIE", es: 'Estudiante keniano de máster con TIE' },
    },
    document: d('TIE', 'Y8042719P', 'Spain', '2027-09-30'),
    presetAnswers: { nationalityGroup: 'non_eu', document: 'TIE', hasEuEid: false, assisted: false },
    scenario: {
      en: 'Non-EU student, TIE chip + face check. Today he would need an office appointment with originals; now it is done from the phone.',
      es: 'Estudiante de fuera de la UE, chip de la TIE + cara. Hoy necesitaría cita en oficina con originales; ahora lo hace desde el móvil.',
    },
    demoBeat: { en: 'Guide slide 4 · Which route is yours', es: 'Guía diapositiva 4 · Qué vía es la tuya' },
    simulation: {
      attempts: [{
        liveness: { outcome: 'pass', score: 0.97, detail: { en: 'Natural micro-movement and depth', es: 'Micromovimiento y profundidad naturales' } },
        face_match: { outcome: 'pass', score: 0.94, detail: { en: 'Matches chip photo', es: 'Coincide con la foto del chip' } },
        residence: { outcome: 'pass', detail: { en: 'Registered in Madrid (padrón)', es: 'Empadronado en Madrid' } },
      }],
    },
  },
  {
    id: 'rafael',
    origin: 'library',
    persona: {
      name: 'Rafael Medina', age: 80, nationality: 'Argentine', initials: 'RM', hue: 32,
      profile: { en: 'The neighbour: 80, no smartphone, helped by his daughter', es: 'El vecino: 80 años, sin smartphone, le ayuda su hija' },
    },
    document: d('TIE', 'X9019583W', 'Spain', '2029-05-12'),
    presetAnswers: { nationalityGroup: 'non_eu', document: 'TIE', hasEuEid: false, assisted: true },
    assisted: { helperName: 'Lucía Medina', relation: { en: 'daughter', es: 'hija' }, deviceOwner: 'Lucía Medina' },
    scenario: {
      en: 'Registers on his daughter Lucía’s phone in assisted mode. He does the face check himself; the Cl@ve is his.',
      es: 'Se registra en el móvil de su hija Lucía en modo asistido. Él hace la comprobación facial; la Cl@ve es suya.',
    },
    demoBeat: { en: 'Video 3:40–4:20 · Nobody left behind', es: 'Vídeo 3:40–4:20 · Nadie se queda atrás' },
    simulation: {
      attempts: [{
        liveness: { outcome: 'pass', score: 0.91, detail: { en: 'Live person confirmed (slower movement, within range)', es: 'Persona real confirmada (movimiento más lento, dentro del rango)' } },
        face_match: { outcome: 'pass', score: 0.92, detail: { en: 'Matches chip photo (Rafael, not the device owner)', es: 'Coincide con la foto del chip (Rafael, no la dueña del móvil)' } },
        residence: { outcome: 'pass', detail: { en: 'Registered in Getafe (padrón)', es: 'Empadronado en Getafe' } },
      }],
    },
  },
  {
    id: 'noah',
    origin: 'library',
    persona: {
      name: 'Noah Becker', age: 16, nationality: 'German', initials: 'NB', hue: 210,
      profile: { en: 'A minor (16) registering with his mother', es: 'Un menor (16) que se registra con su madre' },
    },
    document: d('PASSPORT', 'C01X58RT2', 'Germany', '2030-02-02'),
    presetAnswers: { nationalityGroup: 'eu', document: 'PASSPORT', hasEuEid: false, assisted: false },
    guardian: {
      name: 'Anke Becker',
      relation: { en: 'mother', es: 'madre' },
      document: d('EU_EID', 'L01X44TZ7', 'Germany', '2032-07-20'),
      route: 'A',
    },
    scenario: {
      en: 'His mother signs in with her German eID (route A) and confirms him; he does the chip + face check. An officer confirms the link.',
      es: 'Su madre entra con su eID alemán (vía A) y le confirma; él hace chip + cara. Una funcionaria confirma el vínculo.',
    },
    demoBeat: { en: 'Guide slide 9 · Special cases', es: 'Guía diapositiva 9 · Casos especiales' },
    simulation: {
      attempts: [{
        liveness: { outcome: 'pass', score: 0.95, detail: { en: 'Natural micro-movement and depth', es: 'Micromovimiento y profundidad naturales' } },
        face_match: { outcome: 'pass', score: 0.93, detail: { en: 'Matches chip photo', es: 'Coincide con la foto del chip' } },
        residence: { outcome: 'pass', detail: { en: 'Registered in Madrid with his mother (padrón)', es: 'Empadronado en Madrid con su madre' } },
        guardian_link: { outcome: 'pass', detail: { en: 'Mother signed in via German eID (eIDAS); same address in padrón', es: 'La madre entró con eID alemán (eIDAS); mismo domicilio en el padrón' } },
      }],
    },
  },
  {
    id: 'yusuf',
    origin: 'library',
    persona: {
      name: 'Yusuf Haddad', age: 31, nationality: 'Syrian', initials: 'YH', hue: 280,
      profile: { en: 'International protection applicant with a red card', es: 'Solicitante de protección internacional con tarjeta roja' },
    },
    document: d('RED_CARD', 'Y9117004D', 'Spain', '2027-01-15'),
    presetAnswers: { nationalityGroup: 'non_eu', document: 'RED_CARD', hasEuEid: false, assisted: false },
    policyProposal: true,
    scenario: {
      en: 'Excluded today. Under our policy proposal, his red card has no chip, so he goes straight to a video call with an officer.',
      es: 'Hoy está excluido. Con nuestra propuesta normativa, su tarjeta roja no tiene chip, así que va directo a videollamada con una funcionaria.',
    },
    demoBeat: { en: 'Policy proposal · red-card holders', es: 'Propuesta normativa · titulares de tarjeta roja' },
    simulation: {
      attempts: [{
        chip_read: { outcome: 'skipped', detail: { en: 'Document has no chip', es: 'El documento no tiene chip' } },
        residence: { outcome: 'pass', detail: { en: 'Registered in Madrid (padrón)', es: 'Empadronado en Madrid' } },
        officer_video: { outcome: 'pending', detail: { en: 'Waiting for officer video call', es: 'Esperando videollamada con funcionaria' } },
      }],
    },
  },
  {
    id: 'deepfake',
    origin: 'library',
    persona: {
      name: 'Ivo Petrov (claimed)', age: 35, nationality: 'Bulgarian', initials: 'IP', hue: 0,
      profile: { en: 'Deepfake attempt: someone else’s passport, a synthetic face video', es: 'Intento de deepfake: pasaporte ajeno y vídeo facial sintético' },
    },
    document: d('PASSPORT', '391027844', 'Bulgaria', '2029-11-08'),
    presetAnswers: { nationalityGroup: 'eu', document: 'PASSPORT', hasEuEid: false, assisted: false },
    scenario: {
      en: 'The face matches the chip photo, but liveness fails: an injected video. The engine stops it and an officer refuses with a reason.',
      es: 'La cara coincide con la foto del chip, pero falla la prueba de vida: vídeo inyectado. El motor lo para y una funcionaria deniega con motivo.',
    },
    demoBeat: { en: 'Video 2:50–3:40 · A hard case', es: 'Vídeo 2:50–3:40 · Un caso difícil' },
    simulation: {
      attempts: [{
        liveness: { outcome: 'fail', score: 0.22, detail: { en: 'Injected video stream: no depth, screen-replay pattern, frozen micro-movement', es: 'Vídeo inyectado: sin profundidad, patrón de pantalla, micromovimiento congelado' } },
        face_match: { outcome: 'pass', score: 0.97, detail: { en: 'Matches chip photo (expected for a deepfake built from it)', es: 'Coincide con la foto del chip (esperable en un deepfake hecho a partir de ella)' } },
        residence: { outcome: 'warn', detail: { en: 'Address registered 3 days ago', es: 'Domicilio registrado hace 3 días' } },
      }],
    },
  },
  {
    id: 'fakedoc',
    origin: 'library',
    persona: {
      name: 'Hana Kovač (claimed)', age: 41, nationality: 'Croatian', initials: 'HK', hue: 330,
      profile: { en: 'Fake document: a passport whose chip was cloned and edited', es: 'Documento falso: pasaporte con el chip clonado y modificado' },
    },
    document: d('PASSPORT', '205521963', 'Croatia', '2028-04-30'),
    presetAnswers: { nationalityGroup: 'eu', document: 'PASSPORT', hasEuEid: false, assisted: false },
    scenario: {
      en: 'The chip reads, but its signature is not from a trusted issuing country. Flagged high risk; the officer refuses with "Chip signature invalid".',
      es: 'El chip se lee, pero su firma no es de un país emisor de confianza. Riesgo alto; la funcionaria deniega con «Firma del chip no válida».',
    },
    demoBeat: { en: 'Guide slide 7 · What we check, and why', es: 'Guía diapositiva 7 · Qué comprobamos y por qué' },
    simulation: {
      attempts: [{
        chip_signature: { outcome: 'fail', detail: { en: 'Signature not issued by a trusted country signing authority (CSCA)', es: 'Firma no emitida por una autoridad firmante de confianza del país (CSCA)' } },
        document_validity: { outcome: 'warn', detail: { en: 'Expiry date in chip differs from printed page', es: 'La caducidad del chip difiere de la página impresa' } },
        liveness: { outcome: 'pass', score: 0.94, detail: { en: 'Live person', es: 'Persona real' } },
        face_match: { outcome: 'pass', score: 0.91, detail: { en: 'Matches chip photo', es: 'Coincide con la foto del chip' } },
      }],
    },
  },
  {
    id: 'linwei',
    origin: 'library',
    persona: {
      name: 'Lin Wei', age: 29, nationality: 'Chinese', initials: 'LW', hue: 190,
      profile: { en: 'Engineer with a TIE who moved last month', es: 'Ingeniera con TIE que se mudó el mes pasado' },
    },
    document: d('TIE', 'Z9088104B', 'Spain', '2028-12-01'),
    presetAnswers: { nationalityGroup: 'non_eu', document: 'TIE', hasEuEid: false, assisted: false },
    scenario: {
      en: 'Her padrón was not updated after moving, so the officer refuses with "Residence not found". She updates it, presses "I have corrected it" and is approved.',
      es: 'No actualizó el padrón al mudarse, así que la funcionaria deniega con «Empadronamiento no encontrado». Lo actualiza, pulsa «Ya lo he corregido» y queda aprobada.',
    },
    demoBeat: { en: 'Video 2:50–3:40 · A rejection corrected', es: 'Vídeo 2:50–3:40 · Una denegación corregida' },
    simulation: {
      attempts: [
        {
          liveness: { outcome: 'pass', score: 0.96, detail: { en: 'Live person', es: 'Persona real' } },
          face_match: { outcome: 'pass', score: 0.95, detail: { en: 'Matches chip photo', es: 'Coincide con la foto del chip' } },
          residence: { outcome: 'fail', detail: { en: 'No residence record at the declared address (padrón)', es: 'Sin empadronamiento en la dirección declarada' } },
        },
        {
          liveness: { outcome: 'pass', score: 0.96, detail: { en: 'Live person', es: 'Persona real' } },
          face_match: { outcome: 'pass', score: 0.95, detail: { en: 'Matches chip photo', es: 'Coincide con la foto del chip' } },
          residence: { outcome: 'pass', detail: { en: 'Residence confirmed after padrón update', es: 'Empadronamiento confirmado tras la actualización' } },
        },
      ],
    },
  },
]

/* ---------------------------------------------------- background cases
 * Filler so the officer queue looks alive. Not runnable from the citizen side.
 */
interface BackgroundSeed {
  id: string
  name: string; age: number; nationality: string; initials: string; hue: number
  profile: Bilingual
  doc: IdentityDocument
  route: RouteId
  status: StatusId
  level: Case['level']
  advanced: Case['advanced']
  awaitingOfficer: boolean
  minutesAgo: number
  checks: Array<[CheckId, Case['checks'][number]['outcome'], number | undefined, string]>
  flags: Case['flags']
  risk: Case['risk']
  infoRequest?: string
  refusedWith?: import('./types').RejectionReasonId
  appeal?: string
}

const bg = (x: BackgroundSeed) => x
const BACKGROUND: BackgroundSeed[] = [
  bg({ id: 'bg-01', name: 'Amélie Laurent', age: 27, nationality: 'French', initials: 'AL', hue: 240, profile: { en: 'French designer', es: 'Diseñadora francesa' }, doc: d('EU_EID', 'X4RT90213', 'France', '2031-01-10'), route: 'A', status: 'approved', level: 'basic', advanced: 'not_requested', awaitingOfficer: false, minutesAgo: 14, checks: [['eidas_login', 'pass', undefined, 'French eID confirmed via eIDAS'], ['residence', 'pass', undefined, 'Registered in Madrid']], flags: [], risk: 'low' }),
  bg({ id: 'bg-02', name: 'Mateo Rojas', age: 34, nationality: 'Colombian', initials: 'MR', hue: 50, profile: { en: 'Colombian nurse with a TIE', es: 'Enfermero colombiano con TIE' }, doc: d('TIE', 'Y8063377N', 'Spain', '2028-06-01'), route: 'B', status: 'approved', level: 'basic', advanced: 'pending_review', awaitingOfficer: true, minutesAgo: 22, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.96, 'Live person'], ['face_match', 'pass', 0.95, 'Matches chip photo'], ['residence', 'pass', undefined, 'Registered in Zaragoza']], flags: [{ code: 'advanced_level_review', severity: 'low', reason: { en: 'Advanced level always gets a human review', es: 'El nivel avanzado siempre lo revisa una persona' } }], risk: 'low' }),
  bg({ id: 'bg-03', name: 'Priya Nair', age: 31, nationality: 'Indian', initials: 'PN', hue: 20, profile: { en: 'Indian data scientist with a passport', es: 'Científica de datos india con pasaporte' }, doc: d('PASSPORT', 'K7712093', 'India', '2033-08-19'), route: 'B', status: 'checking', level: 'none', advanced: 'not_requested', awaitingOfficer: true, minutesAgo: 9, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.93, 'Live person'], ['face_match', 'warn', 0.86, 'Below threshold: new glasses and beard vs chip photo'], ['residence', 'pass', undefined, 'Registered in Barcelona']], flags: [{ code: 'low_face_match', severity: 'medium', reason: { en: 'Face match 0.86 is below the 0.90 threshold', es: 'Coincidencia facial 0,86 por debajo del umbral 0,90' } }], risk: 'medium' }),
  bg({ id: 'bg-04', name: 'Oluwaseun Adeyemi', age: 26, nationality: 'Nigerian', initials: 'OA', hue: 120, profile: { en: 'Nigerian MBA student with a TIE', es: 'Estudiante nigeriano de MBA con TIE' }, doc: d('TIE', 'Y8071240D', 'Spain', '2027-07-15'), route: 'B', status: 'need_info', level: 'none', advanced: 'not_requested', awaitingOfficer: false, minutesAgo: 75, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.95, 'Live person'], ['face_match', 'pass', 0.93, 'Matches chip photo'], ['residence', 'warn', undefined, 'Two padrón records found (old and new address)']], flags: [{ code: 'residence_not_found', severity: 'medium', reason: { en: 'Residence record ambiguous', es: 'Empadronamiento ambiguo' } }], risk: 'medium', infoRequest: 'Please confirm which of your two addresses is current (Calle Mayor or Calle Alcalá).' }),
  bg({ id: 'bg-05', name: 'Carmen Ruiz Ortega', age: 45, nationality: 'Spanish', initials: 'CR', hue: 0, profile: { en: 'Spanish teacher with a DNI', es: 'Profesora española con DNI' }, doc: d('DNI', '48219360M', 'Spain', '2030-04-04'), route: 'C', status: 'approved', level: 'advanced', advanced: 'granted', awaitingOfficer: false, minutesAgo: 140, checks: [['dni_video', 'pass', undefined, 'DNI video identification completed']], flags: [], risk: 'low' }),
  bg({ id: 'bg-06', name: 'Tomás Ferreira', age: 38, nationality: 'Portuguese', initials: 'TF', hue: 100, profile: { en: 'Portuguese chef', es: 'Cocinero portugués' }, doc: d('EU_EID', '152198027ZX4', 'Portugal', '2029-10-10'), route: 'A', status: 'checking', level: 'none', advanced: 'not_requested', awaitingOfficer: true, minutesAgo: 31, checks: [['eidas_login', 'warn', undefined, 'Surname order differs from residence record'], ['residence', 'pass', undefined, 'Registered in Sevilla']], flags: [{ code: 'eid_data_mismatch', severity: 'medium', reason: { en: 'eID data does not match the records (surname order)', es: 'Los datos del eID no coinciden con los registros (orden de apellidos)' } }], risk: 'medium' }),
  bg({ id: 'bg-07', name: 'Aisha Rahman', age: 29, nationality: 'Bangladeshi', initials: 'AR', hue: 160, profile: { en: 'Bangladeshi researcher with a passport', es: 'Investigadora bangladesí con pasaporte' }, doc: d('PASSPORT', 'A11902588', 'Bangladesh', '2026-10-30'), route: 'B', status: 'not_approved', level: 'none', advanced: 'not_requested', awaitingOfficer: false, minutesAgo: 1440, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['document_validity', 'fail', undefined, 'Passport expired on 30 Oct 2026'], ['liveness', 'pass', 0.97, 'Live person'], ['face_match', 'pass', 0.95, 'Matches chip photo'], ['residence', 'pass', undefined, 'Registered in Madrid']], flags: [{ code: 'appeal_filed', severity: 'medium', reason: { en: 'Appeal filed against the refusal', es: 'Recurso presentado contra la denegación' } }], risk: 'medium', refusedWith: 'document_expired', appeal: 'My passport renewal is in progress; I attach the consulate receipt.' }),
  bg({ id: 'bg-08', name: 'Jonas Lindqvist', age: 52, nationality: 'Swedish', initials: 'JL', hue: 200, profile: { en: 'Swedish retiree in Málaga', es: 'Jubilado sueco en Málaga' }, doc: d('PASSPORT', '99821470', 'Sweden', '2032-03-03'), route: 'B', status: 'approved', level: 'advanced', advanced: 'granted', awaitingOfficer: false, minutesAgo: 300, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.95, 'Live person'], ['face_match', 'pass', 0.94, 'Matches chip photo'], ['residence', 'pass', undefined, 'Registered in Málaga']], flags: [], risk: 'low' }),
  bg({ id: 'bg-09', name: 'Valentina Costa', age: 19, nationality: 'Brazilian', initials: 'VC', hue: 300, profile: { en: 'Brazilian undergraduate with a TIE', es: 'Estudiante brasileña de grado con TIE' }, doc: d('TIE', 'Y8090011N', 'Spain', '2027-09-30'), route: 'FALLBACK', status: 'checking', level: 'none', advanced: 'not_requested', awaitingOfficer: true, minutesAgo: 48, checks: [['chip_read', 'fail', undefined, 'Chip could not be read twice (damaged card)'], ['officer_video', 'pending', undefined, 'Waiting for officer video call']], flags: [{ code: 'second_attempt', severity: 'medium', reason: { en: 'Chip unreadable twice: moved to Fallback', es: 'Chip ilegible dos veces: pasa a vía alternativa' } }], risk: 'medium' }),
  bg({ id: 'bg-10', name: 'Marek Nowak', age: 40, nationality: 'Polish', initials: 'MN', hue: 260, profile: { en: 'Polish logistics manager', es: 'Responsable de logística polaco' }, doc: d('PASSPORT', 'EP4401872', 'Poland', '2030-12-12'), route: 'B', status: 'approved', level: 'basic', advanced: 'pending_review', awaitingOfficer: true, minutesAgo: 5, checks: [['chip_read', 'pass', undefined, 'Chip read'], ['chip_signature', 'pass', undefined, 'Valid signature'], ['document_validity', 'pass', undefined, 'In date'], ['liveness', 'pass', 0.97, 'Live person'], ['face_match', 'pass', 0.96, 'Matches chip photo'], ['residence', 'pass', undefined, 'Registered in Valencia']], flags: [{ code: 'advanced_level_review', severity: 'low', reason: { en: 'Advanced level always gets a human review', es: 'El nivel avanzado siempre lo revisa una persona' } }], risk: 'low' }),
]

const both = (s: string): Bilingual => ({ en: s, es: s })

/* ------------------------------------------------------- citizen accounts */

/**
 * Tiny deterministic hash (FNV-1a, 32-bit, hex) so the store never keeps passwords in plain text.
 * DEMO ONLY: this is not a secure password hash. Never reuse a real password in the prototype.
 */
export function demoHash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Normalises a typed document number for sign-in (case and spaces don't matter). */
export const normaliseDocNumber = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')

/**
 * Saved demo accounts for the 8 library personas: sign in with the document number + this password.
 * These credentials are documented ONLY in the README for the team. They must never be rendered in the UI.
 */
export const DEMO_ACCOUNT_PASSWORDS: Record<string, string> = {
  giulia: 'giulia-demo',
  daniel: 'daniel-demo',
  rafael: 'rafael-demo',
  noah: 'noah-demo',
  yusuf: 'yusuf-demo',
  deepfake: 'ivo-demo',
  fakedoc: 'hana-demo',
  linwei: 'linwei-demo',
}

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

function libraryAccount(c: { id: string; document: IdentityDocument }, at: string): CitizenAccount {
  return { caseId: c.id, documentNumber: c.document.number, passwordHash: demoHash(DEMO_ACCOUNT_PASSWORDS[c.id]), createdAt: at, origin: 'library' }
}

/**
 * Builds the initial state. Deterministic for a given `now`.
 * Library cases start as 'draft' (the citizen runs them). Background cases start mid-flow.
 */
export function buildSeedState(now: Date = new Date()): AppState {
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString()
  const cases: Record<string, Case> = {}

  for (const c of CASE_LIBRARY) {
    cases[c.id] = {
      ...c,
      answers: null,
      route: null,
      status: 'draft',
      level: 'none',
      advanced: 'not_requested',
      consentGiven: false,
      attempt: 0,
      checks: [],
      risk: 'low',
      flags: [],
      awaitingOfficer: false,
      decisions: [],
      correctedAfterRefusal: false,
      updatedAt: iso(0),
    }
  }

  const officer = OFFICERS[1]
  for (const b of BACKGROUND) {
    const at = iso(b.minutesAgo)
    const decisions: Case['decisions'] = []
    if (b.level === 'basic' || b.level === 'advanced') {
      decisions.push({ outcome: 'approved_basic', by: SYSTEM_ACTOR, at })
    }
    if (b.advanced === 'granted') {
      decisions.push({ outcome: 'approved_advanced', by: { kind: 'officer', id: officer.id, name: officer.name }, at })
    }
    if (b.refusedWith) {
      decisions.push({ outcome: 'refused', by: { kind: 'officer', id: officer.id, name: officer.name }, reasonId: b.refusedWith, at })
    }
    const answers: AssistantAnswers = {
      nationalityGroup: b.nationality === 'Spanish' ? 'spanish' : ['French', 'Portuguese', 'Swedish', 'Polish'].includes(b.nationality) ? 'eu' : 'non_eu',
      document: b.doc.type,
      hasEuEid: b.route === 'A',
      assisted: false,
    }
    cases[b.id] = {
      id: b.id,
      origin: 'background',
      persona: { name: b.name, age: b.age, nationality: b.nationality, initials: b.initials, hue: b.hue, profile: b.profile },
      document: b.doc,
      presetAnswers: answers,
      scenario: b.profile,
      demoBeat: both('Background case'),
      simulation: { attempts: [] },
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
      awaitingOfficer: b.awaitingOfficer || Boolean(b.appeal),
      decisions,
      infoRequest: b.infoRequest
        ? { message: b.infoRequest, at, by: { kind: 'officer', id: officer.id, name: officer.name } }
        : undefined,
      appeal: b.appeal ? { text: b.appeal, at, state: 'open' } : undefined,
      correctedAfterRefusal: false,
      submittedAt: at,
      updatedAt: at,
    }
  }

  const accounts: Record<string, CitizenAccount> = {}
  for (const c of CASE_LIBRARY) accounts[c.id] = libraryAccount(c, iso(0))

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

/** localStorage key and BroadcastChannel name. */
export const STORAGE_KEY = 'getyourclave.state.v1'
export const CHANNEL_NAME = 'getyourclave.sync'
