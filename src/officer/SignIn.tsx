/* Staff sign-in: simulated electronic certificate → authorisation check → job details (first time only). */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, BadgeCheck, CircleAlert, CreditCard, FileKey2, IdCard, KeyRound, Loader2, ShieldCheck, ShieldX, UserCog, X,
} from 'lucide-react'
import type { StaffCertificate, StaffSignInResult } from '@/contract/types'
import { KEY_RULE, SERVICE_NAME, STAFF_CERTIFICATES, STAFF_CREDENTIAL_LABELS } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { actions, ClaveRuleError, useClave } from '@/core/store'
import { isCertificateExpired } from '@/core/staff'
import { LangToggle, LogoGlyph, cn } from '@/ui'
import { C, S } from './copy'
import { fill, formatDate, useLang, useTr } from './lib'
import { Btn, Sim } from './components/ui'
import { CertificateFacts, ProfileForm } from './ProfileForm'

type Phase =
  | { kind: 'start' }
  | { kind: 'checking'; certId: string; step: 0 | 1 }
  | { kind: 'denied'; certId: string; reason: Extract<StaffSignInResult, { status: 'not_authorised' }>['reason'] }
  | { kind: 'profile'; certId: string; officerId: string }

const CRED_ICON = { employee_certificate: CreditCard, dnie: IdCard, personal_certificate: FileKey2 } as const

/* ------------------------------------------------------------ certificate picker (OS-style dialog) */

function CertificatePicker({ open, onOpenChange, onChoose }: { open: boolean; onOpenChange: (o: boolean) => void; onChoose: (id: string) => void }) {
  const tr = useTr()
  const lang = useLang()
  const [sel, setSel] = useState<string>('')
  const chosen = STAFF_CERTIFICATES.find(c => c.id === sel)
  useEffect(() => { if (open) setSel('') }, [open])

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-[ofc-fade_.18s_ease-out]" />
        <RDialog.Content
          aria-describedby="cert-picker-desc"
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-black/10 bg-[#f6f6f7] text-ink shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] outline-none data-[state=open]:animate-[ofc-pop_.2s_cubic-bezier(.2,.9,.3,1.2)]"
        >
          {/* window title bar */}
          <div className="flex items-center gap-3 border-b border-black/10 bg-gradient-to-b from-[#ececee] to-[#e2e2e5] px-3 py-2">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-3 rounded-full bg-[#ff5f57]" /><span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" />
            </span>
            <RDialog.Title className="flex-1 truncate text-center text-[13px] font-semibold text-ink">{tr(S.pickerTitle)}</RDialog.Title>
            <RDialog.Close className="grid size-7 place-items-center rounded-md text-muted outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand" aria-label={tr(S.cancel)}>
              <X className="size-4" aria-hidden />
            </RDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm"><KeyRound className="size-5" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p id="cert-picker-desc" className="text-sm leading-snug text-ink">{tr(S.pickerBody)}</p>
                <div className="mt-1.5"><Sim /></div>
              </div>
            </div>

            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-semibold tracking-[0.06em] text-muted uppercase">{tr(S.pickerList)}</legend>
              <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
                {STAFF_CERTIFICATES.map(c => {
                  const expired = isCertificateExpired(c)
                  const Icon = CRED_ICON[c.credential]
                  const active = sel === c.id
                  return (
                    <label
                      key={c.id}
                      data-testid={`cert-${c.id}`}
                      onDoubleClick={() => { setSel(c.id); onChoose(c.id) }}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 border-b border-black/5 px-3 py-2.5 last:border-b-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-inset',
                        active ? 'bg-brand text-white' : 'hover:bg-black/[0.035]',
                      )}
                    >
                      <input
                        type="radio"
                        name="staff-cert"
                        value={c.id}
                        checked={active}
                        onChange={() => setSel(c.id)}
                        className="sr-only"
                        aria-label={`${c.holderName}, ${tr(STAFF_CREDENTIAL_LABELS[c.credential])}, ${c.holderId}, ${tr(S.validUntil)} ${formatDate(c.validUntil, lang)}${expired ? `, ${tr(S.expiredTag)}` : ''}`}
                      />
                      <Icon className={cn('size-5 shrink-0', active ? 'text-white' : 'text-brand')} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{c.holderName}</span>
                          <span className={cn('truncate font-mono text-[11px]', active ? 'text-white/85' : 'text-muted')}>{c.holderId}</span>
                        </span>
                        <span className={cn('block truncate text-[12px]', active ? 'text-white/85' : 'text-muted')}>{tr(STAFF_CREDENTIAL_LABELS[c.credential])} · {tr(S.issuerText)}</span>
                      </span>
                      <span className="shrink-0 text-right text-[12px]">
                        {expired ? (
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold', active ? 'bg-white/20 text-white' : 'bg-danger-soft text-danger')}>
                            <CircleAlert className="size-3" aria-hidden />{tr(S.expiredTag)}
                          </span>
                        ) : (
                          <span className={active ? 'text-white/85' : 'text-muted'}>{tr(S.validUntil)}</span>
                        )}
                        <span className="block font-medium tabular-nums">{formatDate(c.validUntil, lang)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="mt-3 min-h-[124px] rounded-lg border border-black/10 bg-white p-3" aria-live="polite">
              <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-muted uppercase">{tr(S.certDetails)}</p>
              {chosen ? <CertificateFacts cert={chosen} compact /> : <p className="text-sm text-muted">{tr({ en: 'Select a certificate to see its details.', es: 'Selecciona un certificado para ver sus detalles.' })}</p>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-black/10 bg-[#ececee] px-5 py-3">
            <RDialog.Close asChild><Btn variant="secondary">{tr(S.cancel)}</Btn></RDialog.Close>
            <Btn variant="primary" disabled={!sel} onClick={() => sel && onChoose(sel)}>{tr(S.ok)}</Btn>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/* ------------------------------------------------------------ screens */

function Steps() {
  const tr = useTr()
  const items = [
    [KeyRound, S.step1, S.step1b],
    [ShieldCheck, S.step2, S.step2b],
    [UserCog, S.step3, S.step3b],
  ] as const
  return (
    <ol className="mt-6 grid gap-3 sm:grid-cols-3">
      {items.map(([Icon, t, sub], i) => (
        <li key={i} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-white"><Icon className="size-4" aria-hidden /></span>
          <span>
            <span className="block text-sm font-semibold text-white"><span className="mr-1 text-white/70 tabular-nums">{i + 1}.</span>{tr(t)}</span>
            <span className="block text-[12.5px] leading-snug text-white/70">{tr(sub)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function Checking({ step }: { step: 0 | 1 }) {
  const tr = useTr()
  const lines = [S.checkingCert, S.checkingAuth]
  return (
    <div role="status" aria-live="polite" className="mt-6 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      {lines.map((l, i) => (
        <p key={i} className={cn('flex items-center gap-2.5 text-sm', i <= step ? 'text-white' : 'text-white/45')}>
          {i < step ? <BadgeCheck className="size-4 text-[#5ee08a]" aria-hidden /> : i === step ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <span className="size-4" aria-hidden />}
          {tr(l)}
        </p>
      ))}
      <div className="mt-1"><Sim /></div>
    </div>
  )
}

function Denied({ cert, reason, onRetry }: { cert: StaffCertificate; reason: Extract<Phase, { kind: 'denied' }>['reason']; onRetry: () => void }) {
  const tr = useTr()
  const lang = useLang()
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div data-testid="staff-denied" data-reason={reason} className="rounded-3xl bg-surface p-6 text-ink shadow-2xl sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-danger-soft text-danger"><ShieldX className="size-6" aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] text-danger uppercase">{tr(S.deniedEyebrow)}</p>
          <h1 ref={ref} tabIndex={-1} className="mt-1 text-2xl font-semibold tracking-tight outline-none">{tr(S.deniedTitle[reason])}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">
            {fill(tr(S.deniedWhy[reason]), { name: cert.holderName, date: formatDate(cert.validUntil, lang) })}
          </p>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-canvas p-4">
        <h2 className="text-sm font-semibold">{tr(S.whatToDo)}</h2>
        <ul className="mt-2 grid gap-2">
          {S.todo[reason].map((t, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-snug text-ink">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />{tr(t)}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 rounded-2xl border border-line p-4">
        <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-muted uppercase">{tr(S.certUsed)}</p>
        <CertificateFacts cert={cert} compact />
      </div>
      <p className="mt-4 text-[13px] text-muted">{tr(S.attemptRecorded)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Btn variant="primary" size="lg" onClick={onRetry}><KeyRound className="size-4" aria-hidden />{tr(S.tryAnother)}</Btn>
        {reason === 'not_staff' ? (
          <Link to={PATHS.citizen} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-[15px] font-semibold text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand">{tr(S.goApply)}</Link>
        ) : (
          <Link to={PATHS.landing} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-[15px] font-semibold text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand">{tr(S.backHome)}</Link>
        )}
      </div>
    </div>
  )
}

export function SignIn() {
  const tr = useTr()
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>({ kind: 'start' })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const officerProfiles = useClave(s => s.officerProfiles)
  const startBtn = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), [])

  const choose = (certId: string) => {
    setPickerOpen(false)
    setError(null)
    const pace = reduce ? 250 : 650
    setPhase({ kind: 'checking', certId, step: 0 })
    timers.current.push(window.setTimeout(() => setPhase({ kind: 'checking', certId, step: 1 }), pace))
    timers.current.push(window.setTimeout(() => {
      try {
        const r = actions.officerSignInWithCertificate(certId)
        if (r.status === 'not_authorised') setPhase({ kind: 'denied', certId, reason: r.reason })
        else if (r.status === 'needs_profile') setPhase({ kind: 'profile', certId: r.certificateId, officerId: r.officerId })
        // signed_in: OfficerApp swaps to the console.
      } catch (e) {
        setError(e instanceof ClaveRuleError ? e.message : String((e as Error).message))
        setPhase({ kind: 'start' })
      }
    }, pace * 2))
  }

  const restart = () => { setPhase({ kind: 'start' }); setPickerOpen(true) }
  const cert = 'certId' in phase ? STAFF_CERTIFICATES.find(c => c.id === phase.certId) : undefined
  const rise = reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.3 } }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f1117] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ background: 'radial-gradient(60rem 30rem at 15% 0%, color-mix(in oklab, var(--color-brand) 40%, transparent), transparent 60%), radial-gradient(50rem 30rem at 100% 100%, color-mix(in oklab, var(--color-sim) 35%, transparent), transparent 60%)' }} />

      <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-5 py-5 sm:px-8">
        <Link to={PATHS.landing} className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/70">
          <LogoGlyph size={40} />
          <span className="leading-tight">
            <span className="block text-[17px] font-semibold tracking-tight">{SERVICE_NAME}</span>
            <span className="block text-[12px] text-white/70">{tr(S.staffAccess)}</span>
          </span>
        </Link>
        <span className="ml-auto flex items-center gap-3"><Sim /><LangToggle tone="stage" /></span>
      </header>

      <main className={cn('relative mx-auto px-5 pt-4 pb-16 sm:px-8', phase.kind === 'profile' ? 'max-w-5xl' : 'max-w-2xl')}>
        <AnimatePresence mode="wait">
          {(phase.kind === 'start' || phase.kind === 'checking') && (
            <motion.div key="start" {...rise}>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur sm:p-8">
                <p className="text-xs font-semibold tracking-[0.12em] text-white/70 uppercase">{tr(S.staffAccess)}</p>
                <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight">{tr(S.startTitle)}</h1>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/75">{tr(S.startBody)}</p>
                <Steps />
                {phase.kind === 'checking' ? (
                  <Checking step={phase.step} />
                ) : (
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <button
                      ref={startBtn}
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="group inline-flex h-12 items-center gap-2.5 rounded-xl bg-white px-5 text-[15px] font-semibold text-[#0f1117] shadow-lg outline-none transition hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-white/50"
                    >
                      <KeyRound className="size-5" aria-hidden />
                      {tr(S.signInCert)}
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                    </button>
                  </div>
                )}
                {error && <p role="alert" className="mt-4 rounded-xl bg-danger/20 px-3 py-2 text-sm text-white">{error}</p>}
                <p className="mt-5 text-[13px] leading-relaxed text-white/70">{tr(S.noSelfRegister)}</p>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13px] text-white/70">
                <Link to={PATHS.landing} className="inline-flex items-center gap-1.5 rounded outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"><ArrowLeft className="size-4" aria-hidden />{tr(S.backHome)}</Link>
                <span>{tr(S.citizenHere)} <Link to={PATHS.citizen} className="font-semibold text-white underline-offset-2 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">{tr(S.goApply)}</Link></span>
              </div>
              <p className="mt-6 flex gap-2 text-xs leading-relaxed text-white/70">
                <span className="font-semibold text-white/85">{tr(C.keyRule)}:</span>{tr(KEY_RULE)}
              </p>
            </motion.div>
          )}

          {phase.kind === 'denied' && cert && (
            <motion.div key="denied" {...rise}>
              <Denied cert={cert} reason={phase.reason} onRetry={restart} />
            </motion.div>
          )}

          {phase.kind === 'profile' && cert && (
            <motion.div key="profile" {...rise} className="rounded-3xl bg-surface p-6 text-ink shadow-2xl sm:p-8" data-testid="staff-profile-form">
              <ProfileForm
                officerId={phase.officerId}
                cert={cert}
                existing={officerProfiles?.[phase.officerId]}
                mode="first"
                onDone={() => undefined}
                onCancel={restart}
                cancelLabel={tr(S.useOtherCert)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CertificatePicker
        open={pickerOpen}
        onOpenChange={o => { setPickerOpen(o); if (!o) window.setTimeout(() => startBtn.current?.focus(), 0) }}
        onChoose={choose}
      />
    </div>
  )
}
