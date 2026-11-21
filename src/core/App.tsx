/* App shell + routing — Platform agent (A). HashRouter, PATHS from the contract. */
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { LandingPage, CitizenApp } from '@/citizen'
import { OfficerApp } from '@/officer'
import { DashboardPage } from '@/dashboard'
import { DemoPanel, Footer, Toaster } from '@/ui'
import { PATHS } from '@/contract/api'
import { SERVICE_NAME } from '@/contract/seed'
import { useClave } from './store'

/* ------------------------------------------------------- error boundary */

interface EBProps { children: ReactNode; area: string; lang: 'en' | 'es' }
interface EBState { error: Error | null }

export class RouteErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { error: null }
  static getDerivedStateFromError(error: Error): EBState { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(`[${this.props.area}] screen error`, error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    const es = this.props.lang === 'es'
    return (
      <div role="alert" className="mx-auto my-16 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-ink">{es ? 'Algo no ha ido bien en esta pantalla' : 'Something went wrong on this screen'}</p>
        <p className="mt-2 text-sm text-muted">
          {es ? 'Tus datos están a salvo. Prueba a recargar o vuelve al inicio.' : 'Your data is safe. Try again or go back to the start.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink" onClick={() => this.setState({ error: null })}>
            {es ? 'Reintentar' : 'Try again'}
          </button>
          <Link to={PATHS.landing} onClick={() => this.setState({ error: null })} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink">
            {es ? 'Ir al inicio' : 'Go to start'}
          </Link>
        </div>
      </div>
    )
  }
}

function Guard({ area, children }: { area: string; children: ReactNode }) {
  const lang = useClave(s => s.lang)
  const { pathname } = useLocation()
  // Key by area so navigating to another area clears a stale error.
  return <RouteErrorBoundary key={area + (pathname.split('/')[1] ?? '')} area={area} lang={lang}>{children}</RouteErrorBoundary>
}

/* ----------------------------------------------------- document chrome */

/** True when the hash query (or the real query) has `name=1`. */
export function hasFlag(name: string, search = ''): boolean {
  const q = new URLSearchParams(search)
  if (q.get(name) === '1') return true
  if (typeof window === 'undefined') return false
  const hashQ = window.location.hash.split('?')[1]
  return new URLSearchParams(window.location.search).get(name) === '1' || new URLSearchParams(hashQ ?? '').get(name) === '1'
}

const TITLES: Record<string, { en: string; es: string }> = {
  '': { en: 'Welcome', es: 'Bienvenida' },
  citizen: { en: 'Citizen', es: 'Ciudadanía' },
  officer: { en: 'Officer', es: 'Funcionariado' },
  dashboard: { en: 'Dashboard', es: 'Panel' },
  demo: { en: 'Demo', es: 'Demo' },
}

function DocumentChrome() {
  const lang = useClave(s => s.lang)
  const { pathname, search } = useLocation()
  const embed = hasFlag('embed', search)
  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    if (embed) root.dataset.embed = '1'
    else delete root.dataset.embed
  }, [lang, embed])
  useEffect(() => {
    const area = pathname.split('/')[1] ?? ''
    const t = TITLES[area] ?? TITLES['']
    document.title = `${t[lang]} · ${SERVICE_NAME}`
  }, [pathname, lang])
  return null
}

/* ----------------------------------------------------------------- app */

export function AppRoutes() {
  return (
    <>
      <DocumentChrome />
      <div className="flex min-h-dvh flex-col">
        <div className="flex-1">
          <Routes>
            <Route path={PATHS.landing} element={<Guard area="landing"><LandingPage /></Guard>} />
            <Route path={`${PATHS.citizen}/*`} element={<Guard area="citizen"><CitizenApp /></Guard>} />
            <Route path={`${PATHS.officer}/*`} element={<Guard area="officer"><OfficerApp /></Guard>} />
            <Route path={PATHS.dashboard} element={<Guard area="dashboard"><DashboardPage /></Guard>} />
            <Route path={PATHS.demo} element={<Guard area="demo"><DemoPanel /></Guard>} />
            <Route path="*" element={<Guard area="landing"><LandingPage /></Guard>} />
          </Routes>
        </div>
        <Footer />
        <Toaster />
      </div>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
