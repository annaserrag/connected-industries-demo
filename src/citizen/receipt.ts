/**
 * "Descargar justificante (PDF)": a one-page receipt built in the browser, no library and no network.
 * It always says it is an academic prototype with no official value.
 */
import type { Case, Lang } from '@/contract/types'
import { CHECKS, DOCUMENTS, ROUTES, statusLabel } from '@/contract/seed'

const T = (lang: Lang, en: string, es: string) => (lang === 'es' ? es : en)

/** PDF base fonts use WinAnsi: keep Latin-1, swap the few typographic characters we use. */
function latin1(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x00-\xFF]/g, '?')
}
const esc = (s: string) => latin1(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

/** Show only the last 3 characters of the document number. */
export function maskDocNumber(n: string): string {
  const v = n.replace(/\s+/g, '')
  return v.length <= 3 ? v : `${'•'.repeat(Math.max(3, v.length - 3))}${v.slice(-3)}`.replace(/•/g, '*')
}

export function receiptLines(c: Case, lang: Lang, now = new Date()): Array<{ text: string; size: number; bold?: boolean; gap?: number }> {
  const date = now.toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' })
  const level = c.advanced === 'granted' ? T(lang, 'Advanced', 'Avanzado') : c.level === 'none' ? T(lang, 'None', 'Ninguno') : T(lang, 'Basic', 'Básico')
  const lines: Array<{ text: string; size: number; bold?: boolean; gap?: number }> = [
    { text: 'Get your Cl@ve', size: 20, bold: true },
    { text: T(lang, 'Registration receipt', 'Justificante de registro'), size: 14, bold: true, gap: 8 },
    { text: T(lang, 'ACADEMIC PROTOTYPE OF IE UNIVERSITY - NOT AN OFFICIAL DOCUMENT, NO LEGAL VALUE', 'PROTOTIPO ACADÉMICO DE IE UNIVERSITY - NO ES UN DOCUMENTO OFICIAL NI TIENE VALIDEZ'), size: 9, bold: true, gap: 18 },
    { text: `${T(lang, 'Applicant', 'Solicitante')}: ${c.persona.name}`, size: 11 },
    { text: `${T(lang, 'Document', 'Documento')}: ${T(lang, DOCUMENTS[c.document.type].label.en, DOCUMENTS[c.document.type].label.es)} ${maskDocNumber(c.document.number)}`, size: 11 },
    { text: `${T(lang, 'Application number', 'Número de solicitud')}: ${c.id.toUpperCase()}`, size: 11 },
    { text: `${T(lang, 'Route', 'Vía')}: ${c.route ? `${ROUTES[c.route].code} - ${T(lang, ROUTES[c.route].name.en, ROUTES[c.route].name.es)}` : '-'}`, size: 11 },
    { text: `${T(lang, 'Status', 'Estado')}: ${(lang === 'es' ? statusLabel(c.status === 'draft' ? 'received' : c.status, c.advanced).es : statusLabel(c.status === 'draft' ? 'received' : c.status, c.advanced).en)}`, size: 11 },
    { text: `${T(lang, 'Access level', 'Nivel de acceso')}: ${level}`, size: 11 },
    { text: `${T(lang, 'Issued', 'Emitido')}: ${date}`, size: 11, gap: 16 },
    { text: T(lang, 'Checks carried out', 'Comprobaciones realizadas'), size: 12, bold: true, gap: 4 },
    ...c.checks.map(r => ({
      text: `- ${T(lang, CHECKS[r.id].label.en, CHECKS[r.id].label.es)}: ${r.outcome === 'pass' ? T(lang, 'passed', 'superada') : r.outcome === 'fail' ? T(lang, 'not passed', 'no superada') : r.outcome === 'warn' ? T(lang, 'reviewed by a person', 'revisada por una persona') : T(lang, 'pending', 'pendiente')}${r.score !== undefined ? ` (${r.score.toFixed(2)}, ${T(lang, 'simulated values', 'valores simulados')})` : ''}`,
      size: 10,
    })),
  ]
  lines.push({ text: '', size: 10, gap: 10 })
  lines.push({ text: T(lang, 'All people, documents and numbers in this prototype are fictional.', 'Todas las personas, documentos y números de este prototipo son ficticios.'), size: 9 })
  return lines
}

/** Build the PDF bytes (PDF 1.4, Helvetica / Helvetica-Bold, A4). */
export function buildReceiptPdf(c: Case, lang: Lang, now = new Date()): Uint8Array {
  let y = 790
  const ops: string[] = []
  for (const l of receiptLines(c, lang, now)) {
    if (l.text) ops.push(`BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf 56 ${y} Td (${esc(l.text)}) Tj ET`)
    y -= l.size + 6 + (l.gap ?? 0)
  }
  // orange rule under the title, like the site header
  ops.unshift('0.773 0.290 0.039 RG 2 w 56 742 m 539 742 l S')
  const stream = ops.join('\n')

  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${latin1(stream).length} >>\nstream\n${stream}\nendstream`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  const bin = latin1(out)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function downloadReceipt(c: Case, lang: Lang) {
  const blob = new Blob([buildReceiptPdf(c, lang) as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${lang === 'es' ? 'justificante' : 'receipt'}-${c.id}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
