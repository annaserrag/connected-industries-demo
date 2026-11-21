/** After sign-up: show the assigned DEMO sign-in number, then continue into the route assistant. */
import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check, CheckCircle2, Copy, ShieldCheck } from 'lucide-react'
import { Avatar, SimulatedBadge } from '@/ui'
import { C, fill } from './copy'
import { BigButton } from './components/basics'
import { flowPath } from './Shell'
import { useCase, useGo, useReduced, useTr } from './hooks'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through to the legacy path (iframes, insecure contexts) */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function Welcome() {
  const { id } = useParams()
  const c = useCase(id)
  const { tr } = useTr()
  const go = useGo()
  const reduced = useReduced()
  const [copied, setCopied] = useState(false)
  const numberRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headingRef.current?.focus() }, [])
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(t)
  }, [copied])

  if (!c) return <Navigate to="/citizen" replace />

  const number = c.document.number
  const onCopy = async () => {
    const ok = await copyText(number)
    if (ok) setCopied(true)
    else if (numberRef.current) {
      // Could not copy: select the number so the person can copy it by hand.
      const range = document.createRange()
      range.selectNodeContents(numberRef.current)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }
  const next = () => go(c.status === 'draft' && !c.route ? `/citizen/start/${c.id}` : flowPath(c))

  return (
    <div data-testid="signup-welcome">
      <div className="flex flex-col items-center text-center">
        <motion.span
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          className="relative grid size-16 place-items-center rounded-full bg-success-soft text-success"
        >
          <CheckCircle2 size={34} aria-hidden />
        </motion.span>
        <h1 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-[28px] font-semibold leading-tight tracking-tight text-ink focus:outline-none">
          {tr(C.accountCreated)}
        </h1>
        <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-muted">
          {fill(tr(C.accountCreatedBody), { name: c.persona.name.split(' ')[0] })}
        </p>
      </div>

      <motion.section
        aria-labelledby="signin-number-label"
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 0.12 }}
        className="relative mt-6 overflow-hidden rounded-[22px] bg-ink p-5 text-surface shadow-[0_20px_40px_-24px_rgba(22,24,29,0.6)]"
      >
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-brand/40 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <Avatar initials={c.persona.initials} hue={c.persona.hue} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{c.persona.name}</p>
            <p className="truncate text-[12px] text-surface/70">{tr(c.persona.profile)}</p>
          </div>
        </div>
        <p id="signin-number-label" className="relative mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-surface/70">{tr(C.yourSignInNumber)}</p>
        <div className="relative mt-1.5 flex items-center gap-2">
          <code
            ref={numberRef}
            data-testid="assigned-number"
            className="min-w-0 flex-1 break-all font-mono text-[20px] font-semibold tracking-wide text-surface select-all"
          >
            {number}
          </code>
          <button
            type="button"
            onClick={onCopy}
            aria-label={tr(C.copyNumber)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-surface/12 px-3.5 text-[13px] font-semibold text-surface ring-1 ring-surface/25 transition hover:bg-surface/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-surface/50"
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
            {tr(copied ? C.copied : C.copy)}
          </button>
        </div>
        <p className="relative mt-3 text-[12px] text-surface/70">{tr(C.demoNumberNote)}</p>
        <span className="sr-only" aria-live="polite">{copied ? tr(C.copied) : ''}</span>
      </motion.section>

      <section aria-labelledby="next-steps" className="mt-6 rounded-[20px] bg-surface p-4 ring-1 ring-line">
        <h2 id="next-steps" className="text-xs font-semibold uppercase tracking-wider text-muted">{tr(C.nextStepsTitle)}</h2>
        <ol className="mt-3 space-y-3">
          {C.nextSteps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-[14px] leading-snug text-ink">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">{i + 1}</span>
              <span className="pt-0.5">{tr(s)}{i === 1 && <SimulatedBadge className="ml-2 align-middle" />}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 flex gap-3 rounded-[14px] bg-brand-soft/60 p-3.5 text-[13px] leading-snug text-ink">
        <ShieldCheck size={18} className="mt-px shrink-0 text-brand" aria-hidden />
        <p>{tr(C.realDocNote)}</p>
      </div>

      <BigButton className="mt-6" onClick={next}>
        {tr(C.startApplication)} <ArrowRight size={18} aria-hidden />
      </BigButton>
    </div>
  )
}
