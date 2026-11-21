import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/ui'
import { useReduced } from '../hooks'

/** Drive a 0→1 progress over `ms` while `running`. Reduced motion jumps quickly to the end. */
export function useProgress(running: boolean, ms: number, onDone?: () => void) {
  const reduced = useReduced()
  const [p, setP] = useState(0)
  useEffect(() => {
    if (!running) return
    const total = reduced ? Math.min(ms, 700) : ms
    const start = Date.now()
    let finished = false
    // setInterval (not rAF) so the step still completes when the tab is in the background.
    const id = window.setInterval(() => {
      const v = Math.min(1, (Date.now() - start) / total)
      setP(v)
      if (v >= 1 && !finished) { finished = true; window.clearInterval(id); onDone?.() }
    }, 40)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  return p
}

/** Ring progress used by chip + face animations. */
function Ring({ p, size, stroke = 6, className }: { p: number; size: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className={cn('-rotate-90', className)} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-2" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - p)} className="stroke-brand transition-[stroke-dashoffset] duration-100"
      />
    </svg>
  )
}

/** Phone seen from the back with a document sliding onto it and NFC waves. */
export function ChipReadAnimation({ progress, done, docLabel }: { progress: number; done: boolean; docLabel: string }) {
  const reduced = useReduced()
  const active = progress > 0 && !done
  return (
    <div className="relative mx-auto grid h-64 w-full place-items-center" aria-hidden>
      <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_45%,var(--color-brand-soft),transparent_65%)]" />
      {/* phone back */}
      <div className="relative h-56 w-28 rounded-[1.6rem] border-[3px] border-ink/80 bg-gradient-to-b from-surface to-surface-2 shadow-xl">
        <div className="absolute left-3 top-3 grid grid-cols-2 gap-1 rounded-xl bg-ink/85 p-1.5">
          <span className="size-3 rounded-full bg-surface-2/70" />
          <span className="size-3 rounded-full bg-surface-2/70" />
          <span className="size-3 rounded-full bg-surface-2/70" />
          <span className="size-1.5 self-center justify-self-center rounded-full bg-warning-soft" />
        </div>
        {/* NFC waves */}
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-[46%] size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={active && !reduced ? { opacity: [0, 0.7, 0], scale: [0.4, 1.6, 2.1] } : { opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
          />
        ))}
      </div>
      {/* document */}
      <motion.div
        className="absolute flex h-24 w-40 flex-col justify-between rounded-xl border border-ink/10 bg-gradient-to-br from-[hsl(222_45%_32%)] to-[hsl(222_50%_20%)] p-2.5 text-[9px] font-semibold uppercase tracking-wider text-white/85 shadow-2xl"
        initial={{ x: 120, y: 60, rotate: 18, opacity: 0 }}
        animate={progress > 0 || done ? { x: 0, y: 18, rotate: -4, opacity: 0.96 } : { x: 120, y: 60, rotate: 18, opacity: 0.9 }}
        transition={{ type: 'spring', stiffness: 120, damping: 16 }}
      >
        <span className="truncate">{docLabel}</span>
        <span className="flex items-end justify-between">
          <span className="grid h-6 w-8 grid-cols-3 gap-px rounded-[3px] bg-[hsl(45_70%_62%)] p-[3px]">
            {Array.from({ length: 6 }).map((_, i) => <span key={i} className="rounded-[1px] bg-[hsl(45_60%_45%)]" />)}
          </span>
          <span className="text-[8px] tracking-normal text-white/60">DEMO</span>
        </span>
      </motion.div>
      {/* progress badge */}
      <div className="absolute bottom-0 right-4 grid place-items-center">
        <Ring p={progress} size={56} />
        <span className="absolute grid place-items-center text-xs font-bold tabular-nums text-ink">
          {done ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-9 place-items-center rounded-full bg-success text-white">
              <Check size={18} strokeWidth={3} />
            </motion.span>
          ) : (
            `${Math.round(progress * 100)}%`
          )}
        </span>
      </div>
    </div>
  )
}

/** Face oval with a neutral silhouette that turns; ring fills as the capture progresses. */
export function FaceScanAnimation({ progress, done }: { progress: number; done: boolean }) {
  const reduced = useReduced()
  const turn = reduced ? 0 : Math.sin(progress * Math.PI * 2) * 14
  const W = 220
  const H = 270
  const perim = useMemo(() => Math.PI * (3 * (W / 2 + H / 2) - Math.sqrt((3 * W / 2 + H / 2) * (W / 2 + 3 * H / 2))), [])
  return (
    <div className="relative mx-auto grid h-[300px] w-full place-items-center overflow-hidden rounded-3xl bg-ink" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,hsl(220_20%_30%),hsl(220_25%_9%)_70%)]" />
      {/* silhouette */}
      <motion.svg viewBox="0 0 200 240" width={170} className="relative" animate={{ rotateY: turn, x: turn * 0.6 }} transition={{ type: 'tween', duration: 0.1 }}>
        <defs>
          <linearGradient id="cz-face" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="hsl(220 12% 62%)" />
            <stop offset="1" stopColor="hsl(220 12% 42%)" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="92" rx="54" ry="66" fill="url(#cz-face)" />
        <path d="M18 240c6-52 40-78 82-78s76 26 82 78z" fill="url(#cz-face)" />
      </motion.svg>
      {/* scan line */}
      {!done && progress > 0 && !reduced && (
        <motion.div
          className="absolute left-1/2 h-0.5 w-48 -translate-x-1/2 bg-gradient-to-r from-transparent via-[hsl(190_90%_65%)] to-transparent"
          animate={{ top: ['22%', '78%', '22%'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {/* oval guide + progress */}
      <svg className="absolute" width={W + 16} height={H + 16} viewBox={`-8 -8 ${W + 16} ${H + 16}`}>
        <ellipse cx={W / 2} cy={H / 2} rx={W / 2} ry={H / 2} fill="none" stroke="white" strokeOpacity={0.25} strokeWidth={4} strokeDasharray="6 8" />
        <ellipse
          cx={W / 2} cy={H / 2} rx={W / 2} ry={H / 2} fill="none"
          stroke={done ? 'var(--color-success)' : 'hsl(190 90% 65%)'} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={perim} strokeDashoffset={perim * (1 - progress)}
          transform={`rotate(-90 ${W / 2} ${H / 2})`}
        />
      </svg>
      {done && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute bottom-4 grid size-11 place-items-center rounded-full bg-success text-white shadow-lg">
          <Check size={22} strokeWidth={3} />
        </motion.span>
      )}
    </div>
  )
}

/** Confetti burst (skipped entirely with reduced motion). */
export function Confetti({ fire }: { fire: number }) {
  const reduced = useReduced()
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        i,
        x: (Math.random() - 0.5) * 380,
        y: -(160 + Math.random() * 260),
        r: Math.random() * 720 - 360,
        d: 1.6 + Math.random() * 1.1,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        hue: [222, 150, 45, 12, 280, 190][i % 6],
        round: i % 4 === 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fire],
  )
  if (reduced || fire === 0) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-30 flex justify-center" aria-hidden key={fire}>
      {pieces.map(p => (
        <motion.span
          key={p.i}
          className={cn('absolute', p.round ? 'rounded-full' : 'rounded-[2px]')}
          style={{ width: p.w, height: p.round ? p.w : p.h, background: `hsl(${p.hue} 85% 58%)` }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 520], opacity: [1, 1, 0], rotate: p.r }}
          transition={{ duration: p.d, ease: [0.15, 0.6, 0.4, 1], times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  )
}
