/* Officer area (screens 6–8). Route: /officer/* */
import { Navigate, Route, Routes } from 'react-router-dom'
import * as RTooltip from '@radix-ui/react-tooltip'
import { Toaster } from 'sonner'
import { useClave } from '@/core/store'
import './officer.css'
import { Shell } from './components/Shell'
import { LiveProvider, TOASTER_ID } from './live'
import { SignIn } from './SignIn'
import { QueuePage } from './Queue'
import { CaseDetailPage } from './CaseDetail'
import { AuditPage } from './Audit'

export function OfficerApp() {
  const officerId = useClave(s => s.officerId)
  return (
    <RTooltip.Provider delayDuration={150}>
      <Toaster id={TOASTER_ID} position="bottom-right" richColors closeButton expand={false} visibleToasts={4} />
      {!officerId ? (
        <SignIn />
      ) : (
        <LiveProvider>
          <Shell>
            <Routes>
              <Route index element={<QueuePage />} />
              <Route path="case/:id" element={<CaseDetailPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="*" element={<Navigate to="/officer" replace />} />
            </Routes>
          </Shell>
        </LiveProvider>
      )}
    </RTooltip.Provider>
  )
}
