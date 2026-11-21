/**
 * Citizen-area UI microcopy. Every citizen-facing string exists in EN and ES.
 * Contract strings (ROUTES, STATUSES, CITIZEN_MESSAGES, …) are used directly from '@/contract/seed';
 * only the extra interface text lives here.
 */
import type { Bilingual, CheckOutcome } from '@/contract/types'

const b = (en: string, es: string): Bilingual => ({ en, es })

export const C = {
  /* ---------- shell ---------- */
  appName: b('Get your Cl@ve', 'Get your Cl@ve'),
  citizenView: b('Citizen view', 'Vista ciudadana'),
  switchIdentity: b('Switch demo identity', 'Cambiar identidad de demo'),
  home: b('Home', 'Inicio'),
  back: b('Back', 'Atrás'),
  next: b('Next', 'Siguiente'),
  continue: b('Continue', 'Continuar'),
  close: b('Close', 'Cerrar'),
  cancel: b('Cancel', 'Cancelar'),
  updatedJustNow: b('Updated just now', 'Actualizado ahora mismo'),
  sideCaption: b(
    'This is the citizen’s phone. Open the officer view in another tab: the same case updates live in both.',
    'Este es el móvil de la persona solicitante. Abre la vista de funcionario en otra pestaña: el mismo caso se actualiza en directo en las dos.',
  ),
  openOfficer: b('Open officer view', 'Abrir vista de funcionario'),
  skipToContent: b('Skip to content', 'Saltar al contenido'),

  /* ---------- landing ---------- */
  launchEyebrow: b('Now open to everyone living in Spain', 'Ya abierto a todas las personas que viven en España'),
  heroTitle1: b('Your Cl@ve,', 'Tu Cl@ve,'),
  heroTitle2: b('from your phone.', 'desde tu móvil.'),
  heroBody: b(
    'Anyone living in Spain, with any document, no appointment. A foreigner gets Cl@ve the same way and in the same time as a Spaniard.',
    'Cualquier persona que viva en España, con cualquier documento y sin cita. Una persona extranjera obtiene Cl@ve igual y en el mismo tiempo que una española.',
  ),
  iAmCitizen: b('I am a citizen', 'Soy ciudadano/a'),
  iAmCitizenSub: b('Get your Cl@ve or follow your application', 'Obtén tu Cl@ve o sigue tu solicitud'),
  iAmOfficer: b('I am an officer', 'Soy funcionario/a'),
  iAmOfficerSub: b('Review cases, decide with a reason, see the audit', 'Revisa casos, decide con motivo, consulta la auditoría'),
  todayLabel: b('Today', 'Hoy'),
  nowLabel: b('Now', 'Ahora'),
  todaySteps: [b('Office', 'Oficina'), b('Originals', 'Originales'), b('Appointment', 'Cita previa'), b('Weeks', 'Semanas')],
  nowSteps: [b('Your phone', 'Tu móvil'), b('Minutes', 'Minutos')],
  todayNote: b(
    'Video registration is only for Spaniards with a DNI. Foreigners go in person with originals; red-card and NIE-paper holders cannot register at all.',
    'El registro por vídeo solo es para españoles con DNI. Las personas extranjeras van en persona con originales; quienes tienen tarjeta roja o NIE en papel no pueden registrarse.',
  ),
  nowNote: b(
    'One platform, four routes: EU eID, passport or TIE chip + face check, DNI video call, or a video call with an officer.',
    'Una plataforma, cuatro vías: eID de la UE, chip del pasaporte o TIE + cara, videollamada con DNI o videollamada con una persona funcionaria.',
  ),
  figuresTitle: b('Cl@ve in numbers', 'Cl@ve en cifras'),
  figuresNote: b('Real published figures, with year and source.', 'Cifras reales publicadas, con año y fuente.'),
  sourceLabel: b('Source', 'Fuente'),
  keyRuleTitle: b('The key rule', 'La regla clave'),
  routesTitle: b('Four routes, one platform', 'Cuatro vías, una plataforma'),
  dashboardLink: b('Indicators dashboard', 'Panel de indicadores'),
  demoLink: b('Demo mode', 'Modo demo'),
  studentPrototype: b('IE University · Smart Cities & E-Government · student concept', 'IE University · Smart Cities & E-Government · concepto de estudiantes'),

  /* ---------- sign in ---------- */
  signInTitle: b('Sign in', 'Entrar'),
  signInBody: b(
    'This prototype uses preset demo identities. Choose who you are: nobody types a real ID number.',
    'Este prototipo usa identidades de demo predefinidas. Elige quién eres: nadie escribe un número de identidad real.',
  ),
  demoIdentities: b('Demo identities', 'Identidades de demo'),
  notStarted: b('Not started', 'Sin empezar'),
  inProgress: b('Route chosen', 'Vía elegida'),
  fictional: b('All people and documents are fictional.', 'Todas las personas y documentos son ficticios.'),

  /* ---------- assistant ---------- */
  hello: b('Hi', 'Hola'),
  assistantIntro: b(
    'A few quick questions and we tell you the fastest route for you. We filled them in for this demo identity; you can change any answer.',
    'Unas preguntas rápidas y te decimos la vía más rápida para ti. Las hemos rellenado para esta identidad de demo; puedes cambiar cualquier respuesta.',
  ),
  questionOf: b('Question {n} of {total}', 'Pregunta {n} de {total}'),
  yes: b('Yes', 'Sí'),
  no: b('No', 'No'),
  hasChip: b('Has a chip', 'Tiene chip'),
  noChip: b('No chip', 'Sin chip'),
  eidYesSub: b('For example your country’s ID card with its PIN or app', 'Por ejemplo, el DNI de tu país con su PIN o app'),
  eidNoSub: b('I don’t have it, or not with me right now', 'No lo tengo, o no lo tengo ahora a mano'),
  assistedYesSub: b('I am using someone else’s phone with their help', 'Uso el móvil de otra persona con su ayuda'),
  assistedNoSub: b('It is my own phone', 'Es mi propio móvil'),
  helperOnDevice: b('Helper on this phone', 'Persona que ayuda en este móvil'),
  deviceOwner: b('Phone owner', 'Dueño/a del móvil'),
  seeRecommendation: b('See my route', 'Ver mi vía'),
  recommendedFor: b('Your recommended route', 'Tu vía recomendada'),
  whyThisRoute: b('Why this route', 'Por qué esta vía'),
  whatHappensNext: b('What happens next', 'Qué pasa ahora'),
  otherRoutes: b('See the other routes', 'Ver las otras vías'),
  hideOtherRoutes: b('Hide the other routes', 'Ocultar las otras vías'),
  confirmRoute: b('Continue with this route', 'Continuar con esta vía'),
  changeAnswers: b('Change my answers', 'Cambiar mis respuestas'),
  policyRouteNote: b(
    'This is a proposed rule change, not a current rule:',
    'Esto es una propuesta de cambio normativo, no una norma actual:',
  ),
  guardianNote: b(
    'You are a minor, so {guardian} ({relation}) signs in first with her own eID and confirms you.',
    'Eres menor, así que {guardian} ({relation}) entra primero con su propio eID y te confirma.',
  ),
  yourAnswers: b('Your answers', 'Tus respuestas'),
  routeLabel: b('Route', 'Vía'),

  /* ---------- verification ---------- */
  consentWhat: b('What we will check', 'Qué vamos a comprobar'),
  consentFine: b(
    'You can withdraw your consent at any time. No real data is used in this prototype.',
    'Puedes retirar tu consentimiento en cualquier momento. En este prototipo no se usan datos reales.',
  ),
  stepLabel: b('Step {n} of {total}', 'Paso {n} de {total}'),
  // Route A
  redirecting: b('You are being redirected to your country’s eID', 'Te estamos redirigiendo a la identidad digital de tu país'),
  redirectingBody: b('Through eIDAS, the European network that connects national digital IDs.', 'A través de eIDAS, la red europea que conecta las identidades digitales nacionales.'),
  countryLogin: b('National eID login · {country}', 'Acceso eID nacional · {country}'),
  countryLoginBody: b(
    'Get your Cl@ve asks to confirm your identity. Approve in your eID app.',
    'Get your Cl@ve pide confirmar tu identidad. Aprueba en tu app de eID.',
  ),
  sharedData: b('Data shared', 'Datos compartidos'),
  sharedFields: b('Name · Date of birth · Unique identifier', 'Nombre · Fecha de nacimiento · Identificador único'),
  approveSignIn: b('Approve sign-in', 'Aprobar acceso'),
  returning: b('Identity confirmed. Returning to Get your Cl@ve…', 'Identidad confirmada. Volviendo a Get your Cl@ve…'),
  neutralNote: b('Neutral mock-up of a national eID screen: no real logos, no real login.', 'Maqueta neutra de una pantalla de eID nacional: sin logos ni acceso reales.'),
  // Guardian
  guardianTitle: b('First, {guardian} signs in', 'Primero entra {guardian}'),
  guardianBody: b(
    '{guardian} ({relation}) uses her own EU eID (route A) and confirms she is registering {name}.',
    '{guardian} ({relation}) usa su propio eID de la UE (vía A) y confirma que registra a {name}.',
  ),
  guardianConfirm: b('I confirm I am {name}’s {relation}', 'Confirmo que soy {relation} de {name}'),
  guardianDone: b('{guardian} confirmed. Now hand the phone to {name}.', '{guardian} ha confirmado. Ahora pasa el móvil a {name}.'),
  // Route B
  chipTitle: b('Hold your document to the back of your phone', 'Acerca tu documento a la parte trasera del móvil'),
  chipBody: b('Keep it still until the chip is read. It takes a few seconds.', 'Mantenlo quieto hasta que se lea el chip. Tarda unos segundos.'),
  chipStart: b('Start reading the chip', 'Empezar a leer el chip'),
  chipReading: b('Reading the chip…', 'Leyendo el chip…'),
  chipDone: b('Chip read', 'Chip leído'),
  faceTitle: b('Now, a short face check', 'Ahora, una breve comprobación facial'),
  faceBody: b('Put your face inside the oval and turn your head slowly.', 'Pon tu cara dentro del óvalo y gira la cabeza despacio.'),
  faceBodyAssisted: b(
    '{name}, this part is yours: {helper} holds the phone, but the face must be yours.',
    '{name}, esta parte es tuya: {helper} sujeta el móvil, pero la cara debe ser la tuya.',
  ),
  faceStart: b('Start the face check', 'Empezar la comprobación facial'),
  faceTurn: b('Turn your head slowly', 'Gira la cabeza despacio'),
  faceHold: b('Hold still…', 'No te muevas…'),
  faceDone: b('Face captured', 'Cara capturada'),
  noCameraNote: b('No camera is used: this is an animation.', 'No se usa la cámara: es una animación.'),
  // Route C
  dniTitle: b('DNI video call', 'Videollamada con DNI'),
  dniBody: b("Today's video identification, kept as it is.", 'La videoidentificación actual, sin cambios.'),
  dniStart: b('Start the video call', 'Empezar la videollamada'),
  dniSteps: [b('Show the front of your DNI', 'Enseña la parte delantera de tu DNI'), b('Show the back', 'Enseña la parte trasera'), b('Look at the camera', 'Mira a la cámara')],
  dniDone: b('Video identification completed', 'Videoidentificación completada'),
  connecting: b('Connecting…', 'Conectando…'),
  // Fallback
  bookTitle: b('Book a video call with an officer', 'Reserva una videollamada con una persona funcionaria'),
  bookBody: b(
    'An officer confirms your identity live, from your phone. Pick a time today.',
    'Una persona funcionaria confirma tu identidad en directo, desde tu móvil. Elige una hora de hoy.',
  ),
  todayAt: b('Today, {time}', 'Hoy, {time}'),
  slotsLegend: b('Available times today', 'Horas disponibles hoy'),
  bookConfirm: b('Book this time', 'Reservar esta hora'),
  booked: b('Video call booked for today, {time}', 'Videollamada reservada para hoy, {time}'),
  bookedBody: b('We send your application now. The officer will call you here at that time.', 'Enviamos tu solicitud ahora. La persona funcionaria te llamará aquí a esa hora.'),
  // submission
  sendForChecks: b('Send for checks', 'Enviar a comprobar'),
  liveChecks: b('Live checks', 'Comprobaciones en directo'),
  checksRunning: b('Our engine is checking. Results appear as they finish.', 'Nuestro motor está comprobando. Los resultados aparecen según terminan.'),
  checksDoneApproved: b('All done: you have Cl@ve.', 'Listo: ya tienes Cl@ve.'),
  checksDoneOfficer: b('Done. A person will review your application; you can follow it from your status page.', 'Listo. Una persona revisará tu solicitud; puedes seguirla desde tu página de estado.'),
  goToStatus: b('Go to my status', 'Ir a mi estado'),
  verificationStep: b('Verification', 'Verificación'),

  /* ---------- checks ---------- */
  outcome: {
    pass: b('Passed', 'Superada'),
    warn: b('Needs a look', 'Requiere revisión'),
    fail: b('Did not pass: a person will review it', 'No superada: la revisará una persona'),
    pending: b('Waiting', 'En espera'),
    skipped: b('Not needed', 'No necesaria'),
  } satisfies Record<CheckOutcome, Bilingual>,
  running: b('Checking…', 'Comprobando…'),
  score: b('Score', 'Puntuación'),
  threshold: b('Minimum {min}', 'Mínimo {min}'),

  /* ---------- status tracker ---------- */
  statusTitle: b('Your application', 'Tu solicitud'),
  stepState: {
    done: b('Done', 'Hecho'),
    now: b('Now', 'Ahora'),
    next: b('Next', 'Siguiente'),
    notNeeded: b('Not needed', 'No hizo falta'),
    ifNeeded: b('Only if needed', 'Solo si hace falta'),
    notReached: b('Not applicable', 'No aplica'),
  },
  checksTitle: b('Every check we did', 'Cada comprobación que hicimos'),
  levelTitle: b('Your access level', 'Tu nivel de acceso'),
  levelNone: b('No level yet', 'Aún sin nivel'),
  levelBasic: b('Basic level', 'Nivel básico'),
  levelAdvPending: b('Advanced: pending review by a person', 'Avanzado: pendiente de revisión por una persona'),
  levelAdvGranted: b('Advanced level granted', 'Nivel avanzado concedido'),
  officerAsks: b('The officer asks', 'La persona funcionaria pregunta'),
  replyLabel: b('Your answer', 'Tu respuesta'),
  replyPlaceholder: b('Write your answer here', 'Escribe tu respuesta aquí'),
  sendReply: b('Send answer', 'Enviar respuesta'),
  youReplied: b('You answered', 'Respondiste'),
  replySuggest: b('Use a suggested answer', 'Usar una respuesta sugerida'),
  replySuggestion: b('My current address is the new one; I updated my padrón this week.', 'Mi dirección actual es la nueva; actualicé el padrón esta semana.'),
  waitingPerson: b('A person is reviewing your application. You don’t need to do anything.', 'Una persona está revisando tu solicitud. No tienes que hacer nada.'),
  videoCallBookedCard: b('Your video call with an officer', 'Tu videollamada con una persona funcionaria'),
  startOver: b('Start this demo case over', 'Reiniciar este caso de demo'),
  submitted: b('Submitted', 'Enviada'),
  continueApplication: b('Continue my application', 'Continuar mi solicitud'),

  /* ---------- result ---------- */
  congrats: b('You have Cl@ve!', '¡Ya tienes Cl@ve!'),
  congratsBody: b('You can now sign in to online public services from your phone.', 'Ya puedes entrar a los servicios públicos en línea desde tu móvil.'),
  basicGranted: b('Basic level granted', 'Nivel básico concedido'),
  basicGrantedBody: b('Enough for most online services.', 'Suficiente para la mayoría de servicios en línea.'),
  advPendingBody: b('Pending review by a person. You will see the answer here.', 'Pendiente de revisión por una persona. Verás la respuesta aquí.'),
  advGrantedBody: b('Reviewed and granted by a person.', 'Revisado y concedido por una persona.'),
  autoGranted: b('Granted automatically', 'Concedido automáticamente'),
  grantedByPerson: b('Granted after review by a person', 'Concedido tras revisión de una persona'),
  notApprovedTitle: b('Not approved yet', 'Aún no aprobada'),
  personReviewed: b('A person reviewed it on {date}.', 'Una persona la revisó el {date}.'),
  theReason: b('The reason', 'El motivo'),
  howToFix: b('How to fix it', 'Cómo corregirlo'),
  appeal: b('Appeal', 'Recurrir'),
  appealTitle: b('Appeal this decision', 'Recurrir esta decisión'),
  appealBody: b('Tell us why you think the decision is wrong. A different officer will review it.', 'Cuéntanos por qué crees que la decisión es errónea. La revisará otra persona funcionaria.'),
  appealLabel: b('Why do you appeal?', '¿Por qué recurres?'),
  appealSuggestion: b('I believe my document and identity are genuine. I can confirm it on a video call.', 'Creo que mi documento e identidad son auténticos. Puedo confirmarlo en una videollamada.'),
  sendAppeal: b('Send appeal', 'Enviar recurso'),
  appealUnderReview: b('Appeal under review', 'Recurso en revisión'),
  appealUpheld: b('Appeal upheld', 'Recurso estimado'),
  appealDismissed: b('Appeal dismissed', 'Recurso desestimado'),
  yourAppeal: b('Your appeal', 'Tu recurso'),
  corrected: b('I have corrected it', 'Ya lo he corregido'),
  correctTitle: b('Tell us what you corrected', 'Cuéntanos qué has corregido'),
  correctBody: b('We will run the checks again with your correction.', 'Volveremos a hacer las comprobaciones con tu corrección.'),
  correctLabel: b('What did you correct?', '¿Qué has corregido?'),
  correctSuggestion: b('I updated my padrón at the town hall with my new address.', 'He actualizado mi padrón en el ayuntamiento con mi nueva dirección.'),
  sendCorrection: b('Check again', 'Volver a comprobar'),
  bookVideoCall: b('Book a video call', 'Reservar videollamada'),
  bookedSimNote: b('Booking is simulated in this prototype.', 'La reserva es simulada en este prototipo.'),
  appealNotAvailable: b(
    'This appeal could not be registered in the prototype yet. Your basic level is kept.',
    'Este recurso aún no se puede registrar en el prototipo. Conservas el nivel básico.',
  ),
  writeSomething: b('Please write a few words first.', 'Escribe unas palabras primero.'),
} as const

/** Replace {key} placeholders. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))
}
