import { Navigate } from 'react-router-dom'

/**
 * The presenter "demo mode" was removed: the platform now behaves like a real service.
 * Kept as an export so older imports keep compiling; it simply sends visitors home.
 * To show citizen and staff side by side, open /#/citizen and /#/officer in two windows of the same browser.
 */
export function DemoPanel() {
  return <Navigate to="/" replace />
}
