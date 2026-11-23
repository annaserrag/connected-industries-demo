/* Case-detail sections for the rules-driven case view (SPEC §6). Everything shown comes from the case state and
   the pure engine (evaluate): checks, attempts, printed vs chip, discrepancies, uploads, assisted details. */
import { useState, type ReactNode } from 'react'
import {
  Baby, BadgeCheck, Ban, Camera, CircleAlert, ClipboardCheck, Cpu, CreditCard, FileImage, Fingerprint, HandHelping,
  ListChecks, MessageSquareText, Phone, Scale, ScanFace, Sparkles, Table2, Undo2,
} from 'lucide-react'
import type { Bilingual, CameraInput, Case, CheckResult, PersonData, Upload } from '@/contract/types'
import { CHECKS, DECISION_RULES, REJECTION_REASONS } from '@/contract/seed'
import { CAMERA_CONTROL, HELPER_RELATION_LABELS } from '@/contract/messages'
import { lookupResidence } from '@/contract/world'
import { evaluate, readFace, subjectData, subjectDocument, type Evaluation } from '@/core/engine'
import { SimulatedValuesNote, cn } from '@/ui'
import { C, DECISION_LABEL, K, OUTCOME_LABEL } from '../copy'
import { daysUntil, effectiveOutcome, fill, formatDate, formatDateTime, officerName, RISK_RANK, SCORED, useLang, useTr } from '../lib'
import { CheckIcon, Dialog, Panel, RiskTag } from './ui'

const PERSON_FIELDS: Array<keyof PersonData> = ['givenNames', 'surnames', 'dateOfBirth']
const FIELD_LABEL: Record<keyof PersonData, Bilingual> = { givenNames: K.givenNames, surnames: K.surnames, dateOfBirth: K.dateOfBirth }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const fullName = (d: PersonData) => `${d.surnames.toUpperCase()}, ${d.givenNames.toUpperCase()}`

export function useEvaluation(c: Case): Evaluation | null {
  try { return evaluate(c) } catch { return null }
}

/* ------------------------------------------------------------- AI reason */
export function AiReasonBox({ c }: { c: Case }) {
  const tr = useTr()
  const rule = c.ruleId ? DECISION_RULES.find(r => r.id === c.ruleId) : undefined
  const flags = [...c.flags].sort((a, b) => RISK_RANK[a.severity] - RISK_RANK[b.severity])
  const others = flags.filter(f => !c.aiReason || (f.reason.en !== c.aiReason.en && f.code !== 'advanced_level_review'))
  const tone = c.risk === 'high' ? 'danger' : c.risk === 'medium' ? 'warning' : 'default'
  return (
    <Panel id="ai-reason" title={tr(K.aiReason)} icon={<Sparkles className="size-4" />} hint={tr(K.aiReasonHint)} tone={tone}>
      <div data-testid="ai-reason" className={cn('rounded-[2px] border-l-4 p-4', c.risk === 'high' ? 'border-danger bg-danger-soft/50' : c.risk === 'medium' ? 'border-warning bg-warning-soft/50' : 'border-brand bg-brand-soft/50')}>
        <p className="text-[15px] leading-snug font-semibold text-ink">{c.aiReason ? tr(c.aiReason) : tr(K.noAiReason)}</p>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {c.ruleId && (
          <div>
            <dt className="text-xs text-muted">{tr(K.ruleApplied)}</dt>
            <dd><code className="rounded-[2px] bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] font-bold">{c.ruleId}</code>{rule && <span className="ml-1.5 text-ink">{tr(rule.situation)}</span>}</dd>
          </div>
        )}
        {c.suggestedReason && (
          <div>
            <dt className="text-xs text-muted">{tr(K.suggestedReason)}</dt>
            <dd data-testid="suggested-reason"><code className="font-mono text-[12px] font-bold">{c.suggestedReason}</code> <span className="text-ink">{tr(REJECTION_REASONS[c.suggestedReason].officerLabel)}</span></dd>
          </div>
        )}
      </dl>
      {others.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted">{tr(K.otherFlags)}</p>
          <ul className="mt-1.5 space-y-1.5">
            {others.map(f => (
              <li key={f.code} className="flex items-start gap-2 text-[13px]">
                <CircleAlert className={cn('mt-0.5 size-3.5 shrink-0', f.severity === 'high' ? 'text-danger' : f.severity === 'medium' ? 'text-warning' : 'text-muted')} aria-hidden />
                <span className="flex-1">{tr(f.reason)}</span>
                <RiskTag risk={f.severity} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

/* ----------------------------------------------------------- checks table */
export function ChecksTable({ c }: { c: Case }) {
  const tr = useTr()
  return (
    <Panel id="checks" title={tr(K.checksTable)} icon={<ListChecks className="size-4" />} hint={tr(K.checksTableHint)}>
      {c.checks.length === 0 ? <p className="text-sm text-muted">{tr(C.noChecks)}</p> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm" data-testid="checks-table">
            <caption className="sr-only">{tr(K.checksTable)}</caption>
            <thead>
              <tr className="border-y border-line bg-canvas/70 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
                <th scope="col" className="py-2 pr-3 pl-5">{tr(K.check)}</th>
                <th scope="col" className="px-3 py-2">{tr(K.result)}</th>
                <th scope="col" className="px-3 py-2">{tr(K.detail)}</th>
                <th scope="col" className="py-2 pr-5 pl-3 text-right">{tr(K.score)}</th>
              </tr>
            </thead>
            <tbody>
              {c.checks.map(r => <CheckRow key={r.id} r={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function CheckRow({ r }: { r: CheckResult }) {
  const tr = useTr()
  const o = effectiveOutcome(r)
  const th = SCORED[r.id]
  const symbol = o === 'pass' ? '✓' : o === 'fail' ? '✗' : o === 'warn' ? '!' : o === 'skipped' ? '–' : '…'
  return (
    <tr data-check={r.id} data-outcome={o} className={cn('border-b border-line/70 align-top last:border-b-0', o === 'fail' && 'bg-danger-soft/30')}>
      <th scope="row" className="py-2.5 pr-3 pl-5 font-semibold text-ink">{tr(CHECKS[r.id].label)}</th>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className={cn('inline-flex items-center gap-1.5 font-semibold', o === 'pass' ? 'text-success' : o === 'fail' ? 'text-danger' : o === 'warn' ? 'text-warning' : 'text-muted')}>
          <CheckIcon outcome={o} /><span aria-hidden className="font-mono">{symbol}</span>{tr(OUTCOME_LABEL[o])}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[13px] text-ink/85">{tr(r.detail)}</td>
      <td className="py-2.5 pr-5 pl-3 text-right whitespace-nowrap">
        {r.score !== undefined ? (
          <span className="inline-flex flex-col items-end">
            <span className={cn('font-bold tabular-nums', th !== undefined && r.score < th ? 'text-danger' : 'text-success')}>{r.score.toFixed(2)}</span>
            {th !== undefined && <span className="text-[10.5px] text-muted tabular-nums">{tr(C.threshold)} {th.toFixed(2)}</span>}
            <SimulatedValuesNote />
          </span>
        ) : <span className="text-muted">—</span>}
      </td>
    </tr>
  )
}

/* -------------------------------------------------------------- attempts */
const CAMERA_LABEL: Record<CameraInput, Bilingual> = { person: CAMERA_CONTROL.person, reflections: CAMERA_CONTROL.reflections, synthetic: CAMERA_CONTROL.synthetic }

export function AttemptsPanel({ c, e }: { c: Case; e: Evaluation | null }) {
  const tr = useTr()
  const s = c.session
  if (!s) return null
  const faceDoc = subjectDocument(c)?.number ?? c.typed.number
  const fb = s.fallback
  const vc = s.videoCall
  const callText = vc?.state === 'ended' ? `${tr(K.vcEnded)}${vc.officerName ? ` · ${vc.officerName}` : ''}`
    : vc?.state === 'live' ? `${tr(K.vcLive)}${vc.officerName ? ` · ${vc.officerName}` : ''}`
      : vc?.state === 'waiting' || fb?.joined ? tr(K.vcWaiting)
        : fb?.comeBackLater ? tr(K.vcOfferedNotJoined)
          : fb ? tr(K.vcOfferedPending) : tr(K.vcNotOffered)
  const rows: Array<[Bilingual, ReactNode]> = []
  if (s.chipReads.length) rows.push([K.chipReads, (
    <ol className="flex flex-wrap gap-1.5">
      {s.chipReads.map((r, i) => (
        <li key={i} className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', r === 'ok' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
          {i + 1}. {r === 'ok' ? tr(K.chipOk) : tr(K.chipFailed)}
        </li>
      ))}
    </ol>
  )])
  if (s.faceAttempts.length) rows.push([K.faceAttempts, (
    <ol className="space-y-1">
      {s.faceAttempts.map((cam, i) => {
        const f = e?.face.readings[i] ?? readFace(cam, faceDoc, i)
        return (
          <li key={i} data-testid="face-attempt" className="flex flex-wrap items-center gap-x-2 text-[13px]">
            <span className="font-semibold tabular-nums">{i + 1}.</span>
            <CheckIcon outcome={f.result === 'pass' ? 'pass' : f.result === 'retry' ? 'warn' : 'fail'} className="size-3.5" />
            <span>{tr(K.cameraInput)}: <b>{tr(CAMERA_LABEL[cam])}</b></span>
            <span className="text-muted">· {f.liveness !== undefined ? `${tr(K.liveness)} ${f.liveness.toFixed(2)}, ${tr(K.faceMatch)} ${f.faceMatch?.toFixed(2)}` : tr(K.noScore)}</span>
          </li>
        )
      })}
      <li><SimulatedValuesNote /></li>
    </ol>
  )])
  if (s.videoAttempts.length) rows.push([K.videoAttempts, (
    <ol className="space-y-1">
      {s.videoAttempts.map((cam, i) => (
        <li key={i} className="text-[13px]"><span className="font-semibold">{i + 1}.</span> {tr(K.cameraInput)}: <b>{tr(CAMERA_LABEL[cam])}</b></li>
      ))}
    </ol>
  )])
  if (s.guardianChecks === 'passed') rows.push([K.minorAndGuardian, <span className="text-[13px]">{tr(K.guardianChecks)}</span>])
  rows.push([K.videoCallRow, <span data-testid="video-call-state" className="text-[13px]">{callText}</span>])
  return (
    <Panel id="attempts" title={tr(K.attempts)} icon={<Camera className="size-4" />} hint={tr(K.attemptsHint)}>
      <dl className="divide-y divide-line/70">
        {rows.map(([k, v], i) => (
          <div key={i} className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[190px_1fr]">
            <dt className="text-[13px] font-semibold text-muted">{tr(k)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

/* ---------------------------------------------------------------- stills */
function Silhouette({ flagged }: { flagged: boolean }) {
  return (
    <svg viewBox="0 0 80 100" className="block h-auto w-full" aria-hidden>
      <rect width="80" height="100" fill={flagged ? '#e9e3e3' : '#e6e9ee'} />
      <circle cx="40" cy="38" r="15" fill="#b8bec9" />
      <path d="M12 100c2-22 13-34 28-34s26 12 28 34z" fill="#b8bec9" />
    </svg>
  )
}

export function StillsStrip({ c, e }: { c: Case; e: Evaluation | null }) {
  const tr = useTr()
  const atts = c.session?.faceAttempts ?? []
  if (!atts.length) return null
  const faceDoc = subjectDocument(c)?.number ?? c.typed.number
  // Two frames per attempt (start and end of the capture).
  const frames = atts.flatMap((cam, i) => {
    const f = e?.face.readings[i] ?? readFace(cam, faceDoc, i)
    return [0, 1].map(k => ({ key: `${i}-${k}`, attempt: i + 1, cam, result: f.result, flagged: f.result !== 'pass' && k === 1 }))
  })
  return (
    <Panel id="stills" title={tr(K.stills)} icon={<ScanFace className="size-4" />} hint={tr(K.stillsHint)}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6" data-testid="stills-strip">
        {frames.map(f => (
          <li key={f.key} data-flagged={f.flagged ? '1' : undefined} className={cn('overflow-hidden rounded-[2px] ring-1', f.flagged ? 'ring-2 ring-danger' : 'ring-line')}>
            <Silhouette flagged={f.flagged} />
            <p className={cn('px-1.5 py-1 text-[10.5px] leading-tight', f.flagged ? 'bg-danger text-white' : 'bg-surface-2 text-muted')}>
              {tr(C.attempt)} {f.attempt} · {f.flagged ? tr(K.flaggedFrame) : f.result === 'pass' ? tr(K.frameOk) : f.result === 'retry' ? tr(K.frameRetry) : tr(CAMERA_LABEL[f.cam])}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ---------------------------------------------------------- printed vs chip */
export function PrintedVsChip({ e }: { c: Case; e: Evaluation | null }) {
  const tr = useTr()
  const lang = useLang()
  const chip = e?.chip
  if (!chip?.ok || !chip.record.chip) return null
  const sigBad = !chip.record.chip.signatureValid
  if (!sigBad && !e!.printedDiff.length) return null
  const printed = chip.doc.data
  const inChip = chip.record.chip.data
  const rows: Array<[Bilingual, string, string]> = [
    ...PERSON_FIELDS.map(f => [FIELD_LABEL[f], f === 'dateOfBirth' ? printed[f] : printed[f].toUpperCase(), f === 'dateOfBirth' ? inChip[f] : inChip[f].toUpperCase()] as [Bilingual, string, string]),
    [K.expiry, chip.doc.expiry, chip.record.chip.expiry],
  ]
  return (
    <Panel id="printed-vs-chip" title={tr(K.printedVsChip)} icon={<Fingerprint className="size-4" />} hint={tr(K.printedVsChipHint)} tone="danger">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm" data-testid="printed-vs-chip">
          <thead>
            <tr className="border-y border-line bg-canvas/70 text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              <th scope="col" className="py-2 pr-3 pl-5">{tr(K.field)}</th>
              <th scope="col" className="px-3 py-2">{tr(K.printed)}</th>
              <th scope="col" className="px-3 py-2">{tr(K.chipData)}</th>
              <th scope="col" className="py-2 pr-5 pl-3"><span className="sr-only">{tr(K.result)}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b2]) => {
              const diff = norm(a) !== norm(b2)
              return (
                <tr key={label.en} data-differs={diff ? '1' : undefined} className={cn('border-b border-line/70 last:border-b-0', diff && 'bg-danger-soft/50')}>
                  <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-semibold">{tr(label)}</th>
                  <td className={cn('px-3 py-2.5 font-mono text-[13px]', diff && 'font-bold text-danger')}>{a}</td>
                  <td className={cn('px-3 py-2.5 font-mono text-[13px]', diff && 'font-bold text-danger')}>{b2}</td>
                  <td className="py-2.5 pr-5 pl-3 text-right text-xs font-semibold whitespace-nowrap">{diff ? <span className="text-danger">✗ {tr(K.differs)}</span> : <span className="text-success">✓ {tr(K.matches)}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className={cn('mt-3 flex items-center gap-2 text-[13px] font-semibold', sigBad ? 'text-danger' : 'text-success')}>
        <CheckIcon outcome={sigBad ? 'fail' : 'pass'} className="size-4" />
        {tr(CHECKS.chip_signature.label)}: {sigBad ? tr({ en: 'not valid', es: 'no válida' }) : tr({ en: 'valid', es: 'válida' })} · {chip.doc.nationality} · <span className="font-mono">{chip.doc.number}</span> · {formatDate(chip.doc.expiry, lang)}
      </p>
    </Panel>
  )
}

/* ------------------------------------------------------- discrepancy table */
export function DiscrepancyTable({ c, e }: { c: Case; e: Evaluation | null }) {
  const tr = useTr()
  const res = e?.residence
  const doc = subjectDocument(c)
  if (!res || res.state !== 'mismatch' || !doc) return null
  const compareWith: PersonData = e!.chip?.ok && e!.chip.record.chip ? e!.chip.record.chip.data : subjectData(c)
  const rec = lookupResidence(doc.number, compareWith)
  if (!rec) return null
  const src = e!.chip?.ok ? tr({ en: 'chip', es: 'chip' }) : tr({ en: 'document', es: 'documento' })
  const rows: Array<[Bilingual, string, string]> = [
    [K.fullName, fullName(compareWith), fullName(rec.data)],
    ...PERSON_FIELDS.map(f => [FIELD_LABEL[f], f === 'dateOfBirth' ? compareWith[f] : compareWith[f].toUpperCase(), f === 'dateOfBirth' ? rec.data[f] : rec.data[f].toUpperCase()] as [Bilingual, string, string]),
  ]
  return (
    <Panel id="discrepancies" title={tr(K.discrepancy)} icon={<Table2 className="size-4" />} hint={tr(K.discrepancyHint)} tone="warning">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm" data-testid="discrepancy-table">
          <thead>
            <tr className="border-y border-line bg-canvas/70 text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              <th scope="col" className="py-2 pr-3 pl-5">{tr(K.field)}</th>
              <th scope="col" className="px-3 py-2">{tr(K.docOrChip)} <span className="normal-case">({src})</span></th>
              <th scope="col" className="py-2 pr-5 pl-3">{tr(K.records)} <span className="normal-case">({tr(K.municipality).toLowerCase()}: {rec.municipality})</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b2]) => {
              const diff = norm(a) !== norm(b2)
              return (
                <tr key={label.en} data-differs={diff ? '1' : undefined} className={cn('border-b border-line/70 last:border-b-0', diff && 'bg-warning-soft/60')}>
                  <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-semibold">{tr(label)}{diff && <span className="ml-1.5 text-xs font-bold text-warning">· {tr(K.differs)}</span>}</th>
                  <td className={cn('px-3 py-2.5 font-mono text-[13px]', diff && 'font-bold')}>{diff ? <Highlight text={a} other={b2} /> : a}</td>
                  <td className={cn('py-2.5 pr-5 pl-3 font-mono text-[13px]', diff && 'font-bold')}>{b2}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/** Marks the words of `text` that are missing from `other`. */
function Highlight({ text, other }: { text: string; other: string }) {
  const have = new Set(norm(other).split(/[\s,]+/))
  return <>{text.split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || have.has(norm(w).replace(/,$/, '')) ? <span key={i}>{w}</span> : <mark key={i} className="rounded-[2px] bg-warning/30 px-0.5 text-ink">{w}</mark>))}</>
}

/* ----------------------------------------------------------- upload viewer */
export function UploadView({ upload, label, testId, children }: { upload?: Upload; label: string; testId: string; children?: ReactNode }) {
  const tr = useTr()
  const lang = useLang()
  const [open, setOpen] = useState(false)
  if (!upload) return <p className="rounded-[2px] border border-dashed border-line p-4 text-sm text-muted" data-testid={testId}>{tr(K.noImage)}</p>
  return (
    <figure data-testid={testId} className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
      <button type="button" onClick={() => setOpen(true)} className="group block overflow-hidden rounded-[2px] bg-canvas ring-1 ring-line outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label={`${tr(K.openImage)}: ${label}`}>
        <img src={upload.dataUrl} alt={label} className="block max-h-56 w-full object-contain transition group-hover:opacity-90" />
      </button>
      <figcaption className="min-w-0 text-sm">
        <p className="font-semibold break-all text-ink">{upload.name}</p>
        <p className="text-xs text-muted">{tr(K.uploadedAt)} · {formatDateTime(upload.at, lang)}</p>
        {children}
        <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-semibold text-brand hover:underline">{tr(K.openImage)}</button>
      </figcaption>
      <Dialog open={open} onOpenChange={setOpen} wide title={label} description={upload.name}>
        <img src={upload.dataUrl} alt={label} className="mx-auto block max-h-[70vh] w-auto max-w-full" />
      </Dialog>
    </figure>
  )
}

export function ProofPanel({ c }: { c: Case }) {
  const tr = useTr()
  const lang = useLang()
  const s = c.session
  if (s?.who !== 'child') return null
  const minor = s.minor
  return (
    <Panel id="proof" title={tr(K.proof)} icon={<Baby className="size-4" />} hint={tr(K.proofHint)} tone="warning">
      <UploadView upload={s.uploads.proof} label={tr(K.proof)} testId="proof-viewer" />
      <dl className="mt-4 grid gap-3 border-t border-line pt-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">{tr(K.applicantMinor)}</dt>
          <dd className="font-semibold">{c.persona.name}{minor && <span className="font-normal text-muted"> · {formatDate(minor.dateOfBirth, lang)} · {minor.document.type} <span className="font-mono">{minor.document.number}</span></span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{tr(K.guardianAccount)}</dt>
          <dd className="font-semibold">{c.typed.data.givenNames} {c.typed.data.surnames} <span className="font-normal text-muted">· {c.typed.type} <span className="font-mono">{c.typed.number}</span></span></dd>
          {s.guardianChecks === 'passed' && <dd className="mt-0.5 flex items-center gap-1 text-xs text-success"><BadgeCheck className="size-3.5" aria-hidden />{tr(K.guardianChecks)}</dd>}
        </div>
      </dl>
    </Panel>
  )
}

export function RedCardPanel({ c }: { c: Case }) {
  const tr = useTr()
  const lang = useLang()
  const s = c.session
  if ((s?.route ?? c.route) !== 'X' && !s?.uploads.redCard) return null
  const rc = s.uploads.redCard
  const days = rc ? daysUntil(rc.expiry) : null
  const soon = days !== null && days < 30
  return (
    <Panel id="red-card" title={tr(K.redCard)} icon={<CreditCard className="size-4" />} hint={tr(K.redCardHint)} tone="warning">
      <UploadView upload={rc} label={tr(K.redCard)} testId="red-card-viewer">
        {rc && (
          <dl className="mt-2 grid gap-2 text-sm">
            <div><dt className="text-xs text-muted">{tr(K.cardNumber)}</dt><dd data-testid="red-card-number" className="inline-block rounded-[2px] bg-warning-soft px-2 py-0.5 font-mono text-[15px] font-bold text-ink ring-1 ring-warning/40">{rc.number}</dd></div>
            <div>
              <dt className="text-xs text-muted">{tr(K.expiry)}</dt>
              <dd data-testid="red-card-expiry" data-soon={soon ? '1' : undefined} className={cn('inline-flex flex-wrap items-center gap-2 rounded-[2px] px-2 py-0.5 font-semibold', soon ? 'bg-danger-soft text-danger ring-2 ring-danger/50' : 'bg-surface-2 text-ink')}>
                {formatDate(rc.expiry, lang)}
                <span className="text-xs">{days! >= 0 ? fill(tr(K.expiresIn), { n: days! }) : fill(tr(K.expiredAgo), { n: -days! })}</span>
                {soon && <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10.5px] font-bold text-white">{tr(K.expiresSoon)}</span>}
              </dd>
            </div>
          </dl>
        )}
      </UploadView>
      {s.passport && (
        <p className="mt-4 border-t border-line pt-3 text-sm"><span className="text-xs text-muted">{tr(K.passportUsed)}:</span> <span className="font-mono">{s.passport.number}</span> · {s.passport.nationality} · {formatDate(s.passport.expiry, lang)}</p>
      )}
    </Panel>
  )
}

/* ---------------------------------------------------------- assisted session */
export function AssistedPanel({ c }: { c: Case }) {
  const tr = useTr()
  const h = c.session?.helper
  if (c.session?.who !== 'helping' || !h) return null
  return (
    <Panel id="assisted" title={tr(K.assistedTitle)} icon={<HandHelping className="size-4" />}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted">{tr(K.helperLine)}</dt><dd className="font-semibold" data-testid="helper-name">{h.name}</dd></div>
        <div><dt className="text-xs text-muted">{tr(K.relation)}</dt><dd className="font-semibold">{tr(HELPER_RELATION_LABELS[h.relation])}</dd></div>
      </dl>
      <ul className="mt-3 space-y-2 text-[13px]">
        {c.session.applicantConfirmed && <li className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{tr(K.applicantConfirmed)}</li>}
        <li className="flex items-start gap-2 rounded-[2px] bg-info-soft p-2.5 text-info" data-testid="sms-own-number"><Phone className="mt-0.5 size-4 shrink-0" aria-hidden />{tr(K.smsOwn)}</li>
      </ul>
    </Panel>
  )
}

/* ------------------------------------------------------- consents + contact */
export function ConsentsPanel({ c }: { c: Case }) {
  const tr = useTr()
  const lang = useLang()
  const s = c.session
  if (!s || (!s.consents.at && !s.contact)) return null
  const route = s.route ?? c.route
  const cs = s.consents
  const item = (label: Bilingual, v: boolean | undefined, notAsked = false) => (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span>{tr(label)}</span>
      <span className={cn('text-xs font-semibold', notAsked ? 'text-muted' : v ? 'text-success' : 'text-danger')}>{notAsked ? tr(K.notAsked) : v ? `✓ ${tr(K.given)}` : tr(K.notGiven)}</span>
    </li>
  )
  return (
    <Panel id="consents" title={tr(K.consents)} icon={<ClipboardCheck className="size-4" />} hint={cs.at ? `${formatDateTime(cs.at, lang)}` : undefined}>
      <ul className="divide-y divide-line/70 text-sm" data-testid="consents">
        {cs.declined ? item(K.consentDeclined, true) : <>
          {item(K.consentFace, cs.face, route === 'A')}
          {item(K.consentResidence, cs.residence, route === 'X' || route === 'F')}
        </>}
      </ul>
      {s.contact && (
        <dl className="mt-3 grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">{tr(K.mobile)}</dt><dd className="font-mono">{s.contact.mobile} <span className={cn('ml-1 font-sans text-xs font-semibold', s.contact.smsConfirmed ? 'text-success' : 'text-muted')}>{s.contact.smsConfirmed ? `✓ ${tr(K.smsConfirmed)}` : tr(K.smsPending)}</span></dd></div>
          {s.contact.email && <div><dt className="text-xs text-muted">{tr(K.email)}</dt><dd className="break-all">{s.contact.email}</dd></div>}
        </dl>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------ info thread */
export function InfoThread({ c }: { c: Case }) {
  const tr = useTr()
  const lang = useLang()
  const ir = c.infoRequest
  if (!ir) return null
  return (
    <Panel id="info" title={tr(K.infoThread)} icon={<MessageSquareText className="size-4" />}>
      <div className="space-y-3" data-testid="info-thread">
        <div className="max-w-[92%] rounded-[4px] rounded-tl-sm bg-surface-2 p-3 text-sm">
          <p><span className="font-semibold">{tr(K.whatWeNeed)}:</span> {ir.message}</p>
          {ir.reason && <p className="mt-1"><span className="font-semibold">{tr(K.because)}:</span> {ir.reason}</p>}
          <p className="mt-1 text-[11px] text-muted">{tr(C.askedBy)} {ir.by.name} · {formatDateTime(ir.at, lang)}</p>
        </div>
        {ir.response ? (
          <div className="ml-auto max-w-[92%] rounded-[4px] rounded-tr-sm border border-brand/30 bg-brand-soft p-3 text-sm" data-testid="info-reply">
            <p className="text-[11px] font-semibold text-brand">{tr(K.citizenReply)}</p>
            {ir.response.text && <p className="mt-0.5">{ir.response.text}</p>}
            {ir.response.upload && <div className="mt-2"><UploadView upload={ir.response.upload} label={tr(K.citizenReply)} testId="info-reply-upload" /></div>}
            <p className="mt-1 text-[11px] text-muted">{c.caseLabel ?? c.persona.name} · {formatDateTime(ir.response.at, lang)}</p>
          </div>
        ) : <p className="text-[13px] text-muted">{tr(C.noResponseYet)}</p>}
      </div>
    </Panel>
  )
}

/* ---------------------------------------------------------------- appeal */
export function AppealPanel({ c }: { c: Case }) {
  const tr = useTr()
  const lang = useLang()
  const a = c.appeal
  if (!a) return null
  const stateLabel = a.state === 'open' ? C.appealOpen : a.state === 'upheld' ? K.correctedTag : C.appealDismissed
  return (
    <Panel id="appeal" title={tr(K.appealTitle)} icon={<Scale className="size-4" />} hint={tr(K.appealHint)} tone={a.state === 'open' ? 'warning' : 'default'}
      action={<span data-testid="appeal-state" className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', a.state === 'open' ? 'bg-warning-soft text-warning' : a.state === 'upheld' ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted')}>{tr(stateLabel)}</span>}>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">{tr(K.firstDecision)}</dt>
          <dd><span className="font-semibold">{officerName(a.refusedBy)}</span>{a.refusedReasonId && <> · <code className="font-mono text-[12px] font-bold">{a.refusedReasonId}</code> {tr(REJECTION_REASONS[a.refusedReasonId].officerLabel)}</>}</dd>
        </div>
        {a.decidedBy && (
          <div>
            <dt className="text-xs text-muted">{tr(K.decidedBy)}</dt>
            <dd><span className="font-semibold">{a.decidedBy.name}</span>{a.decidedAt && <span className="text-muted"> · {formatDateTime(a.decidedAt, lang)}</span>}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs font-semibold text-muted">{tr(K.appealNote)}</p>
      <blockquote className="mt-1 border-l-2 border-warning/50 pl-3 text-sm italic" data-testid="appeal-note">“{a.text}”</blockquote>
      <p className="mt-1 text-xs text-muted">{c.caseLabel ?? c.persona.name} · {formatDateTime(a.at, lang)}</p>
      {a.upload && (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted"><FileImage className="size-3.5" aria-hidden />{tr(K.appealUpload)}</p>
          <UploadView upload={a.upload} label={tr(K.appealUpload)} testId="appeal-upload" />
        </div>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------- previous decisions */
export function DecisionsPanel({ c }: { c: Case }) {
  const tr = useTr()
  const lang = useLang()
  return (
    <Panel id="decisions" title={tr(K.previousDecisions)} icon={<Scale className="size-4" />}>
      {c.decisions.length === 0 ? <p className="text-sm text-muted">{tr(C.noDecisions)}</p> : (
        <ol className="space-y-2.5" data-testid="decisions">
          {[...c.decisions].reverse().map((d, i) => {
            const bad = d.outcome === 'refused' || d.outcome === 'revoked'
            const Icon = d.by.kind === 'system' ? Cpu : d.outcome === 'refused' ? Ban : d.outcome === 'revoked' ? Undo2 : BadgeCheck
            return (
              <li key={i} className="flex gap-3 rounded-[2px] border border-line p-3">
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-[2px]', bad ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}><Icon className="size-4" aria-hidden /></span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{tr(DECISION_LABEL[d.outcome])}{d.ruleId === 'APPEAL-SECOND-OFFICER' && !bad && <span className="ml-2 rounded-full bg-success-soft px-1.5 py-0.5 text-[11px] font-bold text-success">{tr(K.correctedTag)}</span>}</p>
                  <p className="text-xs text-muted"><span className="font-semibold text-ink">{d.by.kind === 'system' ? tr(K.engine) : d.by.name}</span> · {formatDateTime(d.at, lang)}{d.ruleId && <> · <code className="font-mono">{d.ruleId}</code></>}</p>
                  {d.reasonId && <p className="mt-1 text-[13px]"><span className="font-medium text-muted">{tr(C.reason)}:</span> <code className="font-mono text-[12px] font-bold">{d.reasonId}</code> {tr(REJECTION_REASONS[d.reasonId].officerLabel)}</p>}
                  {d.note && <p className="mt-0.5 text-[13px] text-muted"><span className="font-medium">{tr(K.internalNote)}:</span> <i>“{d.note}”</i></p>}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

