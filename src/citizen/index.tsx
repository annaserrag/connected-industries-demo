/* Citizen area (agent B): screens 1–5. Named exports only. */
import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useClave } from '@/core/store'
import { CitizenShell, flowPath } from './Shell'
import { SignIn } from './SignIn'
import { Assistant } from './Assistant'
import { Verify } from './Verify'
import { StatusPage } from './Status'
import { useEmbed, useGo, useReduced, withEmbed } from './hooks'

export { LandingPage } from './Landing'

/** /citizen: if a demo identity is already active, jump to where that case is; otherwise list identities. */
function CitizenHome() {
  const activeId = useClave(s => s.activeCitizenCaseId)
  const active = useClave(s => (activeId ? s.cases[activeId] : undefined))
  const embed = useEmbed()
  if (active && active.origin === 'library') return <Navigate to={withEmbed(flowPath(active), embed)} replace />
  return <SignIn />
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
    const m = pathname.match(/^\/citizen\/(?:start|verify|case)\/([^/]+)/)
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
            <Route path="start/:id" element={<Assistant />} />
            <Route path="verify/:id" element={<Verify />} />
            <Route path="case/:id" element={<StatusPage />} />
            <Route path="*" element={<Navigate to="/citizen" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </CitizenShell>
  )
}
