/**
 * Route assistant (MSG-RA-02 … RA-06), one question per screen, then the recommended route (RA-07A/B/C/F/X).
 * The answers are only stored with actions.setAnswers when the citizen confirms the result.
 */
import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Baby, BookOpen, Bot, ChevronLeft, CircleHelp, FileText, HandHeart, IdCard, Smartphone, User } from 'lucide-react'
import { Avatar, ProposedRuleTag, cn } from '@/ui'
import { actions } from '@/core/store'
import type { AssistantAnswers, DocumentType, Who, YesNoUnsure } from '@/contract/types'
import { DOCUMENT_OPTIONS, WHO_OPTIONS, YES_NO_UNSURE, type MsgId } from '@/contract/messages'
import { SIGNUP_COUNTRIES, countryByName, recommendRoute } from '@/contract/seed'
import { C, fill } from './copy'
import { BigButton, OptionCard, ProgressBar } from './components/basics'
import { Alert, SelectInput, msg } from './components/flow'
import { flowPath } from './Shell'
import { errText, useCase, useGo, useReduced, useTr } from './hooks'

type Q = 'nationality' | 'document' | 'euEid' | 'who' | 'nfc' | 'result'
type DocAnswer = DocumentType | 'UNSURE'

const DOC_ORDER: DocAnswer[] = ['DNI', 'EU_EID', 'PASSPORT', 'TIE', 'NIE_PAPER', 'RED_CARD', 'UNSURE']
const docIcon = (d: DocAnswer) =>
  d === 'UNSURE' ? <CircleHelp size={20} /> : d === 'PASSPORT' ? <BookOpen size={20} /> : d === 'NIE_PAPER' || d === 'RED_CARD' ? <FileText size={20} /> : <IdCard size={20} />
const whoIcon = (w: Who) => (w === 'self' ? <User size={20} /> : w === 'helping' ? <HandHeart size={20} /> : <Baby size={20} />)

interface Draft { countryIndex: number; document: DocAnswer | null; euEid: YesNoUnsure | null; who: Who | null; nfc: YesNoUnsure | null }

function toAnswers(d: Draft): AssistantAnswers {
  const country = SIGNUP_COUNTRIES[d.countryIndex]
  const group = country?.group ?? 'non_eu'
  const unsure = d.document === 'UNSURE'
  const who = d.who ?? 'self'
  const euEid = group === 'eu' ? d.euEid : null
  return {
    nationalityGroup: group, nationality: country?.name.en, document: d.document && d.document !== 'UNSURE' ? d.document : 'PASSPORT', documentUnsure: unsure || undefined,
    euEid, who, nfc: d.nfc, hasEuEid: euEid === 'yes', assisted: who === 'helping', forMinor: who === 'child',
  }
}

/** RA-06 is asked only when the answers so far could lead to route B. */
function nfcNeeded(d: Draft): boolean {
  if (!d.document) return false
  return recommendRoute(toAnswers({ ...d, nfc: null })).route === 'B'
}

export function Assistant() {
  const { id } = useParams()
  const c = useCase(id)
  const { tr } = useTr()
  const go = useGo()
  const reduced = useReduced()
  const [draft, setDraft] = useState<Draft>(() => {
    const a = c?.answers
    const idx = SIGNUP_COUNTRIES.findIndex(x => x.name.en === (a?.nationality ?? c?.typed.nationality))
    return {
      countryIndex: idx >= 0 ? idx : SIGNUP_COUNTRIES.indexOf(countryByName(c?.typed.nationality ?? '') ?? SIGNUP_COUNTRIES[0]),
      document: a ? (a.documentUnsure ? 'UNSURE' : a.document) : null,
      euEid: a?.euEid ?? null,
      who: a ? c!.session.who : null,
      nfc: a?.nfc ?? null,
    }
  })
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [error, setError] = useState('')

  const steps: Q[] = useMemo(() => {
    const group = SIGNUP_COUNTRIES[draft.countryIndex]?.group
    return ['nationality', 'document', ...(group === 'eu' ? (['euEid'] as Q[]) : []), 'who', ...(nfcNeeded(draft) ? (['nfc'] as Q[]) : []), 'result']
  }, [draft])

  if (!c) return <Navigate to="/citizen" replace />
  if (c.session.consents.at || c.status !== 'draft') return <Navigate to={flowPath(c)} replace />

  const q = steps[Math.min(i, steps.length - 1)]
  const total = steps.length - 1
  const set = (p: Partial<Draft>) => { setDraft(d => ({ ...d, ...p })); setError('') }
  const answered = q === 'nationality' ? draft.countryIndex >= 0 : q === 'document' ? Boolean(draft.document) : q === 'euEid' ? Boolean(draft.euEid) : q === 'who' ? Boolean(draft.who) : q === 'nfc' ? Boolean(draft.nfc) : true
  const next = () => {
    if (!answered) { setError(tr(C.chooseOne)); return }
    setDir(1); setI(n => Math.min(n + 1, steps.length - 1))
  }
  const back = () => {
    setError('')
    if (i === 0) { go('/citizen'); return }
    setDir(-1); setI(n => n - 1)
  }
  const answers = toAnswers(draft)
  const rec = recommendRoute(answers)
  const resultId = `RA-07${rec.route}` as MsgId
  const large = draft.who === 'helping'

  const confirm = () => {
    try {
      const country = SIGNUP_COUNTRIES[draft.countryIndex]
      actions.setAnswers(c.id, {
        nationality: country.name.en, nationalityGroup: country.group, document: draft.document!,
        euEid: country.group === 'eu' ? draft.euEid : null, who: draft.who ?? 'self', nfc: steps.includes('nfc') ? draft.nfc : null,
      })
      if (rec.route === 'F') {
        actions.joinVideoCall(c.id)
        go(`/citizen/case/${c.id}`)
        return
      }
      go(`/citizen/verify/${c.id}`)
    } catch (e) { setError(errText(e)) }
  }

  const variants = {
    enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * -40 }),
  }
  const legend = 'mb-2 block font-display text-[24px] font-bold leading-tight text-ink'
  const help = (h?: { en: string; es: string }) => h && <p className="mb-4 text-[16px] leading-relaxed text-muted">{tr(h)}</p>

  return (
    <div className={cn(large && 'assisted-large')} data-large-text={large ? '1' : undefined} data-testid="route-assistant">
      <div className="mb-5 flex items-center gap-3">
        <button type="button" onClick={back} className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink hover:bg-surface-2" aria-label={tr(C.back)}>
          <ChevronLeft size={20} aria-hidden />
        </button>
        <div className="flex-1">
          <ProgressBar value={q === 'result' ? 1 : (i + 1) / (total + 1)} label={q === 'result' ? tr(C.yourRoute) : fill(tr(C.questionOf), { n: i + 1, total })} />
        </div>
      </div>

      {i === 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-[2px] border border-line bg-surface p-3">
          <Avatar initials={c.persona.initials} hue={c.persona.hue} size={40} />
          <p className="text-[15px] leading-snug text-ink"><span className="font-bold">{tr(C.hello)}, {c.typed.data.givenNames.split(' ')[0]}.</span> {tr(msg('RA-01'))}</p>
        </div>
      )}

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section key={q} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: reduced ? 0.12 : 0.22, ease: 'easeOut' }}>
          {q === 'nationality' && (
            <div data-testid="ra-02">
              <h1 className={legend}>{tr(msg('RA-02'))}</h1>
              {help(msg('RA-02').help)}
              <SelectInput
                label={tr(C.nationality)} value={String(draft.countryIndex)} onChange={v => set({ countryIndex: Number(v), euEid: null })} testId="ra-nationality" name="nationality"
                options={SIGNUP_COUNTRIES.map((x, n) => ({ value: String(n), label: tr(x.name) }))}
              />
            </div>
          )}

          {q === 'document' && (
            <fieldset data-testid="ra-03">
              <legend className={legend}>{tr(msg('RA-03'))}</legend>
              {help(msg('RA-03').help)}
              <div className="space-y-2.5">
                {DOC_ORDER.map(d => (
                  <OptionCard key={d} name="document" value={d} checked={draft.document === d} onChange={() => set({ document: d, nfc: null })} title={tr(DOCUMENT_OPTIONS[d])} icon={docIcon(d)} />
                ))}
              </div>
            </fieldset>
          )}

          {q === 'euEid' && (
            <fieldset data-testid="ra-04">
              <legend className={legend}>{tr(msg('RA-04'))}</legend>
              {help(msg('RA-04').help)}
              <div className="space-y-2.5">
                {(['yes', 'no', 'unsure'] as YesNoUnsure[]).map(v => (
                  <OptionCard key={v} name="euEid" value={v} checked={draft.euEid === v} onChange={() => set({ euEid: v })} title={tr(YES_NO_UNSURE[v])} />
                ))}
              </div>
            </fieldset>
          )}

          {q === 'who' && (
            <fieldset data-testid="ra-05">
              <legend className={legend}>{tr(msg('RA-05'))}</legend>
              <div className="space-y-2.5">
                {(['self', 'helping', 'child'] as Who[]).map(w => (
                  <OptionCard key={w} name="who" value={w} checked={draft.who === w} onChange={() => set({ who: w })} title={tr(WHO_OPTIONS[w])} icon={whoIcon(w)} />
                ))}
              </div>
              {large && <p className="mt-3 text-[15px] text-muted" role="status">{tr(C.largeTextOn)}</p>}
            </fieldset>
          )}

          {q === 'nfc' && (
            <fieldset data-testid="ra-06">
              <legend className={legend}>{tr(msg('RA-06'))}</legend>
              {help(msg('RA-06').help)}
              <div className="space-y-2.5">
                {(['yes', 'no', 'unsure'] as YesNoUnsure[]).map(v => (
                  <OptionCard key={v} name="nfc" value={v} checked={draft.nfc === v} onChange={() => set({ nfc: v })} title={tr(YES_NO_UNSURE[v])} icon={<Smartphone size={20} />} />
                ))}
              </div>
            </fieldset>
          )}

          {q === 'result' && (
            <div data-testid="recommended-route" data-route={rec.route}>
              <p className="text-[14px] font-bold uppercase tracking-wider text-muted">{tr(C.yourRoute)}</p>
              <motion.div
                initial={reduced ? false : { scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="mt-2 rounded-card border-2 border-brand bg-brand-soft p-5 text-ink"
                data-testid={`msg-${resultId}`}
              >
                {rec.policyProposal && <ProposedRuleTag className="mb-2" />}
                <h1 className="font-display text-[24px] font-bold leading-tight">{tr(msg(resultId).title!)}</h1>
                <p className="mt-2 text-[16px] leading-relaxed">{tr(msg(resultId))}</p>
                {msg(resultId).why && <p className="mt-3 text-[15px] leading-relaxed text-muted">{tr(msg(resultId).why!)}</p>}
              </motion.div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      <div className="mt-4"><Alert>{error}</Alert></div>

      <div className="mt-6 space-y-2">
        {q !== 'result' ? (
          <BigButton onClick={next} testId="ra-next">{tr(C.next)} <ArrowRight size={18} aria-hidden /></BigButton>
        ) : (
          <>
            <BigButton onClick={confirm} testId="ra-confirm">{tr(msg(resultId).button!)}</BigButton>
            <BigButton variant="ghost" onClick={() => { setDir(-1); setI(0) }}>{tr(C.changeAnswers)}</BigButton>
          </>
        )}
      </div>

      {i === 0 && (
        <p className="mt-5 flex gap-2 text-[14px] leading-snug text-muted" data-testid="msg-AI-01">
          <Bot size={16} className="mt-0.5 shrink-0" aria-hidden />{tr(msg('AI-01'))}
        </p>
      )}
    </div>
  )
}
