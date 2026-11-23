/**
 * Public information pages: Help, About this platform, Accessibility, Legal notice, Privacy.
 * The About page is the ONE place that says what is simulated in this academic prototype.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Minus } from 'lucide-react'
import { Button, Dialog, DialogClose, GovPage, cn, toast } from '@/ui'
import { actions } from '@/core/store'
import type { Bilingual } from '@/contract/types'
import {
  DOCUMENTS, KEY_RULE, LEVEL_LABELS, PENDING_FACT_CHECKS, POLICY_PROPOSALS, REFERENCE_FIGURES, ROUTES, ROUTE_ORDER, STATUSES, STATUS_ORDER,
} from '@/contract/seed'
import { useTr } from '../hooks'

const b = (en: string, es: string): Bilingual => ({ en, es })

/* --------------------------------------------------------------- pieces */

function Section({ id, title, children, className }: { id?: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={cn('scroll-mt-24 border-t border-line pt-8 first:border-t-0 first:pt-0', className)}>
      <h2 id={id ? `${id}-h` : undefined} className="font-display text-[22px] leading-snug font-bold text-ink sm:text-[24px]">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-ink [&_p]:max-w-[72ch]">{children}</div>
    </section>
  )
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="max-w-[72ch] space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[9px] size-1.5 shrink-0 bg-brand" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

/** Side navigation for long pages (sticky on desktop). */
function PageNav({ items, label }: { items: { id: string; label: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-6">
      <p className="mb-2 text-[12px] font-bold tracking-[0.08em] text-muted uppercase">{label}</p>
      <ul className="border-l-2 border-line">
        {items.map(it => (
          <li key={it.id}>
            <Link to={`?s=${it.id}`} replace className="-ml-[2px] block border-l-2 border-transparent py-1.5 pl-4 text-[15px] font-semibold text-brand underline-offset-[3px] hover:border-brand hover:underline">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Scrolls to the section named in ?s= (hash routing can't use #anchors). */
function useSectionScroll() {
  const [params] = useSearchParams()
  const s = params.get('s')
  useEffect(() => {
    if (!s) return
    const el = document.getElementById(s)
    if (!el) return
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start' })
      const h = el.querySelector('h2') as HTMLElement | null
      h?.setAttribute('tabindex', '-1')
      h?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [s])
}

/* ----------------------------------------------------------------- help */

export function HelpPage() {
  const { tr } = useTr()
  useSectionScroll()
  const nav = [
    { id: 'what', label: tr(b('What is Get your Cl@ve', 'Qué es Get your Cl@ve')) },
    { id: 'who', label: tr(b('Who can apply', 'Quién puede solicitarla')) },
    { id: 'documents', label: tr(b('Documents accepted', 'Documentos admitidos')) },
    { id: 'how', label: tr(b('How it works', 'Cómo funciona')) },
    { id: 'decisions', label: tr(b('Decisions and appeals', 'Resoluciones y recursos')) },
  ]
  return (
    <GovPage
      title={tr(b('Help', 'Ayuda'))}
      subtitle={tr(b('Everything you need to register in Cl@ve from your phone.', 'Todo lo que necesitas para registrarte en Cl@ve desde tu móvil.'))}
      breadcrumb={[{ to: '/', label: tr(b('Home', 'Inicio')) }, { label: tr(b('Help', 'Ayuda')) }]}
    >
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]" data-testid="help-page">
        <div><PageNav items={nav} label={tr(b('On this page', 'En esta página'))} /></div>
        <div className="space-y-10">
          <Section id="what" title={nav[0].label}>
            <p>{tr(b(
              'Cl@ve is the system you use to identify yourself to online public services in Spain. Get your Cl@ve is the registration service: it lets anyone living in Spain register from their phone, without an appointment, whatever their nationality.',
              'Cl@ve es el sistema con el que te identificas ante los servicios públicos en línea en España. Get your Cl@ve es el servicio de registro: permite a cualquier persona que viva en España registrarse desde su móvil, sin cita, sea cual sea su nacionalidad.',
            ))}</p>
            <Bullets items={[
              <><strong>{tr(LEVEL_LABELS.basic)}.</strong> {tr(b('Granted automatically when every check passes. Enough for most online services.', 'Se concede automáticamente cuando se superan todas las comprobaciones. Suficiente para la mayoría de servicios en línea.'))}</>,
              <><strong>{tr(LEVEL_LABELS.advanced)}.</strong> {tr(b('Always reviewed by a person at a registration office before it is granted.', 'Siempre lo revisa una persona de una oficina de registro antes de concederlo.'))}</>,
            ]} />
          </Section>

          <Section id="who" title={nav[1].label}>
            <p>{tr(b('Anyone who lives in Spain:', 'Cualquier persona que viva en España:'))}</p>
            <Bullets items={[
              tr(b('Spanish nationals with a DNI.', 'Personas de nacionalidad española con DNI.')),
              tr(b('Citizens of another EU country, with their national eID or passport.', 'Ciudadanía de otro país de la UE, con su eID nacional o su pasaporte.')),
              tr(b('Non-EU residents with a TIE, a passport, an NIE paper certificate or a red card.', 'Residentes de fuera de la UE con TIE, pasaporte, certificado de NIE en papel o tarjeta roja.')),
              tr(b('Minors register together with a parent or legal guardian, who signs in first and confirms them.', 'Las personas menores de edad se registran con su madre, padre o tutor legal, que entra primero y las confirma.')),
              tr(b('If you don’t have a smartphone, someone you trust can help you on their phone. You still do the face check yourself, and the Cl@ve is yours.', 'Si no tienes smartphone, una persona de confianza puede ayudarte con su móvil. Tú haces la comprobación facial y la Cl@ve es tuya.')),
            ]} />
          </Section>

          <Section id="documents" title={nav[2].label}>
            <div className="overflow-x-auto">
              <table className="w-full max-w-[720px] border-collapse text-left text-[15px]">
                <caption className="sr-only">{nav[2].label}</caption>
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th scope="col" className="py-2 pr-4 font-bold">{tr(b('Document', 'Documento'))}</th>
                    <th scope="col" className="py-2 font-bold">{tr(b('How you verify it', 'Cómo se verifica'))}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(DOCUMENTS).map(d => (
                    <tr key={d.type} className="border-b border-line">
                      <th scope="row" className="py-3 pr-4 font-semibold">{tr(d.label)}</th>
                      <td className="py-3 text-muted">
                        {d.type === 'DNI' ? tr(b('Video call with your DNI (route C)', 'Videollamada con tu DNI (vía C)'))
                          : d.type === 'EU_EID' ? tr(b('Your country’s digital ID through eIDAS (route A)', 'La identidad digital de tu país a través de eIDAS (vía A)'))
                          : d.hasChip ? tr(b('Chip read with your phone + face check (route B)', 'Lectura del chip con tu móvil + comprobación facial (vía B)'))
                          : tr(b('Video call with an officer (alternative route)', 'Videollamada con una persona funcionaria (vía alternativa)'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted">{tr(b('Your document must be in date. You never upload photos of it: the phone reads the chip directly.', 'Tu documento debe estar en vigor. Nunca subes fotos: el móvil lee el chip directamente.'))}</p>
          </Section>

          <Section id="how" title={nav[3].label}>
            <ol className="max-w-[72ch] space-y-3">
              {[
                b('Create your account: name, date of birth, nationality and the document you have. You get your applicant number.', 'Crea tu cuenta: nombre, fecha de nacimiento, nacionalidad y el documento que tienes. Recibes tu número de solicitante.'),
                b('Answer a few questions. We recommend the route that best fits you.', 'Responde unas preguntas. Te recomendamos la vía que mejor te encaja.'),
                b('Verify your identity from your phone on that route.', 'Verifica tu identidad desde el móvil por esa vía.'),
                b('Follow your application until you have Cl@ve. If we need something, we tell you here.', 'Sigue tu solicitud hasta tener Cl@ve. Si necesitamos algo, te lo decimos aquí.'),
              ].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-[14px] font-bold text-brand-ink">{i + 1}</span>
                  <span className="pt-0.5">{tr(s)}</span>
                </li>
              ))}
            </ol>
            <h3 className="pt-3 text-[18px] font-bold">{tr(b('The four routes', 'Las cuatro vías'))}</h3>
            <dl className="grid max-w-[860px] gap-3 sm:grid-cols-2">
              {ROUTE_ORDER.map(r => (
                <div key={r} className="rounded-card border border-line p-4">
                  <dt className="font-bold">
                    <span className="mr-2 inline-grid h-6 min-w-6 place-items-center rounded-[2px] bg-brand px-1.5 text-[12px] text-brand-ink">{r === 'F' ? tr(b('Alt.', 'Alt.')) : ROUTES[r].code}</span>
                    {tr(ROUTES[r].name)}
                  </dt>
                  <dd className="mt-1 text-[15px] text-muted">{tr(ROUTES[r].forWhom)}</dd>
                </div>
              ))}
            </dl>
            <h3 className="pt-3 text-[18px] font-bold">{tr(b('Application statuses', 'Estados de la solicitud'))}</h3>
            <ol className="max-w-[72ch] space-y-2">
              {STATUS_ORDER.map(s => (
                <li key={s}><strong>{STATUSES[s].step}. {tr(STATUSES[s].label)}.</strong> <span className="text-muted">{tr(STATUSES[s].message)}</span></li>
              ))}
            </ol>
          </Section>

          <Section id="decisions" title={nav[4].label}>
            <p>{tr(KEY_RULE)}</p>
            <p>{tr(b(
              'If your application is not approved, you see the reason and how to fix it. You can appeal with one button, and a different officer reviews it. If the cause was something you can correct (for example, your padrón), press “I have corrected it” and we check again.',
              'Si tu solicitud no se aprueba, ves el motivo y cómo corregirlo. Puedes recurrir con un botón y la revisa otra persona funcionaria. Si la causa era algo que puedes corregir (por ejemplo, tu padrón), pulsa «Ya lo he corregido» y lo volvemos a comprobar.',
            ))}</p>
          </Section>

          <div className="rounded-card border-l-4 border-brand bg-brand-soft p-5">
            <p className="font-bold">{tr(b('Ready to start?', '¿Quieres empezar?'))}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button asChild><Link to="/citizen?mode=signup">{tr(b('Apply', 'Solicitar'))}</Link></Button>
              <Button asChild variant="secondary"><Link to="/citizen">{tr(b('Sign in', 'Acceder'))}</Link></Button>
            </div>
          </div>
        </div>
      </div>
    </GovPage>
  )
}

/* ---------------------------------------------------------------- about */

const SIMULATED: Bilingual[] = [
  b('The verification engine (the “AI”) that runs the checks and scores the risk: it follows scripted results for each case.', 'El motor de verificación (la «IA») que hace las comprobaciones y puntúa el riesgo: sigue resultados guionizados para cada caso.'),
  b('Signing in with another EU country’s digital ID (eIDAS): the national eID screen is a neutral mock-up.', 'El acceso con la identidad digital de otro país de la UE (eIDAS): la pantalla del eID nacional es una maqueta neutra.'),
  b('Reading the passport or TIE chip with the phone (NFC): it is an animation, nothing is read.', 'La lectura del chip del pasaporte o la TIE con el móvil (NFC): es una animación, no se lee nada.'),
  b('The face check (liveness and face match): no camera is used.', 'La comprobación facial (prueba de vida y coincidencia): no se usa la cámara.'),
  b('The residence check with other public bodies’ records and the DNI video call.', 'La consulta de tus datos de residencia en registros de otros organismos y la videollamada con DNI.'),
  b('Video calls with officers and their booking slots.', 'Las videollamadas con personal funcionario y sus horas de reserva.'),
  b('The “Demo: simulate a result” control on the verification screen, which forces a failed chip read, an invalid chip signature, a failed liveness check or data that does not match, so the hard cases can be recorded.', 'El control «Demo: simular un resultado» de la pantalla de verificación, que fuerza un chip no legible, una firma del chip inválida, una prueba de vida fallida o datos que no coinciden, para poder grabar los casos difíciles.'),
  b('The receipt PDF (it says it has no official value) and the “Open Cl@ve Móvil” button, which opens no app.', 'El justificante en PDF (indica que no tiene validez oficial) y el botón «Abrir Cl@ve Móvil», que no abre ninguna app.'),
  b('Text messages and letters to the applicant in assisted mode: nothing is sent.', 'Los SMS y cartas a la persona solicitante en modo asistido: no se envía nada.'),
  b('Staff certificates, PINs and staff accounts used to sign in to the registration console.', 'Los certificados, PIN y cuentas del personal con los que se entra en la consola de registro.'),
  b('Every person, document and number. DNI/NIE-shaped numbers carry a deliberately wrong check letter, so they can never belong to a real person.', 'Todas las personas, documentos y números. Los números con forma de DNI/NIE llevan una letra de control errónea a propósito, así que nunca pueden ser de una persona real.'),
  b('The numbers on the Service statistics page (weekly indicators, charts, appeals): invented to show what we would measure after launch. The “Published figures” there and below are real.', 'Las cifras de la página de Estadísticas del servicio (indicadores semanales, gráficos, recursos): inventadas para mostrar lo que mediríamos tras el lanzamiento. Las «Cifras publicadas» de esa página y de esta son reales.'),
]

export function AboutPage() {
  const { tr } = useTr()
  useSectionScroll()
  const nav = [
    { id: 'project', label: tr(b('An academic prototype', 'Un prototipo académico')) },
    { id: 'simulated', label: tr(b('What is simulated', 'Qué está simulado')) },
    { id: 'proposals', label: tr(b('Policy proposals', 'Propuestas normativas')) },
    { id: 'assumptions', label: tr(b('Assumptions', 'Supuestos')) },
    { id: 'figures', label: tr(b('Reference figures', 'Cifras de referencia')) },
  ]
  return (
    <GovPage
      title={tr(b('About this platform', 'Sobre esta plataforma'))}
      subtitle={tr(b('Who made Get your Cl@ve, what is real and what is simulated.', 'Quién ha hecho Get your Cl@ve, qué es real y qué está simulado.'))}
      breadcrumb={[{ to: '/', label: tr(b('Home', 'Inicio')) }, { label: tr(b('About this platform', 'Sobre esta plataforma')) }]}
    >
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]" data-testid="about-page">
        <div><PageNav items={nav} label={tr(b('On this page', 'En esta página'))} /></div>
        <div className="space-y-10">
          <Section id="project" title={nav[0].label}>
            <p className="rounded-card border-l-4 border-brand bg-brand-soft p-4 font-semibold">
              {tr(b(
                'Get your Cl@ve is a student prototype made at IE University (Connected Industries, Smart Cities & E-Government). It is not an official Government of Spain service and it is not connected to the real Cl@ve system.',
                'Get your Cl@ve es un prototipo de estudiantes hecho en IE University (Connected Industries, Smart Cities & E-Government). No es un servicio oficial del Gobierno de España y no está conectado con el sistema Cl@ve real.',
              ))}
            </p>
            <p>{tr(b(
              'It shows how registration in Cl@ve could work if a foreigner could register from their phone with no appointment, the same as a Spaniard. It looks and behaves like a real service on purpose, so people can try it as they would use it. That is why the screens carry no “demo” labels: everything that is simulated is listed on this page instead.',
              'Muestra cómo podría funcionar el registro en Cl@ve si una persona extranjera pudiera registrarse desde el móvil sin cita, igual que una española. Se ve y se comporta como un servicio real a propósito, para que se pueda probar tal como se usaría. Por eso las pantallas no llevan etiquetas de «demo»: todo lo simulado se detalla en esta página.',
            ))}</p>
            <p>{tr(b(
              'It uses no official logos or coats of arms; “Cl@ve” and the names of public bodies appear only as text, to describe the service being redesigned.',
              'No usa logotipos oficiales ni escudos; «Cl@ve» y los nombres de organismos públicos aparecen solo como texto, para describir el servicio que se rediseña.',
            ))}</p>
          </Section>

          <Section id="simulated" title={nav[1].label}>
            <Bullets items={SIMULATED.map(s => tr(s))} />
            <p className="text-muted">{tr(b(
              'Everything runs in your browser. Citizen and staff views of the same application update live between windows of the same browser.',
              'Todo funciona en tu navegador. Las vistas ciudadana y del personal de una misma solicitud se actualizan en directo entre ventanas del mismo navegador.',
            ))}</p>
          </Section>

          <Section id="proposals" title={nav[2].label}>
            <p>{tr(b('Two parts of the service need a change in the rules. They are proposals, not current rules:', 'Dos partes del servicio necesitan un cambio normativo. Son propuestas, no normas actuales:'))}</p>
            <ol className="max-w-[72ch] space-y-2">
              {POLICY_PROPOSALS.map((p, i) => (
                <li key={i} className="flex gap-3"><span className="font-display font-bold text-brand-strong">{i + 1}.</span><span>{tr(p)}</span></li>
              ))}
            </ol>
          </Section>

          <Section id="assumptions" title={nav[3].label}>
            <p>{tr(b('We assume these facts and have not confirmed them yet:', 'Damos por supuestos estos hechos y aún no los hemos confirmado:'))}</p>
            <Bullets items={PENDING_FACT_CHECKS.map(p => tr(p))} />
          </Section>

          <Section id="figures" title={nav[4].label}>
            <p>{tr(b('The only real numbers in the platform, quoted exactly with their year and source.', 'Las únicas cifras reales de la plataforma, citadas literalmente con su año y fuente.'))}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[15px]" data-testid="about-figures">
                <caption className="sr-only">{nav[4].label}</caption>
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th scope="col" className="py-2 pr-4 font-bold">{tr(b('Figure', 'Indicador'))}</th>
                    <th scope="col" className="py-2 pr-4 font-bold">{tr(b('Value', 'Valor'))}</th>
                    <th scope="col" className="py-2 pr-4 font-bold">{tr(b('Year', 'Año'))}</th>
                    <th scope="col" className="py-2 font-bold">{tr(b('Source', 'Fuente'))}</th>
                  </tr>
                </thead>
                <tbody>
                  {REFERENCE_FIGURES.map(f => (
                    <tr key={f.id} className="border-b border-line align-top">
                      <th scope="row" className="py-3 pr-4 font-semibold">{tr(f.label)}</th>
                      <td className="py-3 pr-4 tabular-nums">{f.value}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{f.year}</td>
                      <td className="py-3">
                        <span className="font-semibold">{f.source}</span>
                        <span className="mt-0.5 block max-w-[34ch] text-[12px] break-all text-muted">{f.sourceUrl}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[14px] text-muted">{tr(b('Source addresses are shown as text; the platform never connects to them.', 'Las direcciones de las fuentes se muestran como texto; la plataforma nunca se conecta a ellas.'))}</p>
          </Section>
        </div>
      </div>
    </GovPage>
  )
}

/* -------------------------------------------------------- accessibility */

export function AccessibilityPage() {
  const { tr } = useTr()
  const done = [
    b('Every page works with the keyboard alone, with a clearly visible focus outline.', 'Todas las páginas funcionan solo con el teclado y con un contorno de foco bien visible.'),
    b('Text and controls meet the contrast ratios of WCAG 2.1 AA (at least 4.5:1 for text).', 'Los textos y controles cumplen los contrastes de WCAG 2.1 AA (al menos 4,5:1 para el texto).'),
    b('Every form field has a visible label; errors are announced and say how to fix them.', 'Cada campo tiene una etiqueta visible; los errores se anuncian y explican cómo corregirlos.'),
    b('Status changes are announced to screen readers as they happen.', 'Los cambios de estado se anuncian a los lectores de pantalla en cuanto ocurren.'),
    b('Animations are reduced when your device asks for reduced motion.', 'Las animaciones se reducen si tu dispositivo pide movimiento reducido.'),
    b('Charts come with a data table, and the whole service is available in English and Spanish.', 'Los gráficos incluyen una tabla de datos y todo el servicio está en inglés y en español.'),
  ]
  const limits = [
    b('The chip-read and face-check screens are illustrations; their meaning is also given in text.', 'Las pantallas de lectura del chip y comprobación facial son ilustraciones; su significado también se da en texto.'),
    b('The platform has not been audited by an external accessibility body.', 'La plataforma no ha sido auditada por un organismo externo de accesibilidad.'),
  ]
  return (
    <GovPage
      title={tr(b('Accessibility', 'Accesibilidad'))}
      subtitle={tr(b('Our target is level AA of the Web Content Accessibility Guidelines (WCAG) 2.1.', 'Nuestro objetivo es el nivel AA de las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1.'))}
      breadcrumb={[{ to: '/', label: tr(b('Home', 'Inicio')) }, { label: tr(b('Accessibility', 'Accesibilidad')) }]}
      width="max-w-[960px]"
    >
      <div className="space-y-10" data-testid="accessibility-page">
        <Section title={tr(b('What we do', 'Qué hacemos'))}>
          <ul className="max-w-[72ch] space-y-2">
            {done.map((d, i) => <li key={i} className="flex gap-3"><Check className="mt-1 size-5 shrink-0 text-success" aria-hidden /><span>{tr(d)}</span></li>)}
          </ul>
        </Section>
        <Section title={tr(b('Known limitations', 'Limitaciones conocidas'))}>
          <ul className="max-w-[72ch] space-y-2">
            {limits.map((d, i) => <li key={i} className="flex gap-3"><Minus className="mt-1 size-5 shrink-0 text-warning" aria-hidden /><span>{tr(d)}</span></li>)}
          </ul>
        </Section>
        <Section title={tr(b('Tell us about a problem', 'Avísanos de un problema'))}>
          <p>{tr(b(
            'This is an academic prototype, so there is no official accessibility contact. If something does not work for you, please tell the project team at IE University.',
            'Esto es un prototipo académico, así que no hay un contacto oficial de accesibilidad. Si algo no te funciona, díselo al equipo del proyecto en IE University.',
          ))}</p>
        </Section>
      </div>
    </GovPage>
  )
}

/* ---------------------------------------------------------------- legal */

export function LegalPage() {
  const { tr } = useTr()
  return (
    <GovPage
      title={tr(b('Legal notice', 'Aviso legal'))}
      breadcrumb={[{ to: '/', label: tr(b('Home', 'Inicio')) }, { label: tr(b('Legal notice', 'Aviso legal')) }]}
      width="max-w-[960px]"
    >
      <div className="space-y-10" data-testid="legal-page">
        <Section title={tr(b('Who is responsible', 'Quién es responsable'))}>
          <p>{tr(b(
            'Get your Cl@ve is an academic project by a group of students of IE University, Madrid, for the course Connected Industries, Smart Cities & E-Government (2026). It is not a service of the Government of Spain or of any public body, and it has no link with the official Cl@ve system.',
            'Get your Cl@ve es un proyecto académico de un grupo de estudiantes de IE University, Madrid, para la asignatura Connected Industries, Smart Cities & E-Government (2026). No es un servicio del Gobierno de España ni de ningún organismo público, y no tiene relación con el sistema Cl@ve oficial.',
          ))}</p>
        </Section>
        <Section title={tr(b('Names and trademarks', 'Nombres y marcas'))}>
          <p>{tr(b(
            '“Cl@ve” and the names of public bodies are used only as text, to describe the service being redesigned. The platform shows no official logos, coats of arms or agency branding; its mark is its own.',
            '«Cl@ve» y los nombres de organismos públicos se usan solo como texto, para describir el servicio que se rediseña. La plataforma no muestra logotipos oficiales, escudos ni marcas de organismos; su marca es propia.',
          ))}</p>
        </Section>
        <Section title={tr(b('Content', 'Contenido'))}>
          <p>{tr(b(
            'All people, documents and numbers in the platform are fictional, except the reference figures, which are quoted with their year and source. Nothing here grants any real access, right or identity.',
            'Todas las personas, documentos y números de la plataforma son ficticios, salvo las cifras de referencia, que se citan con su año y fuente. Nada de lo que hay aquí concede ningún acceso, derecho o identidad real.',
          ))}</p>
          <p><Link to="/about" className="gov-link">{tr(b('See what is simulated', 'Ver qué está simulado'))}</Link></p>
        </Section>
      </div>
    </GovPage>
  )
}

/* -------------------------------------------------------------- privacy */

export function PrivacyPage() {
  const { tr } = useTr()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <GovPage
      title={tr(b('Privacy', 'Privacidad'))}
      subtitle={tr(b('Your data stays in this browser.', 'Tus datos se quedan en este navegador.'))}
      breadcrumb={[{ to: '/', label: tr(b('Home', 'Inicio')) }, { label: tr(b('Privacy', 'Privacidad')) }]}
      width="max-w-[960px]"
    >
      <div className="space-y-10" data-testid="privacy-page">
        <Section title={tr(b('What we store and where', 'Qué guardamos y dónde'))}>
          <p>{tr(b(
            'Accounts, applications, decisions and the audit trail are saved only in this browser’s local storage. They are shared between tabs and windows of the same browser, so the staff console can see an application live, and they are never sent to a server.',
            'Las cuentas, solicitudes, resoluciones y el registro de auditoría se guardan solo en el almacenamiento local de este navegador. Se comparten entre pestañas y ventanas del mismo navegador, para que la consola del personal vea una solicitud en directo, y nunca se envían a un servidor.',
          ))}</p>
          <p>{tr(b(
            'There are no cookies, no analytics and no requests to other websites: even the fonts are part of the platform.',
            'No hay cookies, ni analítica, ni peticiones a otras webs: incluso las tipografías forman parte de la plataforma.',
          ))}</p>
        </Section>
        <Section title={tr(b('What you should never type', 'Qué no debes escribir nunca'))}>
          <p>{tr(b(
            'Never type a real document number or a password you use elsewhere. When you create an account, the platform assigns you a fictional applicant number; passwords are kept only as a simple fingerprint, which is not secure enough for a real password.',
            'Nunca escribas un número de documento real ni una contraseña que uses en otro sitio. Al crear tu cuenta, la plataforma te asigna un número de solicitante ficticio; las contraseñas se guardan solo como una huella sencilla, que no es lo bastante segura para una contraseña real.',
          ))}</p>
        </Section>
        <Section title={tr(b('Delete your data', 'Borrar tus datos'))}>
          <p>{tr(b(
            'You can delete everything saved in this browser at any time. Accounts you created are removed and every application goes back to its starting point.',
            'Puedes borrar en cualquier momento todo lo guardado en este navegador. Se eliminan las cuentas que creaste y cada solicitud vuelve a su punto de partida.',
          ))}</p>
          <Button variant="secondary" onClick={() => setOpen(true)} data-testid="privacy-delete">
            {tr(b('Delete the data in this browser', 'Borrar los datos de este navegador'))}
          </Button>
        </Section>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={tr(b('Delete the data in this browser?', '¿Borrar los datos de este navegador?'))}
        description={tr(b('This signs everyone out and cannot be undone.', 'Se cierran todas las sesiones y no se puede deshacer.'))}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">{tr(b('Cancel', 'Cancelar'))}</Button></DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                try { actions.resetDemo() } catch (e) { console.warn('[privacy] reset', e) }
                setOpen(false)
                toast.success(tr(b('Data deleted', 'Datos borrados')))
                navigate('/')
              }}
            >
              {tr(b('Delete', 'Borrar'))}
            </Button>
          </>
        }
      />
    </GovPage>
  )
}
