/* Officer / staff console (screens 6–8 + dashboard, by document, all applications, profile). Route: /officer/* */
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
import { StaffDashboardPage } from './StaffDashboard'
import { DocumentsPage } from './Documents'
import { ApplicationsPage } from './Applications'
import { ProfilePage } from './Profile'

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
              <Route path="dashboard" element={<StaffDashboardPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/officer" replace />} />
            </Routes>
          </Shell>
        </LiveProvider>
      )}
    </RTooltip.Provider>
  )
}
