import { useMemo, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen, Bot, ChevronDown, ChevronLeft, Earth, FileText, Globe, HandHeart, IdCard, Landmark, ShieldCheck, Smartphone, Users,
} from 'lucide-react'
import { Avatar, PolicyBadge, SimulatedBadge, cn } from '@/ui'
import { actions } from '@/core/store'
import type { AssistantAnswers, DocumentType } from '@/contract/types'
import {
  ASSISTANT_QUESTIONS, CHECKS, CITIZEN_MESSAGES, DOCUMENTS, POLICY_PROPOSALS, ROUTES, ROUTE_ORDER, recommendRoute,
} from '@/contract/seed'
import { C, fill } from './copy'
import { BigButton, OptionCard, ProgressBar, RouteCode } from './components/basics'
import { flowPath, safe } from './Shell'
import { useCase, useGo, useReduced, useTr } from './hooks'

type Q = 'nationality' | 'document' | 'hasEuEid' | 'assisted' | 'result'

const DOC_ORDER: DocumentType[] = ['PASSPORT', 'TIE', 'EU_EID', 'DNI', 'NIE_PAPER', 'RED_CARD']
const docIcon = (d: DocumentType) =>
  d === 'PASSPORT' ? <BookOpen size={20} /> : d === 'NIE_PAPER' || d === 'RED_CARD' ? <FileText size={20} /> : <IdCard size={20} />

export function Assistant() {
  const { id } = useParams()
  const c = useCase(id)
  const { tr } = useTr()
  const go = useGo()
  const reduced = useReduced()
  const [answers, setAnswers] = useState<AssistantAnswers | null>(() => (c ? c.answers ?? c.presetAnswers : null))
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [showOthers, setShowOthers] = useState(false)

  const steps: Q[] = useMemo(
    () => (answers ? ['nationality', 'document', ...(answers.nationalityGroup === 'eu' ? (['hasEuEid'] as Q[]) : []), 'assisted', 'result'] : []),
    [answers],
  )

  if (!c || !answers) return <Navigate to="/citizen" replace />
  if (c.status !== 'draft') return <Navigate to={flowPath(c)} replace />

  const q = steps[Math.min(i, steps.length - 1)]
  const questionCount = steps.length - 1
  const set = (patch: Partial<AssistantAnswers>) => setAnswers(a => ({ ...(a as AssistantAnswers), ...patch }))
  const next = () => { setDir(1); setI(n => Math.min(n + 1, steps.length - 1)) }
  const back = () => {
    if (i === 0) { go('/citizen'); return }
    setDir(-1); setI(n => n - 1)
  }
  const rec = recommendRoute(answers)
  const route = ROUTES[rec.route]

  const confirm = () => {
    safe(() => actions.startCase(c.id, answers, rec.route))
    go(`/citizen/verify/${c.id}`)
  }

  const variants = {
    enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * -40 }),
  }

  return (
    <div>
      {/* top bar: back + progress */}
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
          aria-label={tr(C.back)}
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <div className="flex-1">
          {q !== 'result' ? (
            <ProgressBar value={(i + 1) / (questionCount + 1)} label={fill(tr(C.questionOf), { n: i + 1, total: questionCount })} />
          ) : (
            <ProgressBar value={1} label={tr(C.recommendedFor)} />
          )}
        </div>
      </div>

      {i === 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <Avatar initials={c.persona.initials} hue={c.persona.hue} size={40} />
          <p className="text-[13px] leading-snug text-muted">
            <span className="font-semibold text-ink">{tr(C.hello)}, {c.persona.name.split(' ')[0]}.</span> {tr(C.assistantIntro)}
          </p>
        </div>
      )}

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={q}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduced ? 0.12 : 0.22, ease: 'easeOut' }}
          aria-live="polite"
        >
          {q === 'nationality' && (
            <fieldset>
              <legend className="mb-4 font-display text-2xl font-semibold leading-tight text-ink">{tr(ASSISTANT_QUESTIONS.nationality)}</legend>
              <div className="space-y-2.5">
                {(['spanish', 'eu', 'non_eu'] as const).map(v => (
                  <OptionCard
                    key={v} name="nationality" value={v} checked={answers.nationalityGroup === v}
                    onChange={() => set({ nationalityGroup: v, hasEuEid: v === 'eu' ? answers.hasEuEid : false })}
                    title={tr(ASSISTANT_QUESTIONS.nationalityOptions[v])}
                    icon={v === 'spanish' ? <Landmark size={20} /> : v === 'eu' ? <Globe size={20} /> : <Earth size={20} />}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {q === 'document' && (
            <fieldset>
              <legend className="mb-4 font-display text-2xl font-semibold leading-tight text-ink">{tr(ASSISTANT_QUESTIONS.document)}</legend>
              <div className="space-y-2.5">
                {DOC_ORDER.map(d => (
                  <OptionCard
                    key={d} name="document" value={d} checked={answers.document === d}
                    onChange={() => set({ document: d })}
                    title={tr(DOCUMENTS[d].label)}
                    sub={DOCUMENTS[d].hasChip ? tr(C.hasChip) : tr(C.noChip)}
                    icon={docIcon(d)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {q === 'hasEuEid' && (
            <fieldset>
              <legend className="mb-4 font-display text-2xl font-semibold leading-tight text-ink">{tr(ASSISTANT_QUESTIONS.hasEuEid)}</legend>
              <div className="space-y-2.5">
                <OptionCard name="hasEuEid" value="yes" checked={answers.hasEuEid} onChange={() => set({ hasEuEid: true })} title={tr(C.yes)} sub={tr(C.eidYesSub)} icon={<ShieldCheck size={20} />} />
                <OptionCard name="hasEuEid" value="no" checked={!answers.hasEuEid} onChange={() => set({ hasEuEid: false })} title={tr(C.no)} sub={tr(C.eidNoSub)} icon={<IdCard size={20} />} />
              </div>
            </fieldset>
          )}

          {q === 'assisted' && (
            <fieldset>
              <legend className="mb-4 font-display text-2xl font-semibold leading-tight text-ink">{tr(ASSISTANT_QUESTIONS.assisted)}</legend>
              <div className="space-y-2.5">
                <OptionCard name="assisted" value="no" checked={!answers.assisted} onChange={() => set({ assisted: false })} title={tr(C.no)} sub={tr(C.assistedNoSub)} icon={<Smartphone size={20} />} />
                <OptionCard
                  name="assisted" value="yes" checked={answers.assisted} onChange={() => set({ assisted: true })} title={tr(C.yes)} sub={tr(C.assistedYesSub)} icon={<HandHeart size={20} />}
                  aside={answers.assisted && c.assisted ? (
                    <span className="mt-2 block rounded-xl bg-surface px-3 py-2 text-[12px] leading-snug text-muted ring-1 ring-line">
                      <span className="font-semibold text-ink">{tr(C.helperOnDevice)}:</span> {c.assisted.helperName} ({tr(c.assisted.relation)})<br />
                      <span className="font-semibold text-ink">{tr(C.deviceOwner)}:</span> {c.assisted.deviceOwner}
                    </span>
                  ) : undefined}
                />
              </div>
              <p className="mt-4 flex gap-2 rounded-2xl bg-brand-soft/60 p-3 text-[13px] leading-snug text-ink">
                <Users size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                {tr(CITIZEN_MESSAGES.assistedNote)}
              </p>
            </fieldset>
          )}

          {q === 'result' && (
            <div>
              <h1 className="font-display text-2xl font-semibold leading-tight text-ink">{tr(C.recommendedFor)}</h1>
              <motion.div
                initial={reduced ? false : { scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-[color-mix(in_oklab,var(--color-brand),black_28%)] p-5 text-brand-ink shadow-[0_18px_40px_-18px_var(--color-brand)]"
                data-testid="recommended-route"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                    {tr(C.routeLabel)} {route.code}
                  </span>
                  {rec.policyProposal && <span className="rounded-full bg-white px-0.5"><PolicyBadge /></span>}
                </div>
                <h2 className="mt-3 font-display text-[22px] font-semibold leading-tight">{tr(route.name)}</h2>
                <p className="mt-1 text-sm text-white/80">{tr(route.forWhom)}</p>
              </motion.div>

              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">{tr(C.whyThisRoute)}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{tr(rec.reason)}</p>

              {rec.policyProposal && (
                <div className="mt-3 rounded-2xl border border-warning/30 bg-warning-soft p-3 text-[13px] leading-snug text-ink">
                  <div className="mb-1"><PolicyBadge /></div>
                  {tr(C.policyRouteNote)} {tr(rec.route === 'FALLBACK' ? POLICY_PROPOSALS[1] : POLICY_PROPOSALS[0])}
                </div>
              )}

              {c.guardian && rec.route === 'B' && (
                <p className="mt-3 flex gap-2 rounded-2xl bg-surface p-3 text-[13px] leading-snug text-ink ring-1 ring-line">
                  <Users size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                  {fill(tr(C.guardianNote), { guardian: c.guardian.name, relation: tr(c.guardian.relation) })}
                </p>
              )}
              {answers.assisted && (
                <p className="mt-3 flex gap-2 rounded-2xl bg-brand-soft/60 p-3 text-[13px] leading-snug text-ink">
                  <HandHeart size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                  <span>
                    {tr(CITIZEN_MESSAGES.assistedNote)}
                    {c.assisted && (
                      <span className="mt-1 block text-muted">
                        {tr(C.helperOnDevice)}: <strong className="text-ink">{c.assisted.helperName}</strong> ({tr(c.assisted.relation)}) · {tr(C.deviceOwner)}: <strong className="text-ink">{c.assisted.deviceOwner}</strong>
                      </span>
                    )}
                  </span>
                </p>
              )}

              <div className="mt-5 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{tr(C.whatHappensNext)}</h3>
                <SimulatedBadge />
              </div>
              <ol className="mt-2 space-y-1.5">
                {[...(c.guardian && rec.route === 'B' ? (['guardian_link'] as const) : []), ...route.checks].map((ck, n) => (
                  <li key={ck} className="flex items-start gap-3 rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{n + 1}</span>
                    <span className="text-[13px] leading-snug">
                      <span className="font-semibold text-ink">{tr(CHECKS[ck].label)}</span>
                      <span className="block text-muted">{tr(CHECKS[ck].explains)}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <button
                type="button"
                onClick={() => setShowOthers(s => !s)}
                aria-expanded={showOthers}
                aria-controls="other-routes"
                className="mt-4 flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
              >
                {showOthers ? tr(C.hideOtherRoutes) : tr(C.otherRoutes)}
                <ChevronDown size={18} className={cn('transition-transform', showOthers && 'rotate-180')} aria-hidden />
              </button>
              <AnimatePresence initial={false}>
                {showOthers && (
                  <motion.ul
                    id="other-routes"
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {ROUTE_ORDER.filter(r => r !== rec.route).map(r => (
                      <li key={r} className="flex gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
                        <RouteCode code={ROUTES[r].code} className="shrink-0 self-start" />
                        <span className="text-[13px] leading-snug">
                          <span className="font-semibold text-ink">{tr(ROUTES[r].name)}</span>
                          <span className="block text-muted">{tr(ROUTES[r].forWhom)}</span>
                        </span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      <div className="mt-6 space-y-2">
        {q !== 'result' ? (
          <BigButton onClick={next}>{i === steps.length - 2 ? tr(C.seeRecommendation) : tr(C.next)}</BigButton>
        ) : (
          <>
            <BigButton onClick={confirm}>{tr(C.confirmRoute)}</BigButton>
            <BigButton variant="ghost" onClick={() => { setDir(-1); setI(0) }}>{tr(C.changeAnswers)}</BigButton>
          </>
        )}
      </div>

      <p className="mt-5 flex gap-2 text-[12px] leading-snug text-muted">
        <Bot size={15} className="mt-0.5 shrink-0" aria-hidden />
        {tr(CITIZEN_MESSAGES.ownAiAssistant)}
      </p>
    </div>
  )
}
