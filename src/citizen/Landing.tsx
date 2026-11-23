/**
 * Home page in the clave.gob.es style: grey title band (H1 + subtitle + primary action), role cards
 * (citizen / registration-office staff) like carpetaciudadana.gob.es, a row of four info cards linking to Help,
 * and "Cl@ve in numbers" with the real reference figures (year + source).
 */
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, ChevronRight, LogIn, Smartphone } from 'lucide-react'
import type { Bilingual } from '@/contract/types'
import { GovHeader, Illustration, InfoCard } from '@/ui'
import { KEY_RULE, REFERENCE_FIGURES } from '@/contract/seed'
import { MSG } from '@/contract/messages'
import { C } from './copy'
import { useTr } from './hooks'

const FIGURE_IDS = ['users', 'eidas', 'online']

const b = (en: string, es: string): Bilingual => ({ en, es })
/** Landing-only copy (the rest of the citizen copy lives in ./copy). */
const L = {
  subtitle: b(
    'Register in Cl@ve with any document you live in Spain with, no appointment needed. The same steps and the same time for everyone, Spanish or not.',
    'Regístrate en Cl@ve con cualquier documento con el que vivas en España, sin cita previa. Los mismos pasos y el mismo tiempo para todo el mundo, seas o no de España.',
  ),
  alreadyApplied: b('Already applied?', '¿Ya lo has solicitado?'),
  signIn: b('Sign in', 'Accede'),
  modes: b('Choose how you access', 'Elige cómo accedes'),
  citizenBody: b('Apply for Cl@ve or follow your application.', 'Solicita Cl@ve o sigue tu solicitud.'),
  staffBody: b(
    'Review applications with your electronic certificate or staff account. Only for authorised staff.',
    'Revisa solicitudes con tu certificado electrónico o tu cuenta de personal. Solo para personal autorizado.',
  ),
  access: b('Access', 'Acceder'),
  infoTitle: b('Find out more', 'Más información'),
  cards: [
    { s: 'what', ill: 'id-card', t: b('What is Get your Cl@ve', 'Qué es Get your Cl@ve'), d: b('Your digital key to online public services, now open to everyone living in Spain.', 'Tu llave digital para los servicios públicos en línea, ahora abierta a todas las personas que viven en España.') },
    { s: 'who', ill: 'people', t: b('Who can apply', 'Quién puede solicitarla'), d: b('Spaniards, EU citizens and non-EU residents. Minors with a parent or guardian.', 'Españoles, ciudadanía de la UE y residentes de fuera de la UE. Menores con su madre, padre o tutor.') },
    { s: 'documents', ill: 'documents', t: b('Documents accepted', 'Documentos admitidos'), d: b('DNI, EU eID, passport, TIE, NIE paper certificate or red card.', 'DNI, eID de la UE, pasaporte, TIE, certificado de NIE en papel o tarjeta roja.') },
    { s: 'how', ill: 'phone-steps', t: b('How it works', 'Cómo funciona'), d: b('Create your account, verify your identity from your phone and follow your status.', 'Crea tu cuenta, verifica tu identidad desde el móvil y sigue el estado.') },
  ] as const,
  rule: b('Every decision has a reason', 'Cada resolución tiene un motivo'),
}

function RoleCard({ to, title, body, icon, testId, illustration }: {
  to: string; title: string; body: string; icon: React.ReactNode; testId: string; illustration: 'citizen' | 'office'
}) {
  const { tr } = useTr()
  return (
    <Link
      to={to}
      data-testid={testId}
      className="group flex items-center gap-4 rounded-[12px] border-2 border-brand bg-surface p-4 transition-colors hover:bg-brand-soft sm:p-5"
    >
      <span className="hidden w-[92px] shrink-0 sm:block"><Illustration name={illustration} /></span>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand sm:hidden">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[19px] leading-snug font-extrabold text-brand-strong">{title}</span>
        <span className="mt-1 block text-[15px] leading-snug text-muted">{body}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-bold text-brand underline underline-offset-[3px] group-hover:text-brand-strong">
        <span className="hidden sm:inline">{tr(L.access)}</span><ChevronRight size={20} aria-hidden />
      </span>
    </Link>
  )
}

export function LandingPage() {
  const { tr } = useTr()
  const figures = REFERENCE_FIGURES.filter(f => FIGURE_IDS.includes(f.id))

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink" data-testid="landing">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:font-bold">
        {tr(C.skipToContent)}
      </a>
      <GovHeader />

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {/* title band */}
        <section className="bg-band" aria-labelledby="landing-title">
          <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h1 id="landing-title" className="font-display text-[30px] leading-[1.2] font-bold text-ink sm:text-[40px]" data-testid="msg-RA-01">{tr(MSG['RA-01'].title)}</h1>
              <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-ink sm:text-[18px]">{tr(MSG['RA-01'])}</p>
              <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-muted">{tr(L.subtitle)}</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link
                  to="/citizen?mode=signup"
                  data-testid="landing-apply"
                  className="inline-flex h-13 items-center gap-2.5 rounded-[2px] border-2 border-brand bg-brand px-7 text-[17px] font-bold text-brand-ink transition-colors hover:border-brand-strong hover:bg-brand-strong"
                >
                  <Smartphone size={20} aria-hidden />{tr(MSG['RA-01'].button)}<ArrowRight size={18} aria-hidden />
                </Link>
                <p className="text-[16px] text-ink">
                  {tr(L.alreadyApplied)}{' '}
                  <Link to="/citizen" className="gov-link inline-flex items-center gap-1" data-testid="landing-signin">
                    <LogIn size={16} aria-hidden />{tr(L.signIn)}
                  </Link>
                </p>
              </div>
            </div>

            {/* role cards */}
            <div role="group" aria-label={tr(L.modes)} className="grid gap-3" data-testid="landing-tabs">
              <RoleCard to="/citizen" testId="landing-citizen" title={tr(C.iAmCitizen)} body={tr(L.citizenBody)} icon={<Smartphone size={22} aria-hidden />} illustration="citizen" />
              <RoleCard to="/officer" testId="landing-officer" title={tr(C.iAmOfficer)} body={tr(L.staffBody)} icon={<BadgeCheck size={22} aria-hidden />} illustration="office" />
            </div>
          </div>
        </section>

        {/* info cards */}
        <section aria-labelledby="info-title" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
          <h2 id="info-title" className="font-display text-[24px] font-bold sm:text-[28px]">{tr(L.infoTitle)}</h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {L.cards.map(c => (
              <li key={c.s}>
                <InfoCard to={`/help?s=${c.s}`} illustration={c.ill} title={tr(c.t)} description={tr(c.d)} testId={`info-${c.s}`} />
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3 rounded-[2px] border-l-4 border-brand bg-brand-soft p-4 text-[16px] leading-relaxed sm:p-5">
            <BadgeCheck size={22} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <p><strong>{tr(L.rule)}.</strong> {tr(KEY_RULE)}</p>
          </div>
        </section>

        {/* reference figures */}
        <section aria-labelledby="figures-title" className="border-t border-line bg-band">
          <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="figures-title" className="font-display text-[24px] font-bold sm:text-[28px]">{tr(C.figuresTitle)}</h2>
              <p className="text-[15px] text-muted">{tr(C.figuresNote)}</p>
            </div>
            <ul className="mt-6 grid gap-5 sm:grid-cols-3">
              {figures.map(f => (
                <li key={f.id} className="rounded-card border border-line border-t-4 border-t-brand bg-surface p-5" data-testid={`figure-${f.id}`}>
                  <p className="font-display text-[28px] font-bold text-ink tabular-nums">{f.value}</p>
                  <p className="mt-1 text-[16px] leading-snug text-ink">{tr(f.label)}</p>
                  <p className="mt-3 text-[14px] text-muted">
                    {f.year} · {tr(C.sourceLabel)}: <span title={f.sourceUrl}>{f.source}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}
