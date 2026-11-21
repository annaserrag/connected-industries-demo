/**
 * Citizen sign-in / create-account screen (branch feature/citizen-accounts).
 * No demo identities are listed anywhere: the team's demo logins live only in the README.
 */
import { useId, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle, BookOpen, ChevronDown, Eye, EyeOff, FileText, FlaskConical, IdCard, KeyRound, LogIn, ShieldCheck, UserPlus,
} from 'lucide-react'
import { cn } from '@/ui'
import { actions, useClave } from '@/core/store'
import { ageOn, documentsForCountry, isValidName, NAME_MAX_LENGTH, parseIsoDate, SIGNUP_MAX_AGE } from '@/core/accounts'
import { DOCUMENTS, PASSWORD_MIN_LENGTH, SIGNUP_COUNTRIES, SIGNUP_MIN_AGE } from '@/contract/seed'
import type { Bilingual, DocumentType, SignUpResult } from '@/contract/types'
import { C, fill } from './copy'
import { BigButton, OptionCard } from './components/basics'
import { flowPath } from './Shell'
import { useGo, useReduced, useTr } from './hooks'

type Mode = 'signin' | 'signup'

/* ---------------------------------------------------------- form pieces */

const inputCls =
  'h-12 w-full rounded-[14px] bg-surface px-4 text-[16px] text-ink ring-1 ring-inset ring-line-strong/70 transition-shadow placeholder:text-muted/80 ' +
  'hover:ring-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger'

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-danger">
      <AlertCircle size={15} className="mt-px shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

function Hint({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return <p id={id} className="text-[13px] leading-snug text-muted">{children}</p>
}

type TextFieldProps = {
  label: string
  hint?: string
  error?: string
  /** Rendered inside the input box, on the right (e.g. show/hide toggle). */
  trailing?: ReactNode
  inputRef?: React.Ref<HTMLInputElement>
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>

function TextField({ label, hint, error, trailing, inputRef, id: idProp, ...input }: TextFieldProps) {
  const auto = useId()
  const id = idProp ?? auto
  const hintId = `${id}-hint`
  const errId = `${id}-error`
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[14px] font-semibold text-ink">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputCls, trailing && 'pr-14')}
          {...input}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      <FieldError id={errId}>{error}</FieldError>
      <Hint id={hintId}>{hint}</Hint>
    </div>
  )
}

function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const { tr } = useTr()
  const [shown, setShown] = useState(false)
  const auto = useId()
  const id = props.id ?? auto
  return (
    <TextField
      {...props}
      id={id}
      type={shown ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-controls={id}
          aria-pressed={shown}
          aria-label={tr(shown ? C.hidePassword : C.showPassword)}
          title={tr(shown ? C.hidePassword : C.showPassword)}
          className="grid size-10 place-items-center rounded-[12px] text-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
        >
          {shown ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      }
    />
  )
}

function FormAlert({ children, id }: { children?: ReactNode; id?: string }) {
  return (
    <div aria-live="assertive" aria-atomic="true">
      {children && (
        <div id={id} role="alert" className="flex items-start gap-2.5 rounded-[14px] bg-danger-soft p-3.5 text-[14px] font-medium leading-snug text-danger">
          <AlertCircle size={18} className="mt-px shrink-0" aria-hidden />
          <span>{children}</span>
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- sign in */

function SignInForm({ onSwitch }: { onSwitch: () => void }) {
  const { tr } = useTr()
  const go = useGo()
  const [doc, setDoc] = useState('')
  const [pwd, setPwd] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [failed, setFailed] = useState(false)
  const docRef = useRef<HTMLInputElement>(null)
  const pwdRef = useRef<HTMLInputElement>(null)

  const docErr = submitted && !doc.trim() ? tr(C.errDocNumberRequired) : undefined
  const pwdErr = submitted && !pwd ? tr(C.errPasswordRequired) : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setFailed(false)
    if (!doc.trim()) { docRef.current?.focus(); return }
    if (!pwd) { pwdRef.current?.focus(); return }
    let res: ReturnType<typeof actions.citizenSignIn> = { ok: false, reason: 'invalid_credentials' }
    try { res = actions.citizenSignIn(doc, pwd) } catch (err) { console.warn('[citizen] sign-in', err) }
    if (!res.ok) {
      setFailed(true)
      setPwd('')
      pwdRef.current?.focus()
      return
    }
    const c = useClave.getState().cases[res.caseId]
    go(c ? flowPath(c) : '/citizen', { replace: true })
  }

  return (
    <form onSubmit={submit} noValidate aria-describedby={failed ? 'signin-failed' : undefined} className="space-y-4" data-testid="signin-form">
      <FormAlert id="signin-failed">{failed ? tr(C.invalidCredentials) : null}</FormAlert>
      <TextField
        inputRef={docRef}
        label={tr(C.docNumber)}
        hint={tr(C.docNumberHint)}
        error={docErr}
        name="username"
        autoComplete="username"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        placeholder="DEMO-…"
        value={doc}
        onChange={e => { setDoc(e.target.value); setFailed(false) }}
        data-testid="signin-doc"
      />
      <PasswordField
        inputRef={pwdRef}
        label={tr(C.password)}
        error={pwdErr}
        name="password"
        autoComplete="current-password"
        value={pwd}
        onChange={e => { setPwd(e.target.value); setFailed(false) }}
        data-testid="signin-password"
      />
      <BigButton type="submit"><LogIn size={18} aria-hidden /> {tr(C.signInCta)}</BigButton>
      <p className="text-center text-[14px] text-muted">
        {tr(C.noAccountYet)}{' '}
        <button type="button" onClick={onSwitch} className="rounded font-semibold text-brand underline decoration-brand/30 underline-offset-[3px] hover:decoration-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30">
          {tr(C.createOne)}
        </button>
      </p>
    </form>
  )
}

/* ------------------------------------------------------- create account */

type SignUpField = 'name' | 'dob' | 'country' | 'doc' | 'pwd' | 'pwd2'
const FIELD_ORDER: SignUpField[] = ['name', 'dob', 'country', 'doc', 'pwd', 'pwd2']

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const docIcon = (d: DocumentType) =>
  d === 'PASSPORT' ? <BookOpen size={20} /> : d === 'NIE_PAPER' || d === 'RED_CARD' ? <FileText size={20} /> : <IdCard size={20} />

function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const { tr } = useTr()
  const go = useGo()
  const reduced = useReduced()
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [country, setCountry] = useState('')
  const [doc, setDoc] = useState<DocumentType | ''>('')
  const [docCleared, setDocCleared] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [touched, setTouched] = useState<Partial<Record<SignUpField, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const refs = useRef<Partial<Record<SignUpField, HTMLElement | null>>>({})
  const docLegendId = useId()

  const countryIndex = country === '' ? -1 : Number(country)
  const allowedDocs = useMemo(() => documentsForCountry(countryIndex), [countryIndex])

  const errors = useMemo(() => {
    const e: Partial<Record<SignUpField, string>> = {}
    if (!isValidName(name)) e.name = tr(C.errName)
    if (!dob) e.dob = tr(C.errDobRequired)
    else {
      const age = ageOn(dob)
      if (!parseIsoDate(dob) || age === null || age > SIGNUP_MAX_AGE || age < 0) e.dob = tr(C.errDobInvalid)
      else if (age < SIGNUP_MIN_AGE) e.dob = fill(tr(C.errUnderage), { n: SIGNUP_MIN_AGE })
    }
    if (countryIndex < 0) e.country = tr(C.errCountry)
    if (!doc) e.doc = docCleared ? tr(C.errDocForCountry) : tr(C.errDocType)
    else if (!allowedDocs.includes(doc)) e.doc = tr(C.errDocForCountry)
    if (pwd.length < PASSWORD_MIN_LENGTH) e.pwd = fill(tr(C.errWeakPassword), { n: PASSWORD_MIN_LENGTH })
    if (!pwd2 || pwd2 !== pwd) e.pwd2 = tr(C.errMismatch)
    return e
  }, [name, dob, countryIndex, doc, docCleared, allowedDocs, pwd, pwd2, tr])

  const show = (f: SignUpField) => ((submitted || touched[f]) ? errors[f] : undefined)
  const blur = (f: SignUpField) => () => setTouched(t => ({ ...t, [f]: true }))

  const onCountry = (v: string) => {
    setCountry(v)
    setTouched(t => ({ ...t, country: true }))
    const allowed = documentsForCountry(v === '' ? -1 : Number(v))
    if (doc && !allowed.includes(doc)) {
      setDoc('')
      setDocCleared(true)
      setTouched(t => ({ ...t, doc: true }))
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setFormError(null)
    const first = FIELD_ORDER.find(f => errors[f])
    if (first) {
      const el = refs.current[first]
      el?.focus()
      el?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
      return
    }
    let res: SignUpResult | null = null
    try {
      res = actions.citizenSignUp({ fullName: name, dateOfBirth: dob, countryIndex, documentType: doc as DocumentType, password: pwd })
    } catch (err) {
      console.warn('[citizen] sign-up', err)
    }
    if (!res) { setFormError(tr(C.errGeneric)); return }
    if (!res.ok) {
      const map: Record<typeof res.reason, Bilingual> = {
        invalid_name: C.errName, underage: C.errUnderage, weak_password: C.errWeakPassword, invalid_document_for_country: C.errDocForCountry,
      }
      setFormError(fill(tr(map[res.reason]), { n: res.reason === 'underage' ? SIGNUP_MIN_AGE : PASSWORD_MIN_LENGTH }))
      return
    }
    go(`/citizen/welcome/${res.caseId}`, { replace: true })
  }

  const docErr = show('doc')
  const docErrId = `${docLegendId}-error`

  return (
    <form onSubmit={submit} noValidate className="space-y-5" data-testid="signup-form">
      <FormAlert id="signup-error">{submitted && FIELD_ORDER.some(f => errors[f]) ? tr(C.fixFields) : formError}</FormAlert>
      <TextField
        inputRef={el => { refs.current.name = el }}
        label={tr(C.fullName)}
        hint={tr(C.fullNameHint)}
        error={show('name')}
        name="name"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={NAME_MAX_LENGTH}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={blur('name')}
        data-testid="signup-name"
      />
      <TextField
        inputRef={el => { refs.current.dob = el }}
        label={tr(C.dateOfBirth)}
        error={show('dob')}
        type="date"
        name="bday"
        autoComplete="bday"
        min="1900-01-01"
        max={todayIso()}
        value={dob}
        onChange={e => setDob(e.target.value)}
        onBlur={blur('dob')}
        data-testid="signup-dob"
      />

      <div className="space-y-1.5">
        <label htmlFor="signup-country" className="block text-[14px] font-semibold text-ink">{tr(C.nationality)}</label>
        <div className="relative">
          <select
            id="signup-country"
            ref={el => { refs.current.country = el }}
            value={country}
            onChange={e => onCountry(e.target.value)}
            onBlur={blur('country')}
            aria-invalid={show('country') ? true : undefined}
            aria-describedby={show('country') ? 'signup-country-error' : undefined}
            className={cn(inputCls, 'appearance-none pr-11', country === '' && 'text-muted')}
            data-testid="signup-country"
          >
            <option value="" disabled>{tr(C.chooseNationality)}</option>
            {SIGNUP_COUNTRIES.map((c, i) => <option key={c.name.en} value={i} className="text-ink">{tr(c.name)}</option>)}
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        </div>
        <FieldError id="signup-country-error">{show('country')}</FieldError>
      </div>

      <fieldset
        aria-describedby={docErr ? docErrId : `${docLegendId}-hint`}
        aria-invalid={docErr ? true : undefined}
        className="space-y-2"
        data-testid="signup-doc"
      >
        <legend id={docLegendId} className="mb-1.5 block text-[14px] font-semibold text-ink">{tr(C.documentType)}</legend>
        {allowedDocs.length === 0 ? (
          <p id={`${docLegendId}-hint`} className="rounded-[14px] border border-dashed border-line-strong/50 p-3.5 text-[13px] leading-snug text-muted">{tr(C.documentTypeFirst)}</p>
        ) : (
          <div className="space-y-2" ref={el => { refs.current.doc = el?.querySelector('input') ?? null }}>
            <AnimatePresence initial={false}>
              {allowedDocs.map(d => (
                <motion.div key={d} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <OptionCard
                    name="signup-document"
                    value={d}
                    checked={doc === d}
                    onChange={v => { setDoc(v as DocumentType); setDocCleared(false); setTouched(t => ({ ...t, doc: true })) }}
                    title={tr(DOCUMENTS[d].label)}
                    sub={tr(DOCUMENTS[d].hasChip ? C.hasChip : C.noChip)}
                    icon={docIcon(d)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        <FieldError id={docErrId}>{docErr}</FieldError>
      </fieldset>

      <PasswordField
        inputRef={el => { refs.current.pwd = el }}
        label={tr(C.newPassword)}
        hint={fill(tr(C.newPasswordHint), { n: PASSWORD_MIN_LENGTH })}
        error={show('pwd')}
        name="new-password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        value={pwd}
        onChange={e => setPwd(e.target.value)}
        onBlur={blur('pwd')}
        data-testid="signup-password"
      />
      <PasswordField
        inputRef={el => { refs.current.pwd2 = el }}
        label={tr(C.confirmPassword)}
        error={show('pwd2')}
        name="confirm-password"
        autoComplete="new-password"
        value={pwd2}
        onChange={e => setPwd2(e.target.value)}
        onBlur={blur('pwd2')}
        data-testid="signup-password2"
      />

      <div className="flex gap-3 rounded-[14px] bg-surface p-3.5 text-[13px] leading-snug text-ink ring-1 ring-line" data-testid="real-doc-note">
        <ShieldCheck size={18} className="mt-px shrink-0 text-brand" aria-hidden />
        <p>{tr(C.realDocNote)}</p>
      </div>

      <BigButton type="submit"><UserPlus size={18} aria-hidden /> {tr(C.createAccountCta)}</BigButton>
      <p className="text-center text-[14px] text-muted">
        {tr(C.haveAccount)}{' '}
        <button type="button" onClick={onSwitch} className="rounded font-semibold text-brand underline decoration-brand/30 underline-offset-[3px] hover:decoration-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30">
          {tr(C.signInInstead)}
        </button>
      </p>
    </form>
  )
}

/* ---------------------------------------------------------------- screen */

/** Sign in / Create account. `notice` explains why a deep link landed here. */
export function SignIn({ notice }: { notice?: 'signedOut' | 'other' }) {
  const { tr } = useTr()
  const reduced = useReduced()
  const { search } = useLocation()
  const [mode, setMode] = useState<Mode>(() => (new URLSearchParams(search).get('mode') === 'signup' ? 'signup' : 'signin'))
  const tabs: { value: Mode; label: Bilingual; icon: ReactNode }[] = [
    { value: 'signin', label: C.tabSignIn, icon: <KeyRound size={16} aria-hidden /> },
    { value: 'signup', label: C.tabSignUp, icon: <UserPlus size={16} aria-hidden /> },
  ]
  const switchTo = (m: Mode) => {
    setMode(m)
    requestAnimationFrame(() => document.getElementById(`account-tab-${m}`)?.focus())
  }

  return (
    <div data-testid="citizen-signin">
      <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">{tr(C.welcomeTitle)}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr(C.welcomeBody)}</p>

      {notice && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-[14px] bg-warning-soft p-3.5 text-[14px] font-medium leading-snug text-warning" data-testid="signin-notice">
          <AlertCircle size={18} className="mt-px shrink-0" aria-hidden />
          {tr(notice === 'other' ? C.otherCaseNote : C.signedOutNote)}
        </p>
      )}

      <Tabs.Root value={mode} onValueChange={v => setMode(v as Mode)} className="mt-6">
        <Tabs.List aria-label={tr(C.accountModes)} className="grid grid-cols-2 rounded-[16px] bg-surface-2 p-1 ring-1 ring-inset ring-line">
          {tabs.map(t => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              id={`account-tab-${t.value}`}
              className={cn(
                'relative z-0 inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] text-[14px] font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30',
                mode === t.value ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {mode === t.value && (
                <motion.span
                  layoutId="account-tab-pill"
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 -z-10 rounded-[12px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-6px_rgba(0,0,0,0.12)]"
                />
              )}
              {t.icon}{tr(t.label)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="mt-5">
          <Tabs.Content value="signin" forceMount className="rounded-[16px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas data-[state=inactive]:hidden">
            <SignInForm onSwitch={() => switchTo('signup')} />
          </Tabs.Content>
          <Tabs.Content value="signup" forceMount className="rounded-[16px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas data-[state=inactive]:hidden">
            <SignUpForm onSwitch={() => switchTo('signin')} />
          </Tabs.Content>
        </div>
      </Tabs.Root>

      <aside aria-labelledby="proto-title" className="mt-6 flex gap-3 rounded-[16px] bg-sim-soft p-4 text-[13px] leading-relaxed text-ink" data-testid="prototype-note">
        <FlaskConical size={18} className="mt-0.5 shrink-0 text-sim" aria-hidden />
        <div>
          <p id="proto-title" className="font-semibold text-sim">{tr(C.protoTitle)}</p>
          <p className="mt-0.5 text-ink/90">{tr(C.protoBody)}</p>
        </div>
      </aside>
      <p className="mt-4 text-center text-xs text-muted">{tr(C.fictional)}</p>
    </div>
  )
}
