/**
 * Rules engine — pure and deterministic.
 *
 *   evaluate(case, now)          → the checks of SPEC §3, computed from the session inputs + the simulated world
 *   decide(case, now, stage)     → the rules of SPEC §4, in order, first match wins
 *
 * Nothing here is scripted per person: the same typed data with a different camera input or a different world
 * record ends somewhere else. Scores are simulated, deterministic from a hash of the document number.
 *
 * KEY RULE: this module can only APPROVE automatically, OFFER THE FALLBACK or SEND TO AN OFFICER. It has no
 * code path that refuses, revokes or sets 'not_approved'. Only officer actions in store.ts can.
 */
import type {
  Bilingual, CameraInput, Case, CheckId, CheckResult, DiscrepancyRow, FallbackReason, Flag, FlagCode, PersonData,
  RejId, RiskLevel, RouteId, TypedDocument,
} from '@/contract/types'
import { CHECKS, ENGINE, ROUTES, demoHash, fullName, isProposedRule, normaliseName } from '@/contract/seed'
import { HELPER_RELATION_LABELS } from '@/contract/messages'
import { lookupDocument, lookupResidence, type DocumentRecord } from '@/contract/world'

const b = (en: string, es: string): Bilingual => ({ en, es })

/* ============================================================ inputs → facts */

/** The document whose chip is read: route X → the passport; a minor → the minor's document; else the typed one. */
export function subjectDocument(c: Case): TypedDocument | null {
  if ((c.session.route ?? c.route) === 'X') return c.session.passport ?? null
  if (c.session.who === 'child') return c.session.minor?.document ?? null
  return c.typed
}

/** Printed data of the applicant (the minor when registering a child). */
export function subjectData(c: Case): PersonData {
  if (c.session.who === 'child' && c.session.minor) {
    const m = c.session.minor
    return { givenNames: m.givenNames, surnames: m.surnames, dateOfBirth: m.dateOfBirth }
  }
  return c.typed.data
}

/** Route whose checks apply (the assistant's route; the Fallback keeps the checks already done). */
export function baseRoute(c: Case): RouteId | null {
  return c.session.route ?? c.route
}

const FIELDS: Array<keyof PersonData> = ['givenNames', 'surnames', 'dateOfBirth']
const FIELD_LABEL: Record<keyof PersonData, Bilingual> = {
  givenNames: b('given names', 'nombre'),
  surnames: b('surnames', 'apellidos'),
  dateOfBirth: b('date of birth', 'fecha de nacimiento'),
}
export const fieldLabel = (f: keyof PersonData) => FIELD_LABEL[f]

/** Fields that differ between two sources (case, accents and spaces ignored). */
export function diffPerson(a: PersonData, bb: PersonData): Array<keyof PersonData> {
  return FIELDS.filter(f => normaliseName(a[f]) !== normaliseName(bb[f]))
}

/* ------------------------------------------------------- simulated camera */

export type AttemptResult = 'pass' | 'retry' | 'fail'

export interface FaceReading {
  camera: CameraInput
  result: AttemptResult
  liveness?: number
  faceMatch?: number
}

function h32(s: string): number {
  return parseInt(demoHash(s), 16)
}

/** Face-check attempt n (0-based) with this camera input, against the chip photo of `docNumber`. */
export function readFace(camera: CameraInput, docNumber: string, n: number): FaceReading {
  const h = h32(`${docNumber}:${n}`)
  const two = (x: number) => Math.round(x * 100) / 100
  if (camera === 'person') return { camera, result: 'pass', liveness: two(0.93 + (h % 5) / 100), faceMatch: two(0.93 + ((h >>> 4) % 5) / 100) }
  if (camera === 'synthetic') return { camera, result: 'fail', liveness: two(0.2 + (h % 10) / 100), faceMatch: two(0.6 + ((h >>> 4) % 10) / 100) }
  return { camera, result: 'retry' }
}

/** DNI video attempt (route C): person → pass, reflections → retry (MSG-VER-06), synthetic → fail. */
export function readVideo(camera: CameraInput): AttemptResult {
  return camera === 'person' ? 'pass' : camera === 'reflections' ? 'retry' : 'fail'
}

/* ============================================================ evaluate */

export interface Evaluation {
  route: RouteId | null
  checks: CheckResult[]
  /** Chip of the subject document. */
  chip: { doc: TypedDocument; record: DocumentRecord; last: 'ok' | 'failed' | null; failures: number; ok: boolean } | null
  printedDiff: Array<keyof PersonData>
  face: { readings: FaceReading[]; last: FaceReading | null; notPassing: number; anySynthetic: boolean }
  video: { results: AttemptResult[]; last: AttemptResult | null; notPassing: number }
  residence: { state: 'match' | 'mismatch' | 'not_found' | 'no_consent' | 'not_run'; fields: Array<keyof PersonData>; municipality?: string }
  expired: boolean
  expiry: string | null
  discrepancies: DiscrepancyRow[]
}

const today = (now: Date) => now.toISOString().slice(0, 10)
const upper = (s: string) => normaliseName(s)

function check(id: CheckId, outcome: CheckResult['outcome'], detail: Bilingual, extra: Partial<CheckResult> = {}): CheckResult {
  return { id, outcome, detail, ...extra }
}

/** The checks of SPEC §3 for this case, from what the citizen did so far. Pure. */
export function evaluate(c: Case, now: Date = new Date()): Evaluation {
  const s = c.session
  const route = baseRoute(c)
  const doc = subjectDocument(c)
  const printed = subjectData(c)
  const usesChip = route === 'B' || route === 'X' || (route === 'F' && s.chipReads.length > 0)

  /* chip */
  let chip: Evaluation['chip'] = null
  let printedDiff: Array<keyof PersonData> = []
  if (doc && usesChip) {
    const record = lookupDocument(doc)
    const last = s.chipReads.length ? s.chipReads[s.chipReads.length - 1] : null
    const failures = s.chipReads.filter(x => x === 'failed').length
    const ok = last === 'ok' && Boolean(record.chip)
    chip = { doc, record, last, failures, ok }
    if (ok && record.chip) printedDiff = diffPerson(doc.data, record.chip.data)
  }

  /* face (route B / X / minor) */
  const faceDoc = doc?.number ?? c.typed.number
  const readings = s.faceAttempts.map((cam, i) => readFace(cam, faceDoc, i))
  const lastFace = readings.length ? readings[readings.length - 1] : null
  const face = { readings, last: lastFace, notPassing: readings.filter(r => r.result !== 'pass').length, anySynthetic: s.faceAttempts.includes('synthetic') }

  /* DNI video (route C) */
  const vres = s.videoAttempts.map(readVideo)
  const video = { results: vres, last: vres.length ? vres[vres.length - 1] : null, notPassing: vres.filter(r => r !== 'pass').length }

  /* expiry: chip expiry when the chip was read, else the typed one */
  const expiry = chip?.ok && chip.record.chip ? chip.record.chip.expiry : doc?.expiry ?? null
  const expired = Boolean(expiry && expiry < today(now))

  /* residence: compared with the chip data when read, else the typed data */
  const discrepancies: DiscrepancyRow[] = []
  let residence: Evaluation['residence'] = { state: 'not_run', fields: [] }
  const compareWith: PersonData = chip?.ok && chip.record.chip ? chip.record.chip.data : printed
  if (route !== 'X' && route !== 'F' && doc) {
    // Route C is today's DNI route: without the residence consent the check is simply not part of it.
    if (!s.consents.residence) residence = { state: route === 'C' ? 'not_run' : 'no_consent', fields: [] }
    else {
      const rec = lookupResidence(doc.number, compareWith)
      if (!rec) residence = { state: 'not_found', fields: [] }
      else {
        const fields = diffPerson(compareWith, rec.data)
        residence = { state: fields.length ? 'mismatch' : 'match', fields, municipality: rec.municipality }
        for (const f of fields) discrepancies.push({ field: f, document: upper(compareWith[f]), records: upper(rec.data[f]), source: 'residence' })
      }
    }
  }
  if (chip?.ok && chip.record.chip) {
    for (const f of printedDiff) discrepancies.push({ field: f, document: upper(doc!.data[f]), records: upper(chip.record.chip.data[f]), source: 'chip' })
  }

  /* ---- rows, in route order ---- */
  const checks: CheckResult[] = []
  const ids: CheckId[] = route ? [...ROUTES[route].checks] : []
  if (route === 'F' && s.chipReads.length) ids.unshift('chip_read')
  if (route === 'F' && s.faceAttempts.length) ids.splice(ids.indexOf('officer_video'), 0, 'liveness', 'face_match')
  if (s.who === 'child' && !ids.includes('guardian_link')) ids.push('guardian_link')
  if ((s.fallback || s.videoCall) && !ids.includes('officer_video')) ids.push('officer_video')
  const docLabel = doc ? `${doc.nationality} ${doc.type === 'TIE' ? 'TIE' : doc.type === 'PASSPORT' ? 'passport' : doc.type}` : ''

  for (const id of ids) {
    switch (id) {
      case 'eidas_login':
        checks.push(s.eidLogin
          ? check(id, 'pass', b(`Identity confirmed by the national eID (${c.typed.nationality}) through eIDAS`, `Identidad confirmada por la identidad electrónica nacional (${c.typed.nationality}) a través de eIDAS`))
          : check(id, 'pending', b('Not logged in yet', 'Aún no ha iniciado sesión')))
        break
      case 'chip_read':
        if (!chip || chip.last === null) checks.push(check(id, 'pending', b('Chip not read yet', 'Chip aún no leído')))
        else if (!chip.record.chip) checks.push(check(id, 'skipped', b('Document has no chip', 'El documento no tiene chip')))
        else if (chip.ok) checks.push(check(id, 'pass', b(`Chip read (${docLabel})${chip.failures ? ` after ${chip.failures} failed attempt${chip.failures > 1 ? 's' : ''}` : ''}`, `Chip leído (${docLabel})${chip.failures ? ` tras ${chip.failures} intento${chip.failures > 1 ? 's' : ''} fallido${chip.failures > 1 ? 's' : ''}` : ''}`)))
        else checks.push(check(id, 'fail', b(`Chip could not be read (${chip.failures} attempt${chip.failures > 1 ? 's' : ''})`, `No se pudo leer el chip (${chip.failures} intento${chip.failures > 1 ? 's' : ''})`)))
        break
      case 'chip_signature':
        if (!chip?.ok || !chip.record.chip) checks.push(check(id, 'skipped', b('Not possible without reading the chip', 'No es posible sin leer el chip')))
        else checks.push(chip.record.chip.signatureValid
          ? check(id, 'pass', b('Valid signature from the issuing country', 'Firma válida del país emisor'))
          : check(id, 'fail', b('Security signature does not validate against the issuing country', 'La firma de seguridad no se valida con el país emisor')))
        break
      case 'printed_vs_chip':
        if (!chip?.ok) checks.push(check(id, 'skipped', b('Not possible without reading the chip', 'No es posible sin leer el chip')))
        else checks.push(printedDiff.length
          ? check(id, 'fail', b(`Printed data differs from the chip: ${printedDiff.map(f => FIELD_LABEL[f].en).join(', ')}`, `Los datos impresos difieren del chip: ${printedDiff.map(f => FIELD_LABEL[f].es).join(', ')}`), { fields: printedDiff })
          : check(id, 'pass', b('Printed data matches the chip', 'Los datos impresos coinciden con el chip')))
        break
      case 'document_validity':
        if (!expiry) checks.push(check(id, 'pending', b('No expiry date yet', 'Sin fecha de caducidad')))
        else checks.push(expired
          ? check(id, 'fail', b(`Document expired on ${expiry}`, `Documento caducado el ${expiry}`))
          : check(id, 'pass', b(`In date until ${expiry}`, `En vigor hasta el ${expiry}`)))
        break
      case 'liveness':
        if (!face.last) checks.push(check(id, chip && !chip.ok && chip.failures >= 2 ? 'skipped' : 'pending', b('No face attempt yet', 'Sin intento de comprobación facial')))
        else if (face.last.result === 'pass') checks.push(check(id, 'pass', b('Live person in front of the camera', 'Persona real ante la cámara'), { score: face.last.liveness }))
        else if (face.last.result === 'retry') checks.push(check(id, 'warn', b('Live-person check incomplete (low light or reflections)', 'Comprobación de persona real incompleta (poca luz o reflejos)')))
        else checks.push(check(id, 'fail', b('Live-person check failed: no depth, replay pattern', 'Comprobación de persona real fallida: sin profundidad, patrón de reproducción'), { score: face.last.liveness }))
        break
      case 'face_match':
        if (!face.last) checks.push(check(id, chip && !chip.ok && chip.failures >= 2 ? 'skipped' : 'pending', b('No face attempt yet', 'Sin intento de comprobación facial')))
        else if (face.last.result === 'pass') checks.push(check(id, 'pass', b('Matches the chip photo', 'Coincide con la foto del chip'), { score: face.last.faceMatch }))
        else if (face.last.result === 'retry') checks.push(check(id, 'skipped', b('No score: the live-person check did not complete', 'Sin puntuación: la comprobación de persona real no terminó')))
        else checks.push(check(id, 'fail', b('Low match with the chip photo', 'Coincidencia baja con la foto del chip'), { score: face.last.faceMatch }))
        break
      case 'dni_video':
        if (!video.last) checks.push(check(id, 'pending', b('No video yet', 'Sin vídeo')))
        else checks.push(video.last === 'pass'
          ? check(id, 'pass', b(`DNI video identification completed${video.notPassing ? ` (attempt ${video.results.length})` : ''}`, `Videoidentificación con DNI completada${video.notPassing ? ` (intento ${video.results.length})` : ''}`))
          : video.last === 'retry'
            ? check(id, 'warn', b('Document not seen clearly (reflections): retry', 'Documento no visto con claridad (reflejos): repetir'))
            : check(id, 'fail', b('Video did not show a live person', 'El vídeo no mostró a una persona real')))
        break
      case 'residence':
        if (residence.state === 'no_consent') checks.push(check(id, 'skipped', b('Not checked: no consent (an officer checks it)', 'Sin comprobar: no hay consentimiento (lo revisa una persona)')))
        else if (residence.state === 'match') checks.push(check(id, 'pass', b(`Residence record matched (${residence.municipality})`, `Registro de residencia coincidente (${residence.municipality})`)))
        else if (residence.state === 'not_found') checks.push(check(id, 'fail', b('No residence record found', 'No se ha encontrado registro de residencia')))
        else if (residence.state === 'mismatch') checks.push(check(id, 'fail', b(`Residence record differs: ${residence.fields.map(f => FIELD_LABEL[f].en).join(', ')}`, `El registro de residencia difiere: ${residence.fields.map(f => FIELD_LABEL[f].es).join(', ')}`), { fields: residence.fields }))
        else if (route === 'C' && !s.consents.residence) checks.push(check(id, 'skipped', b('Not part of the DNI route without the residence consent', 'No forma parte de la vía con DNI sin el consentimiento de residencia')))
        else checks.push(check(id, 'pending', b('Not checked yet', 'Aún sin comprobar')))
        break
      case 'guardian_link':
        checks.push(s.uploads.proof
          ? check(id, 'pending', b(`Proof of parental authority uploaded${s.guardianChecks === 'passed' ? '; guardian chip and face passed' : ''}: a person checks it`, `Acreditación de patria potestad subida${s.guardianChecks === 'passed' ? '; chip y cara de la madre, padre o tutor superados' : ''}: la revisa una persona`))
          : check(id, 'pending', b('No proof of parental authority yet', 'Aún sin acreditación de patria potestad')))
        break
      case 'red_card': {
        const rc = s.uploads.redCard
        checks.push(rc
          ? check(id, 'pending', b(`Red card ${rc.number}, expires ${rc.expiry}: a person checks it`, `Tarjeta roja ${rc.number}, caduca el ${rc.expiry}: la revisa una persona`))
          : check(id, 'pending', b('Red card not uploaded yet', 'Tarjeta roja aún no subida')))
        break
      }
      case 'officer_video': {
        const v = s.videoCall
        if (v?.state === 'ended') checks.push(check(id, 'pass', b(`Video call held by ${v.officerName ?? 'an officer'}`, `Videollamada realizada por ${v.officerName ?? 'una persona'}`)))
        else if (v?.state === 'live') checks.push(check(id, 'pending', b(`Video call live with ${v.officerName ?? 'an officer'}`, `Videollamada en curso con ${v.officerName ?? 'una persona'}`)))
        else if (v?.state === 'waiting') checks.push(check(id, 'pending', b('Citizen waiting in the video-call room', 'La persona espera en la sala de videollamada')))
        else checks.push(check(id, 'pending', b('Video call not joined', 'Videollamada no iniciada')))
        break
      }
    }
  }
  return { route, checks, chip, printedDiff, face, video, residence, expired, expiry, discrepancies }
}

/* ============================================================== decide */

export type Stage = 'flow' | 'submit'

export interface RuleResult {
  /** continue = nothing decided yet (flow stage). */
  kind: 'continue' | 'fallback' | 'to_officer' | 'auto_basic'
  ruleId: string | null
  fallback?: FallbackReason
  checks: CheckResult[]
  flags: Flag[]
  risk: RiskLevel
  /** Officer-facing sentence (never shown to the citizen). */
  aiReason?: Bilingual
  discrepancies: DiscrepancyRow[]
  suggestedReason?: RejId
  /** Route B / C: the advanced level goes to review after the basic level. */
  advancedReview: boolean
  /** MSG ids the citizen sees. */
  citizenMsgs: string[]
  evidence: CheckId[]
  proposedRule: boolean
  /** EN line for the audit trail. */
  auditText: string
}

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 }
export function riskOf(flags: Flag[]): RiskLevel {
  return flags.reduce<RiskLevel>((acc, f) => (RANK[f.severity] > RANK[acc] ? f.severity : acc), 'low')
}
const flag = (code: FlagCode, severity: RiskLevel, reason: Bilingual): Flag => ({ code, severity, reason })

export const ADVANCED_REVIEW_FLAG: Flag = flag('advanced_level_review', 'low', b('Advanced level always gets a human review', 'El nivel avanzado siempre lo revisa una persona'))

const NUM_WORD: Bilingual[] = [b('no', 'ningún'), b('one', 'un'), b('two', 'dos'), b('three', 'tres'), b('four', 'cuatro')]
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const listEn = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const listEs = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)
/** "name" for given names / surnames, "date of birth". */
function fieldsPhrase(fields: Array<keyof PersonData>): Bilingual {
  const en: string[] = [], es: string[] = []
  if (fields.includes('givenNames') || fields.includes('surnames')) { en.push('name'); es.push('nombre') }
  if (fields.includes('dateOfBirth')) { en.push('date of birth'); es.push('fecha de nacimiento') }
  return b(listEn(en), listEs(es))
}

export function isAssisted(c: Case): boolean {
  return c.session.who === 'helping' || Boolean(c.answers?.assisted)
}
export function hadRefusal(c: Case): boolean {
  return c.decisions.some(d => d.outcome === 'refused' || d.outcome === 'revoked')
}
export function isPolicyProposal(c: Case): boolean {
  return isProposedRule(c.route, c.answers ? { ...c.answers, who: c.session.who } : null)
}

/**
 * The rules of SPEC §4, in order; first match wins. In the 'flow' stage (while the citizen is still doing the
 * checks) only rules 1–5 can fire; at 'submit' all of them. Never returns a refusal.
 */
export function decide(c: Case, now: Date = new Date(), stage: Stage = 'submit'): RuleResult {
  const e = evaluate(c, now)
  const s = c.session
  const route = e.route
  const proposedRule = isPolicyProposal(c)
  const flags: Flag[] = []
  const evidence = e.checks.filter(k => k.outcome === 'pass' || k.outcome === 'fail' || k.outcome === 'warn').map(k => k.id)

  /* ---- context flags ---- */
  if (isAssisted(c) && s.helper) {
    const rel = HELPER_RELATION_LABELS[s.helper.relation]
    flags.push(flag('assisted_shared_device', 'low', b(`Assisted session: helped by ${s.helper.name} (${rel.en.toLowerCase()}); the applicant confirmed in person and the SMS was confirmed from the applicant's own number`, `Sesión asistida: ayuda ${s.helper.name} (${rel.es.toLowerCase()}); la persona confirmó en persona y el SMS se confirmó desde su propio número`)))
  }
  if (proposedRule) flags.push(flag('policy_proposal_route', 'low', b('Proposed rule, not in force today', 'Norma propuesta, aún no vigente')))

  const base = (kind: RuleResult['kind'], ruleId: string | null, extra: Partial<RuleResult>): RuleResult => {
    const all = [...flags, ...(extra.flags ?? [])]
    return {
      kind, ruleId, checks: e.checks, discrepancies: e.discrepancies, advancedReview: false, citizenMsgs: [], evidence, proposedRule,
      auditText: '', ...extra, flags: all, risk: riskOf(all),
    }
  }

  /* 1. Consent declined → no checks; MSG-CON-06; video call = Fallback. */
  if (s.consents.declined) {
    return base('fallback', 'CONSENT-DECLINED', {
      fallback: 'consent', checks: [], evidence: [],
      flags: [flag('consent_declined', 'medium', b('Consent declined: no automatic checks; video call offered', 'Consentimiento no aceptado: sin comprobaciones automáticas; se ofrece videollamada'))],
      aiReason: b('The citizen did not consent to the checks. Identity can only be confirmed on a video call.', 'La persona no aceptó las comprobaciones. Su identidad solo puede confirmarse por videollamada.'),
      citizenMsgs: ['CON-06'],
      auditText: 'Consent declined: no checks run; video call with an officer offered (rule CONSENT-DECLINED)',
    })
  }

  /* 2. Chip read failed twice (route B / X / minor). */
  if (e.chip && !e.chip.ok && e.chip.failures >= ENGINE.maxAttemptsBeforeFallback && e.chip.last === 'failed') {
    const reason = b('Chip could not be read twice; document integrity not verified', 'El chip no se pudo leer dos veces; integridad del documento no verificada')
    return base('fallback', 'CHIP-TWICE', {
      fallback: 'chip', flags: [flag('chip_unreadable', 'medium', reason)], aiReason: reason,
      citizenMsgs: ['STA-3', 'VER-04', 'FALL-01'], evidence: ['chip_read'],
      auditText: `Chip read failed ${e.chip.failures} times (${e.chip.doc.nationality} ${e.chip.doc.type}): video call with an officer offered, risk medium (rule CHIP-TWICE)`,
    })
  }

  /* 3. NFC "No", or document "I am not sure" → Fallback from the start. */
  if (route === 'F') {
    const why = c.answers?.documentUnsure ? b('the citizen did not know which document to use', 'la persona no sabía qué documento usar') : b('the phone has no NFC', 'el móvil no tiene NFC')
    const reason = b(`No automatic route: ${why.en}. Identity is confirmed on a video call.`, `Sin vía automática: ${why.es}. La identidad se confirma por videollamada.`)
    return base('fallback', 'NO-NFC', {
      fallback: 'no_nfc', flags: [flag('no_nfc', 'medium', reason)], aiReason: reason, citizenMsgs: ['RA-07F'],
      auditText: `Route F: ${why.en}; video call with an officer (rule NO-NFC)`,
    })
  }

  /* 4. Face check (or DNI video) failed twice. */
  const faceTwice = e.face.notPassing >= ENGINE.maxAttemptsBeforeFallback && e.face.last?.result !== 'pass'
  const videoTwice = e.video.notPassing >= ENGINE.maxAttemptsBeforeFallback && e.video.last !== 'pass'
  if (faceTwice || videoTwice) {
    const synthetic = faceTwice ? e.face.anySynthetic : c.session.videoAttempts.includes('synthetic')
    const n = faceTwice ? e.face.readings.length : e.video.results.length
    const chipNote = e.chip?.ok && e.chip.record.chip?.signatureValid
    const reason = synthetic
      ? b('The live-person check failed on every attempt and the face match stayed low. The document itself is genuine.', 'La comprobación de persona real falló en todos los intentos y la coincidencia facial siguió baja. El documento en sí es auténtico.')
      : b(`The face check could not be completed on ${n} attempts (low light or reflections).${chipNote ? ' The document chip was read and is valid.' : ''}`, `La comprobación facial no se pudo completar en ${n} intentos (poca luz o reflejos).${chipNote ? ' El chip del documento se leyó y es válido.' : ''}`)
    const ff: Flag[] = [flag('low_liveness', synthetic ? 'high' : 'medium', reason)]
    if (synthetic) ff.push(flag('low_face_match', 'medium', b(`Face match stayed below ${ENGINE.faceMatchMin.toFixed(2)} (simulated values)`, `La coincidencia facial siguió por debajo de ${ENGINE.faceMatchMin.toFixed(2).replace('.', ',')} (valores simulados)`)))
    return base('fallback', 'FACE-TWICE', {
      fallback: 'face', flags: ff, aiReason: reason, suggestedReason: synthetic ? 'REJ-07' : 'REJ-03',
      citizenMsgs: ['STA-3', 'FALL-01'], evidence: faceTwice ? ['liveness', 'face_match'] : ['dni_video'],
      auditText: `${faceTwice ? 'Face check' : 'DNI video'} not passed on ${n} attempts (camera: ${(faceTwice ? s.faceAttempts : s.videoAttempts).join(', ')}): video call offered, risk ${synthetic ? 'high' : 'medium'} (rule FACE-TWICE)`,
    })
  }

  /* 5. Chip signature invalid or printed ≠ chip → officer, High, MSG-VER-07. */
  if (e.chip?.ok && e.chip.record.chip && (!e.chip.record.chip.signatureValid || e.printedDiff.length)) {
    const sigBad = !e.chip.record.chip.signatureValid
    const fp = fieldsPhrase(e.printedDiff)
    const plural = e.printedDiff.some(f => f === 'dateOfBirth') && e.printedDiff.some(f => f !== 'dateOfBirth')
    const reason = sigBad && e.printedDiff.length
      ? b(`The chip answered but its security signature is not valid, and the ${fp.en} on the chip ${plural ? 'differ' : 'differs'} from the printed ${fp.en}.`, `El chip respondió pero su firma de seguridad no es válida, y ${plural ? 'el nombre y la fecha de nacimiento del chip difieren' : `el dato del chip (${fp.es}) difiere`} de lo impreso.`)
      : sigBad
        ? b('The chip answered but its security signature is not valid.', 'El chip respondió pero su firma de seguridad no es válida.')
        : b(`The chip signature is valid, but the ${fp.en} on the chip ${plural ? 'differ' : 'differs'} from the printed ${fp.en}.`, `La firma del chip es válida, pero ${fp.es} del chip ${plural ? 'difieren' : 'difiere'} de lo impreso.`)
    const ff: Flag[] = []
    if (sigBad) ff.push(flag('chip_signature_failed', 'high', reason))
    if (e.printedDiff.length) ff.push(flag('printed_vs_chip_mismatch', 'high', b(`Printed data differs from the chip: ${fp.en}`, `Datos impresos distintos del chip: ${fp.es}`)))
    return base('to_officer', 'CHIP-INTEGRITY', {
      flags: ff, aiReason: reason, suggestedReason: 'REJ-06', citizenMsgs: ['STA-2', 'VER-07'], evidence: ['chip_signature', 'printed_vs_chip'],
      auditText: `Chip read: ${sigBad ? 'signature invalid' : 'signature valid'}${e.printedDiff.length ? `, printed data differs from chip (${e.printedDiff.join(', ')})` : ''}: sent to an officer, risk high (rule CHIP-INTEGRITY)`,
    })
  }

  if (stage === 'flow') return base('continue', null, {})

  /* 6. Document expired → officer, Medium, REJ-01. */
  if (e.expired) {
    const reason = b(`The document expired on ${e.expiry}. Other checks are shown below.`, `El documento caducó el ${e.expiry}. El resto de comprobaciones aparecen debajo.`)
    return base('to_officer', 'DOC-EXPIRED', {
      flags: [flag('document_invalid', 'medium', reason)], aiReason: reason, suggestedReason: 'REJ-01', citizenMsgs: ['STA-2'], evidence: ['document_validity'],
      auditText: `Document expired on ${e.expiry}: sent to an officer, risk medium (rule DOC-EXPIRED)`,
    })
  }

  /* 7. Residence: not found → REJ-04; mismatch → REJ-05 with the discrepancy table; no consent → officer. */
  if (e.residence.state === 'not_found' || e.residence.state === 'no_consent') {
    const nf = e.residence.state === 'not_found'
    const reason = nf
      ? b('No residence record was found for this document. Other checks passed.', 'No se ha encontrado registro de residencia para este documento. El resto de comprobaciones se superaron.')
      : b('Residence was not checked because the citizen did not consent. Other checks passed.', 'La residencia no se comprobó porque la persona no dio su consentimiento. El resto de comprobaciones se superaron.')
    return base('to_officer', 'RES-NOT-FOUND', {
      flags: [flag('residence_not_found', 'medium', reason)], aiReason: reason, suggestedReason: 'REJ-04', citizenMsgs: ['STA-2'], evidence: ['residence'],
      auditText: `${nf ? 'No residence record found' : 'Residence not checked (no consent)'}: sent to an officer, risk medium (rule RES-NOT-FOUND)`,
    })
  }
  if (e.residence.state === 'mismatch') {
    const rows = e.discrepancies.filter(d => d.source === 'residence')
    const sur = rows.find(r => r.field === 'surnames')
    const source = e.chip?.ok ? b('chip', 'chip') : b('document', 'documento')
    const reason = sur && rows.length === 1
      ? b(`The name in the residence record has ${NUM_WORD[Math.min(4, words(sur.records))].en} surname${words(sur.records) === 1 ? '' : 's'}; the ${source.en} has ${NUM_WORD[Math.min(4, words(sur.document))].en}. Other checks passed`, `El nombre del registro de residencia tiene ${NUM_WORD[Math.min(4, words(sur.records))].es} apellido${words(sur.records) === 1 ? '' : 's'}; el del ${source.es} tiene ${NUM_WORD[Math.min(4, words(sur.document))].es}. El resto de comprobaciones se superaron`)
      : b(`The residence record differs from the ${source.en} in: ${listEn(rows.map(r => FIELD_LABEL[r.field].en))}. Other checks passed.`, `El registro de residencia difiere del ${source.es} en: ${listEs(rows.map(r => FIELD_LABEL[r.field].es))}. El resto de comprobaciones se superaron.`)
    return base('to_officer', 'RES-MISMATCH', {
      flags: [flag('residence_mismatch', 'medium', reason)], aiReason: reason, suggestedReason: 'REJ-05', citizenMsgs: ['STA-2'], evidence: ['residence'],
      auditText: `Residence record differs (${rows.map(r => `${r.field}: ${r.document} / ${r.records}`).join('; ')}): sent to an officer, risk medium (rule RES-MISMATCH)`,
    })
  }

  /* 8. Minor → always officer (proof check). */
  if (s.who === 'child') {
    const reason = b('Minor: proof of parental authority to check', 'Menor: acreditación de patria potestad por revisar')
    return base('to_officer', 'MINOR', {
      flags: [flag('minor_with_guardian', 'medium', reason)], aiReason: reason, suggestedReason: 'REJ-08', citizenMsgs: ['STA-2'], evidence: [...evidence, 'guardian_link'],
      auditText: `Minor (${fullName(subjectData(c))}) registered by ${fullName(c.typed.data)}: chip, face and residence checks done; proof of parental authority to check, risk medium (rule MINOR)`,
    })
  }

  /* 9. Route X → always officer. */
  if (route === 'X') {
    const reason = b('Red card cannot be verified automatically; passport chip and face match passed', 'La tarjeta roja no se puede verificar automáticamente; el chip del pasaporte y la coincidencia facial se superaron')
    return base('to_officer', 'RED-CARD', {
      flags: [flag('red_card_check', 'medium', reason)], aiReason: reason, citizenMsgs: ['STA-2'], evidence: [...evidence, 'red_card'],
      auditText: `Route X (proposed rule): passport chip and face passed; red card ${s.uploads.redCard?.number ?? '(not uploaded)'} to check, risk medium (rule RED-CARD)`,
    })
  }

  /* 10. All passed → automatic basic level. */
  const ruleId = route === 'A' ? 'A-OK' : route === 'C' ? 'C-OK' : 'B-OK'
  const advancedReview = route === 'B' || route === 'C'
  const parts: string[] = [`Route ${route}`]
  if (route === 'A') parts.push(`eID verified (${c.typed.nationality})`)
  if (route === 'B' && e.chip) parts.push(`chip read and signature valid (${e.chip.doc.nationality} ${e.chip.doc.type === 'PASSPORT' ? 'passport' : e.chip.doc.type})`, 'face check passed')
  if (route === 'C') parts.push(`DNI video passed${e.video.results.length > 1 ? ` on attempt ${e.video.results.length}` : ''}`)
  if (e.residence.state === 'match') parts.push('residence record matched')
  parts.push(advancedReview ? 'basic level; advanced level queued for review' : 'basic level')
  if (isAssisted(c) && s.helper) parts.push(`assisted session (helper ${s.helper.name}, ${s.helper.relation})`)
  return base('auto_basic', ruleId, {
    advancedReview,
    flags: advancedReview ? [ADVANCED_REVIEW_FLAG] : [],
    aiReason: advancedReview ? b('Basic level granted automatically; the advanced level always gets a human review.', 'Nivel básico concedido automáticamente; el nivel avanzado siempre lo revisa una persona.') : undefined,
    citizenMsgs: [advancedReview ? 'STA-4B' : 'STA-4'],
    auditText: `Approved automatically: ${parts.join(', ')} (rule ${ruleId})`,
  })
}

/** Labels for checks (re-exported for UIs). */
export const checkLabel = (id: CheckId) => CHECKS[id].label
