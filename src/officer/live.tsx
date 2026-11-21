/* Watches the shared store for cases entering the queue or changing, so the UI can animate,
   toast and announce them (aria-live). Mounted once inside the officer shell. */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { Case } from '@/contract/types'
import { PATHS } from '@/contract/api'
import { useClave } from '@/core/store'
import { C } from './copy'
import { useTr } from './lib'

interface LiveState {
  arrived: Set<string>
  flashed: Set<string>
}
const LiveCtx = createContext<LiveState>({ arrived: new Set(), flashed: new Set() })
export const useLive = () => useContext(LiveCtx)

export const TOASTER_ID = 'officer'

type Snap = Record<string, { awaiting: boolean; updatedAt: string; status: Case['status'] }>

export function LiveProvider({ children }: { children: ReactNode }) {
  const cases = useClave(s => s.cases)
  const tr = useTr()
  const navigate = useNavigate()
  const prev = useRef<Snap | null>(null)
  const [arrived, setArrived] = useState<Set<string>>(new Set())
  const [flashed, setFlashed] = useState<Set<string>>(new Set())
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    const snap: Snap = {}
    for (const c of Object.values(cases)) snap[c.id] = { awaiting: c.awaitingOfficer, updatedAt: c.updatedAt, status: c.status }
    const before = prev.current
    prev.current = snap
    if (!before) return

    const newIds: string[] = []
    const changedIds: string[] = []
    for (const c of Object.values(cases)) {
      const p = before[c.id]
      if (c.awaitingOfficer && (!p || !p.awaiting)) newIds.push(c.id)
      else if (p && p.updatedAt !== c.updatedAt) changedIds.push(c.id)
    }
    // A full demo reset changes everything at once: don't spam.
    if (newIds.length + changedIds.length > 6) return

    if (newIds.length) {
      setArrived(s => new Set([...s, ...newIds]))
      window.setTimeout(() => setArrived(s => { const n = new Set(s); newIds.forEach(i => n.delete(i)); return n }), 2600)
      for (const id of newIds) {
        const c = cases[id]
        const kind = c.appeal?.state === 'open'
          ? { en: 'Appeal filed', es: 'Recurso presentado' }
          : c.infoRequest?.response
            ? { en: 'Citizen answered', es: 'La persona respondió' }
            : C.newCase
        const msg = `${tr(kind)}: ${c.persona.name}`
        setAnnounce(msg)
        toast(msg, {
          toasterId: TOASTER_ID,
          description: c.flags[0] ? tr(c.flags[0].reason) : undefined,
          action: { label: tr(C.open), onClick: () => navigate(PATHS.officerCase(id)) },
          duration: 6000,
        })
      }
    }
    if (changedIds.length) {
      setFlashed(s => new Set([...s, ...changedIds]))
      window.setTimeout(() => setFlashed(s => { const n = new Set(s); changedIds.forEach(i => n.delete(i)); return n }), 1800)
      const c = cases[changedIds[0]]
      if (c.awaitingOfficer || c.status === 'checking' || c.status === 'received') setAnnounce(`${tr(C.caseUpdated)}: ${c.persona.name}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases])

  return (
    <LiveCtx.Provider value={{ arrived, flashed }}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">{announce}</div>
    </LiveCtx.Provider>
  )
}
