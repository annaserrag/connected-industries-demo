/* Tiny "Live" connection indicator — Platform agent (A). UIs may place it anywhere. */
import { useEffect, useState } from 'react'
import { useClave, useLiveSync } from './store'

/**
 * Shows a green "Live" dot; flashes "Updated live" for ~2.5 s after a change arrives from another tab.
 * Pass `caseId` to only flash for changes to that case.
 */
export function LiveIndicator({ caseId, className = '' }: { caseId?: string; className?: string }) {
  const lang = useClave(s => s.lang)
  const connected = useLiveSync(s => s.connected)
  const flashing = useRecentRemote(caseId, 2500)
  const es = lang === 'es'
  const label = flashing ? (es ? 'Actualizado en directo' : 'Updated live') : es ? 'En directo' : 'Live'
  return (
    <span
      role="status"
      aria-live="polite"
      data-live-flash={flashing ? '1' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
        flashing ? 'bg-success-soft text-success' : 'text-muted'
      } ${className}`}
    >
      <span className="relative inline-flex h-2 w-2">
        {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-success' : 'bg-muted'}`} />
      </span>
      {label}
    </span>
  )
}

/** True for `ms` after a remote update (optionally only for one case). */
export function useRecentRemote(caseId?: string, ms = 2500): boolean {
  const lastRemoteAt = useLiveSync(s => s.lastRemoteAt)
  const changed = useLiveSync(s => s.caseId)
  const seq = useLiveSync(s => s.seq)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!lastRemoteAt) return
    if (caseId && changed !== caseId) return
    setOn(true)
    const id = setTimeout(() => setOn(false), ms)
    return () => clearTimeout(id)
  }, [seq, lastRemoteAt, changed, caseId, ms])
  return on
}
