/* Screen 7 decision panel: approve, request info, refuse / revoke (closed reason list), video call. */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as RadioGroup from '@radix-ui/react-radio-group'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Ban, BadgeCheck, CircleCheck, Gavel, Info, Lock, MessageSquareText, PhoneOff, Scale, Sparkles, Undo2, Video,
} from 'lucide-react'
import type { Case, RejectionReasonId } from '@/contract/types'
import { KEY_RULE, OFFICERS, REJECTION_REASONS } from '@/contract/seed'
import { PATHS } from '@/contract/api'
import { actions, ClaveRuleError, useClave } from '@/core/store'
import { Avatar, cn } from '@/ui'
import { C, INFO_TEMPLATES } from './copy'
import { canApproveKind, hasVideoCheck, needsVideoCall, reviewKind, suggestedReasons, useHotkeys, useLang, useTr } from './lib'
import { TOASTER_ID } from './live'
import { Btn, Dialog, Kbd, Sim } from './components/ui'
import { FaceArt } from './components/FaceArt'

function run(fn: () => void, onError: (msg: string) => void): boolean {
  try {
    fn()
    return true
  } catch (e) {
    onError(e instanceof ClaveRuleError ? e.message : (e as Error).message)
    return false
  }
}

export function DecisionPanel({ c }: { c: Case }) {
  const tr = useTr()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<null | 'info' | 'refuse' | 'revoke' | 'video'>(null)

  const awaiting = c.awaitingOfficer
  const videoNeeded = needsVideoCall(c)
  const approveKind = canApproveKind(c)
  const canRevoke = c.level !== 'none'
  const approveLabel = approveKind === 'basic' ? tr(C.grantBasic) : tr(C.grantAdvanced)

  const whyDisabled = !awaiting
    ? c.status === 'draft' ? tr(C.notAwaitingDraft)
      : c.status === 'need_info' ? tr(C.notAwaitingNeedInfo)
        : c.status === 'received' || c.status === 'checking' ? tr(C.notAwaitingChecking)
          : tr(C.notAwaitingDone)
    : null

  const fail = (msg: string) => toast.error(tr(C.ruleError), { toasterId: TOASTER_ID, description: msg })
  const done = (title: string, desc?: string) => {
    toast.success(`${title}: ${c.persona.name}`, { toasterId: TOASTER_ID, description: desc ?? tr(C.citizenNotified) })
    navigate(PATHS.officer)
  }

  const approve = () => {
    if (!awaiting || videoNeeded) return
    if (run(() => actions.officerApprove(c.id), fail)) done(`${tr(C.approvedToast)} · ${approveLabel}`)
  }

  useHotkeys({
    a: approve,
    i: () => awaiting && setDialog('info'),
    r: () => awaiting && setDialog('refuse'),
  })

  return (
    <aside aria-labelledby="decision-title" className="rounded-2xl border border-line bg-surface shadow-[0_8px_30px_-12px_rgba(16,16,20,0.18)]">
      <div className="border-b border-line px-5 pt-4 pb-4">
        <div className="flex items-center justify-between">
          <h2 id="decision-title" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"><Gavel className="size-4 text-muted" aria-hidden />{tr(C.decision)}</h2>
          {awaiting
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand"><span className="size-1.5 rounded-full bg-brand" aria-hidden />{tr(C.awaitingYou)}</span>
            : <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted"><Lock className="size-3" aria-hidden />{tr(C.notAwaiting)}</span>}
        </div>
        <p className="mt-2 text-sm text-muted" aria-live="polite">
          {awaiting ? (reviewKind(c) === 'advanced' ? tr(C.advancedReviewKind) : tr(C.decisionKind)) : whyDisabled}
        </p>
      </div>

      <div className="space-y-3 px-5 py-4">
        {/* Fallback: video call first */}
        {awaiting && hasVideoCheck(c) && (
          videoNeeded ? (
            <div className="rounded-xl border border-sim/25 bg-sim-soft/60 p-3">
              <p className="flex items-start gap-2 text-sm text-ink"><Video className="mt-0.5 size-4 shrink-0 text-sim" aria-hidden />{tr(C.videoFirst)}</p>
              <Btn variant="primary" className="mt-3 w-full bg-sim" onClick={() => setDialog('video')}>
                <Video className="size-4" aria-hidden />{tr(C.startVideo)}
              </Btn>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-success-soft p-3 text-sm text-success"><CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />{tr(C.videoDone)}</p>
          )
        )}

        <Btn variant="success" size="lg" className="w-full" disabled={!awaiting || videoNeeded} onClick={approve} kbd="A" aria-keyshortcuts="A">
          <BadgeCheck className="size-[18px]" aria-hidden />{approveLabel}
        </Btn>
        <Btn variant="secondary" size="lg" className="w-full" disabled={!awaiting} onClick={() => setDialog('info')} kbd="I" aria-keyshortcuts="I">
          <MessageSquareText className="size-[18px]" aria-hidden />{tr(C.requestInfo)}
        </Btn>
        <Btn variant="dangerOutline" size="lg" className="w-full" disabled={!awaiting} onClick={() => setDialog('refuse')} kbd="R" aria-keyshortcuts="R">
          <Ban className="size-[18px]" aria-hidden />{tr(C.refuse)}
        </Btn>
        {canRevoke && (
          <div className="pt-1">
            <Btn variant="ghost" size="md" className="w-full text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setDialog('revoke')}>
              <Undo2 className="size-4" aria-hidden />{tr(C.revoke)}
            </Btn>
            {!awaiting && <p className="mt-1 text-center text-[11px] text-muted">{tr(C.revokeHint)}</p>}
          </div>
        )}
      </div>

      <div className="rounded-b-2xl border-t border-line bg-canvas/70 px-5 py-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase"><Scale className="size-3.5" aria-hidden />{tr(C.keyRule)}</p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink">{tr(KEY_RULE)}</p>
      </div>

      <InfoDialog c={c} open={dialog === 'info'} onOpenChange={o => setDialog(o ? 'info' : null)} onDone={() => done(tr(C.infoToast))} onFail={fail} />
      <ReasonDialog c={c} mode="refuse" open={dialog === 'refuse'} onOpenChange={o => setDialog(o ? 'refuse' : null)} onDone={() => done(tr(C.refusedToast))} onFail={fail} />
      <ReasonDialog c={c} mode="revoke" open={dialog === 'revoke'} onOpenChange={o => setDialog(o ? 'revoke' : null)} onDone={() => done(tr(C.revokedToast))} onFail={fail} />
      <VideoCallDialog c={c} open={dialog === 'video'} onOpenChange={o => setDialog(o ? 'video' : null)} onFail={fail} />
    </aside>
  )
}

/* ---------------------------------------------------------- info request */
function InfoDialog({ c, open, onOpenChange, onDone, onFail }: { c: Case; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; onFail: (m: string) => void }) {
  const tr = useTr()
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText('') }, [open])
  const ok = text.trim().length >= 10
  const submit = () => {
    if (!ok) return
    if (run(() => actions.officerRequestInfo(c.id, text.trim()), onFail)) { onOpenChange(false); onDone() }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={tr(C.infoDialogTitle)}
      description={tr(C.infoDialogBody)}
      footer={<>
        <Btn variant="ghost" onClick={() => onOpenChange(false)}>{tr(C.cancel)}</Btn>
        <Btn variant="primary" disabled={!ok} onClick={submit}><MessageSquareText className="size-4" aria-hidden />{tr(C.send)}</Btn>
      </>}
    >
      <p className="text-xs font-semibold text-muted">{tr(C.quickTemplates)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {INFO_TEMPLATES.map(t => (
          <button
            key={t.label.en}
            type="button"
            onClick={() => setText(tr(t.text))}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium outline-none hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-brand"
          >
            {tr(t.label)}
          </button>
        ))}
      </div>
      <label htmlFor="info-msg" className="mt-4 block text-sm font-semibold">{tr(C.message)}</label>
      <textarea
        id="info-msg"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={5}
        aria-describedby="info-hint"
        className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface p-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        placeholder={tr(INFO_TEMPLATES[0].text)}
      />
      <p id="info-hint" className="mt-1 text-xs text-muted">{ok ? `${text.trim().length}` : tr(C.minChars)}</p>
    </Dialog>
  )
}

/* ------------------------------------------------- refuse / revoke dialog */
function ReasonDialog({ c, mode, open, onOpenChange, onDone, onFail }: {
  c: Case; mode: 'refuse' | 'revoke'; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; onFail: (m: string) => void
}) {
  const tr = useTr()
  const [reason, setReason] = useState<RejectionReasonId | ''>('')
  const [note, setNote] = useState('')
  useEffect(() => { if (open) { setReason(''); setNote('') } }, [open])
  const hints = suggestedReasons(c)
  const r = reason ? REJECTION_REASONS[reason] : null
  const confirm = () => {
    if (!reason) return
    const n = note.trim() || undefined
    const ok = run(() => (mode === 'refuse' ? actions.officerRefuse(c.id, reason, n) : actions.officerRevoke(c.id, reason, n)), onFail)
    if (ok) { onOpenChange(false); onDone() }
  }
  const partial = mode === 'refuse' && c.level === 'basic'

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={<span className="flex items-center gap-2">{mode === 'refuse' ? <Ban className="size-5 text-danger" aria-hidden /> : <Undo2 className="size-5 text-danger" aria-hidden />}{mode === 'refuse' ? tr(C.refuseTitle) : tr(C.revokeTitle)} · {c.persona.name}</span>}
      description={tr(C.refuseBody)}
      footer={<>
        {!reason && <span id="reason-needed" className="mr-auto text-sm text-muted">{tr(C.pickReason)}</span>}
        <Btn variant="ghost" onClick={() => onOpenChange(false)}>{tr(C.cancel)}</Btn>
        <Btn variant="danger" disabled={!reason} aria-describedby={!reason ? 'reason-needed' : undefined} onClick={confirm}>
          {mode === 'refuse' ? <Ban className="size-4" aria-hidden /> : <Undo2 className="size-4" aria-hidden />}
          {mode === 'refuse' ? tr(C.confirmRefuse) : tr(C.confirmRevoke)}
        </Btn>
      </>}
    >
      {partial && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-info-soft p-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {tr({ en: 'The basic level stays granted: this refuses only the advanced level.', es: 'El nivel básico se mantiene: esto deniega solo el nivel avanzado.' })}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p id="reason-label" className="text-sm font-semibold">{tr(C.reasonRequired)} <span className="text-danger" aria-hidden>*</span></p>
          <RadioGroup.Root
            value={reason}
            onValueChange={v => setReason(v as RejectionReasonId)}
            aria-labelledby="reason-label"
            aria-required
            className="mt-2 space-y-1.5"
          >
            {Object.values(REJECTION_REASONS).map(rr => (
              <RadioGroup.Item
                key={rr.id}
                value={rr.id}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-brand',
                  reason === rr.id ? 'border-danger bg-danger-soft/60' : 'border-line hover:bg-canvas',
                )}
              >
                <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border-2', reason === rr.id ? 'border-danger' : 'border-muted/50')}>
                  <RadioGroup.Indicator className="size-2 rounded-full bg-danger" />
                </span>
                <span className="flex-1 font-medium">{tr(rr.officerLabel)}</span>
                {hints.has(rr.id) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sim-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-sim"><Sparkles className="size-3" aria-hidden />{tr(C.suggested)}</span>
                )}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <label htmlFor="ref-note" className="mt-4 block text-xs font-semibold text-muted">{tr(C.internalNote)}</label>
          <textarea id="ref-note" value={note} onChange={e => setNote(e.target.value)} rows={2} className="mt-1 w-full resize-y rounded-xl border border-line p-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30" />
        </div>

        <div aria-live="polite">
          <p className="text-sm font-semibold">{tr(C.citizenWillSee)}</p>
          {r ? (
            <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 space-y-2.5">
              {(['en', 'es'] as const).map(l => (
                <div key={l} lang={l} className="rounded-xl border border-line bg-canvas p-3.5">
                  <p className="text-[10.5px] font-bold tracking-[0.08em] text-muted uppercase">{l === 'en' ? tr(C.englishVersion) : tr(C.spanishVersion)}</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{r.citizenMessage[l]}</p>
                  <p className="mt-1 text-[13px] text-muted"><span className="font-semibold text-ink/80">{l === 'en' ? 'How to fix it' : 'Cómo corregirlo'}:</span> {r.howToFix[l]}</p>
                </div>
              ))}
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3 text-[13px] text-muted">
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-white"><Scale className="size-3" aria-hidden />{tr({ en: 'Appeal', es: 'Recurrir' })}</span>
                {tr(C.appealButtonNote)}
              </div>
            </motion.div>
          ) : (
            <div className="mt-2 grid h-[calc(100%-1.75rem)] min-h-48 place-items-center rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{tr(C.pickReason)}</div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------ video call (sim) */
function VideoCallDialog({ c, open, onOpenChange, onFail }: { c: Case; open: boolean; onOpenChange: (o: boolean) => void; onFail: (m: string) => void }) {
  const tr = useTr()
  const lang = useLang()
  const [phase, setPhase] = useState<'connecting' | 'verifying' | 'done'>('connecting')
  const [secs, setSecs] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clear = () => { timers.current.forEach(id => window.clearTimeout(id)); timers.current = [] }
    if (!open) { clear(); return }
    setPhase('connecting'); setSecs(0)
    timers.current.push(window.setTimeout(() => setPhase('verifying'), 1100))
    timers.current.push(window.setTimeout(() => {
      if (run(() => actions.officerCompleteVideoCall(c.id), onFail)) setPhase('done')
      else onOpenChange(false)
    }, 1100 + 3000))
    const tick = window.setInterval(() => setSecs(s => s + 1), 1000)
    return () => { clear(); window.clearInterval(tick) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, c.id])

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const officerId = useClave(s => s.officerId)
  const officerName = OFFICERS.find(o => o.id === officerId)?.name ?? ''
  const officerInitials = officerName.split(' ').map(p => p[0]).join('') || 'OF'

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      dark
      title={<span className="flex items-center gap-2"><Video className="size-5 text-white/70" aria-hidden />{tr(C.callTitle)} · {c.persona.name}<Sim className="ml-1" /></span>}
      description={tr(C.callNote)}
      footer={phase === 'done'
        ? <Btn variant="success" onClick={() => onOpenChange(false)} autoFocus><CircleCheck className="size-4" aria-hidden />{tr(C.callBack)}</Btn>
        : <Btn variant="danger" onClick={() => onOpenChange(false)}><PhoneOff className="size-4" aria-hidden />{tr(C.callEnd)}</Btn>}
    >
      <div className="relative overflow-hidden rounded-2xl bg-black/60 ring-1 ring-white/10">
        <div className="relative mx-auto aspect-video max-h-[46vh]">
          <FaceArt hue={c.persona.hue} initials={c.persona.initials} variant={phase === 'connecting' ? 'empty' : 'live'} label={c.persona.name} className="absolute inset-0 h-full w-full object-cover text-white/40 [&]:h-full" />
          {/* document held to camera */}
          {phase !== 'connecting' && (
            <motion.div
              initial={{ opacity: 0, y: 30, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: -4 }}
              className="absolute bottom-6 left-6 w-44 overflow-hidden rounded-lg bg-gradient-to-br from-[#f3efe6] to-[#d9d2c2] p-2.5 text-[9px] text-[#3b372f] shadow-xl"
              aria-hidden
            >
              <div className="flex gap-2">
                <div className="h-12 w-9 rounded bg-[#bdb6a8]" />
                <div className="flex-1 space-y-1 pt-0.5">
                  <div className="h-1.5 w-full rounded bg-[#a39d90]" />
                  <div className="h-1.5 w-3/4 rounded bg-[#a39d90]" />
                  <p className="font-mono text-[8px]">{c.document.number}</p>
                </div>
              </div>
              {phase === 'verifying' && <motion.div className="absolute inset-x-0 h-0.5 bg-[#12b76a] shadow-[0_0_12px_#12b76a]" initial={{ top: '0%' }} animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 1.6, repeat: Infinity }} />}
            </motion.div>
          )}
          {/* officer PIP */}
          <div className="absolute top-4 right-4 grid h-24 w-32 place-items-center rounded-xl bg-[#1d2130] ring-1 ring-white/15">
            <Avatar initials={officerInitials} hue={226} size={44} />
            <span className="absolute bottom-1.5 left-2 text-[10px] font-medium text-white/70">{tr(C.you)} · {officerName}</span>
          </div>
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
            <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden />
            <span className="tabular-nums">{mmss}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-white/5 p-4 ring-1 ring-white/10" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {phase === 'done'
            ? <CircleCheck className="size-4 text-[#12b76a]" aria-hidden />
            : <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />}
          {phase === 'connecting' ? tr(C.callConnecting) : phase === 'verifying' ? tr(C.callVerifying) : tr(C.callDone)}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={cn('h-full rounded-full', phase === 'done' ? 'bg-[#12b76a]' : 'bg-white/80')}
            initial={{ width: '0%' }}
            animate={{ width: phase === 'connecting' ? '15%' : '100%' }}
            transition={{ duration: phase === 'verifying' ? 3 : 0.8, ease: 'linear' }}
          />
        </div>
        {phase === 'done' && <p className="mt-2 text-sm text-white/70">{tr(C.callDoneBody)}</p>}
        {phase !== 'done' && <p className="mt-2 font-mono text-[11px] text-white/45">{c.document.number} · {c.document.issuingCountry} · {new Date(c.document.expires).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB')}</p>}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/45"><Kbd className="border-white/15 bg-white/10 text-white/70">Esc</Kbd>{tr(C.callEnd)}</p>
    </Dialog>
  )
}
