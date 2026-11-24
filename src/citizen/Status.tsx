/**
 * Status page (MSG-STA-1 … STA-5), live across tabs: what the citizen must do now (COR-01 reply, Fallback offer,
 * video-call room), results with receipt / Cl@ve Móvil, refusals with the REJ text and the review request (COR-03).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Check, FileDown, LogOut, Scale, Send, Smartphone, Video, X } from 'lucide-react'
import { Avatar, LiveDot, ProposedRuleTag, StatusPill, cn } from '@/ui'
import { actions } from '@/core/store'
import { fieldLabel } from '@/core/engine'
import { LiveIndicator, useRecentRemote } from '@/core/LiveIndicator'
import type { Case, Decision, StatusId } from '@/contract/types'
import { GLOSSARY, MSG, fillMsg, type MsgId } from '@/contract/messages'
import { citizenReasonShort, offersVideoAfterRefusal } from '@/core/refuseRules'
import type { RejId } from '@/contract/types'
import { ROUTES, STATUSES, STATUS_ORDER, citizenStatus, fullName, statusMsgId } from '@/contract/seed'
import { C, fill } from './copy'
import { BigButton, LiveToast, Modal } from './components/basics'
import { CheckList, CheckListHeader } from './components/checks'
import { Confetti } from './components/animations'
import { Alert, ImageField, MsgBlock } from './components/flow'
import { flowPath } from './Shell'
import { downloadReceipt } from './receipt'
import { clearHelperDone, errText, isHelperDone, rel, useCase, useGo, useTick, useTr } from './hooks'

type StepState = 'done' | 'now' | 'next' | 'notNeeded' | 'ifNeeded' | 'notReached'

const isRefusal = (d: Decision) => d.outcome === 'refused' || d.outcome === 'revoked'
const lastRefusal = (c: Case) => [...c.decisions].reverse().find(isRefusal)

/**
 * Tracker step state from the real history (case.statusLog: what the citizen has seen, in order). A step is "done"
 * only if it was really shown. Cases without a log (background demo data) fall back to the status order.
 */
function stepState(c: Case, s: StatusId): StepState {
  const cur = citizenStatus(c)
  const log = c.statusLog ?? []
  const decided = cur === 'approved' || cur === 'not_approved'
  const seen = (x: StatusId) => (log.length ? log.some(e => e.status === x) : null)
  switch (s) {
    case 'received': {
      if (cur === 'received') return 'now'
      const v = seen('received')
      return v === null || v ? 'done' : 'notNeeded'
    }
    case 'checking': {
      if (cur === 'checking') return 'now'
      const v = seen('checking')
      if (v === null) return cur === 'received' ? 'next' : 'done'
      if (v) return 'done'
      return decided ? 'notNeeded' : 'next'
    }
    case 'need_info': {
      if (cur === 'need_info') return 'now'
      const v = seen('need_info')
      if (v === null ? Boolean(c.infoRequest || c.session.fallback) : v) return 'done'
      return decided ? 'notNeeded' : 'ifNeeded'
    }
    case 'approved': return cur === 'approved' ? 'now' : cur === 'not_approved' ? 'notReached' : 'next'
    case 'not_approved': return cur === 'not_approved' ? 'now' : cur === 'approved' ? 'notReached' : 'ifNeeded'
  }
}

/** Time the citizen last reached this status (from the log). */
function stepTime(c: Case, s: StatusId): string | undefined {
  const log = c.statusLog ?? []
  for (let i = log.length - 1; i >= 0; i--) if (log[i].status === s) return log[i].at
  return undefined
}

function Tracker({ c }: { c: Case }) {
  const { tr, lang } = useTr()
  return (
    <ol className="relative" aria-label={tr(C.progressTitle)} data-testid="tracker">
      {STATUS_ORDER.map((s, idx) => {
        const st = stepState(c, s)
        const isNow = st === 'now'
        const bad = s === 'not_approved' && isNow
        const good = s === 'approved' && isNow
        const dim = st !== 'done' && !isNow
        const at = st === 'done' || isNow ? stepTime(c, s) : undefined
        return (
          <li key={s} className="relative flex gap-3 pb-4 last:pb-0" aria-current={isNow ? 'step' : undefined} data-testid={`tracker-${s}`} data-state={st}>
            {idx < STATUS_ORDER.length - 1 && <span aria-hidden className={cn('absolute left-[15px] top-8 h-[calc(100%-28px)] w-0.5', st === 'done' ? 'bg-success' : 'bg-line')} />}
            <span className={cn(
              'relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold',
              st === 'done' && 'bg-success text-white',
              isNow && !good && !bad && 'bg-brand text-brand-ink ring-4 ring-brand-tint',
              good && 'bg-success text-white ring-4 ring-success/20',
              bad && 'bg-danger text-white ring-4 ring-danger/20',
              dim && 'border-2 border-dashed border-line-strong bg-surface text-muted',
            )}>
              {st === 'done' || good ? <Check size={15} strokeWidth={3} aria-hidden /> : bad ? <X size={15} strokeWidth={3} aria-hidden /> : STATUSES[s].step}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2 pt-1">
              <span className={cn('text-[15px] font-bold', dim ? 'text-muted' : 'text-ink')}>{tr(s === 'approved' && isNow ? MSG[statusMsgId('approved', c.advanced)].title : STATUSES[s].label)}</span>
              <span className={cn('text-[12px] font-bold uppercase tracking-wide', isNow ? 'text-brand-strong' : 'text-muted')}>
                {tr(C.stepState[st])}{at && <span className="ml-1.5 font-semibold normal-case tracking-normal" data-testid={`tracker-${s}-time`}>· {clock(at, lang)}</span>}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const clock = (iso: string, lang: 'en' | 'es') => new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/* ----------------------------------------------------------- video room */

function VideoRoom({ c }: { c: Case }) {
  const { tr } = useTr()
  const call = c.session.videoCall!
  const live = call.state === 'live'
  const officer = call.officerName ?? ''
  const initials = officer.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '··'
  return (
    <section className="mb-6" aria-labelledby="room-title" data-testid="video-room" data-call-state={call.state}>
      <h2 id="room-title" className="font-display text-[22px] font-bold text-ink">{tr(MSG['FALL-01'].title)}</h2>
      <div className="mt-3 grid gap-3 rounded-card bg-ink p-3 sm:grid-cols-2">
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[2px] bg-[radial-gradient(ellipse_at_50%_35%,hsl(220_20%_32%),hsl(220_25%_10%)_70%)]" data-testid="officer-tile">
          {live ? (
            <>
              <Avatar initials={initials} hue={210} size={84} />
              <span className="absolute bottom-2 left-2 rounded-[2px] bg-black/60 px-2 py-1 text-[13px] font-bold text-white">{officer} · {tr(GLOSSARY.officerCitizen)}</span>
              <span className="absolute right-2 top-2 rounded-[2px] bg-black/60 px-2 py-1"><LiveDot label={tr(C.inCall)} className="text-white" /></span>
            </>
          ) : (
            <p className="max-w-[24ch] px-4 text-center text-[16px] font-bold text-white" data-testid="waiting-room">{tr(MSG['FALL-01'].waitingRoom as { en: string; es: string })}</p>
          )}
        </div>
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[2px] bg-[hsl(220_20%_18%)]" aria-hidden>
          <svg viewBox="0 0 200 200" width="96"><ellipse cx="100" cy="80" rx="40" ry="48" fill="hsl(220 12% 50%)" /><path d="M30 200c4-44 32-66 70-66s66 22 70 66z" fill="hsl(220 12% 50%)" /></svg>
          <span className="absolute bottom-2 left-2 rounded-[2px] bg-black/60 px-2 py-1 text-[13px] font-bold text-white">{tr(C.you)}</span>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-muted">{tr(C.officerTileNote)}</p>
      {!live && <p className="mt-3 text-[16px] leading-relaxed text-ink">{tr(MSG['FALL-01'])}</p>}
    </section>
  )
}

/* ------------------------------------------------------------- actions */

function FallbackOffer({ c }: { c: Case }) {
  const { tr } = useTr()
  const [err, setErr] = useState('')
  const m = MSG['FALL-01']
  return (
    <div className="space-y-4" data-testid="fallback-offer">
      {c.session.fallback?.offered === 'chip' && <MsgBlock id="VER-04" tone="warning" />}
      <MsgBlock id="FALL-01" tone="info" />
      <Alert>{err}</Alert>
      <div className="grid gap-3">
        <BigButton testId="join-video-call" onClick={() => { try { actions.joinVideoCall(c.id) } catch (e) { setErr(errText(e)) } }}><Video size={18} aria-hidden />{tr(m.buttons[0])}</BigButton>
        <BigButton variant="secondary" testId="come-back-later" onClick={() => { try { actions.comeBackLater(c.id) } catch (e) { setErr(errText(e)) } }}>{tr(m.buttons[1])}</BigButton>
      </div>
      <OfficeOption />
    </div>
  )
}

function OfficeOption() {
  const { tr } = useTr()
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" className="gov-link inline-flex min-h-11 items-center gap-2 text-[15px]" onClick={() => setOpen(o => !o)} aria-expanded={open} data-testid="fall02-toggle">
        <Building2 size={16} aria-hidden />{tr(MSG['FALL-02'].button)}
      </button>
      {open && (
        <MsgBlock id="FALL-02" className="mt-2 rounded-card border border-line bg-surface p-4">
          <p className="mt-2 text-[14px] text-muted">{tr(C.officeNote)}</p>
        </MsgBlock>
      )}
    </div>
  )
}

function InfoReply({ c }: { c: Case }) {
  const { tr } = useTr()
  const req = c.infoRequest!
  const [text, setText] = useState('')
  const [img, setImg] = useState<{ name: string; dataUrl: string } | null>(null)
  const [err, setErr] = useState('')
  const reason = req.reason ?? tr({ en: 'a person needs it to check your application', es: 'una persona lo necesita para revisar tu solicitud' })
  return (
    <form className="space-y-4" data-testid="info-request" noValidate onSubmit={e => {
      e.preventDefault()
      if (!text.trim() && !img) { setErr(tr(C.writeOrAttach)); return }
      try { actions.replyToInfoRequest(c.id, text.trim(), img ?? undefined) } catch (ex) { setErr(errText(ex)) }
    }}>
      <MsgBlock id="COR-01" tone="warning" vars={{ whatWeNeed: req.message, reason }} />
      <div className="space-y-1.5">
        <label htmlFor="info-reply" className="block text-[15px] font-bold text-ink">{tr(C.yourReply)}</label>
        <textarea id="info-reply" name="infoReply" rows={3} value={text} onChange={e => { setText(e.target.value); setErr('') }} maxLength={500}
          className="w-full resize-y rounded-[2px] border border-line-strong bg-surface p-3 text-[16px] text-ink focus:border-brand" data-testid="info-text" />
      </div>
      <ImageField label={tr(C.addImageOptional)} value={img} onChange={setImg} testId="info-upload" />
      <Alert>{err}</Alert>
      <BigButton type="submit" testId="info-send"><Send size={18} aria-hidden />{tr(MSG['COR-01'].button)}</BigButton>
    </form>
  )
}

function ReviewRequest({ c, onClose }: { c: Case; onClose: () => void }) {
  const { tr } = useTr()
  const m = MSG['COR-03']
  const [text, setText] = useState('')
  const [img, setImg] = useState<{ name: string; dataUrl: string } | null>(null)
  const [err, setErr] = useState('')
  return (
    <form className="space-y-4 rounded-card border-2 border-brand bg-surface p-4" data-testid="review-form" noValidate onSubmit={e => {
      e.preventDefault()
      if (!text.trim()) { setErr(tr(C.writeSomething)); return }
      try { actions.requestReview(c.id, text.trim(), img ?? undefined); onClose() } catch (ex) { setErr(errText(ex)) }
    }}>
      <MsgBlock id="COR-03" />
      <div className="space-y-1.5">
        <label htmlFor="review-text" className="block text-[15px] font-bold text-ink">{tr(m.title)}</label>
        <textarea id="review-text" name="reviewText" rows={4} maxLength={m.maxLength} value={text} onChange={e => { setText(e.target.value.slice(0, m.maxLength)); setErr('') }}
          aria-describedby="review-count" className="w-full resize-y rounded-[2px] border border-line-strong bg-surface p-3 text-[16px] text-ink focus:border-brand" data-testid="review-text" />
        <p id="review-count" className="text-right text-[13px] text-muted" aria-live="polite">{fill(tr(C.charsLeft), { n: m.maxLength - text.length })}</p>
      </div>
      <ImageField label={tr(C.addImageOptional)} value={img} onChange={setImg} testId="review-upload" />
      <Alert>{err}</Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <BigButton type="submit" testId="review-send"><Send size={18} aria-hidden />{tr(m.buttons[0])}</BigButton>
        <BigButton variant="secondary" onClick={onClose}>{tr(m.buttons[1])}</BigButton>
      </div>
    </form>
  )
}

function Approved({ c }: { c: Case }) {
  const { tr, lang } = useTr()
  const [movil, setMovil] = useState(false)
  const id = statusMsgId('approved', c.advanced)
  return (
    <div className="space-y-4" data-testid="result-approved">
      {c.citizenMsgs.includes('COR-06') && <MsgBlock id="COR-06" tone="success" />}
      {c.citizenMsgs.includes('COR-08') && <MsgBlock id="COR-08" tone="success" />}
      <MsgBlock id={id} as="h2" tone="success" />
      {id === 'STA-4C' && c.session.who === 'helping' && <SmsMockup c={c} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <BigButton variant="secondary" onClick={() => downloadReceipt(c, lang)} testId="download-receipt"><FileDown size={18} aria-hidden />{tr(id === 'STA-4C' ? MSG['STA-4C'].button : MSG['STA-4'].buttons[0])}</BigButton>
        {id !== 'STA-4C' && <BigButton onClick={() => setMovil(true)} testId="open-clave-movil"><Smartphone size={18} aria-hidden />{tr(MSG['STA-4'].buttons[1])}</BigButton>}
      </div>
      <AdvancedRefusal c={c} />
      <Modal open={movil} onOpenChange={setMovil} title={tr(MSG['STA-4'].buttons[1])} closeLabel={tr(C.close)}>
        <p className="text-[16px] leading-relaxed text-ink">{tr(C.claveMovilBody)}</p>
        <div className="mt-4"><BigButton onClick={() => setMovil(false)}>{tr(C.gotIt)}</BigButton></div>
      </Modal>
    </div>
  )
}

/**
 * GYC-03 (plan block 7, step 7): an assisted applicant gets the advanced-level result by SMS on his own basic phone.
 * A phone mock-up with the SMS text (MSG-STA-4C), labelled as a simulated SMS. No real message is sent.
 */
function SmsMockup({ c }: { c: Case }) {
  const { tr, lang } = useTr()
  const m = MSG['STA-4C']
  const mobile = c.session.contact?.mobile ?? ''
  const masked = mobile ? `${mobile.slice(0, -4).replace(/\d/g, '•')}${mobile.slice(-4)}` : ''
  const at = c.decisions.filter(d => d.outcome === 'approved_advanced').at(-1)?.at ?? c.updatedAt
  return (
    <figure className="mx-auto w-full max-w-[260px]" data-testid="sms-mockup">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border-[6px] border-ink bg-ink p-1.5 shadow-pop">
        <div className="rounded-[20px] bg-surface px-3 pt-2 pb-4">
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-line" aria-hidden />
          <p className="text-center text-[11px] font-bold tracking-wide text-muted uppercase">{tr({ en: 'Messages', es: 'Mensajes' })}{masked ? ` · ${masked}` : ''}</p>
          <div className="mt-3 rounded-[14px] rounded-tl-[4px] bg-surface-2 p-3 text-[14px] leading-snug text-ink">
            <p className="mb-1 flex items-center justify-between gap-2 text-[12px] font-bold text-muted">
              <span>SMS · Get your Cl@ve</span><span className="tabular-nums font-semibold">{clock(at, lang).slice(0, 5)}</span>
            </p>
            <p className="font-bold">{tr(m.title)}</p>
            <p className="mt-1">{tr(m)}</p>
          </div>
        </div>
      </motion.div>
      <figcaption className="mt-2 text-center text-[12px] text-muted">{tr({ en: 'Simulated SMS (prototype): no real message is sent.', es: 'SMS simulado (prototipo): no se envía ningún mensaje real.' })}</figcaption>
    </figure>
  )
}

/** The advanced level alone was refused: the basic level stays, the reason is shown and a review can be asked for. */
function AdvancedRefusal({ c }: { c: Case }) {
  const { tr, lang } = useTr()
  const [form, setForm] = useState(false)
  const d = lastRefusal(c)
  if (!d || d.scope !== 'advanced' || c.level !== 'basic') return null
  const dismissed = c.appeal?.state === 'dismissed' && c.appeal.scope === 'advanced'
  const open = c.appeal?.state === 'open'
  const reasonId = dismissed ? c.appeal?.keptReasonId ?? d.reasonId : d.reasonId
  return (
    <section className="space-y-3 rounded-card border border-danger/40 bg-surface p-4" data-testid="advanced-refused" data-reason={reasonId}>
      <h3 className="font-display text-[18px] font-bold text-ink">{tr({ en: 'Advanced level not approved', es: 'Nivel avanzado no aprobado' })}</h3>
      <p className="text-[15px] text-muted">{tr({ en: 'Your basic level stays active.', es: 'Tu nivel básico sigue activo.' })}</p>
      {dismissed && reasonId && <MsgBlock id="COR-07" tone="danger" vars={{ reason: citizenReasonShort(reasonId as RejId, lang), legal: tr(MSG['COR-07'].legal) }} />}
      {reasonId && <p className="text-[16px] leading-relaxed text-ink">{fillMsg(tr(MSG[reasonId]), { fields: discrepancyText(c, reasonId, tr) })}</p>}
      {open && <MsgBlock id="COR-05" tone="info" />}
      {form ? <ReviewRequest c={c} onClose={() => setForm(false)} />
        : !open && !dismissed && <BigButton testId="ask-review" onClick={() => setForm(true)}><Scale size={18} aria-hidden />{tr(MSG['STA-5'].button)}</BigButton>}
    </section>
  )
}

/**
 * The REJ-05 placeholder "[field: value on your document / value in the records]", filled from the case's
 * discrepancy rows (residence rows first; chip rows when the refusal is about the chip), e.g. "Surnames: ROJAS GÓMEZ / ROJAS".
 */
export function discrepancyText(c: Case, reasonId: string | undefined, tr: (b: { en: string; es: string }) => string): string {
  const all = c.discrepancies ?? []
  const residence = all.filter(x => x.source === 'residence')
  const rows = reasonId === 'REJ-05' && residence.length ? residence : all
  if (!rows.length) return '—'
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
  return rows.map(x => `${cap(tr(fieldLabel(x.field)))}: ${x.document} / ${x.records}`).join('; ')
}

function Refused({ c }: { c: Case }) {
  const { tr, lang } = useTr()
  const d = lastRefusal(c)
  const [form, setForm] = useState(false)
  const [call, setCall] = useState(false)
  const reasonId = c.appeal?.state === 'dismissed' ? c.appeal.keptReasonId ?? d?.reasonId : d?.reasonId
  const vars = { fields: discrepancyText(c, reasonId, tr) }
  const dismissed = c.appeal?.state === 'dismissed'
  const canAsk = !dismissed && c.appeal?.state !== 'open'
  const offerCall = offersVideoAfterRefusal(reasonId as RejId | undefined)
  return (
    <div className="space-y-4" data-testid="result-refused" data-reason={reasonId}>
      {dismissed && reasonId && (
        <MsgBlock id="COR-07" tone="danger" vars={{ reason: citizenReasonShort(reasonId as RejId, lang), legal: tr(MSG['COR-07'].legal) }} />
      )}
      <MsgBlock id="STA-5" as="h2" tone="danger" />
      {reasonId && (
        <section className="rounded-card border border-danger/40 bg-surface p-4" data-testid={`msg-${reasonId}`}>
          <p className="text-[16px] leading-relaxed text-ink">{fillMsg(tr(MSG[reasonId]), vars)}</p>
        </section>
      )}
      {form ? <ReviewRequest c={c} onClose={() => setForm(false)} /> : (
        <div className="grid gap-3">
          {canAsk && <BigButton testId="ask-review" onClick={() => setForm(true)}><Scale size={18} aria-hidden />{tr(MSG['STA-5'].button)}</BigButton>}
          {offerCall && <BigButton variant="secondary" testId="book-video-call" onClick={() => setCall(true)}><Video size={18} aria-hidden />{tr(C.bookVideoCall)}</BigButton>}
        </div>
      )}
      {offerCall && <OfficeOption />}
      <Modal open={call} onOpenChange={setCall} title={tr(MSG['FALL-01'].title)} closeLabel={tr(C.close)}>
        <p className="text-[16px] leading-relaxed text-ink">{tr(MSG['FALL-01'])}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{tr(C.afterRefusalCall)}</p>
        {canAsk && <div className="mt-4"><BigButton onClick={() => { setCall(false); setForm(true) }}>{tr(MSG['STA-5'].button)}</BigButton></div>}
      </Modal>
    </div>
  )
}

/** Extra lines the rules or the officer added for the citizen (VER-07, COR-02, COR-04, COR-05). */
function ExtraMsgs({ c }: { c: Case }) {
  const extra = (['VER-07', 'COR-02', 'COR-04', 'COR-05'] as MsgId[]).filter(id => c.citizenMsgs.includes(id))
  if (!extra.length) return null
  return <div className="space-y-3">{extra.map(id => <MsgBlock key={id} id={id} tone="info" />)}</div>
}

function Checking({ c }: { c: Case }) {
  const { tr } = useTr()
  const [err, setErr] = useState('')
  const fb = c.session.fallback
  const ended = c.session.videoCall?.state === 'ended'
  return (
    <div className="space-y-4">
      <ExtraMsgs c={c} />
      <MsgBlock id="STA-2" tone="info">
        {c.awaitingOfficer && <p className="mt-2 text-[16px] font-semibold text-ink" data-testid="person-reviewing">{tr(MSG['STA-2'].personReviewing)}</p>}
      </MsgBlock>
      {ended && <Alert tone="info">{tr(C.callEnded)}</Alert>}
      {fb?.comeBackLater && !fb.joined && (
        <>
          <BigButton variant="secondary" testId="join-video-call" onClick={() => { try { actions.joinVideoCall(c.id) } catch (e) { setErr(errText(e)) } }}><Video size={18} aria-hidden />{tr(C.joinCallAgain)}</BigButton>
          <Alert>{err}</Alert>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export function StatusPage() {
  const { id } = useParams()
  const c = useCase(id)
  const { tr, lang } = useTr()
  const go = useGo()
  useTick(20_000)
  const remote = useRecentRemote(id, 2500)
  const [toast, setToast] = useState(false)
  const [fire, setFire] = useState(0)
  const prev = useRef<{ status?: string; adv?: string }>({})
  const status = c?.status
  const adv = c?.advanced
  useEffect(() => {
    const p = prev.current
    if (status === 'approved' && p.status && (p.status !== 'approved' || (adv === 'granted' && p.adv !== 'granted'))) setFire(n => n + 1)
    prev.current = { status, adv }
  }, [status, adv])
  useEffect(() => { if (remote) setToast(true) }, [remote])
  const hideToast = useCallback(() => setToast(false), [])

  if (!c) return <Navigate to="/citizen" replace />
  const path = flowPath(c)
  if (path !== `/citizen/case/${c.id}`) return <Navigate to={path} replace />

  if (isHelperDone(c.id)) {
    return (
      <div data-testid="helper-done">
        <MsgBlock id="ASS-03" as="h1" vars={{ applicant: fullName(c.typed.data) }} />
        <div className="mt-6"><BigButton testId="helper-signout" onClick={() => { actions.citizenSignOut(); clearHelperDone(); go('/citizen', { replace: true }) }}><LogOut size={18} aria-hidden />{tr(C.signOutSession)}</BigButton></div>
      </div>
    )
  }

  const s = c.session
  const decided = c.status === 'approved' || c.status === 'not_approved'
  const inRoom = Boolean(s.videoCall && (s.videoCall.state === 'waiting' || s.videoCall.state === 'live') && !decided)
  const openInfo = c.status === 'need_info' && c.infoRequest && !c.infoRequest.response
  const offerFallback = !inRoom && !decided && s.fallback && !s.fallback.joined && !s.fallback.comeBackLater
  const shown = citizenStatus(c)
  const route = c.route ? ROUTES[c.route] : undefined
  const engineRunning = (c.status === 'received' || c.status === 'checking') && !c.awaitingOfficer && !inRoom

  return (
    <div className="relative" data-testid="status-page" data-status={c.status} data-citizen-status={shown}>
      <Confetti fire={fire} />
      <LiveToast message={tr(C.updatedJustNow)} show={toast} onDone={hideToast} />

      <motion.div
        animate={remote ? { boxShadow: ['0 0 0 0 rgba(18,120,74,0)', '0 0 0 6px rgba(18,120,74,0.25)', '0 0 0 0 rgba(18,120,74,0)'] } : {}}
        transition={{ duration: 1.4 }}
        className={cn('mb-5 flex flex-wrap items-center gap-3 rounded-card border border-line border-t-4 border-t-brand bg-surface p-4', remote && 'bg-success-soft')}
      >
        <Avatar initials={c.persona.initials} hue={c.persona.hue} size={44} />
        <div className="min-w-0 flex-1 basis-[60%]">
          <h1 className="font-display text-[20px] font-bold text-ink">{tr(C.statusTitle)}</h1>
          <p className="text-[14px] text-muted">
            {c.persona.name}{route ? ` · ${route.id === 'F' ? tr(C.routeFallback) : `${tr(C.routeLabel)} ${route.code}`}` : ''}{c.submittedAt ? ` · ${tr(C.submitted)} ${rel(c.submittedAt, lang)}` : ''}
          </p>
          {c.policyProposal && <ProposedRuleTag className="mt-1" />}
        </div>
        <div className="flex basis-full flex-wrap items-center justify-between gap-2 sm:basis-auto sm:flex-col sm:items-end" aria-live="polite">
          <StatusPill status={shown} advanced={c.advanced} />
          <LiveIndicator caseId={c.id} className="!px-0 text-[10px]" />
        </div>
      </motion.div>

      <section aria-live="polite" className="mb-6" data-testid="status-main">
        {inRoom ? <div className="space-y-4">{shown === 'need_info' && <MsgBlock id="STA-3" as="h2" />}<VideoRoom c={c} /></div>
          : openInfo ? <div className="space-y-4"><MsgBlock id="STA-3" as="h2" /><InfoReply c={c} /></div>
          : offerFallback ? <div className="space-y-4">{shown === 'need_info' && <MsgBlock id="STA-3" as="h2" />}<FallbackOffer c={c} /></div>
          : c.status === 'approved' ? <Approved c={c} />
          : c.status === 'not_approved' ? <Refused c={c} />
          : c.status === 'received' ? <MsgBlock id="STA-1" tone="info" />
          : <Checking c={c} />}
        {engineRunning && <p className="mt-3 text-[14px] text-muted" role="status">{tr(C.running)}</p>}
      </section>

      <section aria-labelledby="tracker-title" className="mb-6 rounded-card border border-line bg-surface p-4">
        <h2 id="tracker-title" className="mb-3 font-display text-[18px] font-bold text-ink">{tr(C.progressTitle)}</h2>
        <Tracker c={c} />
      </section>

      {c.checks.length > 0 && (
        <details className="mb-6 rounded-card border border-line bg-surface p-4">
          <summary className="cursor-pointer"><span className="inline-block align-middle"><CheckListHeader title={tr(C.checksTitle)} /></span></summary>
          <div className="mt-3"><CheckList expected={[]} results={c.checks} running={false} compact /></div>
        </details>
      )}
    </div>
  )
}

