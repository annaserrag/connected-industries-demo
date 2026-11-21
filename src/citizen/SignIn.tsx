import { motion } from 'framer-motion'
import { ChevronRight, Lock } from 'lucide-react'
import { Avatar, SimulatedBadge, StatusPill } from '@/ui'
import { actions, useClave } from '@/core/store'
import { CASE_LIBRARY, DOCUMENTS } from '@/contract/seed'
import { C } from './copy'
import { flowPath, safe } from './Shell'
import { useGo, useReduced, useTr } from './hooks'

export function SignIn() {
  const { tr } = useTr()
  const go = useGo()
  const reduced = useReduced()
  const cases = useClave(s => s.cases)

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink">{tr(C.signInTitle)}</h1>
        <SimulatedBadge />
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr(C.signInBody)}</p>

      <h2 className="mt-6 mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
        <Lock size={12} aria-hidden /> {tr(C.demoIdentities)}
      </h2>
      <ul className="space-y-2.5">
        {CASE_LIBRARY.map((seed, i) => {
          const c = cases[seed.id]
          if (!c) return null
          const doc = DOCUMENTS[c.document.type]
          return (
            <motion.li
              key={c.id}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.035 }}
            >
              <button
                type="button"
                data-testid={`persona-${c.id}`}
                onClick={() => {
                  safe(() => actions.setActiveCitizenCase(c.id))
                  go(flowPath(c))
                }}
                className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:border-brand/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
              >
                <Avatar initials={c.persona.initials} hue={c.persona.hue} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{c.persona.name}</span>
                  <span className="block truncate text-[13px] text-muted">{tr(c.persona.profile)}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">{tr(doc.label)}</span>
                    {c.status === 'draft' ? (
                      <span className="text-[11px] font-medium text-muted">{c.route ? tr(C.inProgress) : tr(C.notStarted)}</span>
                    ) : (
                      <StatusPill status={c.status} />
                    )}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
              </button>
            </motion.li>
          )
        })}
      </ul>
      <p className="mt-4 text-center text-xs text-muted">{tr(C.fictional)}</p>
    </div>
  )
}
