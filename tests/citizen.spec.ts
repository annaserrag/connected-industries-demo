/**
 * Citizen journey (SPEC §5) on a 390 px phone, Spanish (default). Every outcome comes from the typed data, the
 * simulated world, the simulated-camera input and the officer actions (run from a second tab of the same browser,
 * so the BroadcastChannel sync is exercised).
 * Run: PORT=5181 npx playwright test -c pw.local.config.ts tests/citizen.spec.ts
 * Screenshots: $CITIZEN_SHOTS (default /tmp/citizen-shots)
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { DEMO_PEOPLE } from '../src/contract/world'
import { DEMO_SMS_BANNER, MSG } from '../src/contract/messages'
import { C } from '../src/citizen/copy'

const SHOTS = process.env.CITIZEN_SHOTS ?? '/tmp/citizen-shots'
const PHONE = { width: 390, height: 844 }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const es = (b: { es: string }) => b.es
const person = (id: string) => DEMO_PEOPLE.find(p => p.caseId === id || (id === 'giulia' && p.caseRef === 'GYC-01'))!

async function citizenPage(ctx: BrowserContext, errors: string[]) {
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(`[citizen] ${m.text()}`) })
  page.on('pageerror', e => errors.push(`[citizen] ${e.message}`))
  await page.goto('/#/citizen')
  await page.waitForFunction(() => Boolean(window.__clave))
  await page.evaluate(() => {
    const k = window.__clave!
    k.setEngineSpeed(0.2)
    k.actions.resetDemo()
    k.actions.citizenSignOut()
    k.actions.officerSignOut()
    k.actions.setLang('es')
  })
  await page.goto('/#/citizen')
  return page
}

async function officerPage(ctx: BrowserContext, officerId = 'OF-DEMO-07') {
  const page = await ctx.newPage()
  await page.goto('/#/')
  await page.waitForFunction(() => Boolean(window.__clave))
  await page.evaluate(id => window.__clave!.actions.officerSignIn(id), officerId)
  return page
}

const officer = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([f, a]) => (window.__clave!.actions as unknown as Record<string, (...x: unknown[]) => unknown>)[f as string](...(a as unknown[])), [fn, args] as const)

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })

async function noHorizontalScroll(page: Page) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(w, 'no horizontal scroll').toBeLessThanOrEqual(0)
}

async function signIn(page: Page, id: string) {
  const p = person(id)
  await page.getByTestId('signin-doc').fill(p.account.documentNumber)
  await page.getByTestId('signin-password').fill(p.account.password)
  await page.getByTestId('signin-form').getByRole('button', { name: es(C.signInCta), exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/citizen/start/${id}`))
}

/** Route assistant: one question per screen. `doc` is the RA-03 option text, answers by visible label. */
async function assistant(page: Page, a: { doc: string; euEid?: string; who: string; nfc?: string }) {
  await expect(page.getByTestId('msg-AI-01')).toBeVisible()
  await page.getByTestId('ra-next').click()
  await page.getByTestId('ra-03').getByText(a.doc, { exact: true }).click()
  await page.getByTestId('ra-next').click()
  if (a.euEid) { await page.getByTestId('ra-04').getByText(a.euEid, { exact: true }).click(); await page.getByTestId('ra-next').click() }
  await page.getByTestId('ra-05').getByText(a.who, { exact: true }).click()
  await page.getByTestId('ra-next').click()
  if (a.nfc) { await page.getByTestId('ra-06').getByText(a.nfc, { exact: true }).click(); await page.getByTestId('ra-next').click() }
  await expect(page.getByTestId('recommended-route')).toBeVisible()
}

async function consent(page: Page, boxes: Array<'face' | 'residence'>) {
  await expect(page.getByTestId('consent-accept')).toBeDisabled()
  for (const b of boxes) await page.getByTestId(`consent-${b}`).check()
  await expect(page.getByTestId('consent-accept')).toBeEnabled()
  await page.getByTestId('consent-accept').click()
}

async function contactAndReview(page: Page, opts: { mobile?: string } = {}) {
  await expect(page.getByTestId('contact-step')).toBeVisible()
  if (opts.mobile) await page.getByTestId('contact-mobile').fill(opts.mobile)
  await page.getByTestId('send-code').click()
  await expect(page.getByTestId('demo-code-banner')).toHaveText(DEMO_SMS_BANNER.es)
  await page.getByTestId('sms-code').fill('000000')
  await page.getByTestId('confirm-code').click()
  await expect(page.getByText(es(C.wrongCode))).toBeVisible()
  await page.getByTestId('sms-code').fill('123456')
  await page.getByTestId('confirm-code').click()
  await expect(page.getByTestId('review-step')).toBeVisible()
  await expect(page.getByTestId('submit-application')).toBeDisabled()
  await page.getByTestId('review-confirm').check()
}

test.describe('citizen journey (phone, ES)', () => {
  test.use({ viewport: PHONE })

  test('GYC-01 Giulia typed from scratch, route A → approved basic', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    const g = person('giulia').account
    await page.goto('/#/citizen?mode=signup')
    await expect(page.getByTestId('msg-AI-02')).toBeVisible()
    // a DNI-shaped number with a REAL check letter is refused in plain words
    await page.getByTestId('signup-given').fill(g.givenNames)
    await page.getByTestId('signup-surnames').fill(g.surnames)
    await page.getByTestId('signup-dob').fill(g.dateOfBirth)
    await page.getByTestId('signup-country').selectOption({ label: 'Italia' })
    await page.getByTestId('signup-doc').getByText('eID nacional de la UE').click()
    await page.getByTestId('signup-number').fill('12345678Z')
    await page.getByTestId('signup-expiry').fill(g.expiryDate)
    await page.getByTestId('signup-password').fill(g.password)
    await page.getByTestId('signup-password2').fill(g.password)
    await page.getByTestId('signup-form').getByRole('button', { name: es(C.createAccountCta) }).click()
    await expect(page.getByText(es(C.errRealNumber)).first()).toBeVisible()
    await page.getByTestId('signup-number').fill(g.documentNumber)
    await shot(page, 'giulia-01-signup')
    await page.getByTestId('signup-form').getByRole('button', { name: es(C.createAccountCta) }).click()
    await expect(page.getByTestId('signup-welcome')).toBeVisible()
    await page.getByRole('button', { name: es(C.startApplication) }).click()

    await assistant(page, { doc: es(MSG['RA-03'].options[1]), euEid: 'Sí', who: es(MSG['RA-05'].options[0]) })
    await expect(page.getByTestId('msg-RA-07A')).toBeVisible()
    await expect(page.getByTestId('recommended-route').getByTestId('proposed-rule')).toHaveCount(0)
    await shot(page, 'giulia-02-route-A')
    await page.getByTestId('ra-confirm').click()

    await expect(page.getByTestId('consent-face')).toHaveCount(0)
    await shot(page, 'giulia-03-consent')
    await consent(page, ['residence'])
    await expect(page.getByTestId('eid-login')).toHaveText('Iniciar sesión como Giulia Ferri (demo)')
    await shot(page, 'giulia-04-eid')
    await page.getByTestId('eid-login').click()
    await contactAndReview(page)
    await shot(page, 'giulia-05-review')
    await page.getByTestId('submit-application').click()
    await expect(page).toHaveURL(/\/citizen\/case\//)
    await expect(page.getByTestId('msg-STA-4')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('download-receipt')).toBeVisible()
    await page.getByTestId('open-clave-movil').click()
    await expect(page.getByText(es(C.claveMovilBody))).toBeVisible()
    await page.keyboard.press('Escape')
    await noHorizontalScroll(page)
    await shot(page, 'giulia-06-approved')
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('GYC-02 Kenji: chip fails twice → video call room → officer starts the call and approves → STA-4B', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    await signIn(page, 'kenji')
    await assistant(page, { doc: es(MSG['RA-03'].options[3]), who: es(MSG['RA-05'].options[0]), nfc: 'No lo sé' })
    await expect(page.getByTestId('msg-RA-07B')).toBeVisible()
    await expect(page.getByTestId('recommended-route').getByTestId('proposed-rule')).toBeVisible()
    await page.getByTestId('ra-confirm').click()
    await consent(page, ['face', 'residence'])
    await page.getByTestId('chip-read').click()
    await expect(page.getByTestId('msg-VER-03')).toBeVisible()
    await shot(page, 'kenji-01-ver03')
    await page.getByTestId('chip-read').click()
    await expect(page.getByTestId('msg-VER-04')).toBeVisible()
    await shot(page, 'kenji-02-ver04')
    await page.getByTestId('join-video-call').click()
    await expect(page.getByTestId('waiting-room')).toHaveText(es(MSG['FALL-01'].waitingRoom))
    await shot(page, 'kenji-03-waiting-room')

    const off = await officerPage(ctx)
    await officer(off, 'officerStartVideoCall', 'kenji')
    await page.bringToFront()
    await expect(page.getByTestId('video-room')).toHaveAttribute('data-call-state', 'live')
    await expect(page.getByTestId('officer-tile')).toContainText('Lucía Vega')
    await expect(page.getByTestId('officer-tile')).toContainText('En llamada')
    await shot(page, 'kenji-04-in-call')
    await officer(off, 'officerApproveBasic', 'kenji')
    await page.bringToFront()
    await expect(page.getByTestId('msg-STA-4B')).toBeVisible()
    await shot(page, 'kenji-05-approved-4B')
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('GYC-03 Ernesto assisted, route C: reflections then person; helper number refused; helper sees ASS-03 only', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    await signIn(page, 'ernesto')
    await assistant(page, { doc: es(MSG['RA-03'].options[0]), who: es(MSG['RA-05'].options[1]) })
    await expect(page.getByTestId('route-assistant')).toHaveAttribute('data-large-text', '1')
    await expect(page.getByTestId('msg-RA-07C')).toBeVisible()
    await expect(page.getByTestId('recommended-route').getByTestId('proposed-rule')).toBeVisible()
    await page.getByTestId('ra-confirm').click()

    await expect(page.getByTestId('helper-form')).toBeVisible()
    await shot(page, 'ernesto-01-helper-form')
    await page.getByTestId('helper-continue').click()
    await expect(page.getByTestId('assisted-header')).toHaveText('Se registra: Ernesto Navarro · Ayuda: Marta Navarro (familiar)')
    await shot(page, 'ernesto-02-ass01')
    await page.getByTestId('ass01-yes').click()
    // large text ≥ 20 px for the rest of the session
    const size = await page.getByTestId('msg-CON-01').locator('p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(20)
    await shot(page, 'ernesto-03-consent')
    await consent(page, ['face', 'residence'])
    await page.getByTestId('camera-reflections').check()
    await page.getByTestId('video-run').click()
    await expect(page.getByTestId('msg-VER-06')).toBeVisible()
    await shot(page, 'ernesto-04-ver06')
    await page.getByTestId('camera-person').check()
    await page.getByTestId('video-run').click()
    await expect(page.getByTestId('video-passed')).toBeVisible()
    await page.getByTestId('step-continue').click()

    await expect(page.getByTestId('msg-ASS-02')).toBeVisible()
    await page.getByTestId('contact-mobile').fill(person('ernesto').helper!.mobile)
    await page.getByTestId('send-code').click()
    await expect(page.getByText(es(MSG['ASS-02'])).nth(1)).toBeVisible()
    await shot(page, 'ernesto-05-helper-number-refused')
    await contactAndReview(page, { mobile: person('ernesto').contact.mobile })
    await page.getByTestId('submit-application').click()
    await expect(page.getByTestId('helper-done')).toBeVisible()
    await expect(page.getByTestId('msg-ASS-03')).toContainText('Ernesto Navarro recibirá el resultado en su propio móvil')
    await expect(page.getByTestId('result-approved')).toHaveCount(0)
    await shot(page, 'ernesto-06-ass03')
    // the result arrives for Ernesto (advanced level queued), never on the helper's screen
    await expect.poll(() => page.evaluate(() => window.__clave!.getState().cases.ernesto.advanced), { timeout: 15_000 }).toBe('pending_review')
    await expect(page.getByTestId('result-approved')).toHaveCount(0)
    await page.getByTestId('helper-signout').click()
    await expect(page.getByTestId('signin-form')).toBeVisible()
    await signInAgain(page, 'ernesto')
    await expect(page.getByTestId('msg-STA-4B')).toBeVisible()
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('GYC-06 Applicant X: synthetic video twice → FALL-01 → come back later → STA-2 with a person reviewing', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    await signIn(page, 'applicant-x')
    await assistant(page, { doc: es(MSG['RA-03'].options[2]), euEid: 'No', who: es(MSG['RA-05'].options[0]), nfc: 'Sí' })
    await page.getByTestId('ra-confirm').click()
    await consent(page, ['face', 'residence'])
    await page.getByTestId('chip-read').click()
    await expect(page.getByTestId('chip-ok')).toHaveText(es(MSG['VER-01'].success))
    await page.getByTestId('step-continue').click()
    await expect(page.getByTestId('camera-control')).toBeVisible()
    await expect(page.getByTestId('camera-person')).toBeChecked()
    await page.getByTestId('camera-synthetic').check()
    await page.getByTestId('face-run').click()
    await expect(page.getByTestId('msg-VER-05')).toBeVisible()
    await expect(page.getByTestId('face-scores')).toContainText('valores simulados')
    await shot(page, 'applicantx-01-ver05')
    await page.getByTestId('face-run').click()
    await expect(page.getByTestId('msg-FALL-01')).toBeVisible()
    await shot(page, 'applicantx-02-fall01')
    await page.getByTestId('come-back-later').click()
    await expect(page.getByTestId('msg-STA-2')).toBeVisible()
    await expect(page.getByTestId('person-reviewing')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/fraude|fraud/i)
    const risk = await page.evaluate(() => window.__clave!.getState().cases['applicant-x'].risk)
    expect(risk).toBe('high')
    await shot(page, 'applicantx-03-sta2')
    // officer refuses with REJ-07 → STA-5 + REJ-07, review and video-call options
    const off = await officerPage(ctx)
    await officer(off, 'officerRefuse', 'applicant-x', 'REJ-07', 'internal note')
    await page.bringToFront()
    await expect(page.getByTestId('msg-STA-5')).toBeVisible()
    await expect(page.getByTestId('msg-REJ-07')).toBeVisible()
    await expect(page.getByTestId('book-video-call')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('internal note')
    await shot(page, 'applicantx-04-refused')
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('GYC-04 minor: guardian check, proof upload, minor chip + face; officer asks for more info; reply → COR-02', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    await signIn(page, 'laura')
    await assistant(page, { doc: es(MSG['RA-03'].options[3]), who: es(MSG['RA-05'].options[2]), nfc: 'Sí' })
    await page.getByTestId('ra-confirm').click()
    await expect(page.getByTestId('msg-MIN-01')).toBeVisible()
    await page.getByTestId('ack-MIN-01').click()
    await page.getByTestId('guardian-run').click()
    await expect(page.getByTestId('guardian-passed')).toBeVisible()
    await page.getByTestId('step-continue').click()
    await expect(page.getByTestId('proof-continue')).toBeDisabled()
    await page.getByTestId('proof-upload').setInputFiles({ name: 'patria-potestad.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('proof-upload-preview')).toBeVisible()
    await shot(page, 'laura-01-proof')
    await page.getByTestId('proof-continue').click()
    await expect(page.getByTestId('minor-given')).toHaveValue('Mateo')
    await page.getByTestId('minor-continue').click()
    await expect(page.getByTestId('msg-MIN-02')).toBeVisible()
    await page.getByTestId('ack-MIN-02').click()
    await consent(page, ['face', 'residence'])
    await page.getByTestId('chip-read').click()
    await page.getByTestId('step-continue').click()
    await page.getByTestId('face-run').click()
    await expect(page.getByTestId('face-passed')).toBeVisible()
    await page.getByTestId('step-continue').click()
    await expect(page.getByTestId('contact-mobile')).toHaveValue('+34 600 000 004')
    await contactAndReview(page)
    await page.getByTestId('submit-application').click()
    await expect(page.getByTestId('person-reviewing')).toBeVisible({ timeout: 15_000 })

    const off = await officerPage(ctx)
    await officer(off, 'officerRequestInfo', 'laura', 'una foto clara de tu documento de patria potestad', 'la foto que has enviado está cortada por el lado derecho')
    await page.bringToFront()
    await expect(page.getByTestId('msg-COR-01')).toContainText('una foto clara de tu documento de patria potestad')
    await shot(page, 'laura-02-cor01')
    await page.getByTestId('info-upload').setInputFiles({ name: 'patria-potestad-2.png', mimeType: 'image/png', buffer: PNG })
    await page.getByTestId('info-send').click()
    await expect(page.getByTestId('msg-COR-02')).toBeVisible()
    await officer(off, 'officerApproveBasic', 'laura')
    await page.bringToFront()
    await expect(page.getByTestId('msg-COR-08')).toBeVisible()
    await expect(page.getByTestId('msg-STA-4')).toBeVisible()
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('GYC-05 Daniel, route X: passport chip + face, red card upload (prefilled number), no CON-04', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    await signIn(page, 'daniel')
    await page.getByTestId('ra-nationality').selectOption({ label: 'Venezuela' })
    await page.getByTestId('ra-next').click()
    await page.getByTestId('ra-03').getByText(es(MSG['RA-03'].options[5]), { exact: true }).click()
    await page.getByTestId('ra-next').click()
    await page.getByTestId('ra-05').getByText(es(MSG['RA-05'].options[0]), { exact: true }).click()
    await page.getByTestId('ra-next').click()
    await expect(page.getByTestId('msg-RA-07X')).toBeVisible()
    await expect(page.getByTestId('recommended-route').getByTestId('proposed-rule')).toBeVisible()
    await page.getByTestId('ra-confirm').click()
    await expect(page.getByTestId('consent-residence')).toHaveCount(0)
    await consent(page, ['face'])
    await page.getByTestId('passport-continue').click()
    await page.getByTestId('chip-read').click()
    await page.getByTestId('step-continue').click()
    await page.getByTestId('face-run').click()
    await page.getByTestId('step-continue').click()
    await expect(page.getByTestId('redcard-number')).toHaveValue('DEMO-0005')
    await page.getByTestId('redcard-upload').setInputFiles({ name: 'tarjeta-roja.png', mimeType: 'image/png', buffer: PNG })
    await shot(page, 'daniel-01-redcard')
    await page.getByTestId('redcard-continue').click()
    await contactAndReview(page)
    await page.getByTestId('submit-application').click()
    await expect(page.getByTestId('person-reviewing')).toBeVisible({ timeout: 15_000 })
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('GYC-07 Rafael: chip signature invalid → VER-07, no score, no fraud word', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    await signIn(page, 'rafael')
    await assistant(page, { doc: es(MSG['RA-03'].options[3]), who: es(MSG['RA-05'].options[0]), nfc: 'Sí' })
    await page.getByTestId('ra-confirm').click()
    await consent(page, ['face', 'residence'])
    await page.getByTestId('chip-read').click()
    await expect(page.getByTestId('msg-VER-07')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/fraude|fraud|score|puntuación/i)
    await page.getByTestId('see-status').click()
    await expect(page.getByTestId('msg-STA-2')).toBeVisible()
    await expect(page.getByTestId('msg-VER-07')).toBeVisible()
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('GYC-08 Valentina: refused REJ-05 → review request (≤ 500 chars + image) → second officer approves → COR-06 + STA-4B', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    await signIn(page, 'valentina')
    await assistant(page, { doc: es(MSG['RA-03'].options[3]), who: es(MSG['RA-05'].options[0]), nfc: 'Sí' })
    await page.getByTestId('ra-confirm').click()
    await consent(page, ['face', 'residence'])
    await page.getByTestId('chip-read').click()
    await page.getByTestId('step-continue').click()
    await page.getByTestId('face-run').click()
    await page.getByTestId('step-continue').click()
    await contactAndReview(page)
    await page.getByTestId('submit-application').click()
    await expect(page.getByTestId('person-reviewing')).toBeVisible({ timeout: 15_000 })
    const vega = await officerPage(ctx)
    await officer(vega, 'officerRefuse', 'valentina', 'REJ-05')
    await page.bringToFront()
    await expect(page.getByTestId('msg-REJ-05')).toContainText('apellidos')
    await page.getByTestId('ask-review').click()
    await page.getByTestId('review-text').fill('x'.repeat(520))
    await expect(page.getByTestId('review-text')).toHaveValue('x'.repeat(500))
    await expect(page.getByText('Quedan 0 caracteres')).toBeVisible()
    await page.getByTestId('review-text').fill('Mi nombre completo es Valentina Rojas Gómez; adjunto mi pasaporte.')
    await page.getByTestId('review-upload').setInputFiles({ name: 'pasaporte.png', mimeType: 'image/png', buffer: PNG })
    await shot(page, 'valentina-01-review-form')
    await page.getByTestId('review-send').click()
    await expect(page.getByTestId('msg-COR-04')).toBeVisible()
    await expect(page.getByTestId('msg-COR-05')).toBeVisible()
    const ortiz = await officerPage(ctx, 'OF-DEMO-12')
    await officer(ortiz, 'officerDecideAppeal', 'valentina', 'approve')
    await page.bringToFront()
    await expect(page.getByTestId('msg-COR-06')).toBeVisible()
    await expect(page.getByTestId('msg-STA-4B')).toBeVisible()
    await shot(page, 'valentina-02-corrected')
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('consent: boxes start unticked, "No acepto" → CON-06 with Volver and video call; help panel large text persists', async ({ browser }) => {
    const errors: string[] = []
    const ctx = await browser.newContext({ viewport: PHONE })
    const page = await citizenPage(ctx, errors)
    await signIn(page, 'valentina')
    await assistant(page, { doc: es(MSG['RA-03'].options[3]), who: es(MSG['RA-05'].options[0]), nfc: 'Sí' })
    await page.getByTestId('ra-confirm').click()
    await expect(page.getByTestId('consent-face')).not.toBeChecked()
    await expect(page.getByTestId('consent-residence')).not.toBeChecked()
    await page.getByTestId('consent-face').check()
    await expect(page.getByTestId('consent-accept')).toBeDisabled()
    await page.getByTestId('consent-decline').click()
    await expect(page.getByTestId('msg-CON-06')).toBeVisible()
    await shot(page, 'consent-01-con06')
    await page.getByTestId('con06-back').click()
    await expect(page.getByTestId('consent-accept')).toBeDisabled()
    await page.getByTestId('consent-decline').click()
    await page.getByTestId('con06-video').click()
    await expect(page.getByTestId('waiting-room')).toBeVisible()

    await expect(page.getByTestId('msg-HELP-01')).toBeVisible()
    await page.getByTestId('msg-HELP-01').getByRole('switch').click()
    await page.reload()
    await expect(page.getByTestId('citizen-shell')).toHaveAttribute('data-large-text', '1')
    const size = await page.getByTestId('msg-HELP-01').locator('p').evaluate(el => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(20)
    await page.getByTestId('msg-HELP-01').getByRole('switch').click()
    expect(errors).toEqual([])
    await ctx.close()
  })
})

async function signInAgain(page: Page, id: string) {
  const p = person(id)
  await page.getByTestId('signin-doc').fill(p.account.documentNumber)
  await page.getByTestId('signin-password').fill(p.account.password)
  await page.getByTestId('signin-form').getByRole('button', { name: es(C.signInCta), exact: true }).click()
}

test('landing: citizen and public-employee entries, RA-01 hero, no horizontal scroll (390 px and 1440 px)', async ({ browser }) => {
  for (const viewport of [PHONE, { width: 1440, height: 900 }]) {
    const ctx = await browser.newContext({ viewport })
    const page = await ctx.newPage()
    await page.goto('/#/')
    await page.waitForFunction(() => Boolean(window.__clave))
    await page.evaluate(() => window.__clave!.actions.setLang('es'))
    await page.reload()
    await expect(page.getByTestId('msg-RA-01')).toHaveText(MSG['RA-01'].title.es)
    await expect(page.getByTestId('landing-citizen')).toContainText('Soy ciudadano/a')
    await expect(page.getByTestId('landing-officer')).toContainText('Soy empleado/a público/a')
    await noHorizontalScroll(page)
    await shot(page, `landing-${viewport.width}`)
    await ctx.close()
  }
})
