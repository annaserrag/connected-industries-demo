/* window.__clave — exposed in DEV builds and with `?debug=1` (tests, presenter console). */
import { actions, getState, setEngineSpeed, useClave } from './store'
import { officerQueue, caseAudit, priorityOf, appealsQueue, advancedQueue, dashboardCounters } from './selectors'
import { decide, evaluate } from './engine'
import { DEMO_PEOPLE } from '@/contract/world'

declare global {
  interface Window {
    __clave?: {
      actions: typeof actions
      getState: typeof getState
      setEngineSpeed: typeof setEngineSpeed
      officerQueue: () => ReturnType<typeof officerQueue>
      caseAudit: (id: string) => ReturnType<typeof caseAudit>
      priorityOf: (id: string, nowIso?: string) => ReturnType<typeof priorityOf>
      subscribe: typeof useClave.subscribe
      appealsQueue: () => ReturnType<typeof appealsQueue>
      advancedQueue: () => ReturnType<typeof advancedQueue>
      dashboardCounters: () => ReturnType<typeof dashboardCounters>
      evaluate: (id: string) => ReturnType<typeof evaluate>
      decide: (id: string) => ReturnType<typeof decide>
      DEMO_PEOPLE: typeof DEMO_PEOPLE
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
    priorityOf: (id: string, nowIso?: string) => priorityOf(getState().cases[id], nowIso ? new Date(nowIso) : new Date()),
    subscribe: useClave.subscribe,
    appealsQueue: () => appealsQueue(getState()),
    advancedQueue: () => advancedQueue(getState()),
    dashboardCounters: () => dashboardCounters(getState()),
    evaluate: (id: string) => evaluate(getState().cases[id]),
    decide: (id: string) => decide(getState().cases[id]),
    DEMO_PEOPLE,
  }
}
