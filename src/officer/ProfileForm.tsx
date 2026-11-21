/* "Your job details" — first sign-in (and "Update details" in My profile). */
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { BadgeCheck, Building2, Info, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import type { OfficerProfile, OfficerRole, StaffAccount, StaffCertificate } from '@/contract/types'
import { REGISTRATION_AUTHORITIES, STAFF_CREDENTIAL_LABELS, STAFF_OFFICES, STAFF_POSTS, isFictionalPersonnelNumber } from '@/contract/seed'
import { actions, ClaveRuleError } from '@/core/store'
import { normaliseNrp } from '@/core/staff'
import { cn } from '@/ui'
import { S } from './copy'
import { formatDate, useLang, useTr } from './lib'
import { Btn } from './components/ui'

export const fieldCls =
  'h-11 w-full rounded-[4px] border bg-surface px-3 text-[15px] text-ink outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:bg-surface-2 disabled:text-muted'

/** Where the identity came from: the certificate unlocked with its PIN, or the staff user account. */
export type IdentitySource = { method: 'certificate'; cert: StaffCertificate } | { method: 'password'; account: StaffAccount }

/** Example NRP for this person: their own (fictional) DNI + "A" + a body code. */
export const nrpExample = (holderId: string) => `${holderId.toUpperCase()}A0611`

/** Post is stored in English; show it in the current language. */
export function postLabel(post: string, lang: 'en' | 'es'): string {
  return STAFF_POSTS.find(p => p.en === post || p.es === post)?.[lang] ?? post
}

function Labelled({ id, label, hint, error, children, required }: { id: string; label: string; hint?: ReactNode; error?: string; children: ReactNode; required?: boolean }) {
  const tr = useTr()
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-1 font-normal text-muted">· {tr(S.required)}</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
          <Info className="size-3.5 shrink-0" aria-hidden />{error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function CertificateFacts({ cert, compact }: { cert: StaffCertificate; compact?: boolean }) {
  const tr = useTr()
  const lang = useLang()
  const authority = REGISTRATION_AUTHORITIES.find(a => a.id === cert.authorityId)
  const rows: Array<[string, ReactNode]> = [
    [tr(S.name), cert.holderName],
    [tr(S.idNumber), <span className="font-mono text-[13px]">{cert.holderId}</span>],
    [tr(S.credential), tr(STAFF_CREDENTIAL_LABELS[cert.credential])],
    ...(authority ? [[tr(S.employingBody), tr(authority.name)] as [string, ReactNode]] : []),
    ...(cert.post ? [[tr(S.postInCert), tr(cert.post)] as [string, ReactNode]] : []),
    [tr(S.issuer), tr(S.issuerText)],
    [tr(S.validUntil), formatDate(cert.validUntil, lang)],
  ]
  return (
    <dl className={cn('grid gap-x-4 text-sm', compact ? 'grid-cols-[auto_1fr] gap-y-1.5' : 'grid-cols-[minmax(7rem,auto)_1fr] gap-y-2')}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 font-medium break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function AccountFacts({ account, compact }: { account: StaffAccount; compact?: boolean }) {
  const tr = useTr()
  const rows: Array<[string, ReactNode]> = [
    [tr(S.name), account.holderName],
    [tr(S.idNumber), <span className="font-mono text-[13px]">{account.holderId}</span>],
    [tr(S.userId), <span className="font-mono text-[13px]">{account.userId}</span>],
    [tr(S.signInMethod), tr(S.methodLabel.password)],
  ]
  return (
    <dl className={cn('grid gap-x-4 text-sm', compact ? 'grid-cols-[auto_1fr] gap-y-1.5' : 'grid-cols-[minmax(7rem,auto)_1fr] gap-y-2')}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 font-medium break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function SourceFacts({ source, compact }: { source: IdentitySource; compact?: boolean }) {
  return source.method === 'certificate' ? <CertificateFacts cert={source.cert} compact={compact} /> : <AccountFacts account={source.account} compact={compact} />
}

export function ProfileForm({
  officerId, source, existing, mode, onDone, onCancel, cancelLabel,
}: {
  officerId: string
  source: IdentitySource
  existing?: OfficerProfile
  mode: 'first' | 'update'
  onDone: () => void
  onCancel?: () => void
  cancelLabel?: string
}) {
  const tr = useTr()
  const lang = useLang()
  const uid = useId()
  const cert = source.method === 'certificate' ? source.cert : undefined
  const holderId = source.method === 'certificate' ? source.cert.holderId : source.account.holderId
  const defaultAuthority = existing?.authorityId ?? cert?.authorityId ?? ''
  const officesFor = (a: string) => STAFF_OFFICES.filter(o => o.authorityId === a)
  const [authorityId, setAuthorityId] = useState(defaultAuthority)
  const [officeCode, setOfficeCode] = useState(existing?.officeCode ?? (officesFor(defaultAuthority).length === 1 ? officesFor(defaultAuthority)[0].code : ''))
  const [post, setPost] = useState(existing?.post ?? cert?.post?.en ?? '')
  const [nrp, setNrp] = useState(existing?.personnelNumber ?? '')
  const [role, setRole] = useState<OfficerRole>(existing?.role ?? (cert?.post?.en === STAFF_POSTS[2].en ? 'supervisor' : 'registrar'))
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const offices = useMemo(() => officesFor(authorityId), [authorityId])
  const errors = {
    authority: !authorityId ? tr({ en: 'Pick the organisation you work for.', es: 'Elige el organismo en el que trabajas.' }) : '',
    office: !officeCode ? tr({ en: 'Pick your office.', es: 'Elige tu oficina.' }) : '',
    post: !post ? tr({ en: 'Pick your post.', es: 'Elige tu puesto.' }) : '',
    nrp: !isFictionalPersonnelNumber(normaliseNrp(nrp)) ? tr(S.nrpError) : normaliseNrp(nrp).slice(0, 9) !== holderId.toUpperCase() ? tr(S.nrpNotYours) : '',
  }
  const show = (k: keyof typeof errors) => (submitted || touched[k]) && errors[k] ? errors[k] : undefined
  const invalid = Object.values(errors).some(Boolean)

  const onAuthority = (v: string) => {
    setAuthorityId(v)
    const list = officesFor(v)
    setOfficeCode(list.length === 1 ? list[0].code : '')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (invalid) {
      const first = errors.authority ? 'org' : errors.office ? 'office' : errors.post ? 'post' : 'nrp'
      document.getElementById(`${uid}-${first}`)?.focus()
      return
    }
    try {
      actions.officerCompleteProfile(officerId, source.method, cert ? cert.id : null, { authorityId, officeCode, post, personnelNumber: normaliseNrp(nrp), role })
      onDone()
    } catch (err) {
      setServerError(err instanceof ClaveRuleError ? err.message : String((err as Error).message))
    }
  }

  // First sign-in: put the cursor on the first field still to fill (usually the NRP; the rest comes from the certificate).
  useEffect(() => {
    if (mode !== 'first') return
    const first = !authorityId ? 'org' : !officeCode ? 'office' : !post ? 'post' : 'nrp'
    document.getElementById(`${uid}-${first}`)?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const desc = (k: string, hasErr: boolean) => (hasErr ? `${uid}-${k}-err` : `${uid}-${k}-hint`)

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${uid}-title`} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid content-start gap-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-brand uppercase">{mode === 'first' ? tr(S.profileEyebrow) : tr(S.jobDetails)}</p>
          <h2 id={`${uid}-title`} className="mt-1 font-display text-2xl font-bold text-ink">{mode === 'first' ? tr(S.profileTitle) : tr(S.profileUpdateTitle)}</h2>
          <p className="mt-1 text-sm text-muted">{tr(S.profileBody)}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled id={`${uid}-org`} label={tr(S.organisation)} hint={tr(S.organisationHint)} error={show('authority')} required>
            <select
              id={`${uid}-org`}
              value={authorityId}
              onChange={e => onAuthority(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, authority: true }))}
              aria-invalid={Boolean(show('authority'))}
              aria-describedby={desc('org', Boolean(show('authority')))}
              className={cn(fieldCls, show('authority') ? 'border-danger' : 'border-line-strong')}
            >
              <option value="">{tr(S.pickOne)}</option>
              {REGISTRATION_AUTHORITIES.map(a => <option key={a.id} value={a.id}>{tr(a.name)}</option>)}
            </select>
          </Labelled>

          <Labelled id={`${uid}-office`} label={tr(S.office)} hint={tr(S.officeHint)} error={show('office')} required>
            <select
              id={`${uid}-office`}
              value={officeCode}
              disabled={!authorityId}
              onChange={e => setOfficeCode(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, office: true }))}
              aria-invalid={Boolean(show('office'))}
              aria-describedby={desc('office', Boolean(show('office')))}
              className={cn(fieldCls, show('office') ? 'border-danger' : 'border-line-strong')}
            >
              <option value="">{authorityId ? tr(S.pickOne) : tr(S.pickOrgFirst)}</option>
              {offices.map(o => <option key={o.code} value={o.code}>{tr(o.name)} · {o.code}</option>)}
            </select>
          </Labelled>

          <Labelled id={`${uid}-post`} label={tr(S.post)} error={show('post')} required>
            <select
              id={`${uid}-post`}
              value={post}
              onChange={e => setPost(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, post: true }))}
              aria-invalid={Boolean(show('post'))}
              aria-describedby={show('post') ? `${uid}-post-err` : undefined}
              className={cn(fieldCls, show('post') ? 'border-danger' : 'border-line-strong')}
            >
              <option value="">{tr(S.pickOne)}</option>
              {STAFF_POSTS.map(p => <option key={p.en} value={p.en}>{p[lang]}</option>)}
            </select>
          </Labelled>

          <Labelled id={`${uid}-nrp`} label={tr(S.nrp)} hint={tr(S.nrpHint)} error={show('nrp')} required>
            <input
              id={`${uid}-nrp`}
              value={nrp}
              onChange={e => setNrp(e.target.value.toUpperCase())}
              onBlur={() => setTouched(t => ({ ...t, nrp: true }))}
              placeholder={nrpExample(holderId)}
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-invalid={Boolean(show('nrp'))}
              aria-describedby={desc('nrp', Boolean(show('nrp')))}
              className={cn(fieldCls, 'font-mono tracking-wide', show('nrp') ? 'border-danger' : 'border-line-strong')}
            />
          </Labelled>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">{tr(S.role)}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['registrar', 'supervisor'] as const).map(r => (
              <label
                key={r}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-[4px] border-2 p-3.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/50',
                  role === r ? 'border-brand bg-brand-soft/50' : 'border-line-strong/40 bg-surface hover:bg-surface-2',
                )}
              >
                <input type="radio" name={`${uid}-role`} value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 size-4 accent-[var(--color-brand)]" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{tr(r === 'registrar' ? S.registrar : S.supervisor)}</span>
                  <span className="block text-[13px] text-muted">{tr(r === 'registrar' ? S.registrarHint : S.supervisorHint)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {(serverError || (submitted && invalid)) && (
          <p role="alert" className="rounded-[4px] border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
            {serverError ?? tr(S.fixErrors)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Btn variant="primary" size="lg" type="submit"><BadgeCheck className="size-4" aria-hidden />{mode === 'first' ? tr(S.saveOpen) : tr(S.saveChanges)}</Btn>
          {onCancel && <Btn variant="ghost" size="lg" onClick={onCancel}>{cancelLabel ?? tr(S.cancel)}</Btn>}
        </div>
      </div>

      <aside className="grid content-start gap-4">
        <section aria-labelledby={`${uid}-cert`} className="rounded-[4px] border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`${uid}-cert`} className="flex items-center gap-2 text-sm font-semibold text-ink"><KeyRound className="size-4 text-brand" aria-hidden />{tr(source.method === 'certificate' ? S.readFromCert : S.readFromAccount)}</h3>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted"><Lock className="size-3" aria-hidden />{tr(S.readOnly)}</span>
          </div>
          <div className="mt-3"><SourceFacts source={source} compact /></div>
          <p className="mt-3 flex items-start gap-1.5 text-[12px] font-medium text-success">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />{tr(S.authorised)}
          </p>
          
        </section>
        <section aria-labelledby={`${uid}-why`} className="rounded-[4px] border-l-4 border-brand bg-brand-soft/60 p-4">
          <h3 id={`${uid}-why`} className="flex items-center gap-2 text-sm font-semibold text-ink"><Building2 className="size-4 text-brand" aria-hidden />{tr(S.whyAsk)}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{tr(S.whyAskBody)}</p>
          <p className="mt-2 text-[13px] text-muted">{tr(S.noRealData)}</p>
        </section>
      </aside>
    </form>
  )
}
