/**
 * Message bank — plan section 3 (English and Spanish), copied verbatim. Every text carries the plan's ID
 * without the "MSG-" prefix: MSG['RA-07B'], MSG['REJ-05'], MSG['STA-4B'] …
 *
 * Shape: `en` / `es` = the main text (title, buttons, help and options split out into their own fields).
 * Placeholders: {helper} {applicant} {whatWeNeed} {reason} {fields} {legal}. Use fillMsg() to fill them.
 * Spanish uses "tú". The messages promise no waiting times.
 *
 * Not verbatim (the plan has no Spanish for them): the officer-list labels, "when" and "can correct" of the
 * REJ reason table in Spanish (REJ_REASONS[...].officerLabel.es / when.es / canCorrect.es).
 */
import type { Bilingual, DocumentType, RejId, Who, YesNoUnsure } from './types'

const b = (en: string, es: string): Bilingual => ({ en, es })

export interface Msg extends Bilingual {
  title?: Bilingual
  /** "Why this route" line on the route results. */
  why?: Bilingual
  help?: Bilingual
  button?: Bilingual
  buttons?: Bilingual[]
  options?: Bilingual[]
  checkbox?: Bilingual
  example?: Bilingual
  /** Builder note from the plan (not shown to citizens). */
  note?: string
  [extra: string]: unknown
}

/* ------------------------------------------------------------- glossary */

export const GLOSSARY = {
  serviceName: b('Get your Cl@ve', 'Consigue tu Cl@ve'),
  basicLevel: b('basic level', 'nivel básico'),
  basicLevelHelp: b('Opens most online procedures. A few, such as Cl@ve Firma, need the advanced level', 'Abre la mayoría de los trámites en línea. Algunos, como Cl@ve Firma, necesitan el nivel avanzado'),
  advancedLevel: b('advanced level', 'nivel avanzado'),
  advancedLevelHelp: b('Needed for the rest', 'Necesario para el resto'),
  /** Citizen messages. */
  officerCitizen: b('officer', 'persona de la Administración'),
  /** Officer screens. */
  officerStaff: b('Public employee', 'Empleado público'),
  videoCall: b('video call with an officer', 'videollamada con una persona de la Administración'),
  routeA: b('Route A', 'Vía A'),
  routeB: b('Route B', 'Vía B'),
  routeC: b('Route C', 'Vía C'),
} satisfies Record<string, Bilingual>

/** Prototype chrome next to B, C-assisted, X and the Fallback for foreigners. */
export const PROPOSED_RULE_TAG = b('Proposed rule, not in force today', 'Norma propuesta, aún no vigente')

/** RA-03 options by document type (and the "I am not sure" option). */
export const DOCUMENT_OPTIONS: Record<DocumentType | 'UNSURE', Bilingual> = {
  DNI: b('Spanish national ID (DNI)', 'DNI'),
  EU_EID: b('National electronic ID (eID) from an EU country', 'Documento de identidad electrónico (eID) de un país de la UE'),
  PASSPORT: b('Passport', 'Pasaporte'),
  TIE: b('Foreigner ID card (TIE)', 'Tarjeta de identidad de extranjero (TIE)'),
  NIE_PAPER: b('NIE assignment paper', 'Documento de asignación de NIE'),
  RED_CARD: b('Red card (international protection applicant)', 'Tarjeta roja (solicitante de protección internacional)'),
  UNSURE: b('I am not sure', 'No lo sé'),
}

export const YES_NO_UNSURE: Record<YesNoUnsure, Bilingual> = {
  yes: b('Yes', 'Sí'),
  no: b('No', 'No'),
  unsure: b('I am not sure', 'No lo sé'),
}

export const WHO_OPTIONS: Record<Who, Bilingual> = {
  self: b('I am registering for myself', 'Me registro yo'),
  helping: b('I am helping someone else register', 'Ayudo a otra persona a registrarse'),
  child: b('I am registering a child I am responsible for', 'Registro a un menor a mi cargo'),
}

/** Helper relations offered in the assisted-mode form (SPEC §5). */
export const HELPER_RELATION_LABELS = {
  family: b('Family member', 'Familiar'),
  friend: b('Friend or neighbour', 'Amistad o vecindad'),
  support: b('Social worker or other support person', 'Trabajo social u otra persona de apoyo'),
} satisfies Record<string, Bilingual>

/** Simulated camera control (an input, not an outcome). */
export const CAMERA_CONTROL = {
  label: b('Simulated camera: what is in front of it', 'Cámara simulada: qué hay delante'),
  person: b('Real person', 'Persona real'),
  reflections: b('Reflections or low light', 'Reflejos o poca luz'),
  synthetic: b('Synthetic video', 'Vídeo sintético'),
} satisfies Record<string, Bilingual>

export const DEMO_SMS_BANNER = b('Demo code: 123456', 'Código de demo: 123456')
export const DEMO_SMS_CODE = '123456'

/* ============================================================== THE BANK */

export const MSG = {
  /* ---------------------------------------------------- 3.1 route assistant */
  'RA-01': {
    title: b('Get your Cl@ve from your phone.', 'Consigue tu Cl@ve desde el móvil.'),
    ...b('Answer a few short questions and we will show you the way that fits you.', 'Responde a unas preguntas breves y te mostraremos la vía que mejor te encaja.'),
    button: b('Start', 'Empezar'),
  },
  'RA-02': {
    ...b('What is your nationality?', '¿Cuál es tu nacionalidad?'),
    help: b('If you have more than one, choose the one on the document you will use.', 'Si tienes varias, elige la del documento que vas a usar.'),
  },
  'RA-03': {
    ...b('Which document will you use to identify yourself?', '¿Con qué documento vas a identificarte?'),
    options: [DOCUMENT_OPTIONS.DNI, DOCUMENT_OPTIONS.EU_EID, DOCUMENT_OPTIONS.PASSPORT, DOCUMENT_OPTIONS.TIE, DOCUMENT_OPTIONS.NIE_PAPER, DOCUMENT_OPTIONS.RED_CARD, DOCUMENT_OPTIONS.UNSURE],
    help: b('If you have more than one, choose the main one. We will ask for the others if we need them.', 'Si tienes varios, elige el principal. Te pediremos los otros si hacen falta.'),
  },
  'RA-04': {
    ...b('Does your country issue an electronic ID that you can use to log in online?', '¿Tu país emite una identidad electrónica con la que puedas iniciar sesión en internet?'),
    help: b('For example, a national eID card or app. It has to be from an EU country.', 'Por ejemplo, una tarjeta o una aplicación nacional de identidad electrónica. Tiene que ser de un país de la UE.'),
    options: [YES_NO_UNSURE.yes, YES_NO_UNSURE.no, YES_NO_UNSURE.unsure],
  },
  'RA-05': {
    ...b('Who is registering?', '¿Quién se va a registrar?'),
    options: [WHO_OPTIONS.self, WHO_OPTIONS.helping, WHO_OPTIONS.child],
    note: 'If "helping" is chosen, switch to large text. / Si se elige «Ayudo», pasar a letra grande.',
  },
  'RA-06': {
    ...b('Does your phone have NFC and a front camera?', '¿Tu móvil tiene NFC y cámara frontal?'),
    help: b('NFC lets the phone read the chip in your document. If you are not sure, choose "I am not sure" and we will test it.', 'El NFC permite que el móvil lea el chip de tu documento. Si no lo sabes, elige «No lo sé» y lo probaremos.'),
    options: [YES_NO_UNSURE.yes, YES_NO_UNSURE.no, YES_NO_UNSURE.unsure],
  },
  'RA-07A': {
    title: b('Your EU digital ID.', 'Tu identidad digital de la UE.'),
    ...b('You can log in with your national electronic ID. With your consent, we check your residence data in Spain, and you do not upload any document.', 'Puedes iniciar sesión con tu identidad electrónica nacional. Con tu consentimiento, comprobamos tus datos de residencia en España y no subes ningún documento.'),
    why: b('Why this route: you told us you have an EU electronic ID.', 'Por qué esta vía: nos has dicho que tienes una identidad electrónica de la UE.'),
    button: b('Continue with my national eID', 'Continuar con mi identidad electrónica nacional'),
  },
  'RA-07B': {
    title: b('Your document chip and a face check.', 'El chip de tu documento y una comprobación facial.'),
    ...b('Your phone reads the chip in your passport or foreigner ID card (TIE) and we compare your face with the photo stored in it. With your consent, we also check your residence data.', 'Tu móvil lee el chip de tu pasaporte o de tu tarjeta de identidad de extranjero (TIE) y comparamos tu cara con la foto que contiene. Con tu consentimiento, comprobamos también tus datos de residencia.'),
    why: b('Why this route: you told us you have a passport or TIE and a phone that can read it.', 'Por qué esta vía: nos has dicho que tienes pasaporte o TIE y un móvil que puede leerlo.'),
    button: b('Start verification', 'Empezar la verificación'),
  },
  'RA-07C': {
    title: b('Your DNI and a short video.', 'Tu DNI y un vídeo corto.'),
    ...b('You record a short video that shows your DNI and your face, as you can already do today in the Cl@ve app. You get the basic level straight away. A person later reviews your video for the advanced level.', 'Grabas un vídeo breve en el que se ven tu DNI y tu cara, como ya puedes hacer hoy en la app Cl@ve. Obtienes el nivel básico al momento. Después, una persona de la Administración revisa tu vídeo para el nivel avanzado.'),
    button: b('Start video', 'Empezar el vídeo'),
  },
  'RA-07F': {
    title: b('A video call with an officer.', 'Una videollamada con una persona de la Administración.'),
    ...b('We could not find a way for you to finish on your own, so you can speak with a person on a video call. If that does not work either, we will offer you an appointment at an office as a last option.', 'No hemos encontrado una forma de que termines tú solo o sola, así que puedes hablar con una persona por videollamada. Si tampoco funciona, te ofreceremos una cita en una oficina como última opción.'),
    button: b('Start video call', 'Empezar la videollamada'),
  },
  'RA-07X': {
    title: b('Register with your passport.', 'Regístrate con tu pasaporte.'),
    ...b('Your phone reads the chip in your passport and checks your face. A person also checks your red card or NIE paper before you are approved. If you do not have a valid passport, we will offer you a video call with an officer.', 'Tu móvil lee el chip de tu pasaporte y comprueba tu cara. Además, una persona revisa tu tarjeta roja o tu documento de NIE antes de aprobar tu registro. Si no tienes un pasaporte en vigor, te ofreceremos una videollamada con una persona de la Administración.'),
    button: b('Start verification', 'Empezar la verificación'),
    note: 'Provisional.',
  },

  /* -------------------------------------------- 3.2 consent and verification */
  'CON-01': {
    title: b('What we check', 'Qué comprobamos'),
    ...b('To confirm who you are, we check three things: your identity document, that you are the person in it, and your residence data in Spain.', 'Para confirmar quién eres, comprobamos tres cosas: tu documento de identidad, que eres la persona que aparece en él y tus datos de residencia en España.'),
  },
  /**
   * DERIVED from MSG-CON-01 for Route X (red card / NIE paper, GYC-05): there is no residence check on this route
   * (a person checks the card instead), so the residence item is left out. Not verbatim.
   */
  'CON-01X': {
    title: b('What we check', 'Qué comprobamos'),
    ...b('To confirm who you are, we check two things: your identity document and that you are the person in it.', 'Para confirmar quién eres, comprobamos dos cosas: tu documento de identidad y que eres la persona que aparece en él.'),
    derivedFrom: 'CON-01',
  },
  'CON-02': {
    title: b('Why we check', 'Por qué lo comprobamos'),
    ...b('We check so that a Cl@ve is only given to the person it belongs to. We only ask for the data these checks need.', 'Hacemos estas comprobaciones para que una Cl@ve solo se entregue a la persona a la que pertenece. Solo pedimos los datos que estas comprobaciones necesitan.'),
  },
  'CON-03': {
    title: b('Chip and face', 'Chip y cara'),
    ...b('Your phone reads the chip in your document. Then you look at the camera and move your head a little, so we can see that a real person is there. We compare your face with the photo stored in the chip. Your face data is sensitive, so we need your clear permission.', 'Tu móvil lee el chip de tu documento. Después miras a la cámara y mueves un poco la cabeza, para que podamos ver que hay una persona real. Comparamos tu cara con la foto guardada en el chip. Los datos de tu cara son sensibles, por eso necesitamos tu permiso expreso.'),
    checkbox: b('I agree that my face data is used to check that I am the holder of this document.', 'Acepto que se usen los datos de mi cara para comprobar que soy el titular de este documento.'),
  },
  /**
   * DERIVED from MSG-CON-03 for Route C (GYC-03: "MSG-CON-03 without the sentence about the chip"). The DNI video
   * route reads no chip: the first sentence is dropped and the photo is the one of the document. Not verbatim.
   */
  'CON-03C': {
    title: b('Face', 'Cara'),
    ...b('You look at the camera and move your head a little, so we can see that a real person is there. We compare your face with the photo of your document. Your face data is sensitive, so we need your clear permission.', 'Miras a la cámara y mueves un poco la cabeza, para que podamos ver que hay una persona real. Comparamos tu cara con la foto de tu documento. Los datos de tu cara son sensibles, por eso necesitamos tu permiso expreso.'),
    checkbox: b('I agree that my face data is used to check that I am the holder of this document.', 'Acepto que se usen los datos de mi cara para comprobar que soy el titular de este documento.'),
    derivedFrom: 'CON-03',
  },
  'CON-04': {
    title: b('Residence records', 'Registros de residencia'),
    ...b('With your agreement, we check in the records of other public bodies that you live in Spain and that your name and date of birth match. Without your agreement we cannot do this check.', 'Con tu consentimiento, comprobamos en los registros de otros organismos públicos que vives en España y que tu nombre y tu fecha de nacimiento coinciden. Sin tu consentimiento no podemos hacer esta comprobación.'),
    checkbox: b('I agree that my residence data is checked in official records.', 'Acepto que se comprueben mis datos de residencia en registros oficiales.'),
  },
  'CON-05': {
    title: b('Privacy', 'Privacidad'),
    ...b('You can ask a person to review any decision about your registration. Read the full privacy notice.', 'Puedes pedir que una persona revise cualquier decisión sobre tu registro. Lee el aviso de privacidad completo.'),
    note: 'Link: to be supplied by Roberto. / Enlace: lo facilita Roberto.',
  },
  'CON-06': {
    title: b('Consent declined', 'Consentimiento no aceptado'),
    ...b('You chose not to agree, so we cannot continue on this route. You can still talk to a person on a video call. You can change your mind at any time.', 'Has decidido no aceptar, así que no podemos continuar por esta vía. Aun así puedes hablar con una persona por videollamada. Puedes cambiar de opinión cuando quieras.'),
    buttons: [b('Go back', 'Volver'), b('Video call with an officer', 'Videollamada con una persona de la Administración')],
  },
  /** Buttons of the consent screen (prototype implementation of GYC-01). */
  'CON-BUTTONS': {
    ...b('I agree and continue', 'Acepto y continúo'),
    buttons: [b('I agree and continue', 'Acepto y continúo'), b('I do not agree', 'No acepto')],
  },
  'VER-01': {
    title: b('Chip instructions', 'Instrucciones del chip'),
    ...b('Place the back of your phone on your document, near the chip symbol, and keep it still. If your phone case is thick, take it off.', 'Apoya la parte trasera del móvil sobre el documento, cerca del símbolo del chip, y no lo muevas. Si tu funda es gruesa, quítala.'),
    button: b('Read chip', 'Leer chip'),
    success: b('Chip read: valid', 'Chip leído: válido'),
  },
  'VER-02': {
    title: b('Face check instructions', 'Instrucciones de la comprobación facial'),
    ...b('Look at the camera in a well-lit place. Follow the prompts and move your head slowly. Do not wear sunglasses, a mask or a hat.', 'Mira a la cámara en un lugar con buena luz. Sigue las indicaciones y mueve la cabeza despacio. No lleves gafas de sol, mascarilla ni gorro.'),
  },
  'VER-03': {
    title: b('Chip read failed, first time', 'Lectura del chip fallida, primera vez'),
    ...b('We could not read the chip. Hold the phone steady on the document and try again. Taking off the case can help.', 'No hemos podido leer el chip. Mantén el móvil quieto sobre el documento e inténtalo de nuevo. Quitar la funda puede ayudar.'),
    button: b('Try again', 'Intentarlo de nuevo'),
  },
  'VER-04': {
    title: b('Chip read failed, second time', 'Lectura del chip fallida, segunda vez'),
    ...b('We still cannot read the chip. This can happen with some phones or documents. You can talk to a person on a video call instead.', 'Seguimos sin poder leer el chip. Puede pasar con algunos móviles o documentos. Puedes hablar con una persona por videollamada.'),
    buttons: [b('Join video call with an officer', 'Unirme a la videollamada'), b('Come back later', 'Volver más tarde')],
  },
  'VER-05': {
    title: b('Face check retry', 'Repetir la comprobación facial'),
    ...b('We could not complete the face check. Try again in a well-lit place, facing the camera, with nothing covering your face.', 'No hemos podido completar la comprobación facial. Inténtalo de nuevo en un lugar con buena luz, mirando a la cámara y sin nada que te tape la cara.'),
    button: b('Try again', 'Intentarlo de nuevo'),
  },
  'VER-06': {
    title: b('Document video, reflections', 'Vídeo del documento, reflejos'),
    ...b('We could not see your document clearly. Tilt it a little to avoid reflections and keep it inside the frame.', 'No hemos visto bien tu documento. Inclínalo un poco para evitar reflejos y mantenlo dentro del recuadro.'),
    button: b('Try again', 'Intentarlo de nuevo'),
  },
  'VER-07': {
    title: b('Document needs a person', 'El documento necesita a una persona'),
    ...b('We could not confirm your document with the chip. A person from the administration will look at your case. You do not need to do anything now. We will tell you here.', 'No hemos podido confirmar tu documento con el chip. Una persona de la Administración revisará tu caso. Ahora no tienes que hacer nada. Te avisaremos aquí.'),
  },
  'ASS-01': {
    title: b('Helper and applicant (assisted mode)', 'Quien ayuda y quien se registra (modo asistido)'),
    ...b(
      "For the helper: please let the applicant read, decide and answer. The applicant's result will not be shown to you. For the applicant: You are registering yourself. {helper} is only helping you with the phone. You decide every answer, and you can stop at any time. Do you want to go on?",
      'Para quien ayuda: deja que la persona que se registra lea, decida y responda. No se te mostrará su resultado. Para la persona que se registra: Te estás registrando tú. {helper} solo te ayuda con el móvil. Tú decides todas las respuestas y puedes parar cuando quieras. ¿Quieres continuar?',
    ),
    forHelper: b("For the helper: please let the applicant read, decide and answer. The applicant's result will not be shown to you.", 'Para quien ayuda: deja que la persona que se registra lea, decida y responda. No se te mostrará su resultado.'),
    forApplicant: b('For the applicant: You are registering yourself. {helper} is only helping you with the phone. You decide every answer, and you can stop at any time. Do you want to go on?', 'Para la persona que se registra: Te estás registrando tú. {helper} solo te ayuda con el móvil. Tú decides todas las respuestas y puedes parar cuando quieras. ¿Quieres continuar?'),
    buttons: [b('Yes, I want to register myself', 'Sí, quiero registrarme yo'), b('No, stop', 'No, parar')],
  },
  'ASS-02': {
    title: b('Own mobile number', 'Tu propio número de móvil'),
    ...b("Use your own mobile number. A mobile number can belong to only one person's Cl@ve, so the number of the person helping you cannot be used.", 'Usa tu propio número de móvil. Un número de móvil solo puede estar asociado a la Cl@ve de una persona, así que no se puede usar el número de quien te ayuda.'),
  },
  'ASS-03': {
    title: b('End of session for the helper', 'Fin de la sesión para quien ayuda'),
    ...b('The session is finished. {applicant} will get the result on their own phone. For privacy, we do not show it here.', 'La sesión ha terminado. {applicant} recibirá el resultado en su propio móvil. Por privacidad, no lo mostramos aquí.'),
  },
  'MIN-01': {
    title: b('Guardian', 'Madre, padre o tutor'),
    ...b('You are registering a child you are responsible for. We will ask you to confirm your identity and to upload proof that you are their parent or legal guardian. The child must be with you and takes part in the checks. A person will review your proof before the registration is approved.', 'Vas a registrar a un menor a tu cargo. Te pediremos que confirmes tu identidad y que subas un documento que acredite que eres su padre, su madre o su tutor legal. El menor debe estar contigo y participa en las comprobaciones. Una persona revisará tu documento antes de aprobar el registro.'),
    button: b('I understand and continue', 'Lo entiendo y continúo'),
  },
  'MIN-02': {
    title: b('Message to the child', 'Mensaje para el menor'),
    ...b('Hello. Your parent or guardian is helping you get your Cl@ve. We check your document and your face to be sure it is you. If something is not clear, ask the adult with you, or ask us to put you in touch with a person.', 'Hola. Tu padre, madre o tutor te está ayudando a conseguir tu Cl@ve. Comprobamos tu documento y tu cara para estar seguros de que eres tú. Si algo no está claro, pregunta al adulto que está contigo o pídenos hablar con una persona.'),
  },

  /* ------------------------------------------------------ 3.3 the five statuses */
  'STA-1': {
    title: b('Received', 'Recibida'),
    ...b('We have received your request. We will tell you here, and by the contact details you gave us, as soon as something changes.', 'Hemos recibido tu solicitud. Te avisaremos aquí, y con los datos de contacto que nos has dado, en cuanto haya novedades.'),
  },
  'STA-2': {
    title: b('Checking', 'En comprobación'),
    ...b('We are checking your document and your data. You do not need to do anything. We will tell you here when we have a result.', 'Estamos comprobando tu documento y tus datos. No tienes que hacer nada. Te diremos aquí cuando tengamos un resultado.'),
    /** Add when a person is reviewing the case. */
    personReviewing: b('A person from the administration is looking at your case.', 'Una persona de la Administración está revisando tu caso.'),
  },
  'STA-3': {
    title: b('We need something from you', 'Necesitamos algo de ti'),
    ...b('To continue, we need you to do one thing. The details are below. Until you do it, your request stays open.', 'Para continuar, necesitamos que hagas una cosa. Los detalles están debajo. Hasta que la hagas, tu solicitud sigue abierta.'),
    button: b('Continue', 'Continuar'),
  },
  'STA-4': {
    title: b('Approved: basic level', 'Aprobada: nivel básico'),
    ...b('Your Cl@ve is active at the basic level. It opens most online procedures. A few, such as Cl@ve Firma, need the advanced level.', 'Tu Cl@ve está activa con el nivel básico. Con él puedes hacer la mayoría de los trámites en línea. Algunos, como Cl@ve Firma, necesitan el nivel avanzado.'),
    buttons: [b('Download receipt (PDF)', 'Descargar justificante (PDF)'), b('Open Cl@ve Móvil', 'Abrir Cl@ve Móvil')],
  },
  'STA-4B': {
    title: b('Approved: basic level. Advanced level under review', 'Aprobada: nivel básico. Nivel avanzado en revisión'),
    ...b('Your Cl@ve is active at the basic level, so you can start using it now. A person from the administration is reviewing your evidence for the advanced level. We will tell you the result here.', 'Tu Cl@ve está activa con el nivel básico, así que ya puedes usarla. Una persona de la Administración está revisando tus datos para el nivel avanzado. Te diremos aquí el resultado.'),
    buttons: [b('Download receipt (PDF)', 'Descargar justificante (PDF)'), b('Open Cl@ve Móvil', 'Abrir Cl@ve Móvil')],
  },
  'STA-4C': {
    title: b('Approved: advanced level', 'Aprobada: nivel avanzado'),
    ...b('Your Cl@ve now has the advanced level. You can use it in all the procedures that ask for it.', 'Tu Cl@ve ya tiene el nivel avanzado. Puedes usarla en todos los trámites que lo pidan.'),
    button: b('Download receipt (PDF)', 'Descargar justificante (PDF)'),
  },
  'STA-5': {
    title: b('Not approved', 'No aprobada'),
    ...b('We could not approve your request. The reason is shown below. A person made this decision, and you can ask for it to be reviewed.', 'No hemos podido aprobar tu solicitud. El motivo aparece debajo. Una persona ha tomado esta decisión y puedes pedir que se revise.'),
    button: b('Ask for a review', 'Pedir una revisión'),
  },

  /* ------------------------------------------------- 3.4 rejection explanations */
  'REJ-01': b(
    'We could not approve your request because your document has expired or is not accepted on this route. We check the validity date and the type of document, and the one you used did not pass. You can register again with a valid document, or talk to a person on a video call if you have no other document. We may ask you to show an original document that is in force. You can also ask for a person to review this decision.',
    'No hemos podido aprobar tu solicitud porque tu documento ha caducado o no se acepta en esta vía. Comprobamos la fecha de validez y el tipo de documento, y el que has usado no lo ha superado. Puedes volver a registrarte con un documento en vigor, o hablar con una persona por videollamada si no tienes otro. Puede que te pidamos un original en vigor. También puedes pedir que una persona revise esta decisión.',
  ) as Msg,
  'REJ-02': b(
    'We could not approve your request because we could not match your face with the photo in your document. This can happen when the photo is old, when you look different now or when the camera image is poor. You can talk to a person on a video call and show your original document to the camera. You can also ask for a person to review this decision.',
    'No hemos podido aprobar tu solicitud porque no hemos podido relacionar tu cara con la foto de tu documento. Puede ocurrir si la foto es antigua, si ahora tienes un aspecto distinto o si la imagen de la cámara es mala. Puedes hablar con una persona por videollamada y enseñar tu documento original a la cámara. También puedes pedir que una persona revise esta decisión.',
  ) as Msg,
  'REJ-03': b(
    'We could not approve your request because the check that confirms a live person did not finish. This often happens with low light, a weak connection or a camera that does not work well. You can try again in a well-lit place, or talk to a person on a video call. You do not need any extra documents. You can also ask for a person to review this decision.',
    'No hemos podido aprobar tu solicitud porque no se ha completado la comprobación de que hay una persona real delante de la cámara. Suele pasar con poca luz, una conexión débil o una cámara que no funciona bien. Puedes intentarlo de nuevo en un lugar con buena luz, o hablar con una persona por videollamada. No necesitas documentos adicionales. También puedes pedir que una persona revise esta decisión.',
  ) as Msg,
  'REJ-04': b(
    'We could not approve your request because we did not find your residence in the official records. This can happen if you registered recently or if a record has a mistake. You can send us a document that shows where you live, and a person will look at it. You can also ask for a person to review this decision.',
    'No hemos podido aprobar tu solicitud porque no hemos encontrado tu residencia en los registros oficiales. Puede ocurrir si te has inscrito hace poco o si hay un error en algún registro. Puedes enviarnos un documento que muestre dónde vives y una persona lo revisará. También puedes pedir que una persona revise esta decisión.',
  ) as Msg,
  'REJ-05': b(
    'We could not approve your request because some of your data is different in your document and in the official records. For example, a surname may be missing or written differently. Below we show what differs: {fields}. You can send us a document that shows your full name and data as they should appear, and ask for a review. A different person will look at it.',
    'No hemos podido aprobar tu solicitud porque algunos de tus datos son distintos en tu documento y en los registros oficiales. Por ejemplo, puede faltar un apellido o estar escrito de otra forma. Debajo te mostramos qué es distinto: {fields}. Puedes enviarnos un documento que muestre tu nombre completo y tus datos tal como deben aparecer, y pedir una revisión. La revisará otra persona.',
  ) as Msg,
  'REJ-06': b(
    'We could not approve your request because the chip in your document did not confirm the printed data. This can happen if the chip is damaged or if something on the document does not match what the chip holds. You can ask for a review and bring your original document to a video call with a person. As a last option, you can make an appointment at an office.',
    'No hemos podido aprobar tu solicitud porque el chip de tu documento no ha confirmado los datos impresos. Puede ocurrir si el chip está dañado o si algo del documento no coincide con lo que contiene el chip. Puedes pedir una revisión y llevar tu documento original a una videollamada con una persona. Como última opción, puedes pedir cita en una oficina.',
  ) as Msg,
  'REJ-07': b(
    'We could not confirm that this request comes from the person named on the document, so we could not approve it. A person reviewed the information and made this decision. If this is a mistake, you can ask for a review and talk to a person on a video call, showing your original document to the camera.',
    'No hemos podido confirmar que esta solicitud la haga la persona que figura en el documento, así que no hemos podido aprobarla. Una persona ha revisado la información y ha tomado esta decisión. Si es un error, puedes pedir una revisión y hablar con una persona por videollamada, enseñando tu documento original a la cámara.',
  ) as Msg,
  'REJ-08': b(
    "We could not approve this registration because the proof that you are the child's parent or legal guardian is missing or could not be accepted. We need it so that only a parent or guardian can register a child. You can upload a clear and complete document that shows your parental authority or guardianship. We may ask again for identity documents for you and the child. You can also ask for a person to review this decision.",
    'No hemos podido aprobar este registro porque falta el documento que acredita que eres el padre, la madre o el tutor legal del menor, o no se ha podido aceptar. Lo necesitamos para que solo un padre, una madre o un tutor puedan registrar a un menor. Puedes subir un documento claro y completo que acredite tu patria potestad o tutela. Puede que volvamos a pedir los documentos de identidad tuyos y del menor. También puedes pedir que una persona revise esta decisión.',
  ) as Msg,

  /* --------------------------------------------- 3.5 correction, appeal and help */
  'COR-01': {
    title: b('Request for more information', 'Petición de más información'),
    ...b('We need one more thing to continue: {whatWeNeed}. We ask because {reason}. You can send it from this screen. Your request stays open until you do.', 'Necesitamos una cosa más para continuar: {whatWeNeed}. Te lo pedimos porque {reason}. Puedes enviarlo desde esta pantalla. Tu solicitud sigue abierta hasta que lo envíes.'),
    button: b('Send it now', 'Enviarlo ahora'),
    example: b('Example: a clear photo of your proof of parental authority. The photo you sent is cut off on the right side.', 'Ejemplo: una foto clara de tu documento de patria potestad. La foto que has enviado está cortada por el lado derecho.'),
  },
  'COR-02': {
    title: b('Information received', 'Información recibida'),
    ...b('Thank you. We have received what you sent. A person will look at it, and we will tell you here as soon as there is a result.', 'Gracias. Hemos recibido lo que nos has enviado. Una persona lo revisará y te diremos aquí en cuanto haya un resultado.'),
  },
  'COR-03': {
    title: b('Ask for a review', 'Pedir una revisión'),
    ...b('You can ask for a person to review this decision. Tell us in a few words why you think it should change. You can add a document or a photo. A different person will look at your case.', 'Puedes pedir que una persona revise esta decisión. Cuéntanos en pocas palabras por qué crees que debería cambiar. Puedes añadir un documento o una foto. Otra persona distinta revisará tu caso.'),
    buttons: [b('Send', 'Enviar'), b('Cancel', 'Cancelar')],
    maxLength: 500,
  },
  'COR-04': {
    title: b('Review request received', 'Solicitud de revisión recibida'),
    ...b('We have received your request for a review. You do not need to send it again.', 'Hemos recibido tu solicitud de revisión. No hace falta que la envíes otra vez.'),
  },
  'COR-05': {
    title: b('Review status', 'Estado de la revisión'),
    ...b('A person is reviewing your request. If we need something else from you, we will tell you here.', 'Una persona está revisando tu solicitud. Si necesitamos algo más de ti, te lo diremos aquí.'),
  },
  'COR-06': {
    title: b('Decision corrected, approved', 'Decisión corregida, aprobada'),
    ...b('After the review, your request has been approved. The earlier decision has been corrected. Your approved status is shown below.', 'Tras la revisión, tu solicitud ha sido aprobada. La decisión anterior se ha corregido. Debajo aparece tu estado de aprobación.'),
  },
  'COR-07': {
    title: b('Decision kept', 'Decisión mantenida'),
    ...b('After a review by a person, we have kept the original decision. The reason is: {reason}. You can still talk to a person on a video call with your original documents, or ask for an appointment at an office as a last option. {legal}', 'Tras la revisión de una persona, mantenemos la decisión original. El motivo es: {reason}. Todavía puedes hablar con una persona por videollamada con tus documentos originales, o pedir cita en una oficina como última opción. {legal}'),
    legal: b('[Legal wording on further ways to challenge the decision: to be supplied by Roberto.]', '[Texto legal sobre otras vías para recurrir la decisión: lo facilita Roberto.]'),
  },
  'COR-08': {
    title: b('Approved after more information', 'Aprobada tras más información'),
    ...b('Thank you. With the information you sent, your request is approved. Your approved status is shown below.', 'Gracias. Con la información que nos has enviado, tu solicitud queda aprobada. Debajo aparece tu estado de aprobación.'),
  },
  'FALL-01': {
    title: b('Video call with an officer', 'Videollamada con una persona de la Administración'),
    ...b('You can talk to a person on a video call. Have your original document and your phone ready. If nobody is available right now, we will tell you when you can try again.', 'Puedes hablar con una persona por videollamada. Ten a mano tu documento original y tu móvil. Si ahora no hay nadie disponible, te diremos cuándo puedes volver a intentarlo.'),
    button: b('Join video call', 'Unirme a la videollamada'),
    buttons: [b('Join video call with an officer', 'Unirme a la videollamada'), b('Come back later', 'Volver más tarde')],
    waitingRoom: b('An officer will join shortly', 'Una persona de la Administración se unirá en breve'),
  },
  'FALL-02': {
    title: b('Office, last option', 'Oficina, última opción'),
    ...b('If the video call does not work for you, you can ask for an appointment at an office. Take your original documents. This is a last option.', 'Si la videollamada no te sirve, puedes pedir cita en una oficina. Lleva tus documentos originales. Es la última opción.'),
    button: b('Ask for an appointment', 'Pedir cita'),
  },
  'HELP-01': {
    title: b('Need help?', '¿Necesitas ayuda?'),
    ...b('Need help? You can ask someone you trust to help you with the phone, switch to large text, or contact 060 by phone or web chat.', '¿Necesitas ayuda? Puedes pedir a alguien de confianza que te ayude con el móvil, cambiar a letra grande o contactar con el 060 por teléfono o chat.'),
    button: b('Large text', 'Letra grande'),
  },

  /* ------------------------------------------------ 3.6 using your own AI assistant */
  'AI-01': {
    title: b('Short line (route assistant, first screen)', 'Línea breve (asistente de vía, primera pantalla)'),
    ...b('You can use an AI assistant to prepare your answers. We check everything ourselves, and you are responsible for what you send.', 'Puedes usar un asistente de IA para preparar tus respuestas. Nosotros comprobamos todo por nuestra cuenta y tú eres responsable de lo que envías.'),
  },
  'AI-02': {
    title: b('Help text', 'Texto de ayuda'),
    ...b('Want to prepare in advance? Ask your AI assistant to fill in this list and copy the answers here: nationality, type of document, document number, expiry date, full name as written on the document, date of birth, mobile number, email, and who is registering. Read every answer before you send it.', '¿Quieres prepararlo antes? Pide a tu asistente de IA que rellene esta lista y copia aquí las respuestas: nacionalidad, tipo de documento, número de documento, fecha de caducidad, nombre completo tal como figura en el documento, fecha de nacimiento, número de móvil, correo electrónico y quién se registra. Lee cada respuesta antes de enviarla.'),
  },
  'AI-03': {
    title: b('Warning', 'Aviso'),
    ...b('An AI assistant can make mistakes. If your answers do not match your document or the official records, we will ask you to correct them.', 'Un asistente de IA puede equivocarse. Si tus respuestas no coinciden con tu documento o con los registros oficiales, te pediremos que las corrijas.'),
  },
  'AI-04': {
    title: b('Final confirmation', 'Confirmación final'),
    ...b('Check your answers. By ticking this box, you confirm that the details are correct and that you are the one sending them.', 'Revisa tus respuestas. Al marcar esta casilla, confirmas que los datos son correctos y que eres tú quien los envía.'),
    checkbox: b('I confirm that my details are correct.', 'Confirmo que mis datos son correctos.'),
    button: b('Send my request', 'Enviar mi solicitud'),
  },
} satisfies Record<string, Msg>

export type MsgId = keyof typeof MSG

/* ------------------------------------------------------- 3.4 reason table */

export interface RejReasonRow {
  id: RejId
  officerLabel: Bilingual
  when: Bilingual
  canCorrect: Bilingual
  /** Plan's case that uses it. */
  usedIn: string | null
}

/** Provisional closed list (plan 3.4). EN verbatim; ES officer texts are our translation (the plan has none). */
export const REJ_REASONS: Record<RejId, RejReasonRow> = {
  'REJ-01': {
    id: 'REJ-01',
    officerLabel: b('Document expired or not valid', 'Documento caducado o no válido'),
    when: b('The document is past its validity date or its type is not accepted on this route', 'El documento ha superado su fecha de validez o su tipo no se acepta en esta vía'),
    canCorrect: b('Yes, with a valid document or a video call', 'Sí, con un documento en vigor o una videollamada'),
    usedIn: null,
  },
  'REJ-02': {
    id: 'REJ-02',
    officerLabel: b('Face does not match the document', 'La cara no coincide con el documento'),
    when: b('Face match is low and the officer cannot reconcile it on the stills or the video call', 'La coincidencia facial es baja y la persona funcionaria no puede resolverlo con las imágenes o la videollamada'),
    canCorrect: b('Yes, on a video call with the original document', 'Sí, en una videollamada con el documento original'),
    usedIn: null,
  },
  'REJ-03': {
    id: 'REJ-03',
    officerLabel: b('Live-person check not completed', 'Comprobación de persona real no completada'),
    when: b('The liveness check failed on the retries and no other evidence arrived', 'La prueba de vida falló en los reintentos y no llegó ninguna otra prueba'),
    canCorrect: b('Yes, by trying again in better conditions or by video call', 'Sí, intentándolo de nuevo en mejores condiciones o por videollamada'),
    usedIn: null,
  },
  'REJ-04': {
    id: 'REJ-04',
    officerLabel: b('Residence not found in records', 'Residencia no encontrada en los registros'),
    when: b('No residence record was found after the check', 'No se encontró ningún registro de residencia tras la comprobación'),
    canCorrect: b('Yes, by sending proof of residence', 'Sí, enviando un justificante de residencia'),
    usedIn: null,
  },
  'REJ-05': {
    id: 'REJ-05',
    officerLabel: b('Data does not match records', 'Los datos no coinciden con los registros'),
    when: b('Name, date of birth or number differs between the document and the records and the officer cannot reconcile it', 'El nombre, la fecha de nacimiento o el número difieren entre el documento y los registros y la persona funcionaria no puede conciliarlo'),
    canCorrect: b('Yes, by sending a supporting document', 'Sí, enviando un documento que lo acredite'),
    usedIn: 'GYC-08',
  },
  'REJ-06': {
    id: 'REJ-06',
    officerLabel: b('Document could not be verified', 'No se ha podido verificar el documento'),
    when: b('The chip signature is invalid or the printed data does not match the chip', 'La firma del chip no es válida o los datos impresos no coinciden con el chip'),
    canCorrect: b('Yes, by a video call with the original document', 'Sí, en una videollamada con el documento original'),
    usedIn: 'GYC-07',
  },
  'REJ-07': {
    id: 'REJ-07',
    officerLabel: b('Suspected fraud', 'Sospecha de fraude'),
    when: b('Several independent signals and evidence the officer has reviewed. Never used on one signal alone', 'Varias señales independientes y pruebas que la persona funcionaria ha revisado. Nunca con una sola señal'),
    canCorrect: b('Review and video call', 'Revisión y videollamada'),
    usedIn: 'GYC-06',
  },
  'REJ-08': {
    id: 'REJ-08',
    officerLabel: b('Proof of parental authority missing or not valid', 'Acreditación de patria potestad ausente o no válida'),
    when: b('The proof for a minor is absent, unreadable or not accepted', 'La acreditación del menor falta, no se lee o no se acepta'),
    canCorrect: b('Yes, by uploading a valid proof', 'Sí, subiendo una acreditación válida'),
    usedIn: 'GYC-04',
  },
}

export const REJ_ORDER: RejId[] = ['REJ-01', 'REJ-02', 'REJ-03', 'REJ-04', 'REJ-05', 'REJ-06', 'REJ-07', 'REJ-08']

/** Fills {placeholders}. Unknown placeholders are left as they are. */
export function fillMsg(text: string, vars: Record<string, string | number | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m))
}

/** A message in one language with placeholders filled. */
export function msgText(id: MsgId, lang: 'en' | 'es', vars: Record<string, string | number | undefined> = {}): string {
  return fillMsg((MSG[id] as Msg)[lang], vars)
}
