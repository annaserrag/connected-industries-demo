/* Abstract, generated portrait for evidence panels. Never a photo, never a real face. */
import { useId } from 'react'
import { cn } from '@/ui'

export type FaceVariant = 'chip' | 'live' | 'spoof' | 'empty'

export function FaceArt({ hue, initials, variant, className, label, tag = 'NO DEPTH · REPLAY' }: { hue: number; initials: string; variant: FaceVariant; className?: string; label: string; tag?: string }) {
  const id = useId().replace(/:/g, '')
  const skin = `hsl(${hue} 45% 72%)`
  const skinDark = `hsl(${hue} 40% 52%)`
  const bgA = variant === 'chip' ? `hsl(${hue} 18% 90%)` : `hsl(${hue} 55% 88%)`
  const bgB = variant === 'chip' ? `hsl(${hue} 14% 78%)` : `hsl(${(hue + 40) % 360} 55% 76%)`
  const gray = variant === 'chip'

  // Face-mesh points (deterministic).
  const mesh: Array<[number, number]> = []
  for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
    const x = 62 + c * 9 + (r % 2 ? 4 : 0)
    const y = 46 + r * 10
    const dx = (x - 82) / 26, dy = (y - 70) / 34
    if (dx * dx + dy * dy < 1) mesh.push([x, y])
  }

  return (
    <svg viewBox="0 0 160 160" role="img" aria-label={label} className={cn('block h-auto w-full', className)}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bgA} />
          <stop offset="1" stopColor={bgB} />
        </linearGradient>
        <linearGradient id={`sk${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={gray ? '#c9c6c0' : skin} />
          <stop offset="1" stopColor={gray ? '#a19d96' : skinDark} />
        </linearGradient>
        <pattern id={`scan${id}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="2" fill="rgba(0,0,0,0.12)" />
        </pattern>
        <clipPath id={`clip${id}`}><rect width="160" height="160" rx="14" /></clipPath>
      </defs>
      <g clipPath={`url(#clip${id})`}>
        <rect width="160" height="160" fill={`url(#bg${id})`} />
        {variant === 'empty' ? (
          <g opacity="0.5">
            <circle cx="80" cy="66" r="26" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
            <path d="M34 150c4-28 22-42 46-42s42 14 46 42" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
          </g>
        ) : (
          <>
            {/* shoulders */}
            <path d="M28 160c3-32 25-50 52-50s49 18 52 50z" fill={gray ? '#8f8b85' : `hsl(${(hue + 200) % 360} 30% 38%)`} />
            {/* neck */}
            <rect x="70" y="92" width="20" height="22" rx="8" fill={`url(#sk${id})`} />
            {/* head */}
            <ellipse cx="80" cy="68" rx="27" ry="33" fill={`url(#sk${id})`} />
            {/* hair cap */}
            <path d="M53 62c0-22 12-34 27-34s27 12 27 34c-6-10-16-15-27-15s-21 5-27 15z" fill={gray ? '#55524e' : `hsl(${hue} 30% 22%)`} />
            {/* abstract features */}
            <g fill="none" stroke={gray ? '#5d5a55' : `hsl(${hue} 35% 30%)`} strokeWidth="2.2" strokeLinecap="round" opacity="0.75">
              <path d="M68 70h7M85 70h7" />
              <path d="M74 86c4 3 8 3 12 0" />
            </g>
            <text x="148" y="20" textAnchor="end" fontSize="11" fontWeight="700" fill={gray ? '#55524e' : `hsl(${hue} 35% 28%)`} opacity="0.65" fontFamily="ui-monospace, monospace">{initials}</text>
          </>
        )}

        {variant === 'chip' && (
          <g>
            <rect x="8" y="8" width="144" height="144" rx="10" fill="none" stroke="#7d7a74" strokeWidth="1" strokeDasharray="2 3" />
            {Array.from({ length: 7 }).map((_, i) => (
              <path key={i} d={`M0 ${120 + i * 6} Q40 ${112 + i * 6} 80 ${120 + i * 6} T160 ${120 + i * 6}`} stroke="#ffffff" strokeOpacity="0.25" fill="none" />
            ))}
            <rect x="12" y="12" width="22" height="16" rx="3" fill="#d6b45a" stroke="#9d7f2e" />
            <path d="M12 20h22M23 12v16" stroke="#9d7f2e" strokeWidth="0.8" />
          </g>
        )}

        {variant === 'live' && (
          <g>
            {mesh.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" fill="#12b76a" opacity="0.85" />)}
            <ellipse cx="80" cy="68" rx="33" ry="40" fill="none" stroke="#12b76a" strokeWidth="2" strokeDasharray="6 4" />
            <g stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M14 30V14h16M146 30V14h-16M14 130v16h16M146 130v16h-16" />
            </g>
          </g>
        )}

        {variant === 'spoof' && (
          <g>
            <rect width="160" height="160" fill={`url(#scan${id})`} />
            {/* glitch bands */}
            <rect x="0" y="52" width="160" height="7" fill={`hsl(${(hue + 180) % 360} 80% 60%)`} opacity="0.45" transform="translate(9 0)" />
            <rect x="0" y="78" width="160" height="4" fill="#ff3b5c" opacity="0.5" transform="translate(-7 0)" />
            <rect x="0" y="101" width="160" height="5" fill="#2dd4ff" opacity="0.35" transform="translate(5 0)" />
            {mesh.map(([x, y], i) => <path key={i} d={`M${x - 1.6} ${y - 1.6}l3.2 3.2M${x + 1.6} ${y - 1.6}l-3.2 3.2`} stroke="#e11d48" strokeWidth="1.1" />)}
            <ellipse cx="80" cy="68" rx="33" ry="40" fill="none" stroke="#e11d48" strokeWidth="2.5" />
            <rect x="10" y="130" width="140" height="20" rx="6" fill="#e11d48" />
            <text x="80" y="144" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#fff" fontFamily="ui-sans-serif, system-ui" letterSpacing="0.6">{tag}</text>
          </g>
        )}
      </g>
    </svg>
  )
}
