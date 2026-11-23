/**
 * Citizen sign-in / create-account screen, laid out like the Cl@ve identification gateway:
 * centred title, then a grid of method cards (applicant number + password, create an account).
 * No test identities are listed anywhere: the team's accounts live only in the README.
 */
import { useId, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import {
  AlertCircle, ArrowUpRight, BookOpen, ChevronDown, Eye, EyeOff, FileText, IdCard, LogIn, ShieldCheck, UserPlus,
} from 'lucide-react'
import { MethodCard, cn } from '@/ui'
import { actions, useClave } from '@/core/store'
import { ageOn, documentsForCountry, isValidName, NAME_MAX_LENGTH, parseIsoDate, SIGNUP_MAX_AGE } from '@/core/accounts'
import { DOCUMENTS, PASSWORD_MIN_LENGTH, SIGNUP_COUNTRIES, SIGNUP_MIN_AGE, fictionalDniNie } from '@/contract/seed'
import type { Bilingual, DocumentType, SignUpResult } from '@/contract/types'
import { C, fill } from './copy'
import { BigButton, OptionCard } from './components/basics'
import { flowPath } from './Shell'
import { useGo, useReduced, useTr } from './hooks'

type Mode = 'signin' | 'signup'

/* ---------------------------------------------------------- form pieces */

const inputCls =
  'h-12 w-full rounded-[2px] border border-line-strong bg-surface px-4 text-[16px] text-ink transition-shadow placeholder:text-muted ' +
  'hover:border-ink focus-visible:border-brand focus-visible:shadow-[inset_0_0_0_1px_var(--color-brand)] ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--color-danger)]'

/** Example shown in the sign-in placeholder: NIE-shaped with a deliberately wrong check letter. */
const EXAMPLE_NUMBER = fictionalDniNie('Y', 1234567)

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="flex items-start gap-1.5 text-[14px] font-bold leading-snug text-danger">
      <AlertCircle size={15} className="mt-px shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

function Hint({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return <p id={id} className="text-[14px] leading-snug text-muted">{children}</p>
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
      <label htmlFor={id} className="block text-[15px] font-bold text-ink">{label}</label>
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
          className="grid size-10 place-items-center rounded-[2px] text-muted hover:bg-surface-2 hover:text-ink"
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
        <div id={id} role="alert" className="flex items-start gap-2.5 rounded-[2px] border-l-4 border-danger bg-danger-soft p-3.5 text-[15px] font-semibold leading-snug text-danger">
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
        placeholder={fill(tr(C.signInPlaceholder), { example: EXAMPLE_NUMBER })}
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
      <p className="text-center text-[15px] text-muted">
        {tr(C.noAccountYet)}{' '}
        <button type="button" onClick={onSwitch} className="gov-link">
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
        invalid_document_number: C.errGeneric, real_document_number: C.errGeneric, duplicate_document: C.errGeneric, invalid_expiry: C.errGeneric,
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
        <label htmlFor="signup-country" className="block text-[15px] font-bold text-ink">{tr(C.nationality)}</label>
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
        <legend id={docLegendId} className="mb-1.5 block text-[15px] font-bold text-ink">{tr(C.documentType)}</legend>
        {allowedDocs.length === 0 ? (
          <p id={`${docLegendId}-hint`} className="rounded-[2px] border border-dashed border-line-strong p-3.5 text-[14px] leading-snug text-muted">{tr(C.documentTypeFirst)}</p>
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

      <div className="flex gap-3 rounded-[2px] border-l-4 border-brand bg-brand-soft p-3.5 text-[14px] leading-snug text-ink" data-testid="real-doc-note">
        <ShieldCheck size={18} className="mt-px shrink-0 text-brand" aria-hidden />
        <p>{tr(C.realDocNote)}</p>
      </div>

      <BigButton type="submit"><UserPlus size={18} aria-hidden /> {tr(C.createAccountCta)}</BigButton>
      <p className="text-center text-[15px] text-muted">
        {tr(C.haveAccount)}{' '}
        <button type="button" onClick={onSwitch} className="gov-link">
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
  const firstField = (m: Mode) => document.querySelector<HTMLInputElement>(m === 'signin' ? '[data-testid="signin-doc"]' : '[data-testid="signup-name"]')
  const open = (m: Mode) => {
    setMode(m)
    requestAnimationFrame(() => {
      const el = firstField(m)
      el?.focus({ preventScroll: true })
      el?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    })
  }
  const panel = (m: Mode, content: ReactNode) => (
    <AnimatePresence initial={false}>
      {mode === m && (
        <motion.div
          key={m}
          id={`${m}-panel`}
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: reduced ? 0.1 : 0.22 }}
          className="overflow-hidden"
        >
          <div className="mt-6 border-t border-line pt-6">{content}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div data-testid="citizen-signin" className="mx-auto w-full max-w-[980px]">
      <div className="text-center">
        <h1 className="font-display text-[26px] leading-tight font-bold text-ink sm:text-[34px]">{tr(C.welcomeTitle)}</h1>
        <p className="mt-2 text-[17px] text-muted sm:text-[19px]">{tr(C.welcomeBody)}</p>
        <p className="mt-3 text-[15px]">
          <Link to="/help" className="gov-link inline-flex items-center gap-1">{tr(C.whatIsClave)}<ArrowUpRight size={15} aria-hidden /></Link>
        </p>
      </div>

      {notice && (
        <p role="status" className="mx-auto mt-6 flex max-w-[640px] items-start gap-2 rounded-[2px] border-l-4 border-warning bg-warning-soft p-3.5 text-[15px] font-semibold leading-snug text-warning" data-testid="signin-notice">
          <AlertCircle size={18} className="mt-px shrink-0" aria-hidden />
          {tr(notice === 'other' ? C.otherCaseNote : C.signedOutNote)}
        </p>
      )}

      <div role="group" aria-label={tr(C.methodsLabel)} className="mt-8 grid items-start gap-5 md:grid-cols-2 md:gap-6">
        <MethodCard
          testId="method-signin"
          illustration="password"
          title={tr(C.methodSignInTitle)}
          description={tr(C.methodSignInBody)}
          actionLabel={<><LogIn size={18} aria-hidden />{tr(C.methodSignInCta)}</>}
          onAction={() => open('signin')}
          expanded={mode === 'signin'}
          controls="signin-panel"
          active={mode === 'signin'}
        >
          {panel('signin', <SignInForm onSwitch={() => open('signup')} />)}
        </MethodCard>
        <MethodCard
          testId="method-signup"
          illustration="new-account"
          tag={tr(C.methodTagNew)}
          title={tr(C.methodSignUpTitle)}
          description={tr(C.methodSignUpBody)}
          actionLabel={<><UserPlus size={18} aria-hidden />{tr(C.methodSignUpCta)}</>}
          onAction={() => open('signup')}
          expanded={mode === 'signup'}
          controls="signup-panel"
          active={mode === 'signup'}
        >
          {panel('signup', <SignUpForm onSwitch={() => open('signin')} />)}
        </MethodCard>
      </div>

      <aside aria-labelledby="security-title" className="mx-auto mt-8 flex max-w-[980px] gap-3 rounded-[2px] border border-line bg-band p-4 text-[15px] leading-relaxed text-ink" data-testid="security-note">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div>
          <p id="security-title" className="font-bold">{tr(C.protoTitle)}</p>
          <p className="mt-0.5 text-muted">{tr(C.protoBody)} {tr(C.fictional)}</p>
          <p className="mt-2">
            {tr(C.needHelp)} <Link to="/help?s=documents" className="gov-link">{tr(C.helpLink)}</Link>
          </p>
        </div>
      </aside>
    </div>
  )
}
