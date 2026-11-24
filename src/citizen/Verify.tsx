/**
 * The citizen journey after the route assistant (SPEC §5): assisted / minor preludes, consent, the route's checks
 * (eID page, passport, chip, face, red card, DNI video), contact + SMS code, review and submit.
 *
 * The current step is DERIVED from what the case already records (resume-friendly). A step that just produced a
 * result the citizen must read (chip read, face passed, a Fallback offer, VER-07) is "held" until they press on.
 * Every outcome comes from the store actions (world + camera input + rules); nothing here decides one.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Check, CheckCircle2, LogOut, Send, ShieldCheck, Video } from 'lucide-react'
import { ProposedRuleTag, cn } from '@/ui'
import { actions, useClave } from '@/core/store'
import { evaluate } from '@/core/engine'
import type { CameraInput, Case, DocumentType, HelperRelation } from '@/contract/types'
import { DEMO_SMS_BANNER, HELPER_RELATION_LABELS, MSG, type MsgId } from '@/contract/messages'
import { DOCUMENTS, ROUTES, countryByName, fullName } from '@/contract/seed'
import { C, fill } from './copy'
import { BigButton, OptionCard, ProgressBar } from './components/basics'
import { ChipReadAnimation, FaceScanAnimation, useProgress } from './components/animations'
import {
  Alert, asHeading, CameraControl, CheckboxCard, ImageField, MsgBlock, ReadAloud, Scores, SelectInput, StepTitle, TextInput, demoPersonFor, isoInDays, msg,
} from './components/flow'
import { flowPath } from './Shell'
import { clearHelperDone, errText, markHelperDone, useCase, useGo, useTr } from './hooks'

type StepId =
  | 'helper' | 'ass01' | 'min01' | 'guardian' | 'proof' | 'minorData' | 'min02'
  | 'consent' | 'eid' | 'passport' | 'chip' | 'face' | 'redcard' | 'video' | 'contact' | 'review' | 'fallF'

const ANIM_MS = 1400
/** SMS code: wrong tries before a pause, and the pause (like the staff certificate PIN). */
const SMS_MAX_TRIES = 3
const SMS_PAUSE_S = 30

function stepsFor(c: Case): StepId[] {
  const s = c.session
  const r = s.route
  const list: StepId[] = []
  if (s.who === 'helping') list.push('helper', 'ass01')
  if (s.who === 'child') list.push('min01', 'guardian', 'proof', 'minorData', 'min02')
  if (r === 'F') return [...list, 'fallF']
  list.push('consent')
  if (r === 'A') list.push('eid')
  if (r === 'X') list.push('passport')
  if (r === 'B' || r === 'X') list.push('chip', 'face')
  if (r === 'X') list.push('redcard')
  if (r === 'C') list.push('video')
  list.push('contact', 'review')
  return list
}

function isDone(c: Case, step: StepId, acks: Set<StepId>): boolean {
  const s = c.session
  const consented = Boolean(s.consents.at && !s.consents.declined)
  switch (step) {
    case 'helper': return Boolean(s.helper)
    case 'ass01': return s.applicantConfirmed === true
    case 'min01': return acks.has('min01') || Boolean(s.guardianChecks)
    case 'guardian': return s.guardianChecks === 'passed'
    case 'proof': return Boolean(s.uploads.proof)
    case 'minorData': return Boolean(s.minor)
    case 'min02': return acks.has('min02') || consented
    case 'consent': return consented
    case 'eid': return Boolean(s.eidLogin)
    case 'passport': return Boolean(s.passport)
    case 'chip': return s.chipReads[s.chipReads.length - 1] === 'ok'
    case 'face': return evaluate(c).face.last?.result === 'pass'
    case 'redcard': return Boolean(s.uploads.redCard)
    case 'video': return evaluate(c).video.last === 'pass'
    case 'contact': return Boolean(s.contact?.smsConfirmed)
    case 'review': case 'fallF': return false
  }
}

/** Core rule errors are written in English for developers: show the citizen plain words in their language. */
function plainError(e: unknown, tr: (b: { en: string; es: string }) => string): string {
  const m = errText(e)
  if (/MSG-ASS-02/.test(m)) return tr(MSG['ASS-02'])
  if (/9 to 15 digits/.test(m)) return tr({ en: 'Write a mobile number with 9 to 15 digits.', es: 'Escribe un número de móvil de 9 a 15 cifras.' })
  if (/already linked/.test(m)) return tr({ en: 'This mobile number is already linked to another person’s Cl@ve. A mobile number can belong to only one person’s Cl@ve.', es: 'Este número de móvil ya está asociado a la Cl@ve de otra persona. Un número de móvil solo puede estar asociado a la Cl@ve de una persona.' })
  if (/valid email/.test(m)) return tr({ en: 'Write a valid email address.', es: 'Escribe un correo electrónico válido.' })
  if (/real person/.test(m)) return tr(C.errRealNumber)
  if (/under 18/.test(m)) return tr({ en: 'A minor is under 18.', es: 'Un menor tiene menos de 18 años.' })
  if (/YYYY-MM-DD/.test(m)) return tr({ en: 'Write the date as day, month and year.', es: 'Escribe la fecha con día, mes y año.' })
  if (/passport number/.test(m)) return tr({ en: 'Write the passport number (6 to 12 letters or digits).', es: 'Escribe el número de pasaporte (de 6 a 12 letras o cifras).' })
  if (/number on the card/.test(m)) return tr({ en: 'Write the number on the card.', es: 'Escribe el número de la tarjeta.' })
  if (/1\.5 MB/.test(m)) return tr(C.imageTooBig)
  if (/Add an image/.test(m)) return tr(C.imageWrongType)
  return m
}

/* ============================================================ small parts */

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-6 grid gap-3">{children}</div>
}

function FallbackChoices({ c, intro }: { c: Case; intro: MsgId }) {
  const { tr } = useTr()
  const go = useGo()
  const [err, setErr] = useState('')
  const m = msg('FALL-01')
  return (
    <div data-testid="fallback-offer">
      {intro !== 'FALL-01' && <MsgBlock id={intro} tone="warning" className="mb-4" />}
      <MsgBlock id="FALL-01" tone="info" />
      <Alert>{err}</Alert>
      <Actions>
        <BigButton testId="join-video-call" onClick={() => { try { actions.joinVideoCall(c.id); go(`/citizen/case/${c.id}`) } catch (e) { setErr(errText(e)) } }}>
          <Video size={18} aria-hidden />{tr(m.buttons![0])}
        </BigButton>
        <BigButton variant="secondary" testId="come-back-later" onClick={() => { try { actions.comeBackLater(c.id); go(`/citizen/case/${c.id}`) } catch (e) { setErr(errText(e)) } }}>
          {tr(m.buttons![1])}
        </BigButton>
      </Actions>
    </div>
  )
}

/* ================================================================ steps */

function HelperStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const demo = demoPersonFor(c)?.helper
  const [name, setName] = useState(c.session.helper?.name ?? demo?.name ?? '')
  const [rel, setRel] = useState<HelperRelation | ''>(c.session.helper?.relation ?? demo?.relation ?? '')
  const [mobile, setMobile] = useState(c.session.helper?.mobile ?? demo?.mobile ?? '')
  const [err, setErr] = useState('')
  const applicant = fullName(c.typed.data)
  return (
    <form data-testid="helper-form" noValidate onSubmit={e => {
      e.preventDefault()
      if (name.trim().length < 2) { setErr(tr({ en: 'Write the name of the person helping.', es: 'Escribe el nombre de quien ayuda.' })); return }
      if (!rel) { setErr(tr({ en: 'Choose the relation.', es: 'Elige la relación.' })); return }
      try { actions.setHelper(c.id, { name, relation: rel, mobile: mobile.trim() || undefined }) } catch (ex) { setErr(plainError(ex, tr)) }
    }}>
      <StepTitle sub={fill(tr(C.helperFormBody), { name: applicant })}>{tr(C.helperFormTitle)}</StepTitle>
      <div className="space-y-5">
        <TextInput label={tr(C.helperName)} name="helperName" autoComplete="off" value={name} onChange={e => setName(e.target.value)} data-testid="helper-name" />
        <fieldset>
          <legend className="mb-2 text-[15px] font-bold text-ink">{fill(tr(C.helperRelation), { name: c.typed.data.givenNames })}</legend>
          <div className="space-y-2">
            {(['family', 'friend', 'support'] as HelperRelation[]).map(r => (
              <OptionCard key={r} name="helperRelation" value={r} checked={rel === r} onChange={() => setRel(r)} title={tr(HELPER_RELATION_LABELS[r])} />
            ))}
          </div>
        </fieldset>
        <TextInput label={tr(C.helperMobile)} hint={fill(tr(C.helperMobileHint), { name: c.typed.data.givenNames })} type="tel" inputMode="tel" name="helperMobile" autoComplete="off" value={mobile} onChange={e => setMobile(e.target.value)} data-testid="helper-mobile" />
        <Alert>{err}</Alert>
      </div>
      <Actions><BigButton type="submit" testId="helper-continue">{tr(C.continue)}</BigButton></Actions>
    </form>
  )
}

function Ass01Step({ c }: { c: Case }) {
  const { tr } = useTr()
  const go = useGo()
  const m = msg('ASS-01')
  const helper = c.session.helper?.name ?? ''
  const stopped = c.session.applicantConfirmed === false
  const [again, setAgain] = useState(false)
  if (stopped && !again) {
    return (
      <div data-testid="assisted-stopped">
        <StepTitle sub={tr(C.stoppedBody)}>{tr(C.stoppedTitle)}</StepTitle>
        <Actions>
          <BigButton onClick={() => setAgain(true)}>{tr(C.back)}</BigButton>
          <BigButton variant="secondary" onClick={() => { actions.citizenSignOut(); clearHelperDone(); go('/citizen', { replace: true }) }}><LogOut size={18} aria-hidden />{tr(C.signOutSession)}</BigButton>
        </Actions>
      </div>
    )
  }
  return (
    <div data-testid="msg-ASS-01">
      <h1 className="font-display text-[26px] font-bold leading-tight text-ink">{tr(m.title!)}</h1>
      <p className="mt-3 rounded-card border border-line bg-surface p-4 text-[16px] leading-relaxed text-ink">{tr(m.forHelper as { en: string; es: string })}</p>
      <p className="mt-3 rounded-card border-l-4 border-brand bg-brand-soft p-4 text-[18px] font-semibold leading-relaxed text-ink">{fill(tr(m.forApplicant as { en: string; es: string }), { helper })}</p>
      <div className="mt-6 grid gap-3">
        <button type="button" data-testid="ass01-yes" onClick={() => { setAgain(false); actions.confirmApplicant(c.id, true) }}
          className="min-h-20 rounded-[2px] border-2 border-success bg-success px-5 text-[22px] font-bold text-white hover:brightness-95">
          {tr(m.buttons![0])}
        </button>
        <button type="button" data-testid="ass01-no" onClick={() => { setAgain(false); actions.confirmApplicant(c.id, false) }}
          className="min-h-20 rounded-[2px] border-2 border-line-strong bg-surface-2 px-5 text-[22px] font-bold text-ink hover:bg-line">
          {tr(m.buttons![1])}
        </button>
      </div>
    </div>
  )
}

function AckStep({ id, button, onAck }: { id: MsgId; button: string; onAck: () => void }) {
  return (
    <div>
      <MsgBlock id={id} as="h1" />
      <Actions><BigButton testId={`ack-${id}`} onClick={onAck}>{button}</BigButton></Actions>
    </div>
  )
}

/** Shared "press, animate, then ask the store" button. */
function useRun(ms = ANIM_MS) {
  const [running, setRunning] = useState(false)
  const [job, setJob] = useState<(() => void) | null>(null)
  const p = useProgress(running, ms, () => { setRunning(false); job?.() })
  return { running, progress: p, start: (fn: () => void) => { setJob(() => fn); setRunning(true) } }
}

function GuardianStep({ c, hold, release }: { c: Case; hold: () => void; release: () => void }) {
  const { tr } = useTr()
  const [camera, setCamera] = useState<CameraInput>('person')
  const [result, setResult] = useState<ReturnType<typeof actions.recordGuardianCheck> | null>(null)
  const run = useRun()
  const passed = result?.passed
  return (
    <div data-testid="guardian-check">
      <StepTitle sub={fill(tr(C.guardianCheckBody), { guardian: c.typed.data.givenNames })}>{tr(C.guardianCheckTitle)}</StepTitle>
      <MsgBlock id="VER-01" as="h3" className="mb-3" />
      <MsgBlock id="VER-02" as="h3" className="mb-4" />
      <FaceScanAnimation progress={passed ? 1 : run.running ? run.progress : 0} done={Boolean(passed)} />
      <div className="mt-4"><CameraControl value={camera} onChange={setCamera} disabled={run.running || passed} /></div>
      <div className="mt-4" aria-live="polite">
        {passed && <Alert tone="success" testId="guardian-passed">{tr(C.guardianPassed)}</Alert>}
        {result && !passed && <MsgBlock id={result.chip === 'failed' ? 'VER-03' : 'VER-05'} tone="warning" />}
      </div>
      <Actions>
        {passed ? <BigButton onClick={release} testId="step-continue">{tr(C.continue)}</BigButton> : (
          <BigButton disabled={run.running} testId="guardian-run" onClick={() => run.start(() => {
            const r = actions.recordGuardianCheck(c.id, camera)
            setResult(r)
            if (r.passed) hold()
          })}>{run.running ? tr(C.faceChecking) : result ? tr(MSG['VER-05'].button) : tr(C.guardianCheckCta)}</BigButton>
        )}
      </Actions>
    </div>
  )
}

function ProofStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const [img, setImg] = useState<{ name: string; dataUrl: string } | null>(null)
  const [err, setErr] = useState('')
  return (
    <div data-testid="proof-step">
      <StepTitle sub={tr(C.proofBody)}>{tr(C.proofTitle)}</StepTitle>
      <ImageField label={tr(C.proofTitle)} value={img} onChange={v => { setImg(v); setErr('') }} testId="proof-upload" />
      <div className="mt-3"><Alert>{err}</Alert></div>
      <Actions>
        <BigButton disabled={!img} testId="proof-continue" onClick={() => { try { actions.uploadProof(c.id, img!) } catch (e) { setErr(plainError(e, tr)) } }}>{tr(C.continue)}</BigButton>
      </Actions>
    </div>
  )
}

const MINOR_DOCS: DocumentType[] = ['TIE', 'PASSPORT', 'DNI', 'EU_EID']

function MinorDataStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const demo = demoPersonFor(c)?.minor
  const [given, setGiven] = useState(demo?.givenNames ?? '')
  const [sur, setSur] = useState(demo?.surnames ?? '')
  const [dob, setDob] = useState(demo?.dateOfBirth ?? '')
  const [type, setType] = useState<DocumentType>(demo?.document.type ?? 'TIE')
  const [num, setNum] = useState(demo?.document.number ?? '')
  const [exp, setExp] = useState(demo?.document.expiry ?? '')
  const [err, setErr] = useState('')
  return (
    <form data-testid="minor-form" noValidate onSubmit={e => {
      e.preventDefault()
      try {
        actions.setMinor(c.id, { givenNames: given, surnames: sur, dateOfBirth: dob, document: { type, number: num, expiry: exp, nationality: c.typed.nationality } })
      } catch (ex) { setErr(plainError(ex, tr)) }
    }}>
      <StepTitle>{tr(C.minorFormTitle)}</StepTitle>
      <div className="space-y-4">
        <TextInput label={tr(C.givenNames)} value={given} onChange={e => setGiven(e.target.value)} name="minorGiven" autoComplete="off" data-testid="minor-given" />
        <TextInput label={tr(C.surnames)} value={sur} onChange={e => setSur(e.target.value)} name="minorSurnames" autoComplete="off" data-testid="minor-surnames" />
        <TextInput label={tr(C.dateOfBirth)} type="date" value={dob} onChange={e => setDob(e.target.value)} name="minorDob" data-testid="minor-dob" />
        <SelectInput label={tr(C.minorDocType)} value={type} onChange={v => setType(v as DocumentType)} name="minorDocType" options={MINOR_DOCS.map(d => ({ value: d, label: tr(DOCUMENTS[d].label) }))} />
        <TextInput label={tr(C.documentNumber)} value={num} onChange={e => setNum(e.target.value)} name="minorDocNumber" autoComplete="off" autoCapitalize="characters" data-testid="minor-number" />
        <TextInput label={tr(C.expiryDate)} type="date" value={exp} onChange={e => setExp(e.target.value)} name="minorExpiry" data-testid="minor-expiry" />
        <Alert>{err}</Alert>
      </div>
      <Actions><BigButton type="submit" testId="minor-continue">{tr(C.continue)}</BigButton></Actions>
    </form>
  )
}

function ConsentStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const go = useGo()
  const route = c.session.route!
  const needFace = route === 'B' || route === 'X' || route === 'C'
  const needResidence = route !== 'X'
  const [face, setFace] = useState(false)
  const [residence, setResidence] = useState(false)
  const [back, setBack] = useState(false)
  const [err, setErr] = useState('')
  const declined = c.session.consents.declined && !back
  // Route C reads no chip (CON-03 without the chip sentence); Route X has no residence check (CON-01 without it).
  const con01: MsgId = route === 'X' ? 'CON-01X' : 'CON-01'
  const con03: MsgId = route === 'C' ? 'CON-03C' : 'CON-03'
  const ids: MsgId[] = [con01, 'CON-02', ...(needFace ? [con03] : []), ...(needResidence ? (['CON-04'] as MsgId[]) : []), 'CON-05']
  const readText = ids.map(id => `${tr(msg(id).title!)}. ${tr(msg(id))}${msg(id).checkbox ? ` ${tr(msg(id).checkbox!)}` : ''}`).join(' ')
  const ok = (!needFace || face) && (!needResidence || residence)
  const btns = msg('CON-BUTTONS').buttons!

  if (declined) {
    const m = msg('CON-06')
    return (
      <div data-testid="consent-declined">
        <MsgBlock id="CON-06" as="h1" />
        <Alert>{err}</Alert>
        <Actions>
          <BigButton variant="secondary" testId="con06-back" onClick={() => { setBack(true); setFace(false); setResidence(false) }}>{tr(m.buttons![0])}</BigButton>
          <BigButton testId="con06-video" onClick={() => { try { actions.joinVideoCall(c.id); go(`/citizen/case/${c.id}`) } catch (e) { setErr(errText(e)) } }}>
            <Video size={18} aria-hidden />{tr(m.buttons![1])}
          </BigButton>
        </Actions>
      </div>
    )
  }

  return (
    <div data-testid="consent-step">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-[2px] bg-brand-soft text-brand"><ShieldCheck size={24} aria-hidden /></span>
        <ReadAloud text={readText} />
      </div>
      <div className="space-y-4">
        <MsgBlock id={con01} as="h1" testId="msg-CON-01" />
        <MsgBlock id="CON-02" />
        {needFace && (
          <MsgBlock id={con03} testId="msg-CON-03">
            <div className="mt-3"><CheckboxCard checked={face} onChange={setFace} testId="consent-face" name="consentFace">{tr(msg(con03).checkbox!)}</CheckboxCard></div>
          </MsgBlock>
        )}
        {needResidence && (
          <MsgBlock id="CON-04">
            <div className="mt-3"><CheckboxCard checked={residence} onChange={setResidence} testId="consent-residence" name="consentResidence">{tr(msg('CON-04').checkbox!)}</CheckboxCard></div>
          </MsgBlock>
        )}
        {route === 'X' && <Alert tone="info">{tr(C.redCardNote)}</Alert>}
        <section data-testid="msg-CON-05" className="text-[15px] leading-relaxed text-muted">
          <h2 className="font-bold text-ink">{tr(msg('CON-05').title!)}</h2>
          <p>{tr(msg('CON-05'))} <Link to="/privacy" className="gov-link">{tr(msg('CON-05').title!)}</Link></p>
        </section>
        <Alert>{err}</Alert>
      </div>
      <Actions>
        <BigButton disabled={!ok} testId="consent-accept" onClick={() => {
          try { actions.giveConsents(c.id, { face: needFace ? face : undefined, residence: needResidence ? residence : undefined }) } catch (e) { setErr(errText(e)) }
        }}>{tr(btns[0])}</BigButton>
        <BigButton variant="secondary" testId="consent-decline" onClick={() => { try { setBack(false); actions.declineConsent(c.id) } catch (e) { setErr(errText(e)) } }}>{tr(btns[1])}</BigButton>
      </Actions>
    </div>
  )
}

function EidStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const country = countryByName(c.typed.nationality)
  const name = fullName(c.typed.data)
  return (
    <div data-testid="eid-page">
      <StepTitle>{asHeading(tr(msg('RA-07A').title!))}</StepTitle>
      <div className="overflow-hidden rounded-[2px] border border-line-strong bg-surface shadow-lg">
        <div className="flex items-center gap-2 bg-[hsl(215_20%_24%)] px-4 py-3 text-white">
          <span className="grid size-8 place-items-center rounded-full bg-white/15"><ShieldCheck size={16} aria-hidden /></span>
          <span className="text-[15px] font-bold">{fill(tr(C.eidHeader), { country: country ? tr(country.name) : c.typed.nationality })}</span>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-[15px] leading-relaxed text-ink">{tr(C.eidBody)}</p>
          <BigButton testId="eid-login" onClick={() => actions.recordEidLogin(c.id)}>{fill(tr(C.eidLogin), { name })}</BigButton>
          <p className="text-[13px] text-muted">{tr(C.eidMock)}</p>
        </div>
      </div>
    </div>
  )
}

function PassportStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const demo = demoPersonFor(c)?.passport
  const own = c.typed.type === 'PASSPORT' ? { number: c.typed.number, expiry: c.typed.expiry } : undefined
  const [num, setNum] = useState(c.session.passport?.number ?? demo?.number ?? own?.number ?? '')
  const [exp, setExp] = useState(c.session.passport?.expiry ?? demo?.expiry ?? own?.expiry ?? '')
  const [err, setErr] = useState('')
  return (
    <form data-testid="passport-step" noValidate onSubmit={e => { e.preventDefault(); try { actions.setPassport(c.id, { number: num, expiry: exp }) } catch (ex) { setErr(plainError(ex, tr)) } }}>
      <StepTitle sub={tr(C.passportBody)}>{tr(C.passportTitle)}</StepTitle>
      <div className="space-y-4">
        <TextInput label={tr(C.passportNumber)} value={num} onChange={e => setNum(e.target.value)} name="passportNumber" autoComplete="off" autoCapitalize="characters" data-testid="passport-number" />
        <TextInput label={tr(C.passportExpiry)} type="date" value={exp} onChange={e => setExp(e.target.value)} name="passportExpiry" data-testid="passport-expiry" />
        <Alert>{err}</Alert>
      </div>
      <Actions><BigButton type="submit" testId="passport-continue">{tr(C.continue)}</BigButton></Actions>
    </form>
  )
}

function ChipStep({ c, hold, release }: { c: Case; hold: () => void; release: () => void }) {
  const { tr } = useTr()
  const go = useGo()
  const [res, setRes] = useState<ReturnType<typeof actions.recordChipRead> | null>(null)
  const [err, setErr] = useState('')
  const run = useRun()
  const ok = res?.msg === 'VER-01'
  const doc = c.session.route === 'X' ? 'PASSPORT' : c.session.who === 'child' ? c.session.minor?.document.type ?? c.typed.type : c.typed.type
  const read = () => run.start(() => {
    try {
      const r = actions.recordChipRead(c.id)
      setRes(r)
      if (r.msg !== 'VER-03') hold()
    } catch (e) { setErr(errText(e)) }
  })
  return (
    <div data-testid="chip-step">
      {res?.msg === 'VER-04' ? <ChipGaveUp c={c} /> : res?.msg === 'VER-07' ? (
        <div>
          <MsgBlock id="VER-07" as="h1" tone="info" />
          <Actions><BigButton testId="see-status" onClick={() => go(`/citizen/case/${c.id}`)}>{tr(C.seeStatus)}</BigButton></Actions>
        </div>
      ) : (
        <>
          <MsgBlock id="VER-01" as="h1" className="mb-4" />
          {doc === 'TIE' && (c.session.who === 'child' ? c.session.minor?.document.can : c.typed.can) && (
            <p className="mb-3 rounded-card border border-line bg-surface p-3 text-[15px] text-ink" data-testid="chip-can">
              {tr(C.canLabel)}: <span className="font-mono font-bold">{c.session.who === 'child' ? c.session.minor?.document.can : c.typed.can}</span>
              <span className="mt-1 block text-[13px] text-muted">{tr(C.canHint)}</span>
            </p>
          )}
          <ChipReadAnimation progress={ok ? 1 : run.running ? run.progress : 0} done={ok} docLabel={tr(DOCUMENTS[doc].label)} />
          <div className="mt-3 min-h-6 text-center text-[16px] font-bold text-ink" aria-live="polite">
            {ok ? <span data-testid="chip-ok" className="inline-flex items-center gap-2 text-success"><CheckCircle2 size={20} aria-hidden />{tr(msg('VER-01').success as { en: string; es: string })}</span> : run.running ? tr(C.chipReading) : ''}
          </div>
          {res?.msg === 'VER-03' && !run.running && <MsgBlock id="VER-03" tone="warning" className="mt-3" />}
          <Alert>{err}</Alert>
          <Actions>
            {ok ? <BigButton onClick={release} testId="step-continue">{tr(C.continue)}</BigButton> : (
              <BigButton disabled={run.running} onClick={read} testId="chip-read">
                {run.running ? tr(C.chipReading) : res?.msg === 'VER-03' ? tr(MSG['VER-03'].button) : tr(MSG['VER-01'].button)}
              </BigButton>
            )}
          </Actions>
        </>
      )}
    </div>
  )
}

/**
 * Chip unreadable twice (GYC-02): MSG-VER-04, then the selfie liveness check still runs (there is no chip photo,
 * so no face match), then the Fallback choices (MSG-FALL-01).
 */
function ChipGaveUp({ c }: { c: Case }) {
  const { tr } = useTr()
  const [camera, setCamera] = useState<CameraInput>('person')
  const [res, setRes] = useState<ReturnType<typeof actions.recordFaceAttempt> | null>(null)
  const [err, setErr] = useState('')
  const run = useRun()
  const attempts = c.session.faceAttempts.length
  const done = Boolean(res && (res.result !== 'retry' || attempts >= 2))
  return (
    <div data-testid="chip-gave-up">
      <MsgBlock id="VER-04" tone="warning" className="mb-4" />
      {!done ? (
        <section data-testid="selfie-step">
          <StepTitle sub={tr(C.selfieBody)}>{tr(C.selfieTitle)}</StepTitle>
          <div role="img" aria-label={tr(C.cameraSilhouette)}>
            <FaceScanAnimation progress={run.running ? run.progress : 0} done={false} />
          </div>
          <div className="mt-4"><CameraControl value={camera} onChange={setCamera} disabled={run.running} /></div>
          <div className="mt-4" aria-live="polite">{res && !run.running && res.result === 'retry' && <MsgBlock id="VER-05" tone="warning" />}</div>
          <Alert>{err}</Alert>
          <Actions>
            <BigButton disabled={run.running} testId="selfie-run" onClick={() => run.start(() => {
              try { setRes(actions.recordFaceAttempt(c.id, camera)) } catch (e) { setErr(errText(e)) }
            })}>{run.running ? tr(C.faceChecking) : res ? tr(MSG['VER-05'].button) : tr(C.startSelfie)}</BigButton>
          </Actions>
        </section>
      ) : (
        <>
          {res?.result === 'pass' && <div className="mb-4"><Alert tone="success" testId="selfie-passed">{tr(C.selfieDone)}</Alert></div>}
          <FallbackChoices c={c} intro="FALL-01" />
        </>
      )}
    </div>
  )
}

function CameraStep({ c, kind, hold, release }: { c: Case; kind: 'face' | 'video'; hold: () => void; release: () => void }) {
  const { tr } = useTr()
  const go = useGo()
  const [camera, setCamera] = useState<CameraInput>('person')
  const [res, setRes] = useState<ReturnType<typeof actions.recordFaceAttempt> | null>(null)
  const [err, setErr] = useState('')
  const run = useRun(kind === 'video' ? ANIM_MS + 600 : ANIM_MS)
  const passed = res?.result === 'pass'
  if (res?.msg === 'FALL-01') {
    return (
      <div data-testid={`${kind}-step`}>
        <Scores liveness={res.liveness} faceMatch={res.faceMatch} />
        <div className="mt-3"><FallbackChoices c={c} intro="FALL-01" /></div>
      </div>
    )
  }
  if (res?.msg === 'VER-07') {
    // Chip integrity failed (GYC-07): a person reviews. No score and no "fraud" word for the citizen.
    return (
      <div data-testid={`${kind}-step`}>
        <MsgBlock id="VER-07" as="h1" tone="info" />
        <Actions><BigButton testId="see-status" onClick={() => go(`/citizen/case/${c.id}`)}>{tr(C.seeStatus)}</BigButton></Actions>
      </div>
    )
  }
  const retryMsg: MsgId = kind === 'face' ? 'VER-05' : 'VER-06'
  return (
    <div data-testid={`${kind}-step`}>
      {kind === 'face' ? <MsgBlock id="VER-02" as="h1" className="mb-4" /> : <MsgBlock id="RA-07C" as="h1" className="mb-4" />}
      <div role="img" aria-label={tr(C.cameraSilhouette)}>
        <FaceScanAnimation progress={passed ? 1 : run.running ? run.progress : 0} done={passed} />
      </div>
      <div className="mt-4"><CameraControl value={camera} onChange={setCamera} disabled={run.running || passed} /></div>
      <div className="mt-4 space-y-3" aria-live="polite">
        {passed && <Alert tone="success" testId={`${kind}-passed`}>{tr(kind === 'face' ? C.facePassed : C.dniPassed)}</Alert>}
        {res && !passed && !run.running && <MsgBlock id={retryMsg} tone="warning" />}
        {res && kind === 'face' && !run.running && <Scores liveness={res.liveness} faceMatch={res.faceMatch} />}
      </div>
      <Alert>{err}</Alert>
      <Actions>
        {passed ? <BigButton onClick={release} testId="step-continue">{tr(C.continue)}</BigButton> : (
          <BigButton disabled={run.running} testId={`${kind}-run`} onClick={() => run.start(() => {
            try {
              const r = kind === 'face' ? actions.recordFaceAttempt(c.id, camera) : actions.recordVideoAttempt(c.id, camera)
              setRes(r)
              if (r.result === 'pass' || r.msg === 'FALL-01' || r.msg === 'VER-07') hold()
            } catch (e) { setErr(errText(e)) }
          })}>
            {run.running ? tr(C.faceChecking) : res ? tr(MSG[retryMsg].button) : tr(kind === 'face' ? C.startFaceCheck : C.startDniVideo)}
          </BigButton>
        )}
      </Actions>
    </div>
  )
}

function RedCardStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const demo = demoPersonFor(c)?.redCard
  const [img, setImg] = useState<{ name: string; dataUrl: string } | null>(null)
  const [num, setNum] = useState(demo?.number ?? '')
  const [exp, setExp] = useState(demo ? isoInDays(demo.expiryDaysFromNow) : '')
  const [err, setErr] = useState('')
  return (
    <form data-testid="redcard-step" noValidate onSubmit={e => {
      e.preventDefault()
      if (!img) { setErr(tr(C.imageWrongType)); return }
      try { actions.uploadRedCard(c.id, img, { number: num, expiry: exp }) } catch (ex) { setErr(plainError(ex, tr)) }
    }}>
      <StepTitle sub={tr(C.redCardNote)}>{tr(C.redCardTitle)}</StepTitle>
      <div className="space-y-4">
        <ImageField label={tr(C.redCardPhoto)} value={img} onChange={v => { setImg(v); setErr('') }} testId="redcard-upload" />
        <TextInput label={tr(C.redCardNumber)} value={num} onChange={e => setNum(e.target.value)} name="redCardNumber" autoComplete="off" data-testid="redcard-number" />
        <TextInput label={tr(C.redCardExpiry)} type="date" value={exp} onChange={e => setExp(e.target.value)} name="redCardExpiry" data-testid="redcard-expiry" />
        <Alert>{err}</Alert>
      </div>
      <Actions><BigButton type="submit" testId="redcard-continue">{tr(C.continue)}</BigButton></Actions>
    </form>
  )
}

function ContactStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const demo = demoPersonFor(c)
  const child = c.session.who === 'child'
  const helping = c.session.who === 'helping'
  const [mobile, setMobile] = useState(c.session.contact?.mobile ?? demo?.contact.mobile ?? '')
  const [email, setEmail] = useState(c.session.contact?.email ?? (child ? demo?.minor?.email : demo?.contact.email) ?? '')
  const [sent, setSent] = useState(Boolean(c.session.contact))
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [wrong, setWrong] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const locked = secondsLeft > 0
  useEffect(() => {
    if (!locked) return
    const id = window.setTimeout(() => {
      setSecondsLeft(n => Math.max(0, n - 1))
      if (secondsLeft <= 1) setWrong(0)
    }, 1000)
    return () => window.clearTimeout(id)
  }, [locked, secondsLeft])
  return (
    <div data-testid="contact-step">
      {helping ? <MsgBlock id="ASS-02" as="h1" className="mb-4" /> : <StepTitle>{tr(C.contactTitle)}</StepTitle>}
      {!sent ? (
        <form noValidate onSubmit={e => {
          e.preventDefault()
          try { actions.setContact(c.id, { mobile, email: email.trim() || undefined }); setSent(true); setErr('') } catch (ex) { setErr(plainError(ex, tr)) }
        }}>
          <div className="space-y-4">
            <TextInput label={tr(child ? C.minorMobile : C.mobile)} type="tel" inputMode="tel" autoComplete="tel" name="mobile" value={mobile} onChange={e => setMobile(e.target.value)} data-testid="contact-mobile" />
            <TextInput label={tr(child ? C.guardianEmail : C.email)} type="email" autoComplete="email" name="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="contact-email" />
            <Alert>{err}</Alert>
          </div>
          <Actions><BigButton type="submit" testId="send-code"><Send size={18} aria-hidden />{tr(C.sendCode)}</BigButton></Actions>
        </form>
      ) : (
        <form noValidate onSubmit={e => {
          e.preventDefault()
          if (locked) return
          try {
            if (actions.confirmSms(c.id, code)) return
            const n = wrong + 1
            setWrong(n)
            setInfo('')
            if (n >= SMS_MAX_TRIES) { setSecondsLeft(SMS_PAUSE_S); setErr('') }
            else setErr(fill(tr(C.wrongCodeLeft), { n: SMS_MAX_TRIES - n }))
          } catch (ex) { setErr(errText(ex)) }
        }}>
          <p className="mb-4 rounded-[2px] border-2 border-dashed border-warning bg-warning-soft px-4 py-3 text-center text-[18px] font-bold text-ink" data-testid="demo-code-banner">{tr(DEMO_SMS_BANNER)}</p>
          <TextInput label={tr(C.smsCode)} inputMode="numeric" autoComplete="one-time-code" name="smsCode" maxLength={6} value={code} disabled={locked} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErr('') }} data-testid="sms-code" />
          <div className="mt-3 space-y-2">
            {locked && <Alert testId="sms-locked">{fill(tr(C.codeLocked), { s: secondsLeft })}</Alert>}
            <Alert>{err}</Alert>
            {info && <Alert tone="success" testId="sms-resent">{info}</Alert>}
          </div>
          <Actions>
            <BigButton type="submit" testId="confirm-code" disabled={locked}>{tr(C.confirmCode)}</BigButton>
            <BigButton variant="secondary" testId="resend-code" disabled={locked} onClick={() => {
              try { actions.setContact(c.id, { mobile: c.session.contact?.mobile ?? mobile, email: c.session.contact?.email ?? (email.trim() || undefined) }); setWrong(0); setCode(''); setErr(''); setInfo(tr(C.codeResent)) } catch (ex) { setErr(plainError(ex, tr)) }
            }}>{tr(C.resendCode)}</BigButton>
            <BigButton variant="ghost" disabled={locked} onClick={() => { setSent(false); setCode(''); setWrong(0); setInfo('') }}>{tr(C.changeNumber)}</BigButton>
          </Actions>
        </form>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v?: ReactNode }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-[14px] font-bold text-muted">{k}</dt>
      <dd className="min-w-0 break-words text-[15px] text-ink">{v}</dd>
    </div>
  )
}

function ReviewStep({ c, onHelperDone }: { c: Case; onHelperDone: () => void }) {
  const { tr } = useTr()
  const go = useGo()
  const [ticked, setTicked] = useState(Boolean(c.session.confirmedReview))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const s = c.session
  const m = msg('AI-04')
  const country = countryByName(c.typed.nationality)
  const docLine = (t: DocumentType, n: string) => `${tr(DOCUMENTS[t].label)} · ${n}`
  const minor = s.minor
  const send = () => {
    setErr('')
    setBusy(true)
    try {
      if (!s.confirmedReview) actions.confirmReview(c.id)
      const p = actions.submit(c.id)
      p.catch(e => { setErr(errText(e)); setBusy(false) })
      // The validation runs before the first await: a sent case already has submittedAt here.
      queueMicrotask(() => {
        if (!useClave.getState().cases[c.id]?.submittedAt) return
        if (s.who === 'helping') { markHelperDone(c.id); onHelperDone() } else go(`/citizen/case/${c.id}`)
      })
    } catch (e) { setErr(errText(e)); setBusy(false) }
  }
  return (
    <div data-testid="review-step">
      <StepTitle>{tr(C.reviewTitle)}</StepTitle>
      <dl className="rounded-card border border-line bg-surface px-4">
        {minor ? (
          <>
            <Row k={tr(C.sumName)} v={fullName(minor)} />
            <Row k={tr(C.sumDob)} v={minor.dateOfBirth} />
            <Row k={tr(C.sumDocument)} v={docLine(minor.document.type, minor.document.number)} />
            <Row k={tr(C.sumExpiry)} v={minor.document.expiry} />
            <Row k={tr(C.sumGuardian)} v={fullName(c.typed.data)} />
            <Row k={tr(C.sumProof)} v={s.uploads.proof ? `${s.uploads.proof.name} · ${tr(C.uploaded)}` : undefined} />
          </>
        ) : (
          <>
            <Row k={tr(C.sumName)} v={fullName(c.typed.data)} />
            <Row k={tr(C.sumDob)} v={c.typed.data.dateOfBirth} />
            <Row k={tr(C.sumNationality)} v={country ? tr(country.name) : c.typed.nationality} />
            <Row k={tr(C.sumDocument)} v={docLine(c.typed.type, c.typed.number)} />
            <Row k={tr(C.sumExpiry)} v={c.typed.expiry} />
          </>
        )}
        <Row k={tr(C.sumRoute)} v={asHeading(tr(msg(`RA-07${s.route}` as MsgId).title!))} />
        {s.helper && <Row k={tr(C.sumHelper)} v={`${s.helper.name} (${tr(HELPER_RELATION_LABELS[s.helper.relation]).toLowerCase()})`} />}
        {s.passport && <Row k={tr(C.sumPassport)} v={`${s.passport.number} · ${s.passport.expiry}`} />}
        {s.uploads.redCard && <Row k={tr(C.sumRedCard)} v={`${s.uploads.redCard.number} · ${s.uploads.redCard.expiry} · ${tr(C.uploaded)}`} />}
        <Row k={tr(C.sumMobile)} v={s.contact ? `${s.contact.mobile}${s.contact.smsConfirmed ? ` · ${tr(C.confirmed)}` : ''}` : undefined} />
        <Row k={tr(C.sumEmail)} v={s.contact?.email} />
      </dl>
      <div className="mt-5 space-y-3" data-testid="msg-AI-04">
        <h2 className="font-display text-[19px] font-bold text-ink">{tr(m.title!)}</h2>
        <p className="text-[16px] leading-relaxed text-ink">{tr(m)}</p>
        <CheckboxCard checked={ticked} onChange={setTicked} testId="review-confirm" name="reviewConfirm">{tr(m.checkbox!)}</CheckboxCard>
        <p className="text-[14px] leading-snug text-muted">{tr(msg('AI-03'))}</p>
      </div>
      <div className="mt-3"><Alert>{err}</Alert></div>
      <Actions>
        <BigButton disabled={!ticked || busy} testId="submit-application" onClick={send}><Send size={18} aria-hidden />{busy ? tr(C.sending) : tr(m.button!)}</BigButton>
      </Actions>
    </div>
  )
}

function HelperDone({ c }: { c: Case }) {
  const { tr } = useTr()
  const go = useGo()
  return (
    <div data-testid="helper-done">
      <span className="grid size-16 place-items-center rounded-full bg-success text-white"><Check size={30} strokeWidth={3} aria-hidden /></span>
      <MsgBlock id="ASS-03" as="h1" vars={{ applicant: fullName(c.typed.data) }} className="mt-4" />
      <Actions>
        <BigButton testId="helper-signout" onClick={() => { actions.citizenSignOut(); clearHelperDone(); go('/citizen', { replace: true }) }}>
          <LogOut size={18} aria-hidden />{tr(C.signOutSession)}
        </BigButton>
      </Actions>
    </div>
  )
}

function FallFStep({ c }: { c: Case }) {
  const { tr } = useTr()
  const go = useGo()
  const [office, setOffice] = useState(false)
  const [err, setErr] = useState('')
  return (
    <div>
      <MsgBlock id="RA-07F" as="h1" className="mb-4" />
      <MsgBlock id="FALL-01" tone="info" />
      <Alert>{err}</Alert>
      <Actions>
        <BigButton testId="join-video-call" onClick={() => { try { actions.joinVideoCall(c.id); go(`/citizen/case/${c.id}`) } catch (e) { setErr(errText(e)) } }}>
          <Video size={18} aria-hidden />{tr(MSG['FALL-01'].button)}
        </BigButton>
        <BigButton variant="ghost" onClick={() => setOffice(o => !o)}><Building2 size={18} aria-hidden />{tr(MSG['FALL-02'].button)}</BigButton>
      </Actions>
      {office && <MsgBlock id="FALL-02" tone="plain" className="mt-4"><p className="mt-2 text-[14px] text-muted">{tr(C.officeNote)}</p></MsgBlock>}
    </div>
  )
}

/* ================================================================ page */

export function Verify() {
  const { id } = useParams()
  const c = useCase(id)
  const { tr } = useTr()
  const [entry] = useState(() => (c ? flowPath(c) : '/citizen'))
  const [acks, setAcks] = useState<Set<StepId>>(() => new Set())
  const [held, setHeld] = useState<StepId | null>(null)
  const [helperDone, setHelperDone] = useState(false)

  useEffect(() => { window.scrollTo({ top: 0 }) }, [held])

  if (!c) return <Navigate to="/citizen" replace />
  if (entry !== `/citizen/verify/${c.id}`) return <Navigate to={entry} replace />
  if (helperDone) return <HelperDone c={c} />
  // A held result screen (VER-07, a Fallback offer) follows the case live: when an officer decides, asks for
  // something or starts the video call, the citizen moves to the status page.
  const v = c.session.videoCall?.state
  if (held && (c.status === 'approved' || c.status === 'not_approved' || (c.status === 'need_info' && c.infoRequest && !c.infoRequest.response) || v === 'live' || v === 'ended')) {
    return <Navigate to={`/citizen/case/${c.id}`} replace />
  }

  const steps = stepsFor(c)
  const current: StepId = held ?? steps.find(st => !isDone(c, st, acks)) ?? 'review'
  const idx = steps.indexOf(current)
  const ack = (st: StepId) => setAcks(a => new Set(a).add(st))
  const hold = () => setHeld(current)
  const release = () => setHeld(null)
  const s = c.session
  const helping = s.who === 'helping'
  const route = s.route ?? 'B'

  return (
    <div className={cn(helping && 'assisted-large')} data-large-text={helping ? '1' : undefined} data-step={current} data-testid="verify">
      {helping && s.helper && (
        <p className="mb-4 rounded-[2px] border border-brand bg-brand-soft px-3 py-2 text-[15px] font-bold text-ink" data-testid="assisted-header">
          {fill(tr(C.applyingHeader), { applicant: fullName(c.typed.data), helper: s.helper.name, relation: tr(HELPER_RELATION_LABELS[s.helper.relation]).toLowerCase() })}
        </p>
      )}
      <div className="mb-5 flex items-center gap-3">
        <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-[13px] font-bold text-brand-ink">{route === 'F' ? tr(C.routeFallback) : `${tr(C.routeLabel)} ${ROUTES[route].code}`}</span>
        <div className="flex-1"><ProgressBar value={(idx + 1) / steps.length} label={fill(tr(C.stepLabel), { n: idx + 1, total: steps.length })} /></div>
      </div>
      {c.policyProposal && <div className="-mt-3 mb-4"><ProposedRuleTag /></div>}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={current} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          {current === 'helper' && <HelperStep c={c} />}
          {current === 'ass01' && <Ass01Step c={c} />}
          {current === 'min01' && <AckStep id="MIN-01" button={tr(MSG['MIN-01'].button)} onAck={() => ack('min01')} />}
          {current === 'guardian' && <GuardianStep c={c} hold={hold} release={release} />}
          {current === 'proof' && <ProofStep c={c} />}
          {current === 'minorData' && <MinorDataStep c={c} />}
          {current === 'min02' && <AckStep id="MIN-02" button={tr(C.continue)} onAck={() => ack('min02')} />}
          {current === 'consent' && <ConsentStep c={c} />}
          {current === 'eid' && <EidStep c={c} />}
          {current === 'passport' && <PassportStep c={c} />}
          {current === 'chip' && <ChipStep c={c} hold={hold} release={release} />}
          {current === 'face' && <CameraStep c={c} kind="face" hold={hold} release={release} />}
          {current === 'video' && <CameraStep c={c} kind="video" hold={hold} release={release} />}
          {current === 'redcard' && <RedCardStep c={c} />}
          {current === 'contact' && <ContactStep c={c} />}
          {current === 'review' && <ReviewStep c={c} onHelperDone={() => setHelperDone(true)} />}
          {current === 'fallF' && <FallFStep c={c} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

