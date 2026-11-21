import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Check, KeyRound, LoaderCircle, ShieldCheck, Video } from 'lucide-react'
import { StatusPill, cn } from '@/ui'
import { actions, plannedChecks } from '@/core/store'
import type { Case, CheckId } from '@/contract/types'
import { CHECKS, CITIZEN_MESSAGES, DOCUMENTS, ROUTES } from '@/contract/seed'
import { C, fill } from './copy'
import { BigButton, OptionCard, ProgressBar } from './components/basics'
import { ChipReadAnimation, FaceScanAnimation, useProgress } from './components/animations'
import { CheckList, CheckListHeader } from './components/checks'
import { safe } from './Shell'
import { fmtTime, saveSlot, todaySlots, useCase, useGo, useReduced, useTr } from './hooks'

type Phase = 'consent' | 'guardian' | 'eidas' | 'chip' | 'face' | 'dni' | 'book' | 'checks'

function phasesFor(c: Case): Phase[] {
  const route = c.route ?? 'B'
  const p: Phase[] = c.consentGiven ? [] : ['consent']
  if (route === 'A') p.push('eidas')
  if (route === 'B') p.push(...(c.guardian ? (['guardian'] as Phase[]) : []), 'chip', 'face')
  if (route === 'C') p.push('dni')
  if (route === 'FALLBACK') p.push('book')
  p.push('checks')
  return p
}

export function expectedChecks(c: Case): CheckId[] {
  if (!c.route) return []
  try {
    return plannedChecks(c)
  } catch {
    return [...ROUTES[c.route].checks, ...(c.guardian ? (['guardian_link'] as CheckId[]) : [])]
  }
}

function StepHeading({ title, body, badges }: { title: string; body?: ReactNode; badges?: ReactNode }) {
  return (
    <div className="mb-4">
      {badges && <div className="mb-2 flex flex-wrap gap-1.5">{badges}</div>}
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-ink">{title}</h1>
      {body && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ consent */
function Consent({ c, onDone }: { c: Case; onDone: () => void }) {
  const { tr } = useTr()
  return (
    <div>
      <div className="mb-4 grid size-12 place-items-center rounded-[2px] bg-brand-soft text-brand"><ShieldCheck size={24} aria-hidden /></div>
      <StepHeading title={tr(CITIZEN_MESSAGES.consentTitle)} body={tr(CITIZEN_MESSAGES.consentBody)} />
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{tr(C.consentWhat)}</h2>
      </div>
      <ul className="space-y-1.5">
        {expectedChecks(c).map(id => (
          <li key={id} className="flex gap-3 rounded-[2px] bg-surface px-3 py-2.5 border border-line">
            <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <span className="text-[13px] leading-snug">
              <span className="font-bold text-ink">{tr(CHECKS[id].label)}</span>
              <span className="block text-muted">{tr(CHECKS[id].explains)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{tr(C.consentFine)}</p>
      <div className="mt-5">
        <BigButton onClick={() => { safe(() => actions.giveConsent(c.id)); onDone() }}>{tr(CITIZEN_MESSAGES.consentAccept)}</BigButton>
      </div>
    </div>
  )
}

/* -------------------------------------------------- eIDAS hand-off (route A) */
function EidasHandoff({ person, country, onDone, children }: { person: string; country: string; onDone: () => void; children?: ReactNode }) {
  const { tr } = useTr()
  const reduced = useReduced()
  const [stage, setStage] = useState<'redirect' | 'login' | 'returning' | 'done'>('redirect')
  useEffect(() => {
    if (stage === 'redirect') { const id = setTimeout(() => setStage('login'), reduced ? 500 : 1700); return () => clearTimeout(id) }
    if (stage === 'returning') { const id = setTimeout(() => setStage('done'), reduced ? 400 : 1300); return () => clearTimeout(id) }
  }, [stage, reduced])
  useEffect(() => { if (stage === 'done' && !children) onDone() }, [stage, children, onDone])

  return (
    <div aria-live="polite">
      <AnimatePresence mode="wait">
        {stage === 'redirect' && (
          <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid place-items-center py-10 text-center">
            <div className="relative grid size-20 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/15 motion-reduce:animate-none" />
              <span className="grid size-16 place-items-center rounded-full bg-brand text-brand-ink"><KeyRound size={26} aria-hidden /></span>
            </div>
            <p className="mt-6 font-display text-xl font-bold text-ink">{tr(C.redirecting)}</p>
            <p className="mt-2 max-w-xs text-sm text-muted">{tr(C.redirectingBody)}</p>
            <LoaderCircle className="mt-5 animate-spin text-brand motion-reduce:animate-none" aria-hidden />
          </motion.div>
        )}
        {stage === 'login' && (
          <motion.div key="l" initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="overflow-hidden rounded-[2px] border border-line bg-surface shadow-lg">
              <div className="flex items-center gap-2 bg-[hsl(215_25%_22%)] px-4 py-3 text-white">
                <span className="grid size-7 place-items-center rounded-[2px] bg-white/15"><ShieldCheck size={16} aria-hidden /></span>
                <span className="text-sm font-bold">{fill(tr(C.countryLogin), { country })}</span>
              </div>
              <div className="p-4">
                <p className="text-[13px] leading-snug text-muted">{tr(C.countryLoginBody)}</p>
                <div className="mt-3 rounded-[2px] bg-surface-2 p-3">
                  <p className="text-[15px] font-bold text-ink">{person}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted">{tr(C.sharedData)}</p>
                  <p className="text-[13px] text-ink">{tr(C.sharedFields)}</p>
                </div>
                <div className="mt-4">
                  <BigButton onClick={() => setStage('returning')}>{tr(C.approveSignIn)}</BigButton>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {(stage === 'returning' || stage === 'done') && (
          <motion.div key="b" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid place-items-center py-8 text-center">
            <motion.span initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }} className="grid size-16 place-items-center rounded-full bg-success text-white"><Check size={30} strokeWidth={3} aria-hidden /></motion.span>
            <p className="mt-4 font-display text-lg font-bold text-ink">{tr(C.returning)}</p>
            {stage === 'done' && children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function eidCountry(c: Case) {
  return c.otherDocuments?.find(d => d.type === 'EU_EID')?.issuingCountry ?? (c.document.type === 'EU_EID' ? c.document.issuingCountry : c.persona.nationality)
}

/* -------------------------------------------------------- guardian (minor) */
function GuardianStep({ c, onDone }: { c: Case; onDone: () => void }) {
  const { tr } = useTr()
  const g = c.guardian!
  const first = c.persona.name.split(' ')[0]
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div>
      <StepHeading
        badges={<><span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">{tr(C.routeLabel)} {ROUTES[g.route].code}</span></>}
        title={fill(tr(C.guardianTitle), { guardian: g.name })}
        body={fill(tr(C.guardianBody), { guardian: g.name, relation: tr(g.relation), name: first })}
      />
      <EidasHandoff person={g.name} country={g.document.issuingCountry} onDone={() => undefined}>
        <div className="mt-6 w-full text-left">
          <label className="flex cursor-pointer items-start gap-3 rounded-[2px] border-2 border-line bg-surface p-4 has-[:checked]:border-brand has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/30">
            <input type="checkbox" name="guardianConfirm" className="mt-0.5 size-5 accent-[var(--color-brand)]" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
            <span className="text-[14px] font-medium text-ink">{fill(tr(C.guardianConfirm), { name: first, relation: tr(g.relation) })}</span>
          </label>
          {confirmed && <p className="mt-3 text-center text-sm text-success" role="status">{fill(tr(C.guardianDone), { guardian: g.name.split(' ')[0], name: first })}</p>}
          <div className="mt-4"><BigButton disabled={!confirmed} onClick={onDone}>{tr(C.continue)}</BigButton></div>
        </div>
      </EidasHandoff>
    </div>
  )
}

/* ------------------------------------------------------------- chip (B) */
function ChipStep({ c, onDone }: { c: Case; onDone: () => void }) {
  const { tr } = useTr()
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const p = useProgress(running, 3400, () => setDone(true))
  return (
    <div>
      <StepHeading title={tr(C.chipTitle)} body={tr(C.chipBody)} />
      <ChipReadAnimation progress={done ? 1 : p} done={done} docLabel={tr(DOCUMENTS[c.document.type].label)} />
      <p className="mt-3 text-center text-sm font-bold text-ink" aria-live="polite">
        {done ? tr(C.chipDone) : running ? tr(C.chipReading) : ' '}
      </p>
      <div className="mt-5">
        {!done ? (
          <BigButton disabled={running} onClick={() => setRunning(true)}>{running ? tr(C.chipReading) : tr(C.chipStart)}</BigButton>
        ) : (
          <BigButton onClick={onDone}>{tr(C.continue)}</BigButton>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- face (B) */
function FaceStep({ c, onDone }: { c: Case; onDone: () => void }) {
  const { tr } = useTr()
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const p = useProgress(running, 4200, () => setDone(true))
  const assisted = c.answers?.assisted && c.assisted
  return (
    <div>
      <StepHeading
        title={tr(C.faceTitle)}
        body={assisted ? fill(tr(C.faceBodyAssisted), { name: c.persona.name.split(' ')[0], helper: c.assisted!.helperName.split(' ')[0] }) : tr(C.faceBody)}
      />
      <FaceScanAnimation progress={done ? 1 : p} done={done} />
      <p className="mt-3 text-center text-sm font-bold text-ink" aria-live="polite">
        {done ? tr(C.faceDone) : running ? (p < 0.75 ? tr(C.faceTurn) : tr(C.faceHold)) : ' '}
      </p>
      <div className="mt-4">
        {!done ? (
          <BigButton disabled={running} onClick={() => setRunning(true)}>{running ? tr(C.faceTurn) : tr(C.faceStart)}</BigButton>
        ) : (
          <BigButton onClick={onDone}>{tr(C.continue)}</BigButton>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------- DNI video (C) */
function DniStep({ onDone }: { onDone: () => void }) {
  const { tr } = useTr()
  const reduced = useReduced()
  const [stage, setStage] = useState(-2) // -2 idle, -1 connecting, 0..2 steps, 3 done
  useEffect(() => {
    if (stage < -1 || stage >= 3) return
    const id = setTimeout(() => setStage(s => s + 1), reduced ? 350 : 1300)
    return () => clearTimeout(id)
  }, [stage, reduced])
  return (
    <div>
      <StepHeading title={tr(C.dniTitle)} body={tr(C.dniBody)} />
      <div className="relative grid h-52 place-items-center overflow-hidden rounded-[2px] bg-ink text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,hsl(220_20%_30%),hsl(220_25%_9%)_70%)]" aria-hidden />
        <div className="relative text-center" aria-live="polite">
          <Video size={34} className="mx-auto opacity-80" aria-hidden />
          <p className="mt-2 text-sm font-bold">
            {stage === -2 ? tr(C.dniTitle) : stage === -1 ? tr(C.connecting) : stage >= 3 ? tr(C.dniDone) : tr(C.dniSteps[stage])}
          </p>
        </div>
        {stage >= -1 && stage < 3 && <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold">● REC</span>}
      </div>
      <ol className="mt-4 space-y-1.5">
        {C.dniSteps.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className={cn('grid size-6 place-items-center rounded-full text-[11px] font-bold', stage > i ? 'bg-success text-white' : stage === i ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted')}>
              {stage > i ? <Check size={13} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={stage >= i ? 'text-ink' : 'text-muted'}>{tr(s)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5">
        {stage < 3 ? (
          <BigButton disabled={stage > -2} onClick={() => setStage(-1)}>{stage > -2 ? tr(C.connecting) : tr(C.dniStart)}</BigButton>
        ) : (
          <BigButton onClick={onDone}>{tr(C.continue)}</BigButton>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------- Fallback: book officer call */
function BookStep({ c, onDone }: { c: Case; onDone: () => void }) {
  const { tr, lang } = useTr()
  const [slots] = useState(() => todaySlots())
  const [pick, setPick] = useState(0)
  const [booked, setBooked] = useState(false)
  const time = fmtTime(slots[pick], lang)
  return (
    <div>
      <StepHeading
        title={tr(C.bookTitle)}
        body={tr(C.bookBody)}
      />
      {!booked ? (
        <>
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{tr(C.slotsLegend)}</legend>
            <div className="space-y-2">
              {slots.map((s, i) => (
                <OptionCard key={i} name="videoCallSlot" value={String(i)} checked={pick === i} onChange={() => setPick(i)} title={fill(tr(C.todayAt), { time: fmtTime(s, lang) })} icon={<CalendarClock size={20} />} />
              ))}
            </div>
          </fieldset>
          <div className="mt-5">
            <BigButton onClick={() => { saveSlot(c.id, slots[pick].toISOString()); setBooked(true) }}>{tr(C.bookConfirm)}</BigButton>
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} role="status">
          <div className="flex gap-3 rounded-[2px] bg-success-soft p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white"><Check size={18} strokeWidth={3} aria-hidden /></span>
            <div>
              <p className="font-bold text-ink">{fill(tr(C.booked), { time })}</p>
              <p className="mt-0.5 text-[13px] text-muted">{tr(C.bookedBody)}</p>
            </div>
          </div>
          <div className="mt-5"><BigButton onClick={onDone}>{tr(C.sendForChecks)}</BigButton></div>
        </motion.div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- live checks */
function LiveChecks({ c }: { c: Case }) {
  const { tr } = useTr()
  const go = useGo()
  const started = useRef(false)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    Promise.resolve()
      .then(() => actions.submitForVerification(c.id))
      .catch(e => console.warn('[citizen] submit', e))
      .finally(() => setDone(true))
  }, [c.id])
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => go(`/citizen/case/${c.id}`), 3200)
    return () => clearTimeout(id)
  }, [done, c.id, go])

  const status = c.status === 'draft' ? 'received' : c.status
  const approved = c.status === 'approved'
  return (
    <div>
      <StepHeading title={tr(C.liveChecks)} body={tr(C.checksRunning)} />
      <div className="mb-3 flex items-center gap-2" aria-live="polite">
        <StatusPill status={status} />
      </div>
      <CheckListHeader title={tr(C.verificationStep)} />
      <div aria-live="polite">
        <CheckList expected={expectedChecks(c)} results={c.checks} running={!done} />
      </div>
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5" role="status">
            <p className={cn('rounded-[2px] p-4 text-[15px] font-bold', approved ? 'border-l-4 border-success bg-success-soft text-success' : 'border-l-4 border-brand bg-brand-soft text-ink')}>
              {approved ? tr(C.checksDoneApproved) : tr(C.checksDoneOfficer)}
            </p>
            <div className="mt-3"><BigButton onClick={() => go(`/citizen/case/${c.id}`)}>{tr(C.goToStatus)}</BigButton></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ page */
export function Verify() {
  const { id } = useParams()
  const c = useCase(id)
  const { tr } = useTr()
  const reduced = useReduced()
  const [startedAsDraft] = useState(() => c?.status === 'draft' && !!c?.route)
  const [phases] = useState<Phase[]>(() => (c ? phasesFor(c) : []))
  const [i, setI] = useState(0)

  if (!c) return <Navigate to="/citizen" replace />
  if (!startedAsDraft) return <Navigate to={c.status === 'draft' ? `/citizen/start/${c.id}` : `/citizen/case/${c.id}`} replace />

  const phase = phases[i]
  const next = () => setI(n => Math.min(n + 1, phases.length - 1))
  const route = c.route!

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">{tr(C.routeLabel)} {ROUTES[route].code}</span>
        <div className="flex-1">
          <ProgressBar value={(i + 1) / phases.length} label={fill(tr(C.stepLabel), { n: i + 1, total: phases.length })} />
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -32 }}
          transition={{ duration: reduced ? 0.1 : 0.22 }}
        >
          {phase === 'consent' && <Consent c={c} onDone={next} />}
          {phase === 'guardian' && <GuardianStep c={c} onDone={next} />}
          {phase === 'eidas' && (
            <div>
              <StepHeading title={tr(ROUTES.A.name)} />
              <EidasHandoff person={c.persona.name} country={eidCountry(c)} onDone={next} />
            </div>
          )}
          {phase === 'chip' && <ChipStep c={c} onDone={next} />}
          {phase === 'face' && <FaceStep c={c} onDone={next} />}
          {phase === 'dni' && <DniStep onDone={next} />}
          {phase === 'book' && <BookStep c={c} onDone={next} />}
          {phase === 'checks' && <LiveChecks c={c} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
