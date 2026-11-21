/* window.__clave — exposed in DEV builds and with `?debug=1` (tests, presenter console). */
import { actions, getState, setEngineSpeed, useClave } from './store'
import { officerQueue, caseAudit } from './selectors'

declare global {
  interface Window {
    __clave?: {
      actions: typeof actions
      getState: typeof getState
      setEngineSpeed: typeof setEngineSpeed
      officerQueue: () => ReturnType<typeof officerQueue>
      caseAudit: (id: string) => ReturnType<typeof caseAudit>
      subscribe: typeof useClave.subscribe
    }
  }
}

export function installDebugHandle() {
  if (typeof window === 'undefined') return
  const q = new URLSearchParams(window.location.search)
  const hq = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const debug = q.get('debug') === '1' || hq.get('debug') === '1'
  if (!import.meta.env.DEV && !debug) return
  window.__clave = {
    actions,
    getState,
    setEngineSpeed,
    officerQueue: () => officerQueue(getState()),
    caseAudit: (id: string) => caseAudit(getState(), id),
    subscribe: useClave.subscribe,
  }
}
