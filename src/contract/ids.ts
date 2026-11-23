/**
 * Fictional identifiers and tiny demo hash. No imports, so world.ts and seed.ts can both use it.
 *
 * Every DNI/NIE-shaped value in the app carries a WRONG check letter, so it can never be a real person's
 * number. Anything a user types in a DNI/NIE-shaped field must fail the real check-letter test.
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

/** Normalises a typed document number (case, spaces and dashes don't matter). */
export const normaliseDocNumber = (s: string) => (s ?? '').trim().toUpperCase().replace(/[\s-]+/g, '')

/** Upper case, no accents, single spaces: how names are compared between sources. */
export const normaliseName = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
