import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarClock, Check, Clock, FileDown, MessageSquare, PartyPopper, RotateCcw, Scale, Send, ShieldCheck, Smartphone, Undo2, UserRound, Video, X,
} from 'lucide-react'
import { Avatar, ProposedRuleTag, StatusPill, cn } from '@/ui'
import { actions, ClaveRuleError } from '@/core/store'
import { LiveIndicator, useRecentRemote } from '@/core/LiveIndicator'
import type { Case, Decision, RejectionReasonId, StatusId } from '@/contract/types'
import { CITIZEN_MESSAGES, KEY_RULE, LEVEL_LABELS, REJECTION_REASONS, ROUTES, STATUSES, STATUS_ORDER, statusLabel, isProposedRule } from '@/contract/seed'
import { C, fill } from './copy'
import { BigButton, LiveToast, Modal, OptionCard } from './components/basics'
import { CheckList, CheckListHeader } from './components/checks'
import { Confetti } from './components/animations'
import { expectedChecks } from './Verify'
import { flowPath } from './Shell'
import { downloadReceipt } from './receipt'
import { fmtDate, fmtTime, readSlot, rel, saveSlot, todaySlots, useCase, useGo, useReduced, useTick, useTr } from './hooks'

type StepState = 'done' | 'now' | 'next' | 'notNeeded' | 'ifNeeded' | 'notReached'

const isRefusal = (d: Decision) => d.outcome === 'refused' || d.outcome === 'revoked'
const lastRefusal = (c: Case) => [...c.decisions].reverse().find(isRefusal)
const BOOK_REASONS: RejectionReasonId[] = ['REJ-02', 'REJ-03', 'REJ-06', 'REJ-07']
const CORRECT_REASONS: RejectionReasonId[] = ['REJ-04', 'REJ-05', 'REJ-08']

function stepState(c: Case, s: StatusId): StepState {
  const cur = c.status as StatusId
  switch (s) {
    case 'received': return cur === 'received' ? 'now' : 'done'
    case 'checking': return cur === 'received' ? 'next' : cur === 'checking' ? 'now' : 'done'
    case 'need_info':
      if (cur === 'need_info') return 'now'
      if (c.infoRequest) return 'done'
      return cur === 'approved' || cur === 'not_approved' ? 'notNeeded' : 'ifNeeded'
    case 'approved': return cur === 'approved' ? 'now' : cur === 'not_approved' ? 'notReached' : 'next'
    case 'not_approved': return cur === 'not_approved' ? 'now' : cur === 'approved' ? 'notReached' : 'ifNeeded'
  }
}

function stepTime(c: Case, s: StatusId): string | undefined {
  if (s === 'received' || s === 'checking') return c.submittedAt
  if (s === 'need_info') return c.infoRequest?.at
  if (s === 'approved') return [...c.decisions].reverse().find(d => d.outcome.startsWith('approved'))?.at
  if (s === 'not_approved') return lastRefusal(c)?.at
}

/* ------------------------------------------------------------- tracker */
function Tracker({ c }: { c: Case }) {
  const { tr, lang } = useTr()
  const reduced = useReduced()
  return (
    <ol className="relative" aria-label={tr(C.statusTitle)}>
      {STATUS_ORDER.map((s, idx) => {
        const st = stepState(c, s)
        const def = STATUSES[s]
        const isNow = st === 'now'
        const bad = s === 'not_approved' && isNow
        const good = s === 'approved' && isNow
        const time = st === 'done' || isNow ? stepTime(c, s) : undefined
        const dim = st === 'notNeeded' || st === 'notReached' || st === 'ifNeeded' || st === 'next'
        return (
          <li key={s} className="relative flex gap-3 pb-4 last:pb-0" aria-current={isNow ? 'step' : undefined}>
            {idx < STATUS_ORDER.length - 1 && (
              <span aria-hidden className={cn('absolute left-[15px] top-8 h-[calc(100%-28px)] w-0.5 rounded', st === 'done' ? 'bg-success' : 'bg-line')} />
            )}
            <span className="relative z-10 grid size-8 shrink-0">
              {isNow && !reduced && !good && !bad && (
                <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
              )}
              <span
                className={cn(
                  'relative grid size-8 place-items-center rounded-full text-xs font-bold',
                  st === 'done' && 'bg-success text-white',
                  isNow && !good && !bad && 'bg-brand text-brand-ink ring-4 ring-brand-tint',
                  good && 'bg-success text-white ring-4 ring-success/20',
                  bad && 'bg-danger text-white ring-4 ring-danger/20',
                  dim && 'border-2 border-dashed border-line-strong bg-surface text-muted',
                )}
              >
                {st === 'done' || good ? <Check size={15} strokeWidth={3} aria-hidden /> : bad ? <X size={15} strokeWidth={3} aria-hidden /> : def.step}
              </span>
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className={cn('text-[15px] font-bold', isNow ? 'text-ink' : dim ? 'text-muted' : 'text-ink/90')}>{tr(s === 'approved' && isNow ? statusLabel(s, c.advanced) : def.label)}</span>
                <span className={cn('text-[11px] font-bold uppercase tracking-wide', isNow ? (bad ? 'text-danger' : good ? 'text-success' : 'text-brand-strong') : 'text-muted')}>
                  {tr(C.stepState[st])}{time ? ` · ${rel(time, lang)}` : ''}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {isNow && (
                  <motion.p
                    initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-1 text-[13px] leading-snug text-muted"
                  >
                    {tr(def.message)}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------------------------------------------------- level chips */
function Levels({ c }: { c: Case }) {
  const { tr } = useTr()
  const chip = (on: boolean, label: string, icon: ReactNode, tone: 'success' | 'warning' | 'muted') => (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-[2px] px-2.5 py-1 text-[13px] font-bold',
      tone === 'success' && 'bg-success-soft text-success', tone === 'warning' && 'bg-warning-soft text-warning', tone === 'muted' && 'bg-surface-2 text-muted',
      !on && 'line-through decoration-1',
    )}>
      {icon}{label}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="levels">
      {c.level === 'none'
        ? chip(true, tr(C.levelNone), <Clock size={12} aria-hidden />, 'muted')
        : chip(true, tr(C.levelBasic), <Check size={12} strokeWidth={3} aria-hidden />, 'success')}
      {c.advanced === 'pending_review' && chip(true, tr(C.levelAdvPending), <Clock size={12} aria-hidden />, 'warning')}
      {c.advanced === 'granted' && chip(true, tr(C.levelAdvGranted), <ShieldCheck size={12} aria-hidden />, 'success')}
    </div>
  )
}

/* ------------------------------------------------------- shared dialogs */
function TextDialog({
  open, onOpenChange, title, body, label, suggestion, submitLabel, onSubmit, name,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; body: string; label: string; suggestion: string; submitLabel: string
  onSubmit: (text: string) => string | void | Promise<string | void>; name: string
}) {
  const { tr } = useTr()
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setText(''); setErr('') } }, [open])
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={body} closeLabel={tr(C.close)}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          if (!text.trim()) { setErr(tr(C.writeSomething)); return }
          const res = await onSubmit(text.trim())
          if (typeof res === 'string') setErr(res)
        }}
      >
        <label htmlFor={`${name}-text`} className="text-sm font-bold text-ink">{label}</label>
        <textarea
          id={`${name}-text`} name={name} value={text} onChange={e => setText(e.target.value)} rows={4}
          aria-invalid={err ? true : undefined} aria-describedby={err ? `${name}-err` : undefined}
          className="mt-1.5 w-full resize-none rounded-[2px] border border-line-strong bg-surface p-3 text-[16px] text-ink placeholder:text-muted focus:border-brand focus:shadow-[inset_0_0_0_1px_var(--color-brand)]"
          placeholder={tr(C.replyPlaceholder)}
        />
        <button type="button" onClick={() => setText(suggestion)} className="gov-link mt-1 text-[14px]">
          {tr(C.replySuggest)}
        </button>
        {err && <p id={`${name}-err`} role="alert" className="mt-2 text-sm text-danger">{err}</p>}
        <div className="mt-4"><BigButton type="submit">{submitLabel}</BigButton></div>
      </form>
    </Modal>
  )
}

function BookCallDialog({ open, onOpenChange, onBooked }: { open: boolean; onOpenChange: (o: boolean) => void; onBooked: (iso: string) => void }) {
  const { tr, lang } = useTr()
  const [slots] = useState(() => todaySlots())
  const [pick, setPick] = useState(0)
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={tr(C.bookTitle)} description={tr(C.bookBody)} closeLabel={tr(C.close)}>
      <fieldset>
        <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{tr(C.slotsLegend)}</legend>
        <div className="space-y-2">
          {slots.map((s, i) => (
            <OptionCard key={i} name="resultVideoCallSlot" value={String(i)} checked={pick === i} onChange={() => setPick(i)} title={fill(tr(C.todayAt), { time: fmtTime(s, lang) })} icon={<CalendarClock size={20} />} />
          ))}
        </div>
      </fieldset>
      <div className="mt-4"><BigButton onClick={() => onBooked(slots[pick].toISOString())}>{tr(C.bookConfirm)}</BigButton></div>
    </Modal>
  )
}

/* -------------------------------------------------------------- results */
function Approved({ c }: { c: Case }) {
  const { tr, lang } = useTr()
  const [movil, setMovil] = useState(false)
  const basicDecision = c.decisions.find(d => d.outcome === 'approved_basic')
  const advRefusal = c.advanced === 'not_requested' ? (() => {
    const r = lastRefusal(c)
    return r && basicDecision && r.at >= basicDecision.at ? r : undefined
  })() : undefined
  return (
    <section aria-labelledby="result-title" className="mb-6" data-testid="result-approved">
      <div className="rounded-card border border-success/40 border-l-[6px] border-l-success bg-success-soft p-5 text-ink">
        <PartyPopper size={28} aria-hidden className="text-success" />
        <h2 id="result-title" className="mt-2 font-display text-[26px] font-bold leading-tight">{tr(C.congrats)}</h2>
        <p className="mt-1 text-[16px] text-ink">{tr(C.congratsBody)}</p>
      </div>
      <div className="mt-3 grid gap-2">
        <div className="flex items-start gap-3 rounded-card border border-line bg-surface p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white"><Check size={18} strokeWidth={3} aria-hidden /></span>
          <div>
            <p className="font-bold text-ink">{tr(C.basicGranted)}</p>
            <p className="text-[13px] text-muted">{tr(C.basicGrantedBody)} · {basicDecision?.by.kind === 'system' ? tr(C.autoGranted) : tr(C.grantedByPerson)}</p>
          </div>
        </div>
        {c.advanced !== 'not_requested' && (
          <div className="flex items-start gap-3 rounded-card border border-line bg-surface p-4" data-testid="advanced-card">
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', c.advanced === 'granted' ? 'bg-success text-white' : 'bg-warning-soft text-warning')}>
              {c.advanced === 'granted' ? <ShieldCheck size={18} aria-hidden /> : <Clock size={18} aria-hidden />}
            </span>
            <div>
              <p className="font-bold text-ink">{c.advanced === 'granted' ? tr(C.levelAdvGranted) : tr(LEVEL_LABELS.advanced)}</p>
              <p className="text-[13px] text-muted">{c.advanced === 'granted' ? tr(C.advGrantedBody) : tr(C.advPendingBody)}</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <BigButton variant="secondary" onClick={() => downloadReceipt(c, lang)} testId="download-receipt">
          <span className="inline-flex items-center gap-2"><FileDown size={18} aria-hidden />{tr(C.downloadReceipt)}</span>
        </BigButton>
        <BigButton onClick={() => setMovil(true)} testId="open-clave-movil">
          <span className="inline-flex items-center gap-2"><Smartphone size={18} aria-hidden />{tr(C.openClaveMovil)}</span>
        </BigButton>
      </div>
      <Modal open={movil} onOpenChange={setMovil} title={tr(C.claveMovilTitle)} closeLabel={tr(C.close)}>
        <p className="text-[15px] leading-relaxed text-ink">{tr(C.claveMovilBody)}</p>
        <div className="mt-4"><BigButton onClick={() => setMovil(false)}>{tr(C.close2)}</BigButton></div>
      </Modal>
      {advRefusal?.reasonId && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-bold text-ink">{tr(LEVEL_LABELS.advanced)} · {tr(STATUSES.not_approved.label)}</p>
          <Refusal c={c} decision={advRefusal} compact />
        </div>
      )}
    </section>
  )
}

function Refusal({ c, decision, compact = false }: { c: Case; decision: Decision; compact?: boolean }) {
  const { tr, lang } = useTr()
  const go = useGo()
  const reason = decision.reasonId ? REJECTION_REASONS[decision.reasonId] : undefined
  const [appealOpen, setAppealOpen] = useState(false)
  const [correctOpen, setCorrectOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [booked, setBooked] = useState<string | null>(() => readSlot(`${c.id}-result`))
  const appealOpenState = c.appeal && (c.appeal.at >= decision.at || c.appeal.state === 'dismissed') ? c.appeal : undefined

  return (
    <div className="space-y-3" data-testid="result-refused">
      {!compact && (
        <div className="rounded-card border border-line border-l-[6px] border-l-danger bg-surface p-5">
          <span className="grid size-11 place-items-center rounded-[2px] bg-danger-soft text-danger"><UserRound size={22} aria-hidden /></span>
          <h2 id="result-title" className="mt-3 font-display text-[24px] font-bold leading-tight text-ink">{tr(C.notApprovedTitle)}</h2>
          <p className="mt-1 text-[13px] text-muted">{fill(tr(C.personReviewed), { date: fmtDate(decision.at, lang) })}</p>
          {c.level === 'basic' && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success"><Check size={12} strokeWidth={3} aria-hidden /> {tr(C.levelBasic)}</p>}
        </div>
      )}
      {reason && (
        <div className="rounded-card border border-danger/40 bg-danger-soft p-4" data-testid="refusal-reason">
          <h3 className="text-xs font-bold uppercase tracking-wider text-danger">{tr(C.theReason)}</h3>
          <p className="mt-1 text-[16px] font-semibold leading-snug text-ink">{tr(reason.citizenMessage)}</p>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-ink">{tr(C.howToFix)}</h3>
          <p className="mt-1 text-[15px] leading-snug text-ink">{tr(reason.howToFix)}</p>
        </div>
      )}
      <p className="flex gap-2 rounded-[2px] border-l-4 border-brand bg-brand-soft p-3 text-[14px] leading-snug text-ink" data-testid="key-rule">
        <Scale size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <span><strong className="text-ink">{tr(C.keyRuleTitle)}:</strong> {tr(KEY_RULE)}</span>
      </p>

      {appealOpenState ? (
        <div className="rounded-card border border-brand bg-brand-soft p-4" role="status" data-testid="appeal-state">
          <p className="flex items-center gap-2 font-bold text-ink">
            <Clock size={16} className="text-brand" aria-hidden />
            {appealOpenState.state === 'open' ? tr(C.appealUnderReview) : appealOpenState.state === 'upheld' ? tr(C.appealUpheld) : tr(C.appealDismissed)}
          </p>
          {appealOpenState.state === 'open' && <p className="mt-1 text-[13px] text-muted">{tr(CITIZEN_MESSAGES.appealConfirmation)}</p>}
          <p className="mt-2 text-[12px] text-muted"><span className="font-bold">{tr(C.yourAppeal)}:</span> “{appealOpenState.text}”</p>
        </div>
      ) : null}

      {notice && <p role="status" className="rounded-[2px] bg-success-soft p-3 text-sm font-medium text-success">{notice}</p>}
      {booked && (
        <p role="status" className="flex items-center gap-2 rounded-[2px] bg-success-soft p-3 text-sm font-medium text-success">
          <Video size={16} aria-hidden /> {fill(tr(C.booked), { time: fmtTime(new Date(booked), lang) })}
        </p>
      )}

      <div className="grid gap-2">
        {decision.reasonId && CORRECT_REASONS.includes(decision.reasonId) && c.status === 'not_approved' && (
          <BigButton onClick={() => setCorrectOpen(true)}><Undo2 size={18} aria-hidden /> {tr(C.corrected)}</BigButton>
        )}
        {decision.reasonId && BOOK_REASONS.includes(decision.reasonId) && !booked && (
          <BigButton variant={CORRECT_REASONS.includes(decision.reasonId) ? 'secondary' : 'primary'} onClick={() => setBookOpen(true)}>
            <Video size={18} aria-hidden /> {tr(C.bookVideoCall)}
          </BigButton>
        )}
        {!appealOpenState && (
          <BigButton variant="secondary" onClick={() => setAppealOpen(true)}><Scale size={18} aria-hidden /> {tr(C.appeal)}</BigButton>
        )}
      </div>

      <TextDialog
        open={appealOpen} onOpenChange={setAppealOpen} name="appeal"
        title={tr(C.appealTitle)} body={tr(C.appealBody)} label={tr(C.appealLabel)} suggestion={tr(C.appealSuggestion)} submitLabel={tr(C.sendAppeal)}
        onSubmit={text => {
          try {
            actions.fileAppeal(c.id, text)
            setAppealOpen(false)
            setNotice(tr(CITIZEN_MESSAGES.appealConfirmation))
          } catch (e) {
            console.warn('[citizen] appeal', e)
            return e instanceof ClaveRuleError && c.level !== 'none' ? tr(C.appealNotAvailable) : e instanceof Error ? e.message : String(e)
          }
        }}
      />
      <TextDialog
        open={correctOpen} onOpenChange={setCorrectOpen} name="correction"
        title={tr(C.correctTitle)} body={tr(C.correctBody)} label={tr(C.correctLabel)} suggestion={tr(C.correctSuggestion)} submitLabel={tr(C.sendCorrection)}
        onSubmit={text => {
          try {
            const p = actions.submitCorrection(c.id, text)
            p.catch(e => console.warn('[citizen] correction', e))
            setCorrectOpen(false)
            setNotice(tr(CITIZEN_MESSAGES.correctionSubmitted))
            go(`/citizen/case/${c.id}`)
          } catch (e) {
            return e instanceof Error ? e.message : String(e)
          }
        }}
      />
      <BookCallDialog
        open={bookOpen} onOpenChange={setBookOpen}
        onBooked={iso => { setBooked(iso); setBookOpen(false); try { sessionStorage.setItem(`getyourclave.citizen.slot.${c.id}-result`, iso) } catch { /* ignore */ } try { actions.bookVideoCall(c.id, iso) } catch (e) { console.warn('[citizen] bookVideoCall', e) } }}
      />
    </div>
  )
}

/* -------------------------------------------------------------- need info */
function NeedInfo({ c }: { c: Case }) {
  const { tr, lang } = useTr()
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const req = c.infoRequest!
  return (
    <section className="mb-6 rounded-card border border-warning/50 border-l-[6px] border-l-warning bg-warning-soft p-4" aria-labelledby="need-info-title" data-testid="need-info">
      <h2 id="need-info-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-warning">
        <MessageSquare size={16} aria-hidden /> {tr(C.officerAsks)}
      </h2>
      <blockquote className="mt-2 rounded-[2px] bg-surface p-3 text-[15px] leading-snug text-ink border border-line">
        “{req.message}”
        <footer className="mt-1 text-[11px] text-muted">{rel(req.at, lang)}</footer>
      </blockquote>
      <form
        className="mt-3"
        onSubmit={e => {
          e.preventDefault()
          if (!text.trim()) { setErr(tr(C.writeSomething)); return }
          try { actions.respondToInfoRequest(c.id, text.trim()); setText('') } catch (ex) { setErr(ex instanceof Error ? ex.message : String(ex)) }
        }}
      >
        <label htmlFor="info-reply" className="text-sm font-bold text-ink">{tr(C.replyLabel)}</label>
        <textarea
          id="info-reply" name="infoReply" rows={3} value={text} onChange={e => { setText(e.target.value); setErr('') }}
          placeholder={tr(C.replyPlaceholder)} aria-invalid={err ? true : undefined} aria-describedby={err ? 'info-reply-err' : undefined}
          className="mt-1.5 w-full resize-none rounded-[2px] border border-line-strong bg-surface p-3 text-[16px] text-ink placeholder:text-muted focus:border-brand focus:shadow-[inset_0_0_0_1px_var(--color-brand)]"
        />
        <button type="button" onClick={() => setText(tr(C.replySuggestion))} className="gov-link text-[14px]">
          {tr(C.replySuggest)}
        </button>
        {err && <p id="info-reply-err" role="alert" className="mt-2 text-sm text-danger">{err}</p>}
        <div className="mt-3"><BigButton type="submit"><Send size={17} aria-hidden /> {tr(C.sendReply)}</BigButton></div>
      </form>
    </section>
  )
}

/* ------------------------------------------------------------------ page */
export function StatusPage() {
  const { id } = useParams()
  const c = useCase(id)
  const { tr, lang } = useTr()
  useTick(20_000)
  const remote = useRecentRemote(id, 2500)
  const [toast, setToast] = useState(false)
  const [fire, setFire] = useState(0)
  const [bookFallback, setBookFallback] = useState(false)
  const [, setBookedNow] = useState<string | null>(null)
  const prev = useRef<{ status?: string; adv?: string; updatedAt?: string }>({})

  const status = c?.status
  const adv = c?.advanced
  useEffect(() => {
    const p = prev.current
    if (status === 'approved' && (p.status !== 'approved' || (adv === 'granted' && p.adv !== 'granted'))) setFire(n => n + 1)
    prev.current = { status, adv }
  }, [status, adv])
  useEffect(() => { if (remote) setToast(true) }, [remote])
  const hideToast = useCallback(() => setToast(false), [])

  if (!c) return <Navigate to="/citizen" replace />
  if (c.status === 'draft') return <Navigate to={flowPath(c)} replace />

  const refusal = c.status === 'not_approved' ? lastRefusal(c) : undefined
  const engineRunning = (c.status === 'received' || c.status === 'checking') && !c.awaitingOfficer
  const awaiting = (c.status === 'checking' || c.status === 'received') && c.awaitingOfficer
  const slot = readSlot(c.id)
  const route = c.route ? ROUTES[c.route] : undefined

  return (
    <div className="relative">
      <Confetti fire={fire} />
      <LiveToast message={tr(C.updatedJustNow)} show={toast} onDone={hideToast} />

      <motion.div
        animate={remote ? { boxShadow: ['0 0 0 0 rgba(18,120,74,0)', '0 0 0 6px rgba(18,120,74,0.25)', '0 0 0 0 rgba(18,120,74,0)'] } : {}}
        transition={{ duration: 1.4 }}
        className={cn('mb-5 flex flex-wrap items-center gap-3 rounded-card border border-line border-t-4 border-t-brand bg-surface p-4 transition-colors', remote && 'bg-success-soft')}
        data-live-flash={remote ? '1' : undefined}
      >
        <Avatar initials={c.persona.initials} hue={c.persona.hue} size={44} />
        <div className="min-w-0 flex-1 basis-[60%]">
          <h1 className="truncate font-display text-[20px] font-bold text-ink">{tr(C.statusTitle)}</h1>
          <p className="truncate text-[14px] text-muted">
            {c.persona.name}{route ? ` · ${tr(C.routeLabel)} ${route.code}` : ''}{c.submittedAt ? ` · ${tr(C.submitted)} ${rel(c.submittedAt, lang)}` : ''}
          </p>
          {isProposedRule(c.route, c.answers) && <ProposedRuleTag className="mt-1" />}
        </div>
        <div className="flex basis-full flex-wrap items-center justify-between gap-2 sm:basis-auto sm:flex-col sm:items-end sm:justify-start" aria-live="polite">
          <StatusPill status={c.status} advanced={c.advanced} />
          <LiveIndicator caseId={c.id} className="!px-0 text-[10px]" />
        </div>
      </motion.div>

      {/* screen 5: result */}
      {c.status === 'approved' && <Approved c={c} />}
      {refusal && <section aria-labelledby="result-title" className="mb-6"><Refusal c={c} decision={refusal} /></section>}

      {/* need info */}
      {c.status === 'need_info' && c.infoRequest && <NeedInfo c={c} />}
      {c.infoRequest?.response && c.status !== 'need_info' && (
        <div className="mb-5 rounded-card border border-line bg-surface p-3 text-[14px]">
          <p className="font-bold text-ink">{tr(C.officerAsks)}: <span className="font-normal">“{c.infoRequest.message}”</span></p>
          <p className="mt-1 text-muted"><span className="font-bold">{tr(C.youReplied)}:</span> “{c.infoRequest.response.text}”</p>
        </div>
      )}

      {/* waiting states */}
      {engineRunning && (
        <div className="mb-5 flex items-center gap-3 rounded-[2px] border-l-4 border-brand bg-brand-soft p-4 text-[15px] text-ink" role="status">
          <RotateCcw size={18} className="animate-spin text-brand [animation-direction:reverse] motion-reduce:animate-none" aria-hidden />
          {tr(C.checksRunning)}
        </div>
      )}
      {awaiting && (
        <div className="mb-5 space-y-2" role="status">
          {c.route === 'F' && slot && c.checks.some(r => r.id === 'officer_video' && r.outcome === 'pending') && (
            <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
              <span className="grid size-10 place-items-center rounded-[2px] bg-brand text-brand-ink"><Video size={18} aria-hidden /></span>
              <div>
                <p className="text-sm font-bold text-ink">{tr(C.videoCallBookedCard)}</p>
                <p className="text-[13px] text-muted">{fill(tr(C.todayAt), { time: fmtTime(new Date(slot), lang) })}</p>
              </div>
              <span className="ml-auto"></span>
            </div>
          )}
          {c.route === 'F' && !slot && c.checks.some(r => r.id === 'officer_video' && r.outcome === 'pending') && (
            <div className="rounded-card border-2 border-brand bg-brand-soft p-4" data-testid="fallback-book">
              <p className="flex items-center gap-2 font-display text-[18px] font-bold text-ink"><Video size={20} className="text-brand" aria-hidden />{tr(C.fallbackBookTitle)}</p>
              <p className="mt-1 text-[14px] leading-snug text-ink">{tr(C.fallbackBookBody)}</p>
              <div className="mt-3"><BigButton onClick={() => setBookFallback(true)}>{tr(C.bookVideoCall)}</BigButton></div>
              <BookCallDialog open={bookFallback} onOpenChange={setBookFallback} onBooked={iso => { saveSlot(c.id, iso); setBookedNow(iso); setBookFallback(false) }} />
            </div>
          )}
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
            <span className="grid size-10 place-items-center rounded-[2px] bg-brand-soft text-brand"><UserRound size={18} aria-hidden /></span>
            <p className="text-[13px] leading-snug text-ink">{tr(C.waitingPerson)}</p>
          </div>
        </div>
      )}

      {/* tracker */}
      <section aria-labelledby="tracker-title" className="mb-6 rounded-card border border-line bg-surface p-4">
        <h2 id="tracker-title" className="mb-3 font-display text-[18px] font-bold text-ink">{tr(C.progressTitle)}</h2>
        <div aria-live="polite"><Tracker c={c} /></div>
      </section>

      <section aria-labelledby="level-title" className="mb-6">
        <h2 id="level-title" className="mb-2 font-display text-[18px] font-bold text-ink">{tr(C.levelTitle)}</h2>
        <Levels c={c} />
      </section>

      <section aria-labelledby="checks-title" className="mb-6">
        <div id="checks-title"><CheckListHeader title={tr(C.checksTitle)} /></div>
        <CheckList expected={expectedChecks(c)} results={c.checks} running={engineRunning} compact />
      </section>

    </div>
  )
}
