/**
 * Shared pieces of the citizen journey: message blocks (MSG bank, verbatim), simple labelled fields,
 * the simulated-camera control, image upload with preview, "Leer en voz alta" and demo prefills.
 */
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, FlaskConical, ImagePlus, Info, TriangleAlert, Volume2, VolumeX } from 'lucide-react'
import type { Bilingual, CameraInput, Case } from '@/contract/types'
import { CAMERA_CONTROL, MSG, fillMsg, type Msg, type MsgId } from '@/contract/messages'
import { DEMO_PEOPLE, type DemoPerson } from '@/contract/world'
import { normaliseDocNumber } from '@/contract/ids'
import { SimulatedValuesNote, cn } from '@/ui'
import { C, fill } from '../copy'
import { readImage, useSpeech, useTr } from '../hooks'
import { score2 } from '@/core/store'

/* ------------------------------------------------------------ messages */

export function msg(id: MsgId): Msg {
  return MSG[id] as Msg
}

type Vars = Record<string, string | number | undefined>

/** Title + text of one MSG id, verbatim. */
/** A message title used as a heading: no trailing full stop (the plan's titles end with one). */
export const asHeading = (s: string) => s.replace(/\.\s*$/, '')

export function MsgBlock({
  id, vars = {}, tone = 'plain', as = 'h2', testId, children, className, text,
}: {
  id: MsgId; vars?: Vars; tone?: 'plain' | 'info' | 'success' | 'warning' | 'danger'; as?: 'h1' | 'h2' | 'h3'; testId?: string; children?: ReactNode; className?: string
  /** Override the body text (e.g. one half of ASS-01). */
  text?: Bilingual
}) {
  const { tr } = useTr()
  const m = msg(id)
  const H = as
  const box = {
    plain: '',
    info: 'rounded-card border-l-4 border-brand bg-brand-soft p-4',
    success: 'rounded-card border-l-4 border-success bg-success-soft p-4',
    warning: 'rounded-card border-l-4 border-warning bg-warning-soft p-4',
    danger: 'rounded-card border-l-4 border-danger bg-danger-soft p-4',
  }[tone]
  return (
    <section className={cn(box, className)} data-testid={testId ?? `msg-${id}`} data-msg={id}>
      {m.title && (
        <H className={cn('font-display font-bold leading-tight text-ink', H === 'h1' ? 'text-[26px]' : 'text-[19px]')}>{asHeading(fillMsg(tr(m.title), vars))}</H>
      )}
      <p className={cn('text-[16px] leading-relaxed text-ink', m.title && 'mt-1.5')}>{fillMsg(tr(text ?? m), vars)}</p>
      {children}
    </section>
  )
}

export function StepTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-[26px] font-bold leading-tight text-ink">{children}</h1>
      {sub && <p className="mt-1.5 text-[16px] leading-relaxed text-muted">{sub}</p>}
    </div>
  )
}

export function Alert({ children, tone = 'danger', testId }: { children?: ReactNode; tone?: 'danger' | 'warning' | 'success' | 'info'; testId?: string }) {
  if (!children) return null
  const t = {
    danger: ['border-danger bg-danger-soft text-danger', <AlertCircle key="i" size={18} className="mt-px shrink-0" aria-hidden />],
    warning: ['border-warning bg-warning-soft text-ink', <TriangleAlert key="i" size={18} className="mt-px shrink-0 text-warning" aria-hidden />],
    success: ['border-success bg-success-soft text-ink', <CheckCircle2 key="i" size={18} className="mt-px shrink-0 text-success" aria-hidden />],
    info: ['border-brand bg-brand-soft text-ink', <Info key="i" size={18} className="mt-px shrink-0 text-brand" aria-hidden />],
  }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} data-testid={testId} className={cn('flex items-start gap-2.5 rounded-[2px] border-l-4 p-3.5 text-[15px] font-semibold leading-snug', t[0] as string)}>
      {t[1]}
      <span>{children}</span>
    </div>
  )
}

/* -------------------------------------------------------------- fields */

const inputCls =
  'h-12 w-full rounded-[2px] border border-line-strong bg-surface px-4 text-[16px] text-ink placeholder:text-muted ' +
  'hover:border-ink focus-visible:border-brand focus-visible:shadow-[inset_0_0_0_1px_var(--color-brand)] ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--color-danger)]'

export function TextInput({ label, hint, error, id: idProp, className, ...input }: {
  label: string; hint?: string; error?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & { className?: string }) {
  const auto = useId()
  const id = idProp ?? auto
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[15px] font-bold text-ink">{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputCls} {...input} />
      {error && <p id={`${id}-err`} className="flex items-start gap-1.5 text-[14px] font-bold text-danger"><AlertCircle size={15} className="mt-px shrink-0" aria-hidden />{error}</p>}
      {hint && <p id={`${id}-hint`} className="text-[14px] leading-snug text-muted">{hint}</p>}
    </div>
  )
}

export function SelectInput({ label, value, onChange, options, id: idProp, testId, name }: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; id?: string; testId?: string; name?: string
}) {
  const auto = useId()
  const id = idProp ?? auto
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[15px] font-bold text-ink">{label}</label>
      <select id={id} name={name} value={value} onChange={e => onChange(e.target.value)} className={cn(inputCls, 'appearance-auto pr-3')} data-testid={testId}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function CheckboxCard({ checked, onChange, children, testId, name }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; testId?: string; name?: string }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-[2px] border-2 border-line bg-surface p-4 has-[:checked]:border-brand has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
      <input id={id} name={name} type="checkbox" data-testid={testId} className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-[15px] font-semibold leading-snug text-ink">{children}</span>
    </label>
  )
}

/* ------------------------------------------------------ simulated camera */

export function CameraControl({ value, onChange, disabled }: { value: CameraInput; onChange: (v: CameraInput) => void; disabled?: boolean }) {
  const { tr } = useTr()
  const name = useId()
  const opts: CameraInput[] = ['person', 'reflections', 'synthetic']
  return (
    <fieldset className="rounded-[2px] border-2 border-dashed border-line-strong bg-surface-2/60 p-3" data-testid="camera-control" disabled={disabled}>
      <legend className="flex items-center gap-1.5 px-1 text-[14px] font-bold text-ink">
        <FlaskConical size={16} className="text-muted" aria-hidden />{tr(CAMERA_CONTROL.label)}
      </legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {opts.map(o => (
          <label
            key={o}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-[2px] border px-3 py-2 text-[14px] font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
              value === o ? 'border-brand bg-brand-soft text-ink' : 'border-line-strong bg-surface text-ink',
            )}
          >
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} className="accent-[var(--color-brand)]" data-testid={`camera-${o}`} />
            {tr(CAMERA_CONTROL[o])}
          </label>
        ))}
      </div>
      <p className="mt-2 text-[13px] leading-snug text-muted">{tr(C.cameraPrototype)}</p>
    </fieldset>
  )
}

export function Scores({ liveness, faceMatch }: { liveness?: number; faceMatch?: number }) {
  const { tr } = useTr()
  if (liveness === undefined && faceMatch === undefined) return null
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] text-muted" data-testid="face-scores">
      {liveness !== undefined && <span>{tr(C.livenessScore)}: <strong className="tabular-nums text-ink">{score2(liveness)}</strong></span>}
      {faceMatch !== undefined && <span>{tr(C.faceMatchScore)}: <strong className="tabular-nums text-ink">{score2(faceMatch)}</strong></span>}
      <SimulatedValuesNote className="text-[12px]" />
    </p>
  )
}

/* -------------------------------------------------------------- uploads */

export function ImageField({ label, value, onChange, testId, hint }: {
  label: string; value: { name: string; dataUrl: string } | null; onChange: (v: { name: string; dataUrl: string } | null) => void; testId?: string; hint?: string
}) {
  const { tr } = useTr()
  const id = useId()
  const [err, setErr] = useState('')
  return (
    <div className="space-y-1.5">
      <span className="block text-[15px] font-bold text-ink" id={`${id}-label`}>{label}</span>
      {value && (
        <figure className="overflow-hidden rounded-[2px] border border-line bg-surface-2">
          <img src={value.dataUrl} alt={fill(tr(C.imagePreview), { name: value.name })} className="mx-auto max-h-56 w-auto object-contain" data-testid={testId ? `${testId}-preview` : undefined} />
          <figcaption className="truncate border-t border-line px-3 py-1.5 text-[13px] text-muted">{value.name}</figcaption>
        </figure>
      )}
      <label
        htmlFor={id}
        className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[2px] border-2 border-dashed border-brand bg-surface px-4 py-3 text-[16px] font-bold text-brand hover:bg-brand-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
      >
        <ImagePlus size={18} aria-hidden />{value ? tr(C.changeImage) : tr(C.chooseImage)}
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          data-testid={testId}
          onChange={async e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setErr('')
            try { onChange(await readImage(f)) } catch (ex) {
              setErr(tr((ex as Error).message === 'size' ? C.imageTooBig : C.imageWrongType))
            }
          }}
        />
      </label>
      <p id={`${id}-hint`} className="text-[13px] leading-snug text-muted">{hint ?? tr(C.imageHint)}</p>
      {err && <p role="alert" className="text-[14px] font-bold text-danger">{err}</p>}
    </div>
  )
}

/* ---------------------------------------------------------- read aloud */

/** "Leer en voz alta" (browser speech). Hidden when the browser has no speech synthesis. */
export function ReadAloud({ text }: { text: string }) {
  const { tr, lang } = useTr()
  const speech = useSpeech()
  if (!speech) return null
  return (
    <button
      type="button"
      onClick={() => (speech.speaking ? speech.stop() : speech.speak(text, lang))}
      aria-pressed={speech.speaking}
      data-testid="read-aloud"
      className="inline-flex min-h-11 items-center gap-2 rounded-[2px] border-2 border-brand bg-surface px-4 text-[15px] font-bold text-brand hover:bg-brand-soft"
    >
      {speech.speaking ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
      {tr(speech.speaking ? C.stopReading : C.readAloud)}
    </button>
  )
}

/* ------------------------------------------------------------ prefills */

/** The README demo data whose account document matches this case (null for anyone else). Inputs only. */
export function demoPersonFor(c: Case): DemoPerson | null {
  const n = normaliseDocNumber(c.typed.number)
  return DEMO_PEOPLE.find(p => normaliseDocNumber(p.account.documentNumber) === n) ?? null
}

export function isoInDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
