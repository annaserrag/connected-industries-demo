/* Citizen area (agent B): screens 1–5. Named exports only. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { useClave } from '@/core/store'
import { CitizenShell, flowPath } from './Shell'
import { SignIn } from './SignIn'
import { Assistant } from './Assistant'
import { Verify } from './Verify'
import { StatusPage } from './Status'
import { Welcome } from './Welcome'
import { useEmbed, useGo, useReduced, withEmbed } from './hooks'

export { LandingPage } from './Landing'

/**
 * /citizen: a signed-in citizen jumps to where their application is; otherwise sign in / create account.
 * Only decided on arrival: after signing in or up, the form navigates itself (e.g. to the welcome step).
 */
function CitizenHome() {
  const [initialId] = useState(() => useClave.getState().activeCitizenCaseId)
  const active = useClave(s => (initialId && s.activeCitizenCaseId === initialId ? s.cases[initialId] : undefined))
  const embed = useEmbed()
  if (active && active.origin !== 'background') return <Navigate to={withEmbed(flowPath(active), embed)} replace />
  return <SignIn />
}

/** Case screens are only for the signed-in owner. Anyone else gets the sign-in screen (no access to others' cases). */
function OwnCase({ children }: { children: ReactNode }) {
  const { id } = useParams()
  const activeId = useClave(s => s.activeCitizenCaseId)
  const exists = useClave(s => Boolean(id && s.cases[id]))
  // While this screen animates out (e.g. right after Sign out), keep showing it instead of a second sign-in form.
  const present = useIsPresent()
  if (!present && exists) return <>{children}</>
  if (!id || !activeId || activeId !== id || !exists) return <SignIn notice={activeId && activeId !== id ? 'other' : 'signedOut'} />
  return <>{children}</>
}

/** Follow the active case when another tab (e.g. the demo panel) switches it. */
function useFollowActiveCase() {
  const activeId = useClave(s => s.activeCitizenCaseId)
  const cases = useClave(s => s.cases)
  const { pathname } = useLocation()
  const go = useGo()
  const prev = useRef(activeId)
  useEffect(() => {
    if (prev.current === activeId) return
    prev.current = activeId
    if (!activeId) return
    const m = pathname.match(/^\/citizen\/(?:start|verify|case|welcome)\/([^/]+)/)
    const c = cases[activeId]
    if (m && m[1] !== activeId && c) go(flowPath(c), { replace: true })
  }, [activeId, pathname, cases, go])
}

export function CitizenApp() {
  const location = useLocation()
  const reduced = useReduced()
  useFollowActiveCase()
  return (
    <CitizenShell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduced ? 0.1 : 0.22, ease: 'easeOut' }}
        >
          <Routes location={location}>
            <Route index element={<CitizenHome />} />
            <Route path="welcome/:id" element={<OwnCase><Welcome /></OwnCase>} />
            <Route path="start/:id" element={<OwnCase><Assistant /></OwnCase>} />
            <Route path="verify/:id" element={<OwnCase><Verify /></OwnCase>} />
            <Route path="case/:id" element={<OwnCase><StatusPage /></OwnCase>} />
            <Route path="*" element={<Navigate to="/citizen" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </CitizenShell>
  )
}
