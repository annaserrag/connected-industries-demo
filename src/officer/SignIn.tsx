/* Screen 0: simulated officer sign-in. Pick a demo officer; no passwords. */
import { motion } from 'framer-motion'
import { ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { KEY_RULE, OFFICERS, SERVICE_NAME } from '@/contract/seed'
import { actions, ClaveRuleError } from '@/core/store'
import { Avatar, LangToggle, LogoGlyph } from '@/ui'
import { toast } from 'sonner'
import { C } from './copy'
import { useTr } from './lib'
import { Sim } from './components/ui'
import { TOASTER_ID } from './live'

export function SignIn() {
  const tr = useTr()
  const signIn = (id: string) => {
    try {
      actions.officerSignIn(id)
    } catch (e) {
      toast.error(e instanceof ClaveRuleError ? e.message : String((e as Error).message), { toasterId: TOASTER_ID })
    }
  }
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0f1117] px-6 py-16 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ background: 'radial-gradient(60rem 30rem at 15% 0%, color-mix(in oklab, var(--color-brand) 40%, transparent), transparent 60%), radial-gradient(50rem 30rem at 100% 100%, color-mix(in oklab, var(--color-sim) 35%, transparent), transparent 60%)' }} />
      <div className="absolute top-5 right-6"><LangToggle /></div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <LogoGlyph size={44} />
          <div>
            <p className="text-lg font-semibold tracking-tight">{SERVICE_NAME}</p>
            <p className="text-sm text-white/60">{tr(C.appName)}</p>
          </div>
          <span className="ml-auto"><Sim /></span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{tr(C.signInTitle)}</h1>
          </div>
          <p className="mt-2 max-w-xl text-sm text-white/65">{tr(C.signInBody)}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium text-white/80">
            <ShieldCheck className="size-3.5" aria-hidden /> {tr(C.simulatedLogin)}
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2" aria-label={tr(C.signInAs)}>
            {OFFICERS.map((o, i) => (
              <motion.li key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
                <button
                  type="button"
                  onClick={() => signIn(o.id)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left outline-none transition hover:border-white/25 hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <Avatar initials={o.name.split(' ').map(p => p[0]).join('')} hue={i ? 168 : 226} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-white/50">{tr(C.signInAs)}</span>
                    <span className="block truncate font-semibold">{o.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/55"><Building2 className="size-3" aria-hidden />{o.office}</span>
                    <span className="block font-mono text-[11px] text-white/70">{o.id}</span>
                  </span>
                  <ArrowRight className="size-5 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" aria-hidden />
                </button>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="mt-6 flex gap-2 text-xs leading-relaxed text-white/55">
          <span className="font-semibold text-white/75">{tr(C.keyRule)}:</span>
          {tr(KEY_RULE)}
        </p>
      </motion.div>
    </div>
  )
}
