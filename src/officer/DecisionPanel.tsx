/* Screen 7 decision panel (SPEC §6): actions by context.
 *  - first decision: Iniciar videollamada · Aprobar nivel básico · Pedir más información · Rechazar con motivo
 *  - advanced review: Aprobar nivel avanzado · Pedir más información · Rechazar con motivo (advanced only)
 *  - open review request: Aprobar · Pedir más información · Mantener la denegación — or, for the officer who
 *    refused, a notice that another person decides (the core enforces it too).
 * Only an officer refuses, always with a reason from the closed list REJ-01…08. */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as RadioGroup from '@radix-ui/react-radio-group'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Ban, BadgeCheck, Gavel, Lock, LogOut, MessageSquareText, PhoneOff, Scale, Sparkles, Undo2, UserRoundX, Video } from 'lucide-react'
import type { Case, Lang, RejectionReasonId } from '@/contract/types'
import { KEY_RULE, OFFICERS, REJECTION_REASONS } from '@/contract/seed'
import { MSG, REJ_ORDER, fillMsg } from '@/contract/messages'
import { PATHS } from '@/contract/api'
import { actions, ClaveRuleError, useClave } from '@/core/store'
import { Avatar, cn } from '@/ui'
import { C, K } from './copy'
import { citizenReasonShort, isDeepfakeCase, refusePrerequisiteError } from '@/core/refuseRules'
import { caseTitle, fill, onFallback, officerName, plainRuleError, rejCitizenText, reviewKind, useHotkeys, useLang, useTr } from './lib'
import { TOASTER_ID } from './live'
import { Btn, Dialog } from './components/ui'

type Fail = (msg: string) => void

function run(fn: () => void, onError: Fail): boolean {
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
  const me = useClave(s => s.officerId)
  const [dialog, setDialog] = useState<null | 'info' | 'refuse' | 'uphold' | 'revoke'>(null)
  const [docShown, setDocShown] = useState(false)
  const [faceOk, setFaceOk] = useState(false)
  useEffect(() => { setDocShown(false); setFaceOk(false) }, [c.id])

  const kind = reviewKind(c)
  const awaiting = c.awaitingOfficer
  const call = c.session?.videoCall?.state
  const fallback = onFallback(c)
  const deepfake = isDeepfakeCase(c)
  const ownRefusal = kind === 'appeal' && c.appeal?.refusedBy === me
  const firstDecision = awaiting && kind === 'decision'
  const onAppeal = awaiting && kind === 'appeal'
  const callLive = call === 'live'
  const needLiveCheck = (firstDecision && fallback) || (onAppeal && deepfake)
  const approveBlocked = Boolean(
    (needLiveCheck && call !== 'live' && call !== 'ended')
    || (callLive && needLiveCheck && !(docShown && faceOk)),
  )

  const fail: Fail = msg => toast.error(tr(C.ruleError), { toasterId: TOASTER_ID, description: tr(plainRuleError(msg)) })
  const done = (title: string) => {
    toast.success(`${title}: ${caseTitle(c)}`, { toasterId: TOASTER_ID, description: tr(K.approvedSent) })
    navigate(PATHS.officer)
  }

  const approve = () => {
    if (!awaiting || ownRefusal || approveBlocked) return
    const note = callLive || call === 'ended' ? (docShown && faceOk ? K.callNote.en : undefined) : undefined
    const ok = run(() => {
      if (kind === 'appeal') actions.officerDecideAppeal(c.id, 'approve')
      else if (kind === 'advanced') actions.officerApproveAdvanced(c.id)
      else actions.officerApproveBasic(c.id, note)
    }, fail)
    if (ok) done(kind === 'advanced' ? tr(C.grantAdvanced) : kind === 'appeal' ? tr(K.approveAppeal) : tr(C.grantBasic))
  }
  const startCall = () => run(() => actions.officerStartVideoCall(c.id), fail)
  const endCall = () => run(() => actions.officerEndVideoCall(c.id), fail)

  useHotkeys({
    a: approve,
    i: () => awaiting && !ownRefusal && setDialog('info'),
    r: () => awaiting && !ownRefusal && setDialog(kind === 'appeal' ? 'uphold' : 'refuse'),
  })

  const whyDisabled = c.status === 'draft' ? tr(C.notAwaitingDraft)
    : c.status === 'need_info' ? tr(C.notAwaitingNeedInfo)
      : c.status === 'received' || c.status === 'checking' ? tr(C.notAwaitingChecking)
        : tr(C.notAwaitingDone)

  const approveLabel = kind === 'appeal' ? tr(K.approveAppeal) : kind === 'advanced' ? tr(C.grantAdvanced) : tr(C.grantBasic)
  const other = OFFICERS.find(o => o.id !== c.appeal?.refusedBy && (o.id === 'OF-DEMO-07' || o.id === 'OF-DEMO-12'))

  return (
    <aside aria-labelledby="decision-title" data-testid="decision-panel" className="rounded-[4px] border border-line bg-surface shadow-[0_8px_30px_-12px_rgba(16,16,20,0.18)]">
      <div className="border-b border-line px-5 pt-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="decision-title" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"><Gavel className="size-4 text-muted" aria-hidden />{tr(C.decision)}</h2>
          {awaiting
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand"><span className="size-1.5 rounded-full bg-brand" aria-hidden />{tr(C.awaitingYou)}</span>
            : <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted"><Lock className="size-3" aria-hidden />{tr(C.notAwaiting)}</span>}
        </div>
        <p className="mt-2 text-sm text-muted" aria-live="polite">
          {!awaiting ? whyDisabled : kind === 'appeal' ? tr(K.decideAppeal) : kind === 'advanced' ? tr(K.decideAdvanced) : tr(K.decideFirst)}
        </p>
      </div>

      <div className="space-y-3 px-5 py-4">
        {awaiting && ownRefusal ? (
          <div role="alert" data-testid="second-officer-notice" className="rounded-[2px] border-2 border-warning/50 bg-warning-soft p-4">
            <p className="flex items-center gap-2 text-[15px] font-bold text-ink"><UserRoundX className="size-5 text-warning" aria-hidden />{tr(K.ownRefusalTitle)}</p>
            <p className="mt-1.5 text-sm text-ink">{fill(tr(K.ownRefusalBody), { reason: c.appeal?.refusedReasonId ? `${c.appeal.refusedReasonId} · ${tr(REJECTION_REASONS[c.appeal.refusedReasonId].officerLabel)}` : '' })}</p>
            <p className="mt-2 text-sm font-bold text-ink">{fill(tr(K.ownRefusalCta), { name: other?.name ?? 'Andrés Ortiz' })}</p>
            <Btn variant="secondary" className="mt-3 w-full" onClick={() => { actions.officerSignOut(); navigate(PATHS.officer) }}>
              <LogOut className="size-4" aria-hidden />{tr(K.switchUser)}
            </Btn>
          </div>
        ) : awaiting ? (
          <>
            {(firstDecision || (onAppeal && deepfake)) && (
              <VideoCallBox
                c={c}
                required={needLiveCheck}
                docShown={docShown}
                faceOk={faceOk}
                setDocShown={setDocShown}
                setFaceOk={setFaceOk}
                onStart={startCall}
                onEnd={endCall}
              />
            )}
            <Btn variant="success" size="lg" className="w-full" disabled={approveBlocked} onClick={approve} kbd="A" aria-keyshortcuts="A" data-testid="btn-approve">
              <BadgeCheck className="size-[18px]" aria-hidden />{approveLabel}
            </Btn>
            {approveBlocked && onAppeal && deepfake && call !== 'live' && call !== 'ended' && (
              <p className="text-center text-xs text-muted" data-testid="deepfake-approve-blocked">{tr(K.deepfakeNeedCall)}</p>
            )}
            {approveBlocked && callLive && <p className="text-center text-xs text-muted">{tr(K.callTickBoth)}</p>}
            <Btn variant="secondary" size="lg" className="w-full" onClick={() => setDialog('info')} kbd="I" aria-keyshortcuts="I" data-testid="btn-info">
              <MessageSquareText className="size-[18px]" aria-hidden />{tr(C.requestInfo)}
            </Btn>
            {kind === 'appeal' ? (
              <Btn variant="dangerOutline" size="lg" className="w-full" onClick={() => setDialog('uphold')} kbd="R" aria-keyshortcuts="R" data-testid="btn-uphold">
                <Scale className="size-[18px]" aria-hidden />{tr(K.uphold)}
              </Btn>
            ) : (
              <Btn variant="dangerOutline" size="lg" className="w-full" onClick={() => setDialog('refuse')} kbd="R" aria-keyshortcuts="R" data-testid="btn-refuse">
                <Ban className="size-[18px]" aria-hidden />{tr(C.refuse)}
              </Btn>
            )}
          </>
        ) : null}
        {c.level !== 'none' && !(awaiting && kind === 'appeal') && (
          <div className="pt-1">
            <Btn variant="ghost" size="md" className="w-full text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setDialog('revoke')}>
              <Undo2 className="size-4" aria-hidden />{tr(C.revoke)}
            </Btn>
            {!awaiting && <p className="mt-1 text-center text-[11px] text-muted">{tr(C.revokeHint)}</p>}
          </div>
        )}
      </div>

      <div className="rounded-b-[4px] border-t border-line bg-canvas/70 px-5 py-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase"><Scale className="size-3.5" aria-hidden />{tr(C.keyRule)}</p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink">{tr(KEY_RULE)}</p>
      </div>

      <InfoDialog c={c} open={dialog === 'info'} onOpenChange={o => setDialog(o ? 'info' : null)} onDone={() => done(tr(C.infoToast))} onFail={fail} />
      <ReasonDialog c={c} mode="refuse" open={dialog === 'refuse'} onOpenChange={o => setDialog(o ? 'refuse' : null)} onDone={() => done(tr(C.refusedToast))} onFail={fail} />
      <ReasonDialog c={c} mode="uphold" open={dialog === 'uphold'} onOpenChange={o => setDialog(o ? 'uphold' : null)} onDone={() => done(tr(K.uphold))} onFail={fail} />
      <ReasonDialog c={c} mode="revoke" open={dialog === 'revoke'} onOpenChange={o => setDialog(o ? 'revoke' : null)} onDone={() => done(tr(C.revokedToast))} onFail={fail} />
    </aside>
  )
}

/* ------------------------------------------------------------ video call */
function VideoCallBox({ c, required, docShown, faceOk, setDocShown, setFaceOk, onStart, onEnd }: {
  c: Case; required: boolean; docShown: boolean; faceOk: boolean
  setDocShown: (v: boolean) => void; setFaceOk: (v: boolean) => void; onStart: () => void; onEnd: () => void
}) {
  const tr = useTr()
  const me = useClave(s => s.officerId)
  const v = c.session?.videoCall
  const state = v?.state
  const myName = officerName(me)
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (state !== 'live') return
    const start = v?.startedAt ? new Date(v.startedAt).getTime() : Date.now()
    const tick = () => setSecs(Math.max(0, Math.round((Date.now() - start) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [state, v?.startedAt])
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  if (state === 'live') {
    return (
      <section data-testid="officer-call-panel" aria-label={tr(K.callLive)} className="overflow-hidden rounded-[2px] bg-[#0f1117] text-white">
        <div className="relative aspect-[4/3]">
          {/* Placeholder citizen tile: a neutral silhouette, never a real face. */}
          <svg viewBox="0 0 160 120" className="absolute inset-0 h-full w-full" role="img" aria-label={tr(K.callCitizenTile)}>
            <rect width="160" height="120" fill="#1d2130" />
            <circle cx="80" cy="48" r="20" fill="#3a4157" />
            <path d="M40 120c4-26 20-40 40-40s36 14 40 40z" fill="#3a4157" />
          </svg>
          <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold">
            <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden />{tr(K.callLive)} · <span className="tabular-nums">{mmss}</span>
          </span>
          <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px]">{caseTitle(c)}</span>
          <div className="absolute right-2 bottom-2 grid h-14 w-20 place-items-center rounded-[2px] bg-[#2a3044] ring-1 ring-white/20">
            <Avatar initials={myName.split(' ').map(p => p[0]).join('') || 'EP'} hue={226} size={28} />
            <span className="absolute bottom-0.5 left-1 text-[9px] text-white/75">{tr(C.you)}</span>
          </div>
        </div>
        <div className="space-y-2 p-3 text-sm">
          {([[docShown, setDocShown, K.callDocShown, 'call-doc'], [faceOk, setFaceOk, K.callFaceMatches, 'call-face']] as const).map(([val, set, label, id]) => (
            <label key={id} className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" data-testid={id} checked={val} onChange={e => set(e.target.checked)} className="size-4 accent-[#12b76a]" />
              {tr(label)}
            </label>
          ))}
          <Btn variant="danger" className="mt-1 w-full" onClick={onEnd} data-testid="btn-end-call"><PhoneOff className="size-4" aria-hidden />{tr(K.callEnd)}</Btn>
        </div>
      </section>
    )
  }
  if (state === 'ended') {
    return (
      <p className="flex items-start gap-2 rounded-[2px] bg-success-soft p-3 text-sm text-success" data-testid="call-ended">
        <Video className="mt-0.5 size-4 shrink-0" aria-hidden />{tr(K.callEnded)}{v?.officerName ? ` · ${v.officerName}` : ''}
      </p>
    )
  }
  return (
    <div className={cn('rounded-[2px] border p-3', required ? 'border-sim/40 bg-sim-soft/60' : 'border-line bg-canvas/60')}>
      <p className="flex items-start gap-2 text-sm text-ink">
        <Video className={cn('mt-0.5 size-4 shrink-0', required ? 'text-sim' : 'text-muted')} aria-hidden />
        <span>{tr(required ? K.callRequired : K.callOptional)}{state === 'waiting' && <><br /><b>{tr(K.callWaiting)}</b></>}</span>
      </p>
      <Btn variant={required ? 'primary' : 'secondary'} className={cn('mt-3 w-full', required && 'bg-sim')} onClick={onStart} data-testid="btn-start-call">
        <Video className="size-4" aria-hidden />{tr(K.startCall)}
      </Btn>
    </div>
  )
}

/* ---------------------------------------------------------- info request */
function InfoDialog({ c, open, onOpenChange, onDone, onFail }: { c: Case; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; onFail: Fail }) {
  const tr = useTr()
  const lang = useLang()
  const [what, setWhat] = useState('')
  const [why, setWhy] = useState('')
  useEffect(() => { if (open) { setWhat(''); setWhy('') } }, [open])
  const ok = what.trim().length >= 5
  const submit = () => {
    if (!ok) return
    if (run(() => actions.officerRequestInfo(c.id, what.trim(), why.trim() || undefined), onFail)) { onOpenChange(false); onDone() }
  }
  const msg = MSG['COR-01']
  const preview = (l: Lang) => fillMsg(msg[l], {
    whatWeNeed: what.trim() || (l === 'es' ? '[lo que necesitamos]' : '[what we need]'),
    reason: why.trim() || (l === 'es' ? '[motivo]' : '[reason]'),
  })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={<span className="flex items-center gap-2"><MessageSquareText className="size-5 text-brand" aria-hidden />{tr(K.infoTitle)} · {caseTitle(c)}</span>}
      description={tr(K.infoBody)}
      footer={<>
        <Btn variant="ghost" onClick={() => onOpenChange(false)}>{tr(K.cancel)}</Btn>
        <Btn variant="primary" disabled={!ok} onClick={submit} data-testid="info-send"><MessageSquareText className="size-4" aria-hidden />{tr(K.send)}</Btn>
      </>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="info-what" className="block text-sm font-semibold">{tr(K.infoWhat)} <span className="text-danger" aria-hidden>*</span></label>
          <textarea id="info-what" value={what} onChange={e => setWhat(e.target.value)} rows={3} placeholder={tr(K.infoWhatPh)}
            className="mt-1.5 w-full resize-y rounded-[2px] border border-line bg-surface p-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30" />
          <label htmlFor="info-why" className="mt-3 block text-sm font-semibold">{tr(K.infoWhy)}</label>
          <textarea id="info-why" value={why} onChange={e => setWhy(e.target.value)} rows={2} placeholder={tr(K.infoWhyPh)}
            className="mt-1.5 w-full resize-y rounded-[2px] border border-line bg-surface p-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30" />
          <p className="mt-2 text-xs text-muted">{tr(msg.example as { en: string; es: string })}</p>
        </div>
        <div aria-live="polite" data-testid="info-preview">
          <p className="text-sm font-semibold">{tr(K.preview)}</p>
          <div className="mt-2 rounded-[2px] border border-line bg-canvas p-4" lang={lang}>
            <p className="text-[15px] font-bold text-ink">{tr(msg.title!)}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{preview(lang)}</p>
            <span className="mt-3 inline-flex rounded-[2px] bg-brand px-3 py-1.5 text-xs font-bold text-brand-ink">{tr(msg.button!)}</span>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------ refuse / uphold / revoke */
function ReasonDialog({ c, mode, open, onOpenChange, onDone, onFail }: {
  c: Case; mode: 'refuse' | 'uphold' | 'revoke'; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; onFail: Fail
}) {
  const tr = useTr()
  const lang = useLang()
  const preselect: RejectionReasonId | '' = mode === 'uphold' ? (c.appeal?.refusedReasonId ?? '') : mode === 'refuse' ? (c.suggestedReason ?? '') : ''
  const [reason, setReason] = useState<RejectionReasonId | ''>(preselect)
  const [note, setNote] = useState('')
  useEffect(() => { if (open) { setReason(preselect); setNote('') } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const confirm = () => {
    if (!reason) return
    const n = note.trim() || undefined
    const ok = run(() => {
      if (mode === 'refuse') actions.officerRefuse(c.id, reason, n)
      else if (mode === 'uphold') actions.officerDecideAppeal(c.id, 'uphold', reason, n)
      else actions.officerRevoke(c.id, reason, n)
    }, onFail)
    if (ok) { onOpenChange(false); onDone() }
  }
  const advancedOnly = mode === 'refuse' && c.level === 'basic'
  const refuseBlock = reason && mode !== 'revoke' ? refusePrerequisiteError(c, reason) : null
  const title = mode === 'uphold' ? tr(K.upholdTitle) : mode === 'revoke' ? tr(C.revokeTitle) : tr(K.refuseTitle)
  const Icon = mode === 'revoke' ? Undo2 : mode === 'uphold' ? Scale : Ban
  const head = MSG[mode === 'uphold' ? 'COR-07' : 'STA-5'] as unknown as { en: string; es: string; title?: { en: string; es: string } }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={<span className="flex items-center gap-2"><Icon className="size-5 text-danger" aria-hidden />{title} · {caseTitle(c)}</span>}
      description={tr(mode === 'uphold' ? K.upholdBody : K.refuseBody)}
      footer={<>
        {!reason && <span id="reason-needed" className="mr-auto text-sm text-muted">{tr(C.pickReason)}</span>}
        <Btn variant="ghost" onClick={() => onOpenChange(false)}>{tr(K.cancel)}</Btn>
        <Btn variant="danger" disabled={!reason || Boolean(refuseBlock)} aria-describedby={!reason ? 'reason-needed' : refuseBlock ? 'reason-blocked' : undefined} onClick={confirm} data-testid="reason-confirm">
          <Icon className="size-4" aria-hidden />
          {mode === 'uphold' ? tr(K.confirmUphold) : mode === 'revoke' ? tr(C.confirmRevoke) : tr(K.confirmRefuse)}
        </Btn>
      </>}
    >
      {advancedOnly && <p className="mb-4 rounded-[2px] bg-info-soft p-3 text-sm text-info">{tr(K.advancedOnly)}</p>}
      {refuseBlock && <p id="reason-blocked" role="alert" data-testid="refuse-prerequisite" className="mb-4 rounded-[2px] bg-warning-soft p-3 text-sm text-ink">{tr(plainRuleError(refuseBlock))}</p>}
      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p id="reason-label" className="text-sm font-semibold">{tr(C.reasonRequired)} <span className="text-danger" aria-hidden>*</span></p>
          <RadioGroup.Root value={reason} onValueChange={v => setReason(v as RejectionReasonId)} aria-labelledby="reason-label" aria-required className="mt-2 space-y-1.5">
            {REJ_ORDER.map(id => {
              const rr = REJECTION_REASONS[id]
              const sel = reason === id
              return (
                <RadioGroup.Item key={id} value={id} data-testid={`reason-${id}`}
                  className={cn('group flex w-full items-start gap-3 rounded-[2px] border px-3 py-2 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-brand', sel ? 'border-danger bg-danger-soft/60' : 'border-line hover:bg-canvas')}>
                  <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2', sel ? 'border-danger' : 'border-muted/50')}>
                    <RadioGroup.Indicator className="size-2 rounded-full bg-danger" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-[11px] font-bold text-muted">{id}</span>{' '}
                    <span className="font-medium">{tr(rr.officerLabel)}</span>
                    <span className="block text-[11.5px] leading-snug text-muted">{tr(rr.when)}</span>
                  </span>
                  {c.suggestedReason === id && mode !== 'revoke' && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sim-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-sim"><Sparkles className="size-3" aria-hidden />{tr(K.suggestedByEngine)}</span>
                  )}
                </RadioGroup.Item>
              )
            })}
          </RadioGroup.Root>
          <label htmlFor="ref-note" className="mt-4 block text-xs font-semibold text-muted">{tr(K.noteLabel)}</label>
          <textarea id="ref-note" value={note} onChange={e => setNote(e.target.value)} rows={2} className="mt-1 w-full resize-y rounded-[2px] border border-line p-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30" />
        </div>
        <div aria-live="polite" data-testid="citizen-preview">
          <p className="text-sm font-semibold">{fill(tr(mode === 'uphold' ? K.citizenSeesUphold : K.citizenSees), { id: reason || 'REJ-0x' })}</p>
          {reason ? (
            <motion.div key={reason} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 rounded-[2px] border border-line bg-canvas p-4" lang={lang}>
              {advancedOnly ? null : <>
                {head.title && <p className="text-[15px] font-bold text-ink">{tr(head.title)}</p>}
                <p className="mt-1 text-[13px] text-muted">{fillMsg(head[lang], { reason: citizenReasonShort(reason, lang), legal: mode === 'uphold' ? (MSG['COR-07'].legal as { en: string; es: string })[lang] : '' })}</p>
              </>}
              <p className="mt-2 text-sm leading-relaxed text-ink">{rejCitizenText(c, reason, lang)}</p>
              <span className="mt-3 inline-flex rounded-[2px] bg-ink px-2.5 py-1 text-xs font-semibold text-white">{tr({ en: 'Ask for a review', es: 'Pedir una revisión' })}</span>
            </motion.div>
          ) : (
            <div className="mt-2 grid min-h-48 place-items-center rounded-[2px] border border-dashed border-line p-6 text-center text-sm text-muted">{tr(C.pickReason)}</div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
