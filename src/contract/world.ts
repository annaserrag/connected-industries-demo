/**
 * The simulated outside world (SPEC §1): the document registry (what a chip answers) and the residence
 * registry (what other public bodies' records say). Only WORLD FACTS live here, never outcomes: what a case
 * ends in is computed by the rules in src/core/engine.ts.
 *
 * Stated assumption (About page): for any other fictional document, the simulated registers answer as a
 * genuine, readable document and a matching residence record. So a brand-new account typed in live (Giulia)
 * is approved by the rules if nothing else fails.
 *
 * Every person and number is fictional. DNI/NIE-shaped numbers carry a deliberately wrong check letter.
 */
import type { Bilingual, DocumentType, HelperRelation, PersonData, TypedDocument, Who, YesNoUnsure } from './types'
import { fictionalDniNie, normaliseDocNumber } from './ids'

export interface ChipRecord {
  /** The phone can read it (false = damaged / shielded / blocked). */
  readable: boolean
  /** Passive-authentication signature validates against the issuing country's certificate. */
  signatureValid: boolean
  /** Name and date of birth stored in the chip. */
  data: PersonData
  expiry: string
  /**
   * Whether the photo stored in the chip is of the document's holder. Default true. false = the chip answers with
   * another person's record (e.g. a chip that does not belong to the printed card): a live face then matches it low.
   */
  photoMatchesHolder?: boolean
}

export interface DocumentRecord {
  type: DocumentType
  number: string
  nationality: string
  /** null = the document has no chip (red card, NIE paper). */
  chip: ChipRecord | null
}

export interface ResidenceRecord {
  data: PersonData
  municipality: string
}

const NO_CHIP: DocumentType[] = ['RED_CARD', 'NIE_PAPER']

/* -------------------------------------------------------- demo identifiers */

export const DEMO_NUMBERS = {
  kenji: fictionalDniNie('Y', 4126021),
  ernesto: fictionalDniNie('', 5218734),
  laura: fictionalDniNie('X', 9318254),
  mateo: fictionalDniNie('X', 9318277),
  daniel: 'VE1441730',
  anaCosta: 'CB2918470',
  rafael: fictionalDniNie('Y', 7350418),
  valentina: fictionalDniNie('Z', 1846203),
  giulia: 'CA48213KF',
} as const

/* --------------------------------------------------------- the registries */

/** Keyed by normalised document number. Only the documents whose world facts differ from the default, plus the plan's people. */
export const DOCUMENT_REGISTRY: Record<string, DocumentRecord> = {
  // GYC-02 Kenji Mori: TIE chip not readable (damaged / blocked by the case).
  [DEMO_NUMBERS.kenji]: {
    type: 'TIE', number: DEMO_NUMBERS.kenji, nationality: 'Japan',
    chip: { readable: false, signatureValid: true, data: { givenNames: 'Kenji', surnames: 'Mori', dateOfBirth: '2000-05-14' }, expiry: '2028-03-31' },
  },
  // GYC-03 Ernesto Navarro: DNI, normal.
  [DEMO_NUMBERS.ernesto]: {
    type: 'DNI', number: DEMO_NUMBERS.ernesto, nationality: 'Spain',
    chip: { readable: true, signatureValid: true, data: { givenNames: 'Ernesto', surnames: 'Navarro', dateOfBirth: '1946-02-03' }, expiry: '2031-06-30' },
  },
  // GYC-04 Laura Ruiz (guardian) and Mateo Ruiz (minor): TIE each, normal.
  [DEMO_NUMBERS.laura]: {
    type: 'TIE', number: DEMO_NUMBERS.laura, nationality: 'Argentina',
    chip: { readable: true, signatureValid: true, data: { givenNames: 'Laura', surnames: 'Ruiz', dateOfBirth: '1982-07-09' }, expiry: '2029-01-31' },
  },
  [DEMO_NUMBERS.mateo]: {
    type: 'TIE', number: DEMO_NUMBERS.mateo, nationality: 'Argentina',
    chip: { readable: true, signatureValid: true, data: { givenNames: 'Mateo', surnames: 'Ruiz', dateOfBirth: '2010-03-22' }, expiry: '2029-01-31' },
  },
  // GYC-05 Daniel Herrera: passport, normal (the red card is typed in the flow; it has no chip and no register).
  [DEMO_NUMBERS.daniel]: {
    type: 'PASSPORT', number: DEMO_NUMBERS.daniel, nationality: 'Venezuela',
    chip: { readable: true, signatureValid: true, data: { givenNames: 'Daniel', surnames: 'Herrera', dateOfBirth: '1992-10-05' }, expiry: '2030-05-20' },
  },
  // GYC-06 Ana Costa: genuine passport (the attack comes from the camera, not the document).
  [DEMO_NUMBERS.anaCosta]: {
    type: 'PASSPORT', number: DEMO_NUMBERS.anaCosta, nationality: 'Portugal',
    chip: { readable: true, signatureValid: true, data: { givenNames: 'Ana', surnames: 'Costa', dateOfBirth: '1985-01-27' }, expiry: '2032-09-14' },
  },
  // GYC-07 Rafael Duarte: chip readable, signature INVALID, chip data differs from the printed data, and the chip
  // photo is of another person's record (so the live face matches it low).
  [DEMO_NUMBERS.rafael]: {
    type: 'TIE', number: DEMO_NUMBERS.rafael, nationality: 'Brazil',
    chip: { readable: true, signatureValid: false, data: { givenNames: 'Rafael', surnames: 'Duarte Souza', dateOfBirth: '1988-03-14' }, expiry: '2030-11-30', photoMatchesHolder: false },
  },
  // GYC-08 Valentina Rojas Gómez: TIE, normal chip (her residence record is the odd one).
  [DEMO_NUMBERS.valentina]: {
    type: 'TIE', number: DEMO_NUMBERS.valentina, nationality: 'Colombia',
    chip: { readable: true, signatureValid: true, data: { givenNames: 'Valentina', surnames: 'Rojas Gómez', dateOfBirth: '1999-08-30' }, expiry: '2030-02-28' },
  },
}

/** Keyed by normalised document number. null = no record at all. Missing key = default (matching record). */
export const RESIDENCE_REGISTRY: Record<string, ResidenceRecord | null> = {
  // GYC-08: the residence record has only the first surname.
  [DEMO_NUMBERS.valentina]: { data: { givenNames: 'Valentina', surnames: 'ROJAS', dateOfBirth: '1999-08-30' }, municipality: 'Madrid' },
}

/* ------------------------------------------------------------- lookups */

/**
 * What the chip of a document answers. Registry hit → that record. Otherwise the DEFAULT: a genuine document,
 * chip readable, signature valid, chip data = typed data, expiry = typed expiry; red card / NIE paper → no chip.
 */
export function lookupDocument(typed: TypedDocument): DocumentRecord {
  const key = normaliseDocNumber(typed.number)
  const hit = DOCUMENT_REGISTRY[key]
  if (hit) return hit
  return {
    type: typed.type,
    number: typed.number,
    nationality: typed.nationality,
    chip: NO_CHIP.includes(typed.type)
      ? null
      : { readable: true, signatureValid: true, data: { ...typed.data }, expiry: typed.expiry },
  }
}

/**
 * What the residence registry says for this document number. Registry hit (may be null = no record).
 * Otherwise the DEFAULT: a record equal to the typed data, municipality Madrid.
 */
export function lookupResidence(docNumber: string, typed: PersonData): ResidenceRecord | null {
  const key = normaliseDocNumber(docNumber)
  if (Object.prototype.hasOwnProperty.call(RESIDENCE_REGISTRY, key)) return RESIDENCE_REGISTRY[key]
  return { data: { ...typed }, municipality: 'Madrid' }
}

/* --------------------------------------------------- typed demo data (README) */

export interface DemoPerson {
  /** Case id of the preloaded account (null = not preloaded, typed in live). */
  caseId: string | null
  caseRef: string
  caseLabel?: string
  /** What is typed at sign-up (and the password of the preloaded account). */
  account: {
    givenNames: string
    surnames: string
    dateOfBirth: string
    /** SIGNUP_COUNTRIES English name. */
    country: string
    documentType: DocumentType
    documentNumber: string
    expiryDate: string
    /** Six-digit CAN printed on a TIE (NFC chip access). */
    can?: string
    password: string
  }
  /** Route assistant answers the plan uses. */
  answers: { document: DocumentType | 'UNSURE'; euEid: YesNoUnsure | null; who: Who; nfc: YesNoUnsure | null }
  contact: { mobile: string; email?: string }
  helper?: { name: string; relation: HelperRelation; mobile: string }
  minor?: { givenNames: string; surnames: string; dateOfBirth: string; document: TypedDocument; email: string }
  /** Route X: passport typed in the flow, and the red card fields. */
  passport?: { number: string; expiry: string }
  redCard?: { number: string; expiryDaysFromNow: number }
  /** World facts, in one line. */
  facts: Bilingual
}

export const DEMO_PEOPLE: DemoPerson[] = [
  {
    caseId: null, caseRef: 'GYC-01',
    account: { givenNames: 'Giulia', surnames: 'Ferri', dateOfBirth: '2002-04-18', country: 'Italy', documentType: 'EU_EID', documentNumber: DEMO_NUMBERS.giulia, expiryDate: '2031-03-14', password: 'giulia-demo' },
    answers: { document: 'EU_EID', euEid: 'yes', who: 'self', nfc: null },
    contact: { mobile: '+34 600 000 001', email: 'giulia.ferri@example.org' },
    facts: { en: 'Not in the registry: default world (genuine document, matching residence record).', es: 'No está en el registro: mundo por defecto (documento auténtico, residencia coincidente).' },
  },
  {
    caseId: 'kenji', caseRef: 'GYC-02',
    account: { givenNames: 'Kenji', surnames: 'Mori', dateOfBirth: '2000-05-14', country: 'Japan', documentType: 'TIE', documentNumber: DEMO_NUMBERS.kenji, expiryDate: '2028-03-31', can: '482913', password: 'kenji-demo' },
    answers: { document: 'TIE', euEid: null, who: 'self', nfc: 'unsure' },
    contact: { mobile: '+34 600 000 003', email: 'kenji.mori@example.org' },
    facts: { en: 'TIE chip not readable (damaged or blocked).', es: 'El chip de la TIE no se puede leer (dañado o bloqueado).' },
  },
  {
    caseId: 'ernesto', caseRef: 'GYC-03',
    account: { givenNames: 'Ernesto', surnames: 'Navarro', dateOfBirth: '1946-02-03', country: 'Spain', documentType: 'DNI', documentNumber: DEMO_NUMBERS.ernesto, expiryDate: '2031-06-30', password: 'ernesto-demo' },
    answers: { document: 'DNI', euEid: null, who: 'helping', nfc: null },
    contact: { mobile: '+34 600 000 002' },
    helper: { name: 'Marta Navarro', relation: 'family', mobile: '+34 600 000 102' },
    facts: { en: 'DNI, normal. Lives in Madrid.', es: 'DNI, normal. Vive en Madrid.' },
  },
  {
    caseId: 'laura', caseRef: 'GYC-04',
    account: { givenNames: 'Laura', surnames: 'Ruiz', dateOfBirth: '1982-07-09', country: 'Argentina', documentType: 'TIE', documentNumber: DEMO_NUMBERS.laura, expiryDate: '2029-01-31', can: '719204', password: 'laura-demo' },
    answers: { document: 'TIE', euEid: null, who: 'child', nfc: 'yes' },
    contact: { mobile: '+34 600 000 004', email: 'laura.ruiz@example.org' },
    minor: {
      givenNames: 'Mateo', surnames: 'Ruiz', dateOfBirth: '2010-03-22', email: 'laura.ruiz@example.org',
      document: { type: 'TIE', number: DEMO_NUMBERS.mateo, expiry: '2029-01-31', nationality: 'Argentina', can: '719255', data: { givenNames: 'Mateo', surnames: 'Ruiz', dateOfBirth: '2010-03-22' } },
    },
    facts: { en: 'TIE each (mother and son), normal.', es: 'TIE cada uno (madre e hijo), normal.' },
  },
  {
    caseId: 'daniel', caseRef: 'GYC-05',
    account: { givenNames: 'Daniel', surnames: 'Herrera', dateOfBirth: '1992-10-05', country: 'Venezuela', documentType: 'PASSPORT', documentNumber: DEMO_NUMBERS.daniel, expiryDate: '2030-05-20', password: 'daniel-demo' },
    answers: { document: 'RED_CARD', euEid: null, who: 'self', nfc: 'yes' },
    contact: { mobile: '+34 600 000 005', email: 'daniel.herrera@example.org' },
    passport: { number: DEMO_NUMBERS.daniel, expiry: '2030-05-20' },
    redCard: { number: 'DEMO-0005', expiryDaysFromNow: 21 },
    facts: { en: 'Passport normal. The red card has no chip and no register: a person checks it.', es: 'Pasaporte normal. La tarjeta roja no tiene chip ni registro: la revisa una persona.' },
  },
  {
    caseId: 'applicant-x', caseRef: 'GYC-06', caseLabel: 'Applicant X',
    account: { givenNames: 'Ana', surnames: 'Costa', dateOfBirth: '1985-01-27', country: 'Portugal', documentType: 'PASSPORT', documentNumber: DEMO_NUMBERS.anaCosta, expiryDate: '2032-09-14', password: 'applicantx-demo' },
    answers: { document: 'PASSPORT', euEid: 'no', who: 'self', nfc: 'yes' },
    contact: { mobile: '+34 600 000 006' },
    facts: { en: "Ana Costa's genuine passport (lost on a train). The attack comes from the camera: choose 'Synthetic video'.", es: "Pasaporte auténtico de Ana Costa (perdido en un tren). El ataque viene de la cámara: elige «Vídeo sintético»." },
  },
  {
    caseId: 'rafael', caseRef: 'GYC-07',
    account: { givenNames: 'Rafael', surnames: 'Duarte', dateOfBirth: '1988-04-13', country: 'Brazil', documentType: 'TIE', documentNumber: DEMO_NUMBERS.rafael, expiryDate: '2030-11-30', can: '305871', password: 'rafael-demo' },
    answers: { document: 'TIE', euEid: null, who: 'self', nfc: 'yes' },
    contact: { mobile: '+34 600 000 007', email: 'rafael.duarte@example.org' },
    facts: { en: 'Chip readable, signature invalid; chip says DUARTE SOUZA, RAFAEL 1988-03-14, printed DUARTE, RAFAEL 1988-04-13.', es: 'Chip legible, firma no válida; el chip dice DUARTE SOUZA, RAFAEL 1988-03-14 y lo impreso DUARTE, RAFAEL 1988-04-13.' },
  },
  {
    caseId: 'valentina', caseRef: 'GYC-08',
    account: { givenNames: 'Valentina', surnames: 'Rojas Gómez', dateOfBirth: '1999-08-30', country: 'Colombia', documentType: 'TIE', documentNumber: DEMO_NUMBERS.valentina, expiryDate: '2030-02-28', can: '664128', password: 'valentina-demo' },
    answers: { document: 'TIE', euEid: null, who: 'self', nfc: 'yes' },
    contact: { mobile: '+34 600 000 008', email: 'valentina.rojas@example.org' },
    facts: { en: 'Residence record has only the first surname (ROJAS).', es: 'El registro de residencia solo tiene el primer apellido (ROJAS).' },
  },
]
