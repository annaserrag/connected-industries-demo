import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { SimulatedBadge } from './primitives'
import { ScoreBar } from './steps'
import { cn, useTr, SPRING, SPRING_POP } from './utils'

/* ------------------------------------------------------- page transitions */

/**
 * Spring transition between steps/pages. Change `id` to animate; `direction` 1 = forward, -1 = back.
 * Under reduced motion it only cross-fades.
 */
export const PageTransition = ({ id, direction = 1, children, className }: {
  id: string | number; direction?: 1 | -1; children: ReactNode; className?: string
}) => {
  const reduce = useReducedMotion()
  const d = reduce ? 0 : 28 * direction
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={id}
        className={className}
        initial={{ opacity: 0, x: d }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -d }}
        transition={reduce ? { duration: 0.15 } : SPRING}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Container that staggers the entrance of its <StaggerItem> children. */
export const Stagger = ({ children, className, delay = 0, gap = 0.06, as = 'div' }: {
  children: ReactNode; className?: string; delay?: number; gap?: number; as?: 'div' | 'ul' | 'ol'
}) => {
  const reduce = useReducedMotion()
  const M = as === 'ul' ? motion.ul : as === 'ol' ? motion.ol : motion.div
  return (
    <M
      className={className}
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </M>
  )
}

/** Child of <Stagger>: fades + rises in sequence. */
export const StaggerItem = ({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) => {
  const M = as === 'li' ? motion.li : motion.div
  return (
    <M className={className} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: SPRING } }}>
      {children}
    </M>
  )
}

/* ---------------------------------------------------------- ConfettiBurst */

const CONFETTI = ['#1d47b8', '#9db4ff', '#16a35a', '#f2b640', '#ffffff', '#c9d6f7']

/**
 * Small, tasteful confetti burst from the centre of its (relative) parent. Re-fires whenever `fire`
 * changes to a new truthy value. Renders nothing under reduced motion.
 */
export const ConfettiBurst = ({ fire, pieces = 26, className }: { fire: boolean | number | string; pieces?: number; className?: string }) => {
  const reduce = useReducedMotion()
  const [burst, setBurst] = useState(0)
  useEffect(() => { if (fire) setBurst(b => b + 1) }, [fire])
  const parts = useMemo(() => Array.from({ length: pieces }, (_, i) => {
    const a = (i / pieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const v = 70 + Math.random() * 90
    return {
      x: Math.cos(a) * v, y: Math.sin(a) * v * 0.8 - 30, r: (Math.random() - 0.5) * 540,
      c: CONFETTI[i % CONFETTI.length], w: 5 + Math.random() * 4, h: Math.random() > 0.5 ? 10 : 5, round: Math.random() > 0.7,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [burst, pieces])
  if (reduce || !burst) return null
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-visible', className)}>
      {parts.map((p, i) => (
        <motion.span
          key={`${burst}-${i}`}
          className="absolute"
          style={{ width: p.w, height: p.h, background: p.c, borderRadius: p.round ? 99 : 2, boxShadow: p.c === '#ffffff' ? '0 0 0 1px rgb(0 0 0 / .08)' : undefined }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 90], opacity: [1, 1, 0], rotate: p.r, scale: 1 }}
          transition={{ duration: 1.3, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------- ChipReadAnimation */

export type ChipReadState = 'idle' | 'reading' | 'done' | 'failed'

/**
 * Simulated NFC chip read: a document card with the phone resting on it, wave rings from the chip
 * while reading, and a progress bar. Props: `state`, optional `progress` (0–1, else auto), `docLabel`.
 */
export const ChipReadAnimation = ({ state, progress, docLabel, className, showSimulated = true }: {
  state: ChipReadState; progress?: number; docLabel?: string; className?: string; showSimulated?: boolean
}) => {
  const tr = useTr()
  const reduce = useReducedMotion()
  const [auto, setAuto] = useState(0)
  useEffect(() => {
    if (state === 'idle') { setAuto(0); return }
    if (state === 'done') { setAuto(1); return }
    if (state === 'failed') return
    if (progress != null) return
    const c = animate(0, 0.94, { duration: reduce ? 0.2 : 2.6, ease: [0.3, 0.6, 0.4, 1], onUpdate: setAuto })
    return () => c.stop()
  }, [state, progress, reduce])
  const p = state === 'done' ? 1 : progress ?? auto
  const pct = Math.round(p * 100)
  const accent = state === 'done' ? 'var(--color-success)' : state === 'failed' ? 'var(--color-danger)' : 'var(--color-brand)'
  const statusText = {
    idle: tr('Hold the top of your phone on the document', 'Apoya la parte de arriba del móvil sobre el documento'),
    reading: tr('Reading the chip… keep still', 'Leyendo el chip… no lo muevas'),
    done: tr('Chip read', 'Chip leído'),
    failed: tr('Could not read the chip', 'No se pudo leer el chip'),
  }[state]

  return (
    <div className={cn('flex w-full flex-col items-center', className)}>
      <div className="relative grid h-[230px] w-full max-w-[320px] place-items-center">
        {/* soft stage */}
        <div aria-hidden className="absolute inset-x-4 inset-y-2 rounded-[28px] bg-[radial-gradient(60%_60%_at_50%_55%,var(--color-brand-soft),transparent_75%)]" />

        {/* document card */}
        <motion.div
          aria-hidden
          className="absolute top-[78px] h-[128px] w-[204px] overflow-hidden rounded-[14px] shadow-raised"
          style={{ background: 'linear-gradient(140deg,#2b3a55 0%,#1c2840 100%)' }}
          animate={state === 'failed' && !reduce ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.45 }}
        >
          <svg className="absolute inset-0 size-full opacity-[0.18]" viewBox="0 0 204 128">
            {Array.from({ length: 9 }, (_, i) => <circle key={i} cx="160" cy="70" r={10 + i * 9} fill="none" stroke="#c9d6f7" strokeWidth="0.8" />)}
          </svg>
          <div className="absolute top-3 left-3.5 text-[8.5px] font-bold tracking-[0.18em] text-[#c9d6f7]/80 uppercase">{docLabel ?? tr('Passport', 'Pasaporte')} · DEMO</div>
          {/* chip */}
          <div className="absolute top-[46px] left-[22px] h-[30px] w-[38px] rounded-[6px]" style={{ background: 'linear-gradient(135deg,#e7c873,#b8923a)' }}>
            <svg viewBox="0 0 38 30" className="size-full opacity-60"><path d="M0 10h13M0 20h13M25 10h13M25 20h13M13 0v30M25 0v30M13 15h12" stroke="#7a5d1c" strokeWidth="1" fill="none" /></svg>
          </div>
          <div className="absolute right-4 bottom-4 left-[74px] space-y-1.5">
            <div className="h-1.5 w-4/5 rounded-full bg-white/25" />
            <div className="h-1.5 w-3/5 rounded-full bg-white/15" />
            <div className="h-1.5 w-2/3 rounded-full bg-white/15" />
          </div>
        </motion.div>

        {/* NFC rings from the chip */}
        <div aria-hidden className="pointer-events-none absolute top-[78px] left-1/2 h-[128px] w-[204px] -translate-x-1/2">
          <span className="absolute top-[61px] left-[41px]">
            {state === 'reading' && !reduce && [0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="absolute -top-[20px] -left-[20px] size-[40px] rounded-full border-2"
                style={{ borderColor: accent }}
                initial={{ scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 3.2, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
              />
            ))}
            <AnimatePresence>
              {(state === 'done' || state === 'failed') && (
                <motion.span
                  key={state}
                  initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING_POP}
                  className="absolute -top-[16px] -left-[16px] grid size-8 place-items-center rounded-full text-white shadow-raised ring-[3px] ring-white"
                  style={{ background: accent }}
                >
                  {state === 'done' ? <Check className="size-4.5" strokeWidth={3} /> : <X className="size-4.5" strokeWidth={3} />}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>

        {/* phone resting on the document */}
        <motion.div
          aria-hidden
          className="absolute top-[6px] h-[112px] w-[132px] rounded-[22px] bg-[#15171b] p-[5px] shadow-pop"
          initial={false}
          animate={reduce ? { y: 0 } : state === 'idle' ? { y: [-4, 6, -4] } : { y: 8 }}
          transition={state === 'idle' && !reduce ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : SPRING}
          style={{ left: 'calc(50% - 4px)', rotate: 7 }}
        >
          <div className="grid size-full place-items-center rounded-[17px] bg-[linear-gradient(160deg,#25407f,#1d47b8)]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".95">
              <path d="M6 8.3a5 5 0 0 1 0 7.4" /><path d="M9.5 6a8 8 0 0 1 0 12" /><path d="M13 3.6a11.5 11.5 0 0 1 0 16.8" />
            </svg>
          </div>
        </motion.div>
      </div>

      {/* progress */}
      <div className="mt-2 w-full max-w-[300px]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className={cn('text-sm font-semibold', state === 'failed' ? 'text-danger' : state === 'done' ? 'text-success' : 'text-ink')} aria-live="polite">
            {statusText}
          </p>
          <span className="text-sm font-semibold text-muted tabular-nums">{state === 'idle' ? '' : `${pct}%`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-ink/5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={tr('Chip read progress', 'Progreso de lectura del chip')}>
          <motion.div className="h-full rounded-full" style={{ background: accent }} animate={{ width: `${pct}%` }} transition={{ duration: 0.25 }} />
        </div>
        {showSimulated && <div className="mt-3 flex justify-center"><SimulatedBadge label={tr('Simulated chip read', 'Lectura de chip simulada')} /></div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------- FaceScanAnimation */

export type FaceScanState = 'idle' | 'scanning' | 'done' | 'failed'

const SKIN = [['#f1c9a5', '#dba882'], ['#e0ac84', '#c78d63'], ['#c68c5f', '#a8714a'], ['#9c6744', '#82553a'], ['#6f4a32', '#5b3b28'], ['#f3d3bd', '#e1b598']]
const HAIR = ['#2b1d16', '#4a3020', '#1a1a1f', '#7a4a26', '#3b2f2a', '#5c5450']

/** Generated abstract face illustration (flat shapes, no photo). `hue` picks a skin tone, hair and top colour. */
export const AbstractFace = ({ hue = 24, className }: { hue?: number; className?: string }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const k = Math.abs(Math.round(hue / 47)) % SKIN.length
  const [s1, s2] = SKIN[k]
  const hair = HAIR[(k + Math.round(hue / 90)) % HAIR.length]
  return (
    <svg viewBox="0 0 200 240" className={className} aria-hidden>
      <defs>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s1} />
          <stop offset="1" stopColor={s2} />
        </linearGradient>
      </defs>
      <path d="M18 240c4-46 40-66 82-66s78 20 82 66z" fill={`hsl(${hue} 32% 40%)`} />
      <rect x="84" y="150" width="32" height="34" rx="12" fill={s2} />
      <ellipse cx="100" cy="106" rx="50" ry="60" fill={`url(#s${uid})`} />
      <path d="M50 102c-4-42 22-64 52-64 34 0 54 24 48 64-6-18-20-30-44-32-22-2-44 10-56 32z" fill={hair} />
      <ellipse cx="81" cy="110" rx="5" ry="3.6" fill="#2a1c16" />
      <ellipse cx="119" cy="110" rx="5" ry="3.6" fill="#2a1c16" />
      <path d="M100 116c-3 9-4 14 2 15" fill="none" stroke="rgb(0 0 0 / .22)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M88 142c8 5 16 5 24 0" fill="none" stroke="rgb(60 20 20 / .55)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Simulated face check: oval mask over a generated abstract face with a scanning ring.
 * Shows liveness / face-match ScoreBars (with thresholds) when scores are given.
 */
export const FaceScanAnimation = ({ state, liveness, faceMatch, livenessMin = 0.85, faceMatchMin = 0.9, hue = 24, hint, className, showSimulated = true }: {
  state: FaceScanState; liveness?: number; faceMatch?: number; livenessMin?: number; faceMatchMin?: number
  hue?: number; hint?: string; className?: string; showSimulated?: boolean
}) => {
  const tr = useTr()
  const reduce = useReducedMotion()
  const ring = state === 'done' ? 'var(--color-success)' : state === 'failed' ? 'var(--color-danger)' : state === 'scanning' ? '#9db4ff' : 'rgba(255,255,255,.7)'
  const label = hint ?? {
    idle: tr('Place your face inside the oval', 'Coloca tu cara dentro del óvalo'),
    scanning: tr('Hold still… checking it is really you', 'No te muevas… comprobamos que eres tú'),
    done: tr('Face check complete', 'Comprobación facial completada'),
    failed: tr('We could not confirm your face', 'No hemos podido confirmar tu cara'),
  }[state]
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  // oval geometry in a 240x300 viewBox
  const cx = 120, cy = 138, rx = 82, ry = 104
  const perim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
  return (
    <div className={cn('flex w-full flex-col items-center', className)}>
      <div className="relative w-full max-w-[280px] overflow-hidden rounded-[28px] bg-[#0f1318] shadow-raised" style={{ aspectRatio: '240 / 300' }}>
        {/* backdrop */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_30%,#2a3446,#0f1318)]" />
        <motion.div
          aria-hidden className="absolute inset-x-[8%] top-[10%] bottom-[-6%]"
          animate={state === 'scanning' && !reduce ? { x: [0, 3, -3, 0], rotate: [0, 1, -1, 0] } : { x: 0, rotate: 0 }}
          transition={{ duration: 3, repeat: state === 'scanning' ? Infinity : 0, ease: 'easeInOut' }}
        >
          <AbstractFace hue={hue} className="size-full" />
        </motion.div>

        <svg viewBox="0 0 240 300" className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <mask id={`m${uid}`}>
              <rect width="240" height="300" fill="white" />
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
            </mask>
            <clipPath id={`c${uid}`}><ellipse cx={cx} cy={cy} rx={rx} ry={ry} /></clipPath>
          </defs>
          <rect width="240" height="300" fill="#0b0e12" opacity=".72" mask={`url(#m${uid})`} />
          {/* static ring */}
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={ring} strokeWidth="3" opacity={state === 'scanning' ? 0.35 : 1} style={{ transition: 'stroke 300ms' }} />
          {/* rotating progress arc */}
          {state === 'scanning' && !reduce && (
            <motion.ellipse
              cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#9db4ff" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${perim * 0.22} ${perim * 0.78}`}
              animate={{ strokeDashoffset: [0, -perim] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          )}
          {/* scan line + mesh dots */}
          {state === 'scanning' && !reduce && (
            <g clipPath={`url(#c${uid})`}>
              <motion.g animate={{ y: [cy - ry, cy + ry - 6, cy - ry] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
                <rect x={cx - rx} y={0} width={rx * 2} height="26" fill={`url(#g${uid})`} />
                <rect x={cx - rx} y={24} width={rx * 2} height="2" fill="#9db4ff" />
              </motion.g>
              {[[92, 120], [148, 120], [120, 150], [100, 176], [140, 176], [120, 96], [80, 150], [160, 150]].map(([x, y], i) => (
                <motion.circle key={i} cx={x} cy={y} r="2.2" fill="#c9d6f7"
                  animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </g>
          )}
          <defs>
            <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9db4ff" stopOpacity="0" />
              <stop offset="1" stopColor="#9db4ff" stopOpacity=".35" />
            </linearGradient>
          </defs>
        </svg>

        {/* result mark */}
        <AnimatePresence>
          {(state === 'done' || state === 'failed') && (
            <motion.div
              key={state}
              initial={reduce ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING_POP}
              className="absolute bottom-[14px] left-1/2 grid size-11 -translate-x-1/2 place-items-center rounded-full text-white shadow-pop ring-4 ring-[#0f1318]"
              style={{ background: state === 'done' ? 'var(--color-success)' : 'var(--color-danger)' }}
              aria-hidden
            >
              {state === 'done' ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
            </motion.div>
          )}
        </AnimatePresence>

        {showSimulated && <div className="absolute top-3 left-3"><SimulatedBadge /></div>}
      </div>

      <p className={cn('mt-4 text-center text-sm font-semibold', state === 'failed' ? 'text-danger' : state === 'done' ? 'text-success' : 'text-ink')} aria-live="polite">
        {label}
      </p>
      <AnimatePresence>
        {(liveness != null || faceMatch != null) && state !== 'idle' && state !== 'scanning' && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
            className="mt-4 w-full max-w-[280px] space-y-3 rounded-[16px] bg-surface p-4 shadow-card"
          >
            {liveness != null && <ScoreBar label={tr('Liveness', 'Prueba de vida')} value={liveness} threshold={livenessMin} />}
            {faceMatch != null && <ScoreBar label={tr('Face match', 'Coincidencia facial')} value={faceMatch} threshold={faceMatchMin} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
