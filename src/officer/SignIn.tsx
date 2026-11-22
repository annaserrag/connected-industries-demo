/*
 * Staff sign-in, modelled on the Cl@ve identification gateway: two method cards (electronic certificate + PIN,
 * staff user + password) → authorisation check → job details (first time only).
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, BadgeCheck, CircleAlert, CreditCard, Eye, EyeOff, FileKey2, IdCard, Info, KeyRound, Loader2, LockKeyhole, ShieldX, X,
} from 'lucide-react'
import type { StaffCertificate, StaffSignInMethod, StaffSignInResult } from '@/contract/types'
import { KEY_RULE, STAFF_CERTIFICATES, STAFF_CREDENTIAL_LABELS, STAFF_DEMO_SECRETS } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { actions, ClaveRuleError, useClave } from '@/core/store'
import { findAccount, isCertificateExpired } from '@/core/staff'
import { GovHeader, cn } from '@/ui'
import { C, S } from './copy'
import { fill, formatDate, useLang, useTr } from './lib'
import { Btn } from './components/ui'
import { AccountFacts, CertificateFacts, ProfileForm, fieldCls, type IdentitySource } from './ProfileForm'

type Denial = Extract<StaffSignInResult, { status: 'not_authorised' }>['reason']

type Phase =
  | { kind: 'methods' }
  | { kind: 'pin'; certId: string }
  | { kind: 'password' }
  | { kind: 'denied'; method: StaffSignInMethod; certId?: string; userId?: string; reason: Denial }
  | { kind: 'profile'; method: StaffSignInMethod; officerId: string; certId?: string; userId?: string }

const CRED_ICON = { employee_certificate: CreditCard, dnie: IdCard, personal_certificate: FileKey2 } as const
const MAX_PIN_TRIES = 3
const PIN_PAUSE_S = 30

/* ------------------------------------------------------------ illustrations (inline SVG, decorative) */

function CertArt() {
  return (
    <svg viewBox="0 0 220 120" className="h-[104px] w-auto" aria-hidden="true" focusable="false">
      <rect x="38" y="18" width="128" height="82" rx="8" fill="var(--color-surface)" stroke="var(--color-line-strong)" strokeWidth="2" />
      <rect x="38" y="18" width="128" height="18" rx="8" fill="var(--color-brand)" />
      <rect x="38" y="28" width="128" height="8" fill="var(--color-brand)" />
      <rect x="52" y="48" width="26" height="20" rx="3" fill="var(--color-brand-tint)" stroke="var(--color-brand)" strokeWidth="1.5" />
      <path d="M52 58h26M65 48v20" stroke="var(--color-brand)" strokeWidth="1.2" />
      <rect x="88" y="48" width="62" height="6" rx="3" fill="var(--color-line-strong)" opacity=".55" />
      <rect x="88" y="60" width="46" height="6" rx="3" fill="var(--color-line-strong)" opacity=".35" />
      <rect x="52" y="78" width="98" height="6" rx="3" fill="var(--color-line-strong)" opacity=".25" />
      <circle cx="168" cy="92" r="20" fill="var(--color-brand-soft)" stroke="var(--color-brand)" strokeWidth="2" />
      <rect x="160" y="90" width="16" height="12" rx="2" fill="var(--color-brand)" />
      <path d="M163 90v-4a5 5 0 0 1 10 0v4" fill="none" stroke="var(--color-brand)" strokeWidth="2" />
    </svg>
  )
}

function PasswordArt() {
  return (
    <svg viewBox="0 0 220 120" className="h-[104px] w-auto" aria-hidden="true" focusable="false">
      <rect x="40" y="14" width="140" height="92" rx="6" fill="var(--color-surface)" stroke="var(--color-line-strong)" strokeWidth="2" />
      <circle cx="110" cy="38" r="12" fill="var(--color-brand-tint)" stroke="var(--color-brand)" strokeWidth="1.5" />
      <path d="M96 58c3-7 8-10 14-10s11 3 14 10" fill="var(--color-brand-tint)" stroke="var(--color-brand)" strokeWidth="1.5" />
      <rect x="58" y="66" width="104" height="12" rx="2" fill="var(--color-surface-2)" stroke="var(--color-line-strong)" strokeWidth="1.2" />
      <rect x="58" y="84" width="104" height="12" rx="2" fill="var(--color-surface-2)" stroke="var(--color-line-strong)" strokeWidth="1.2" />
      {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={68 + i * 9} cy="90" r="2.4" fill="var(--color-ink)" />)}
      <rect x="64" y="70" width="40" height="4" rx="2" fill="var(--color-line-strong)" opacity=".6" />
    </svg>
  )
}

/* ------------------------------------------------------------ method card (gateway style) */

function MethodCard({ testId, art, title, body, cta, recommended, onSelect, buttonRef }: {
  testId: string; art: ReactNode; title: string; body: string; cta: string; recommended?: boolean
  onSelect: () => void; buttonRef?: React.Ref<HTMLButtonElement>
}) {
  const tr = useTr()
  const id = useId()
  return (
    <article
      data-testid={testId}
      aria-labelledby={`${id}-t`}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[16px] border-2 bg-surface transition-colors',
        recommended ? 'border-brand' : 'border-line hover:border-line-strong',
      )}
    >
      {recommended && (
        <span className="absolute top-3 right-3 rounded-[2px] bg-brand px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] text-brand-ink uppercase">{tr(S.recommended)}</span>
      )}
      <div className="grid place-items-center bg-surface-2 px-6 pt-7 pb-5">{art}</div>
      <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
        <h2 id={`${id}-t`} className="font-display text-[20px] leading-snug font-bold text-ink">{title}</h2>
        <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-muted">{body}</p>
        <button
          ref={buttonRef}
          type="button"
          onClick={onSelect}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-tint px-5 text-[15px] font-bold text-ink transition-colors outline-none hover:bg-brand-tint-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {cta}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------ certificate picker (browser-style dialog) */

function CertificatePicker({ open, onOpenChange, onChoose }: { open: boolean; onOpenChange: (o: boolean) => void; onChoose: (id: string) => void }) {
  const tr = useTr()
  const lang = useLang()
  const [sel, setSel] = useState<string>('')
  const chosen = STAFF_CERTIFICATES.find(c => c.id === sel)
  useEffect(() => { if (open) setSel('') }, [open])

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/50 data-[state=open]:animate-[ofc-fade_.18s_ease-out]" />
        <RDialog.Content
          aria-describedby="cert-picker-desc"
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[4px] border-t-4 border-brand bg-surface text-ink shadow-pop outline-none data-[state=open]:animate-[ofc-pop_.2s_cubic-bezier(.2,.9,.3,1.2)]"
        >
          <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
            <KeyRound className="size-5 shrink-0 text-brand" aria-hidden />
            <RDialog.Title className="flex-1 truncate font-display text-[17px] font-bold text-ink">{tr(S.pickerTitle)}</RDialog.Title>
            <RDialog.Close className="grid size-9 place-items-center rounded-[2px] text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand" aria-label={tr(S.cancel)}>
              <X className="size-5" aria-hidden />
            </RDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-3">
            <p id="cert-picker-desc" className="text-[15px] leading-snug text-ink">{tr(S.pickerBody)}</p>

            <fieldset className="mt-4">
              <legend className="mb-2 text-[12px] font-bold tracking-[0.06em] text-muted uppercase">{tr(S.pickerList)}</legend>
              <div className="overflow-hidden rounded-[2px] border border-line-strong">
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
                        'relative flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-inset',
                        active ? 'bg-brand-soft shadow-[inset_4px_0_0_var(--color-brand)]' : 'hover:bg-surface-2',
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
                      <Icon className="size-5 shrink-0 text-brand" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="truncate text-[15px] font-bold">{c.holderName}</span>
                          <span className="truncate font-mono text-[12px] text-muted">{c.holderId}</span>
                        </span>
                        <span className="block truncate text-[13px] text-muted">{tr(STAFF_CREDENTIAL_LABELS[c.credential])}</span>
                      </span>
                      <span className="shrink-0 text-right text-[12px]">
                        {expired ? (
                          <span className="inline-flex items-center gap-1 rounded-[2px] bg-danger-soft px-1.5 py-0.5 font-bold text-danger">
                            <CircleAlert className="size-3" aria-hidden />{tr(S.expiredTag)}
                          </span>
                        ) : (
                          <span className="text-muted">{tr(S.validUntil)}</span>
                        )}
                        <span className="block font-semibold tabular-nums">{formatDate(c.validUntil, lang)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="mt-3 min-h-[124px] rounded-[2px] border border-line bg-surface-2 p-3" aria-live="polite">
              <p className="mb-2 text-[12px] font-bold tracking-[0.06em] text-muted uppercase">{tr(S.certDetails)}</p>
              {chosen ? <CertificateFacts cert={chosen} compact /> : <p className="text-sm text-muted">{tr({ en: 'Select a certificate to see its details.', es: 'Selecciona un certificado para ver sus detalles.' })}</p>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
            <RDialog.Close asChild><Btn variant="secondary">{tr(S.cancel)}</Btn></RDialog.Close>
            <Btn variant="primary" disabled={!sel} onClick={() => sel && onChoose(sel)}>{tr(S.ok)}</Btn>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/* ------------------------------------------------------------ shared bits */

function Checking({ method, step }: { method: StaffSignInMethod; step: 0 | 1 }) {
  const tr = useTr()
  const lines = [method === 'certificate' ? S.checkingPin : S.checkingPw, S.checkingAuth]
  return (
    <div role="status" aria-live="polite" className="grid gap-2 rounded-[2px] border border-line bg-surface-2 p-4" data-testid="staff-checking">
      {lines.map((l, i) => (
        <p key={i} className={cn('flex items-center gap-2.5 text-[15px]', i <= step ? 'text-ink' : 'text-muted')}>
          {i < step ? <BadgeCheck className="size-4 text-success" aria-hidden /> : i === step ? <Loader2 className="size-4 animate-spin text-brand motion-reduce:animate-none" aria-hidden /> : <span className="size-4" aria-hidden />}
          {tr(l)}
        </p>
      ))}
    </div>
  )
}

/** A centred white step card (PIN, user + password) with a back link above it. */
function StepCard({ children, onBack, testId, title, titleId }: { children: ReactNode; onBack: () => void; testId: string; title: string; titleId: string }) {
  const tr = useTr()
  return (
    <div className="mx-auto w-full max-w-[520px]" data-testid={testId}>
      <button type="button" onClick={onBack} className="gov-link mb-4 inline-flex items-center gap-1.5 rounded-[2px] text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
        <ArrowLeft className="size-4" aria-hidden />{tr(S.backToMethods)}
      </button>
      <section aria-labelledby={titleId} className="rounded-[4px] border border-line border-t-4 border-t-brand bg-surface p-6 sm:p-8">
        <h2 id={titleId} tabIndex={-1} className="font-display text-[22px] leading-snug font-bold text-ink outline-none">{title}</h2>
        {children}
      </section>
    </div>
  )
}

function ShowToggle({ shown, onToggle, show, hide }: { shown: boolean; onToggle: () => void; show: string; hide: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? hide : show}
      title={shown ? hide : show}
      className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-[2px] text-muted outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
    >
      {shown ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
    </button>
  )
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-[14px] font-semibold text-danger">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/* ------------------------------------------------------ demo access box */

/** Visible demo credentials so anyone recording or grading can sign in. Fictional accounts only. */
function DemoAccess({ certId, compact }: { certId?: string; compact?: boolean }) {
  const tr = useTr()
  const cert = STAFF_CERTIFICATES.find(c => c.id === (certId ?? 'cert-laura'))
  const pin = cert ? STAFF_DEMO_SECRETS.pins[cert.id] : undefined
  return (
    <aside data-testid="staff-demo-access" className={cn('mx-auto rounded-[2px] border-2 border-dashed border-brand/60 bg-brand-soft p-4 text-[14px] text-ink', compact ? 'mt-4 max-w-[520px]' : 'mt-8 max-w-[760px]')}>
      <p className="flex items-center gap-2 font-bold"><KeyRound className="size-4 text-brand" aria-hidden />{tr({ en: 'Demo access (fictional accounts)', es: 'Acceso de demostración (cuentas ficticias)' })}</p>
      {certId && cert && pin ? (
        <p className="mt-1.5">{tr({ en: 'PIN for', es: 'PIN de' })} {cert.holderName}: <code className="rounded-[2px] bg-surface px-1.5 py-0.5 font-mono text-[15px] font-bold" data-testid="demo-pin">{pin}</code></p>
      ) : (
        <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
          <li>{tr({ en: 'Electronic certificate: Laura Navarro · PIN', es: 'Certificado electrónico: Laura Navarro · PIN' })} <code className="rounded-[2px] bg-surface px-1.5 py-0.5 font-mono font-bold" data-testid="demo-pin">{STAFF_DEMO_SECRETS.pins['cert-laura']}</code></li>
          <li>{tr({ en: 'User and password:', es: 'Usuario y contraseña:' })} <code className="rounded-[2px] bg-surface px-1.5 py-0.5 font-mono font-bold">lnavarro</code> · <code className="rounded-[2px] bg-surface px-1.5 py-0.5 font-mono font-bold">{STAFF_DEMO_SECRETS.passwords.lnavarro}</code></li>
        </ul>
      )}
    </aside>
  )
}

/* ------------------------------------------------------------ PIN step */

function PinStep({ cert, onSubmit, onBack, onChangeCert, checking, wrong, triesLeft, lockedFor }: {
  cert: StaffCertificate; onSubmit: (pin: string) => void; onBack: () => void; onChangeCert: () => void
  checking: 0 | 1 | null; wrong: boolean; triesLeft: number; lockedFor: number
}) {
  const tr = useTr()
  const lang = useLang()
  const uid = useId()
  const [pin, setPin] = useState('')
  const [shown, setShown] = useState(false)
  const [formatErr, setFormatErr] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const Icon = CRED_ICON[cert.credential]
  useEffect(() => { input.current?.focus() }, [])
  // After a wrong PIN: clear the field and put the cursor back.
  useEffect(() => { if (wrong) { setPin(''); input.current?.focus() } }, [wrong, triesLeft])

  const locked = lockedFor > 0
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (locked || checking !== null) return
    if (!/^\d{4,8}$/.test(pin)) { setFormatErr(true); input.current?.focus(); return }
    setFormatErr(false)
    onSubmit(pin)
  }
  const errId = `${uid}-err`
  const hasErr = formatErr || wrong || locked

  return (
    <StepCard onBack={onBack} testId="staff-pin-step" title={tr(S.pinTitle)} titleId={`${uid}-t`}>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{tr(S.pinBody)}</p>

      <div className="mt-5 flex items-center gap-3 rounded-[2px] border border-line bg-surface-2 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[2px] bg-surface text-brand ring-1 ring-line"><Icon className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1 leading-snug">
          <span className="block text-[12px] font-bold tracking-[0.06em] text-muted uppercase">{tr(S.certSelected)}</span>
          <span className="block truncate text-[15px] font-bold text-ink" data-testid="pin-cert-holder">{cert.holderName}</span>
          <span className="block truncate text-[13px] text-muted">{tr(STAFF_CREDENTIAL_LABELS[cert.credential])} · {tr(S.validUntil)} {formatDate(cert.validUntil, lang)}</span>
        </span>
        <button type="button" onClick={onChangeCert} className="gov-link shrink-0 rounded-[2px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-brand">{tr(S.changeCert)}</button>
      </div>

      <form onSubmit={submit} noValidate className="mt-5">
        <label htmlFor={`${uid}-pin`} className="block text-[15px] font-bold text-ink">{tr(S.pinLabel)}</label>
        <p id={`${uid}-hint`} className="mt-0.5 text-[14px] text-muted">{tr(S.pinHint)}</p>
        <div className="relative mt-2">
          <input
            ref={input}
            id={`${uid}-pin`}
            data-testid="pin-input"
            type={shown ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            disabled={locked || checking !== null}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setFormatErr(false) }}
            aria-invalid={hasErr}
            aria-describedby={hasErr ? `${uid}-hint ${errId}` : `${uid}-hint`}
            className={cn(fieldCls, 'pr-12 font-mono text-[18px] tracking-[0.3em]', hasErr ? 'border-danger' : 'border-line-strong')}
          />
          <ShowToggle shown={shown} onToggle={() => setShown(v => !v)} show={tr(S.pinShow)} hide={tr(S.pinHide)} />
        </div>
        {locked ? (
          <FieldError id={errId}>{fill(tr(S.pinLocked), { s: lockedFor })}</FieldError>
        ) : wrong ? (
          <FieldError id={errId}>
            {tr(S.pinWrong)}{' '}
            <span data-testid="pin-attempts">{triesLeft === 1 ? tr(S.attemptLeft) : fill(tr(S.attemptsLeft), { n: triesLeft })}</span>
          </FieldError>
        ) : formatErr ? (
          <FieldError id={errId}>{tr(S.pinFormat)}</FieldError>
        ) : null}

        <div className="mt-6">
          {checking !== null ? <Checking method="certificate" step={checking} /> : (
            <Btn variant="primary" size="lg" type="submit" className="w-full" disabled={locked}>
              <LockKeyhole className="size-4" aria-hidden />{tr(S.continueBtn)}
            </Btn>
          )}
        </div>
      </form>
    </StepCard>
  )
}

/* ------------------------------------------------------------ user + password step */

function PasswordStep({ onSubmit, onBack, checking, wrong, attempt }: {
  onSubmit: (userId: string, password: string) => void; onBack: () => void; checking: 0 | 1 | null; wrong: boolean; attempt: number
}) {
  const tr = useTr()
  const uid = useId()
  const [user, setUser] = useState('')
  const [pw, setPw] = useState('')
  const [shown, setShown] = useState(false)
  const [missing, setMissing] = useState(false)
  const userRef = useRef<HTMLInputElement>(null)
  const pwRef = useRef<HTMLInputElement>(null)
  useEffect(() => { userRef.current?.focus() }, [])
  useEffect(() => { if (wrong) { setPw(''); pwRef.current?.focus() } }, [wrong, attempt])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (checking !== null) return
    if (!user.trim() || !pw) { setMissing(true); (user.trim() ? pwRef : userRef).current?.focus(); return }
    setMissing(false)
    onSubmit(user, pw)
  }
  const errId = `${uid}-err`
  const hasErr = wrong || missing

  return (
    <StepCard onBack={onBack} testId="staff-password-step" title={tr(S.pwTitle)} titleId={`${uid}-t`}>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{tr(S.pwBody)}</p>
      <form onSubmit={submit} noValidate className="mt-5 grid gap-4" data-testid="staff-password-form">
        <div>
          <label htmlFor={`${uid}-user`} className="block text-[15px] font-bold text-ink">{tr(S.userId)}</label>
          <input
            ref={userRef}
            id={`${uid}-user`}
            name="username"
            data-testid="staff-user"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={user}
            disabled={checking !== null}
            onChange={e => { setUser(e.target.value); setMissing(false) }}
            aria-invalid={hasErr && (wrong || !user.trim())}
            aria-describedby={hasErr ? errId : undefined}
            placeholder={tr(S.userIdHint)}
            className={cn(fieldCls, 'mt-2', hasErr && (wrong || !user.trim()) ? 'border-danger' : 'border-line-strong')}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-pw`} className="block text-[15px] font-bold text-ink">{tr(S.password)}</label>
          <div className="relative mt-2">
            <input
              ref={pwRef}
              id={`${uid}-pw`}
              name="password"
              data-testid="staff-password"
              type={shown ? 'text' : 'password'}
              autoComplete="current-password"
              value={pw}
              disabled={checking !== null}
              onChange={e => { setPw(e.target.value); setMissing(false) }}
              aria-invalid={hasErr && (wrong || !pw)}
              aria-describedby={hasErr ? errId : undefined}
              className={cn(fieldCls, 'pr-12', hasErr && (wrong || !pw) ? 'border-danger' : 'border-line-strong')}
            />
            <ShowToggle shown={shown} onToggle={() => setShown(v => !v)} show={tr(S.pwShow)} hide={tr(S.pwHide)} />
          </div>
        </div>
        {wrong ? <FieldError id={errId}>{tr(S.pwWrong)}</FieldError> : missing ? <FieldError id={errId}>{tr(S.pwMissing)}</FieldError> : null}
        <div className="mt-2">
          {checking !== null ? <Checking method="password" step={checking} /> : (
            <Btn variant="primary" size="lg" type="submit" className="w-full"><ArrowRight className="size-4" aria-hidden />{tr(S.signInBtn)}</Btn>
          )}
        </div>
        <p className="text-[14px] text-muted">{tr(S.forgotPw)}</p>
      </form>
    </StepCard>
  )
}

/* ------------------------------------------------------------ refused */

function Denied({ source, reason, onRetry, onMethods }: { source: IdentitySource; reason: Denial; onRetry: () => void; onMethods: () => void }) {
  const tr = useTr()
  const lang = useLang()
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const name = source.method === 'certificate' ? source.cert.holderName : source.account.holderName
  const date = source.method === 'certificate' ? formatDate(source.cert.validUntil, lang) : ''
  return (
    <div data-testid="staff-denied" data-reason={reason} className="mx-auto max-w-[760px] rounded-[4px] border border-line border-t-4 border-t-danger bg-surface p-6 text-ink sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-[2px] bg-danger-soft text-danger"><ShieldX className="size-6" aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold tracking-[0.08em] text-danger uppercase">{tr(S.deniedEyebrow)}</p>
          <h1 ref={ref} tabIndex={-1} className="mt-1 font-display text-[24px] leading-snug font-bold outline-none">{tr(S.deniedTitle[reason])}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{fill(tr(S.deniedWhy[reason]), { name, date })}</p>
        </div>
      </div>
      <div className="mt-6 rounded-[2px] border-l-4 border-brand bg-brand-soft p-4">
        <h2 className="text-[15px] font-bold">{tr(S.whatToDo)}</h2>
        <ul className="mt-2 grid gap-2">
          {S.todo[reason].map((t, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-ink">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />{tr(t)}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 rounded-[2px] border border-line p-4">
        <p className="mb-2 text-[12px] font-bold tracking-[0.06em] text-muted uppercase">{tr(source.method === 'certificate' ? S.certUsed : S.accountUsed)}</p>
        {source.method === 'certificate' ? <CertificateFacts cert={source.cert} compact /> : <AccountFacts account={source.account} compact />}
      </div>
      <p className="mt-4 text-[14px] text-muted">{tr(S.attemptRecorded)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Btn variant="primary" size="lg" onClick={onRetry}>
          <KeyRound className="size-4" aria-hidden />{tr(source.method === 'certificate' ? S.tryAnother : S.tryOtherUser)}
        </Btn>
        <Btn variant="secondary" size="lg" onClick={onMethods}>{tr(S.useOtherMethod)}</Btn>
        {reason === 'not_staff' && (
          <Link to={PATHS.citizen} className="inline-flex h-11 items-center gap-2 rounded-[2px] px-2 text-[15px] gov-link outline-none focus-visible:ring-2 focus-visible:ring-brand">{tr(S.goApply)}</Link>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ page */

export function SignIn() {
  const tr = useTr()
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>({ kind: 'methods' })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [checking, setChecking] = useState<0 | 1 | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Wrong-PIN counter per certificate; after MAX_PIN_TRIES a short pause (never a permanent lock).
  const [pinFails, setPinFails] = useState<Record<string, number>>({})
  const [pinLockUntil, setPinLockUntil] = useState<Record<string, number>>({})
  const [pinWrong, setPinWrong] = useState(false)
  const [pwWrong, setPwWrong] = useState(0)
  const [, setTick] = useState(0)
  const officerProfiles = useClave(s => s.officerProfiles)
  const certBtn = useRef<HTMLButtonElement>(null)
  const pwBtn = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const pace = reduce ? 250 : 600

  const certLockedFor = phase.kind === 'pin' ? Math.max(0, Math.ceil(((pinLockUntil[phase.certId] ?? 0) - Date.now()) / 1000)) : 0
  useEffect(() => {
    if (certLockedFor <= 0) return
    const id = window.setInterval(() => setTick(n => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [certLockedFor > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const toMethods = (focus?: 'certificate' | 'password') => {
    setPhase({ kind: 'methods' }); setChecking(null); setError(null); setPinWrong(false); setPwWrong(0)
    if (focus) later(() => (focus === 'certificate' ? certBtn : pwBtn).current?.focus(), 30)
  }

  const chooseCert = (certId: string) => {
    setPickerOpen(false)
    setError(null)
    setPinWrong(false)
    setPhase({ kind: 'pin', certId })
  }

  /** Runs the action after a short "checking" beat; shows the authorisation step before the outcome. */
  const run = (method: StaffSignInMethod, call: () => StaffSignInResult, ids: { certId?: string; userId?: string }) => {
    setChecking(0)
    later(() => {
      let r: StaffSignInResult
      try { r = call() } catch (e) {
        setError(e instanceof ClaveRuleError ? e.message : String((e as Error).message)); setChecking(null); return
      }
      if (r.status === 'invalid_credentials') {
        setChecking(null)
        if (method === 'certificate' && ids.certId) {
          const id = ids.certId
          const n = (pinFails[id] ?? 0) + 1
          if (n >= MAX_PIN_TRIES) {
            setPinFails(f => ({ ...f, [id]: 0 }))
            setPinLockUntil(l => ({ ...l, [id]: Date.now() + PIN_PAUSE_S * 1000 }))
          } else setPinFails(f => ({ ...f, [id]: n }))
          setPinWrong(true)
        } else setPwWrong(n => n + 1)
        return
      }
      if (r.status === 'signed_in') return // OfficerApp swaps to the console
      setChecking(1)
      later(() => {
        setChecking(null)
        if (r.status === 'not_authorised') setPhase({ kind: 'denied', method, reason: r.reason, ...ids })
        else if (r.status === 'needs_profile') setPhase({ kind: 'profile', method, officerId: r.officerId, certId: r.certificateId, userId: ids.userId })
      }, pace)
    }, pace)
  }

  const submitPin = (pin: string) => {
    if (phase.kind !== 'pin') return
    const certId = phase.certId
    setPinWrong(false)
    run('certificate', () => actions.officerSignInWithCertificate(certId, pin), { certId })
  }
  const submitPassword = (userId: string, password: string) => {
    run('password', () => actions.officerSignInWithPassword(userId, password), { userId: userId.trim().toLowerCase() })
  }

  const sourceOf = (p: Extract<Phase, { kind: 'denied' | 'profile' }>): IdentitySource | null => {
    if (p.method === 'certificate') {
      const cert = STAFF_CERTIFICATES.find(c => c.id === p.certId)
      return cert ? { method: 'certificate', cert } : null
    }
    const account = p.userId ? findAccount(p.userId) : undefined
    return account ? { method: 'password', account } : null
  }

  const rise = reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.25 } }
  const pinCert = phase.kind === 'pin' ? STAFF_CERTIFICATES.find(c => c.id === phase.certId) : undefined
  const src = phase.kind === 'denied' || phase.kind === 'profile' ? sourceOf(phase) : null
  const triesLeft = phase.kind === 'pin' ? MAX_PIN_TRIES - (pinFails[phase.certId] ?? 0) : MAX_PIN_TRIES

  return (
    <div className="flex min-h-full flex-col bg-canvas" data-testid="staff-signin">
      <GovHeader tagline={S.staffAccess} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <AnimatePresence mode="wait" initial={false}>
          {phase.kind === 'methods' && (
            <motion.div key="methods" {...rise}>
              <div className="mx-auto max-w-[1000px] px-4 pt-10 pb-12 sm:px-6 sm:pt-14">
                <h1 className="text-center font-display text-[28px] leading-tight font-bold text-ink sm:text-[34px]">{tr(S.startTitle)}</h1>
                <p className="mt-3 text-center text-[17px] text-muted">{tr(S.startSubtitle)}</p>
                <div className="mt-9 grid gap-6 md:grid-cols-2" data-testid="staff-methods">
                  <MethodCard
                    testId="method-certificate"
                    art={<CertArt />}
                    title={tr(S.methodCert)}
                    body={tr(S.methodCertBody)}
                    cta={tr(S.methodCertCta)}
                    recommended
                    buttonRef={certBtn}
                    onSelect={() => setPickerOpen(true)}
                  />
                  <MethodCard
                    testId="method-password"
                    art={<PasswordArt />}
                    title={tr(S.methodPassword)}
                    body={tr(S.methodPasswordBody)}
                    cta={tr(S.methodPasswordCta)}
                    buttonRef={pwBtn}
                    onSelect={() => { setPwWrong(0); setPhase({ kind: 'password' }) }}
                  />
                </div>
                {error && <p role="alert" className="mt-6 rounded-[2px] border border-danger/40 bg-danger-soft px-3 py-2 text-[15px] text-danger">{error}</p>}
                <DemoAccess />
              </div>
              <div className="bg-band">
                <div className="mx-auto grid max-w-[1000px] gap-3 px-4 py-7 text-[15px] leading-relaxed text-ink sm:px-6">
                  <p>{tr(S.startBody)}</p>
                  <p className="text-muted">{tr(S.noSelfRegister)}</p>
                  <p>{tr(S.citizenHere)} <Link to={PATHS.citizen} className="gov-link rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-brand">{tr(S.goApply)}</Link></p>
                  <p className="text-[14px] text-muted"><span className="font-bold text-ink">{tr(C.keyRule)}:</span> {tr(KEY_RULE)}</p>
                </div>
              </div>
            </motion.div>
          )}

          {phase.kind === 'pin' && pinCert && (
            <motion.div key={`pin-${pinCert.id}`} {...rise} className="px-4 py-10 sm:px-6 sm:py-14">
              <PinStep
                cert={pinCert}
                onSubmit={submitPin}
                onBack={() => toMethods('certificate')}
                onChangeCert={() => setPickerOpen(true)}
                checking={checking}
                wrong={pinWrong}
                triesLeft={triesLeft}
                lockedFor={certLockedFor}
              />
              {error && <p role="alert" className="mx-auto mt-4 max-w-[520px] text-[15px] text-danger">{error}</p>}
              <DemoAccess certId={pinCert.id} compact />
            </motion.div>
          )}

          {phase.kind === 'password' && (
            <motion.div key="password" {...rise} className="px-4 py-10 sm:px-6 sm:py-14">
              <PasswordStep onSubmit={submitPassword} onBack={() => toMethods('password')} checking={checking} wrong={pwWrong > 0} attempt={pwWrong} />
              <DemoAccess compact />
            </motion.div>
          )}

          {phase.kind === 'denied' && src && (
            <motion.div key="denied" {...rise} className="px-4 py-10 sm:px-6 sm:py-14">
              <Denied
                source={src}
                reason={phase.reason}
                onRetry={() => {
                  if (phase.method === 'certificate') { setPhase({ kind: 'methods' }); setPickerOpen(true) }
                  else { setPwWrong(0); setPhase({ kind: 'password' }) }
                }}
                onMethods={() => toMethods()}
              />
            </motion.div>
          )}

          {phase.kind === 'profile' && src && (
            <motion.div key="profile" {...rise} className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-12">
              <div className="rounded-[4px] border border-line border-t-4 border-t-brand bg-surface p-6 text-ink sm:p-8" data-testid="staff-profile-form">
                <ProfileForm
                  officerId={phase.officerId}
                  source={src}
                  existing={officerProfiles?.[phase.officerId]}
                  mode="first"
                  onDone={() => undefined}
                  onCancel={() => toMethods()}
                  cancelLabel={tr(S.useOtherMethod)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CertificatePicker
        open={pickerOpen}
        onOpenChange={o => { setPickerOpen(o); if (!o && phase.kind === 'methods') later(() => certBtn.current?.focus(), 0) }}
        onChoose={chooseCert}
      />
    </div>
  )
}
