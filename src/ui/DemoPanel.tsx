import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, Clapperboard, Laptop, LayoutDashboard, RotateCcw, Smartphone, Users, Video } from 'lucide-react'
import { CASE_LIBRARY } from '@/contract/seed'
import { actions, useClave } from '@/core/store'
import { Avatar, Button, Kbd, LiveDot, PolicyBadge, StatusPill } from './primitives'
import { Dialog, DialogClose } from './forms'
import { LangToggle, LaptopFrame, Logo, PhoneStatusBar } from './layout'
import { toast } from './feedback'
import { cn, useTr, SPRING } from './utils'

const PHONE = { w: 390, h: 844 }
const LAPTOP = { w: 1280, h: 800 }
const STATUS_H = 44

/** Measures an element's content box. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, set] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => set({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/** An iframe rendered at a fixed device resolution and scaled to fit. */
function ScaledFrame({ src, title, w, h, scale, frameKey }: { src: string; title: string; w: number; h: number; scale: number; frameKey: string | number }) {
  return (
    <div className="relative overflow-hidden" style={{ width: w * scale, height: h * scale }}>
      <iframe
        key={frameKey}
        src={src}
        title={title}
        className="absolute top-0 left-0 origin-top-left border-0 bg-canvas"
        style={{ width: w, height: h, transform: `scale(${scale})` }}
      />
    </div>
  )
}

/** Phone bezel for the demo stage (holds a scaled iframe). */
function StagePhone({ children, scale }: { children: ReactNode; scale: number }) {
  return (
    <div className="relative rounded-[44px] bg-[#0b0c0e] p-[10px] shadow-device ring-1 ring-white/10">
      <span aria-hidden className="absolute top-[110px] -left-[3px] h-8 w-[3px] rounded-l bg-[#2a2d33]" />
      <span aria-hidden className="absolute top-[160px] -left-[3px] h-14 w-[3px] rounded-l bg-[#2a2d33]" />
      <span aria-hidden className="absolute top-[140px] -right-[3px] h-20 w-[3px] rounded-r bg-[#2a2d33]" />
      <div className="relative overflow-hidden rounded-[34px] bg-canvas">
        <div style={{ height: STATUS_H * scale, width: PHONE.w * scale }} className="relative overflow-hidden">
          <div className="origin-top-left" style={{ width: PHONE.w, transform: `scale(${scale})` }}><PhoneStatusBar /></div>
        </div>
        {children}
      </div>
    </div>
  )
}

function StageLabel({ icon, children, right }: { icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex w-full items-center justify-between gap-3 text-[13px] font-semibold text-stage-muted">
      <span className="inline-flex items-center gap-2 [&_svg]:size-4">{icon}{children}</span>
      {right}
    </div>
  )
}

/** Case library popover: the 8 personas with avatar, profile, scenario, demo beat and live status. */
function CaseLibrary({ activeId, onPick }: { activeId: string | null; onPick: (id: string) => void }) {
  const tr = useTr()
  const cases = useClave(s => s.cases)
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const active = CASE_LIBRARY.find(c => c.id === activeId)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="group inline-flex h-11 max-w-[340px] items-center gap-2.5 rounded-[14px] bg-white/[0.06] py-1 pr-3 pl-1.5 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
          aria-label={tr('Choose a case from the library', 'Elegir un caso de la biblioteca')}
        >
          {active ? <Avatar initials={active.persona.initials} hue={active.persona.hue} size={32} /> : <span className="grid size-8 place-items-center rounded-full bg-white/10 text-stage-ink"><Users className="size-4" aria-hidden /></span>}
          <span className="min-w-0">
            <span className="block text-[11px] leading-tight font-semibold tracking-wide text-stage-muted uppercase">{tr('Case library', 'Biblioteca de casos')}</span>
            <span className="block truncate text-sm leading-tight font-semibold text-stage-ink">{active ? active.persona.name : tr('Pick a persona', 'Elige un perfil')}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-stage-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={10} align="start" collisionPadding={16} className="z-50 outline-none">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={SPRING}
            className="w-[min(860px,calc(100vw-32px))] rounded-[22px] bg-surface p-3 shadow-pop"
          >
            <div className="flex items-center justify-between px-2 pt-1 pb-3">
              <div>
                <p className="text-[15px] font-semibold text-ink">{tr('Case library', 'Biblioteca de casos')}</p>
                <p className="text-[13px] text-muted">{tr('Picking a case opens it on the phone and resets it to the start.', 'Al elegir un caso se abre en el móvil y vuelve al inicio.')}</p>
              </div>
              <span className="text-xs font-semibold text-muted">{CASE_LIBRARY.length} {tr('personas · all fictional', 'perfiles · todos ficticios')}</span>
            </div>
            <ul className="scroll-quiet grid max-h-[min(70vh,620px)] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {CASE_LIBRARY.map((c, i) => {
                const live = cases[c.id]
                const on = c.id === activeId
                return (
                  <motion.li key={c.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * 0.03 }}>
                    <button
                      type="button"
                      onClick={() => { onPick(c.id); setOpen(false) }}
                      aria-pressed={on}
                      className={cn(
                        'flex h-full w-full gap-3 rounded-[16px] p-3.5 text-left transition-[background-color,box-shadow]',
                        on ? 'bg-brand-soft ring-2 ring-brand' : 'bg-canvas hover:bg-surface-2',
                      )}
                    >
                      <Avatar initials={c.persona.initials} hue={c.persona.hue} size={44} />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[15px] font-semibold text-ink">{c.persona.name}</span>
                          <span className="text-xs text-muted">{c.persona.age} · {c.persona.nationality}</span>
                          {on && <Check className="ml-auto size-4 text-brand" aria-label={tr('Selected', 'Seleccionado')} />}
                        </span>
                        <span className="block text-[13px] font-medium text-ink/80">{tr(c.persona.profile)}</span>
                        <span className="line-clamp-2 block text-[13px] leading-snug text-muted">{tr(c.scenario)}</span>
                        <span className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-ink px-2.5 text-[11px] font-semibold text-white">
                            <Clapperboard className="size-3" aria-hidden />{tr(c.demoBeat)}
                          </span>
                          {c.policyProposal && <PolicyBadge />}
                          {live && <StatusPill status={live.status} />}
                        </span>
                      </span>
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Segmented control on the dark stage. */
function StageSegment<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; icon: ReactNode }[]; label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-11 items-center rounded-[14px] bg-white/[0.06] p-1 ring-1 ring-white/10">
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={cn('relative z-0 inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition-colors [&_svg]:size-4', on ? 'text-ink' : 'text-stage-muted hover:text-stage-ink')}
          >
            {on && <motion.span layoutId="stage-seg" transition={SPRING} className="absolute inset-0 -z-10 rounded-[10px] bg-stage-ink" />}
            {o.icon}{o.label}
          </button>
        )
      })}
    </div>
  )
}

/** How-to-record hint popover. */
function RecordHint() {
  const tr = useTr()
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="inline-flex h-11 items-center gap-2 rounded-[14px] px-3 text-[13px] font-semibold text-stage-muted ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-stage-ink">
          <Video className="size-4" aria-hidden />{tr('How to record', 'Cómo grabar')}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={10} align="end" collisionPadding={16} className="z-50 w-[340px] rounded-[18px] bg-surface p-5 text-sm text-ink shadow-pop outline-none">
          <p className="mb-3 text-[15px] font-semibold">{tr('Recording the launch video', 'Grabar el vídeo de lanzamiento')}</p>
          <ol className="list-decimal space-y-2 pl-4 leading-snug text-ink/90 marker:font-semibold marker:text-brand">
            <li>{tr('Reset all demo data before each take.', 'Restablece todos los datos antes de cada toma.')}</li>
            <li>{tr('Pick the persona for the beat from the case library.', 'Elige el perfil de la escena en la biblioteca de casos.')}</li>
            <li>{tr('Tap through the phone on the left; the laptop on the right updates live.', 'Avanza en el móvil de la izquierda; el portátil de la derecha se actualiza en directo.')}</li>
            <li>{tr('Switch to the dashboard for the closing numbers (simulated).', 'Cambia al panel para las cifras finales (simuladas).')}</li>
          </ol>
          <p className="mt-4 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
            {tr('Best at 1440 × 900, full screen', 'Mejor a 1440 × 900, pantalla completa')} <Kbd>F11</Kbd> / <Kbd>⌃</Kbd><Kbd>⌘</Kbd><Kbd>F</Kbd>
          </p>
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Demo mode stage at /demo: phone (citizen) + laptop (officer or dashboard) iframes kept in sync by the store. */
export function DemoPanel() {
  const tr = useTr()
  const reduce = useReducedMotion()
  const activeId = useClave(s => s.activeCitizenCaseId)
  const [right, setRight] = useState<'officer' | 'dashboard'>('officer')
  const [confirm, setConfirm] = useState(false)
  const [phoneKey, setPhoneKey] = useState(0)
  const [stageRef, stage] = useSize<HTMLDivElement>()
  const active = CASE_LIBRARY.find(c => c.id === activeId)

  useEffect(() => {
    const prev = document.title
    const prevBg = document.body.style.background
    document.title = 'Demo mode · Get your Cl@ve'
    document.body.style.background = 'var(--color-stage)'
    return () => { document.title = prev; document.body.style.background = prevBg }
  }, [])

  // Fit both devices into the stage.
  const labelH = 34, gap = 48, phoneBezel = 20, laptopChrome = { w: 20, h: 46 }
  const avH = Math.max(300, stage.h - labelH)
  const ps = Math.min(1, (avH - phoneBezel) / PHONE.h)
  const phoneW = PHONE.w * ps + phoneBezel
  const ls = Math.max(0.3, Math.min(1, (stage.w - phoneW - gap - laptopChrome.w - 16) / LAPTOP.w, (avH - laptopChrome.h) / LAPTOP.h))

  const pick = (id: string) => {
    try {
      actions.resetCase(id)
      actions.setActiveCitizenCase(id)
      setPhoneKey(k => k + 1)
      const c = CASE_LIBRARY.find(x => x.id === id)
      toast.success(tr('Case ready', 'Caso listo'), { description: c ? `${c.persona.name} · ${tr(c.demoBeat)}` : undefined })
    } catch (e) {
      toast.error(tr('Could not open the case', 'No se pudo abrir el caso'), { description: String((e as Error).message ?? e) })
    }
  }
  const resetAll = () => {
    try {
      actions.resetDemo()
      setPhoneKey(k => k + 1)
      toast.success(tr('Demo data reset', 'Datos de demostración restablecidos'))
    } catch (e) {
      toast.error(tr('Reset failed', 'Error al restablecer'), { description: String((e as Error).message ?? e) })
    }
    setConfirm(false)
  }

  return (
    <div className="on-dark flex h-[calc(100dvh-45px)] min-h-[560px] flex-col overflow-hidden bg-stage text-stage-ink">
      {/* stage lighting */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_50%_at_30%_0%,rgb(29_71_184/0.22),transparent_70%),radial-gradient(50%_40%_at_90%_100%,rgb(157_180_255/0.08),transparent_70%)]" />

      <header className="relative z-10 flex flex-wrap items-center gap-3 border-b border-stage-line px-5 py-3 lg:px-8">
        <Logo tone="light" size="md" />
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.08] px-3 text-xs font-bold tracking-wide text-stage-ink uppercase ring-1 ring-white/10">
          <Clapperboard className="size-3.5" aria-hidden />{tr('Demo mode', 'Modo demo')}
        </span>
        <div className="mx-1 hidden h-7 w-px bg-stage-line md:block" />
        <CaseLibrary activeId={activeId} onPick={pick} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StageSegment
            label={tr('Right screen', 'Pantalla derecha')}
            value={right}
            onChange={setRight}
            options={[
              { value: 'officer', label: tr('Officer', 'Funcionaria'), icon: <Laptop aria-hidden /> },
              { value: 'dashboard', label: tr('Dashboard', 'Panel'), icon: <LayoutDashboard aria-hidden /> },
            ]}
          />
          <LangToggle tone="stage" className="h-11 rounded-[14px] [&>button]:h-9 [&>button]:rounded-[10px] [&_span]:rounded-[10px]" />
          <RecordHint />
          <Button
            variant="ghost" size="md"
            className="h-11 rounded-[14px] text-stage-ink ring-1 ring-white/10 hover:bg-danger/20"
            icon={<RotateCcw className="size-4" aria-hidden />}
            onClick={() => setConfirm(true)}
          >
            {tr('Reset all demo data', 'Restablecer todo')}
          </Button>
        </div>
      </header>

      {/* now presenting ribbon */}
      <div className="relative z-10 flex min-h-12 items-center gap-3 px-5 py-2 text-[13px] lg:px-8">
        <LiveDot label={tr('Same case, live in both views', 'El mismo caso, en directo en ambas vistas')} className="text-stage-ink" />
        <AnimatePresence mode="wait" initial={false}>
          {active ? (
            <motion.p
              key={active.id}
              initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="min-w-0 truncate text-stage-muted"
            >
              <span aria-hidden className="mx-2 text-stage-line">|</span>
              <span className="font-semibold text-stage-ink">{active.persona.name}</span> — {tr(active.scenario)}
            </motion.p>
          ) : (
            <motion.p key="none" className="text-stage-muted"><span aria-hidden className="mx-2 text-stage-line">|</span>{tr('Pick a case from the library to begin.', 'Elige un caso de la biblioteca para empezar.')}</motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* the stage */}
      <main ref={stageRef} className="relative z-10 flex min-h-0 flex-1 items-start justify-center gap-12 overflow-hidden px-5 pt-2 pb-6 lg:px-8">
        {stage.w > 0 && (
          <>
            <section aria-label={tr('Citizen phone', 'Móvil de la ciudadana')} className="flex shrink-0 flex-col items-center">
              <StageLabel icon={<Smartphone aria-hidden />}>{tr('Citizen · phone', 'Ciudadanía · móvil')}</StageLabel>
              <StagePhone scale={ps}>
                <ScaledFrame src="#/citizen?embed=1" title={tr('Citizen view (phone)', 'Vista ciudadana (móvil)')} w={PHONE.w} h={PHONE.h - STATUS_H} scale={ps} frameKey={phoneKey} />
              </StagePhone>
            </section>
            <section aria-label={right === 'officer' ? tr('Officer laptop', 'Portátil de la funcionaria') : tr('Dashboard', 'Panel')} className="flex min-w-0 flex-col items-center" style={{ width: LAPTOP.w * ls + laptopChrome.w + 16 }}>
              <StageLabel
                icon={right === 'officer' ? <Laptop aria-hidden /> : <LayoutDashboard aria-hidden />}
                right={<LiveDot label={tr('Synced', 'Sincronizado')} className="text-stage-muted" />}
              >
                {right === 'officer' ? tr('Officer · laptop', 'Funcionaria · portátil') : tr('Dashboard · simulated numbers', 'Panel · cifras simuladas')}
              </StageLabel>
              <LaptopFrame>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={right} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <ScaledFrame
                      src={right === 'officer' ? '#/officer?embed=1' : '#/dashboard?embed=1'}
                      title={right === 'officer' ? tr('Officer view (laptop)', 'Vista de la funcionaria (portátil)') : tr('Dashboard view', 'Vista del panel')}
                      w={LAPTOP.w} h={LAPTOP.h} scale={ls} frameKey={right}
                    />
                  </motion.div>
                </AnimatePresence>
              </LaptopFrame>
            </section>
          </>
        )}
      </main>

      <Dialog
        open={confirm} onOpenChange={setConfirm} tone="danger" size="sm"
        title={tr('Reset all demo data?', '¿Restablecer todos los datos?')}
        description={tr('Every case goes back to its starting point and the audit trail is cleared, in every open tab.', 'Todos los casos vuelven al inicio y se vacía el registro de auditoría, en todas las pestañas abiertas.')}
        footer={<>
          <DialogClose asChild><Button variant="secondary">{tr('Cancel', 'Cancelar')}</Button></DialogClose>
          <Button variant="danger" icon={<RotateCcw className="size-4" aria-hidden />} onClick={resetAll}>{tr('Reset everything', 'Restablecer todo')}</Button>
        </>}
      />
    </div>
  )
}
