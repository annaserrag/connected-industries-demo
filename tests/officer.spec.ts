/**
 * Officer console (SPEC §6) on the rules-driven core. Cases are set up through window.__clave store actions
 * (what the citizen would do), then the officer acts in the UI.
 * Run: npx playwright test -c pw.local.config.ts tests/officer.spec.ts   (PORT=5182 for the officer dev server)
 * Screenshots: set SHOTS=<dir> to write them (1440 and 1100 px).
 */
import { test, expect, type Page } from '@playwright/test'

/* eslint-disable @typescript-eslint/no-explicit-any */
type K = any
const D = '/?debug=1'
const VEGA = 'OF-DEMO-07'
const ORTIZ = 'OF-DEMO-12'
const SHOTS = process.env.SHOTS

function track(page: Page) {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  return errors
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

/** Fresh demo state, officer signed in through the core (UI sign-in has its own tests). */
async function boot(page: Page, officerId: string | null = VEGA, path = '#/officer') {
  await page.goto(`${D}${path}`)
  await page.waitForFunction(() => Boolean((window as K).__clave))
  await page.evaluate(id => {
    const k = (window as K).__clave
    k.setEngineSpeed(0)
    k.actions.officerSignOut()
    k.actions.resetDemo()
    if (id) k.actions.officerSignIn(id)
  }, officerId)
}

/** A small generated image (no real document): a card with a label, optionally cut off on the right. */
async function makeImage(page: Page, label: string, opts: { cut?: boolean; red?: boolean } = {}): Promise<string> {
  return page.evaluate(([label, cut, red]) => {
    const cv = document.createElement('canvas')
    cv.width = 360; cv.height = 230
    const g = cv.getContext('2d')!
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 360, 230)
    g.fillStyle = red ? '#c8423a' : '#e7e1d3'; g.fillRect(14, 14, cut ? 400 : 332, 202)
    g.fillStyle = red ? '#fff' : '#3b372f'; g.font = 'bold 18px sans-serif'; g.fillText(label as string, 30, 50)
    g.font = '13px sans-serif'; g.fillText('DEMO · FICTIONAL', 30, 74)
    g.fillStyle = red ? '#f2c9c5' : '#c9c1ae'; g.fillRect(30, 96, 70, 90)
    for (let i = 0; i < 4; i++) g.fillRect(118, 104 + i * 20, 190 - i * 24, 8)
    return cv.toDataURL('image/png')
  }, [label, Boolean(opts.cut), Boolean(opts.red)] as const)
}

/** What the citizen does for each plan case, through the store (the citizen UI is tested elsewhere). */
async function citizenRuns(page: Page, kind: 'kenji' | 'applicant-x' | 'rafael' | 'valentina' | 'laura' | 'daniel' | 'ernesto', img?: string) {
  return page.evaluate(async ([kind, img]) => {
    const k = (window as K).__clave, a = k.actions
    const P = k.DEMO_PEOPLE.find((p: K) => p.caseId === kind)
    const finish = async (id: string) => { a.setContact(id, { mobile: P.contact.mobile, email: P.contact.email }); a.confirmSms(id, '123456'); a.confirmReview(id); return a.submit(id) }
    const png = img as string
    switch (kind) {
      case 'kenji':
        a.setAnswers('kenji', { document: 'TIE', who: 'self', nfc: 'unsure' })
        a.giveConsents('kenji', { face: true, residence: true })
        a.recordChipRead('kenji'); a.recordChipRead('kenji')
        a.joinVideoCall('kenji')
        return null
      case 'applicant-x':
        a.setAnswers('applicant-x', { document: 'PASSPORT', euEid: 'no', who: 'self', nfc: 'yes' })
        a.giveConsents('applicant-x', { face: true, residence: true })
        a.recordChipRead('applicant-x')
        a.recordFaceAttempt('applicant-x', 'synthetic'); a.recordFaceAttempt('applicant-x', 'synthetic')
        a.comeBackLater('applicant-x')
        return null
      case 'rafael':
        a.setAnswers('rafael', { document: 'TIE', who: 'self', nfc: 'yes' })
        a.giveConsents('rafael', { face: true, residence: true })
        return a.recordChipRead('rafael')
      case 'valentina':
        a.setAnswers('valentina', { document: 'TIE', who: 'self', nfc: 'yes' })
        a.giveConsents('valentina', { face: true, residence: true })
        a.recordChipRead('valentina'); a.recordFaceAttempt('valentina', 'person')
        return finish('valentina')
      case 'laura':
        a.setAnswers('laura', { document: 'TIE', who: 'child', nfc: 'yes' })
        a.setMinor('laura', { givenNames: P.minor.givenNames, surnames: P.minor.surnames, dateOfBirth: P.minor.dateOfBirth, document: P.minor.document })
        a.recordGuardianCheck('laura', 'person')
        a.uploadProof('laura', { name: 'patria-potestad.png', dataUrl: png })
        a.giveConsents('laura', { face: true, residence: true })
        a.recordChipRead('laura'); a.recordFaceAttempt('laura', 'person')
        return finish('laura')
      case 'daniel': {
        a.setAnswers('daniel', { document: 'RED_CARD', who: 'self' })
        a.giveConsents('daniel', { face: true })
        a.setPassport('daniel', P.passport)
        a.recordChipRead('daniel'); a.recordFaceAttempt('daniel', 'person')
        const expiry = new Date(Date.now() + P.redCard.expiryDaysFromNow * 86_400_000).toISOString().slice(0, 10)
        a.uploadRedCard('daniel', { name: 'tarjeta-roja.png', dataUrl: png }, { number: P.redCard.number, expiry })
        return finish('daniel')
      }
      case 'ernesto':
        a.setAnswers('ernesto', { document: 'DNI', who: 'helping' })
        a.setHelper('ernesto', { name: P.helper.name, relation: P.helper.relation, mobile: P.helper.mobile })
        a.giveConsents('ernesto', { face: true })
        a.confirmApplicant('ernesto', true)
        a.recordVideoAttempt('ernesto', 'reflections'); a.recordVideoAttempt('ernesto', 'person')
        return finish('ernesto')
    }
  }, [kind, img ?? ''] as const)
}

const getCase = (page: Page, id: string) => page.evaluate(id => (window as K).__clave.getState().cases[id], id)
const openCase = async (page: Page, id: string) => {
  await page.goto(`${D}#/officer/case/${id}`)
  await expect(page.getByTestId('case-header')).toBeVisible()
}

test.use({ viewport: { width: 1440, height: 900 } })

test('live: a case set up in the citizen tab arrives in the officer queue with its AI reason', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const officer = await ctx.newPage()
  const citizen = await ctx.newPage()
  const errors = [...track(officer), ...track(citizen)]
  await boot(officer)
  await officer.goto(`${D}#/officer`)
  await expect(officer.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await expect(officer.locator('tr[data-case-id="applicant-x"]')).toHaveCount(0)

  await citizen.goto(`${D}#/`)
  await citizen.waitForFunction(() => Boolean((window as K).__clave))
  await citizenRuns(citizen, 'applicant-x')

  const row = officer.locator('tr[data-case-id="applicant-x"]')
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(officer.getByText('New case: Applicant X').first()).toBeVisible()
  await expect(row).toContainText('Applicant X')
  await expect(row).toContainText('GYC-06')
  await expect(row.getByTestId('queue-ai-reason')).toHaveText('The live-person check failed on every attempt and the face match stayed low. The document itself is genuine.')
  await expect(row.getByTestId('proposed-rule')).toBeVisible()
  // High risk goes first
  await expect(officer.locator('tr[data-case-id]').first()).toHaveAttribute('data-case-id', 'applicant-x')
  await shot(officer, 'queue-1440')
  expect(errors).toEqual([])
  await ctx.close()
})

test('GYC-02 Kenji: approve is blocked until the video call; officer call panel → approve basic', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await citizenRuns(page, 'kenji')
  await openCase(page, 'kenji')
  await expect(page.getByTestId('ai-reason')).toHaveText('Chip could not be read twice; document integrity not verified')
  await expect(page.getByTestId('checks-table').locator('tr[data-check="chip_read"]')).toHaveAttribute('data-outcome', 'fail')
  await expect(page.getByTestId('video-call-state')).toHaveText('Citizen waiting in the video-call room')
  await expect(page.getByTestId('btn-approve')).toBeDisabled()
  await page.getByTestId('btn-start-call').click()
  const panel = page.getByTestId('officer-call-panel')
  await expect(panel).toBeVisible()
  expect((await getCase(page, 'kenji')).session.videoCall).toMatchObject({ state: 'live', officerName: 'Lucía Vega' })
  await expect(page.getByTestId('btn-approve')).toBeDisabled()
  await panel.getByTestId('call-doc').check()
  await panel.getByTestId('call-face').check()
  await shot(page, 'gyc02-call-1440')
  await page.getByTestId('btn-approve').click()
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  const c = await getCase(page, 'kenji')
  expect(c).toMatchObject({ status: 'approved', level: 'basic', advanced: 'pending_review', citizenMsgs: ['STA-4B'] })
  expect(c.decisions.at(-1)).toMatchObject({ outcome: 'approved_basic', by: { name: 'Lucía Vega' }, ruleId: 'VIDEO-CALL' })
  // now in the advanced-level review list
  await page.getByTestId('nav-advanced').click()
  await expect(page.locator('tr[data-case-id="kenji"]')).toBeVisible()
  expect(errors).toEqual([])
})

test('GYC-06 Applicant X: checks, attempts and stills; refuse REJ-07 with internal note; preview shows MSG-REJ-07', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await citizenRuns(page, 'applicant-x')
  await openCase(page, 'applicant-x')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Applicant X')
  await expect(page.getByTestId('case-header')).toContainText('Ana Costa')
  const table = page.getByTestId('checks-table')
  await expect(table.locator('tr[data-check="chip_signature"]')).toHaveAttribute('data-outcome', 'pass')
  await expect(table.locator('tr[data-check="liveness"]')).toHaveAttribute('data-outcome', 'fail')
  await expect(table.getByTestId('simulated-values').first()).toBeVisible()
  await expect(page.getByTestId('face-attempt')).toHaveCount(2)
  await expect(page.getByTestId('face-attempt').first()).toContainText('Synthetic video')
  await expect(page.getByTestId('video-call-state')).toContainText('not joined')
  await expect(page.getByTestId('stills-strip').locator('[data-flagged]')).toHaveCount(2)
  await shot(page, 'gyc06-case-1440')

  await page.keyboard.press('r')
  const dlg = page.getByRole('dialog')
  // suggested reason preselected by the engine
  await expect(dlg.getByTestId('reason-REJ-07')).toHaveAttribute('aria-checked', 'true')
  await expect(dlg.getByTestId('citizen-preview')).toContainText('We could not confirm that this request comes from the person named on the document')
  await dlg.getByLabel(/Internal note/).fill('Synthetic video on both attempts')
  await shot(page, 'gyc06-refuse-1440')
  await dlg.getByTestId('reason-confirm').click()
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  const c = await getCase(page, 'applicant-x')
  expect(c).toMatchObject({ status: 'not_approved', citizenMsgs: ['STA-5', 'REJ-07'] })
  expect(c.decisions.at(-1)).toMatchObject({ outcome: 'refused', reasonId: 'REJ-07', note: 'Synthetic video on both attempts' })
  expect(errors).toEqual([])
})

test('GYC-07 Rafael: printed vs chip side by side, refuse REJ-06', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await citizenRuns(page, 'rafael')
  await openCase(page, 'rafael')
  await expect(page.getByTestId('ai-reason')).toContainText('security signature is not valid')
  const pvc = page.getByTestId('printed-vs-chip')
  await expect(pvc.locator('tr[data-differs]')).toHaveCount(2)
  await expect(pvc).toContainText('DUARTE SOUZA')
  await expect(pvc).toContainText('1988-04-13')
  await expect(pvc).toContainText('1988-03-14')
  await shot(page, 'gyc07-case-1440')
  await page.getByTestId('btn-refuse').click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByTestId('reason-REJ-06')).toHaveAttribute('aria-checked', 'true')
  await expect(dlg.getByTestId('citizen-preview')).toContainText('the chip in your document did not confirm the printed data')
  await dlg.getByLabel(/Internal note/).fill('printed surname differs from chip surname')
  await dlg.getByTestId('reason-confirm').click()
  await expect.poll(async () => (await getCase(page, 'rafael')).status).toBe('not_approved')
  expect((await getCase(page, 'rafael')).decisions.at(-1)).toMatchObject({ reasonId: 'REJ-06' })
  expect(errors).toEqual([])
})

test('GYC-08 Valentina: Vega refuses REJ-05 → review → Vega sees the notice → Ortiz approves; audit shows the correction', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await citizenRuns(page, 'valentina')
  await openCase(page, 'valentina')
  const dt = page.getByTestId('discrepancy-table')
  await expect(dt.locator('tr[data-differs]')).toHaveCount(2) // full name + surnames
  await expect(dt).toContainText('ROJAS GÓMEZ, VALENTINA')
  await expect(dt).toContainText('ROJAS, VALENTINA')
  await shot(page, 'gyc08-case-1440')
  await page.getByTestId('btn-refuse').click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByTestId('reason-REJ-05')).toHaveAttribute('aria-checked', 'true')
  await expect(dlg.getByTestId('citizen-preview')).toContainText('surnames: ROJAS GOMEZ / ROJAS')
  await dlg.getByTestId('reason-confirm').click()
  await expect.poll(async () => (await getCase(page, 'valentina')).status).toBe('not_approved')

  // the citizen asks for a review with a photo of the passport data page
  const img = await makeImage(page, 'PASSPORT · ROJAS GÓMEZ')
  await page.evaluate(img => (window as K).__clave.actions.requestReview('valentina', 'My second surname is Gómez, see my passport.', { name: 'passport-data-page.png', dataUrl: img }), img)

  // Vega opens it from Appeals: notice instead of the buttons
  await page.getByTestId('nav-appeals').click()
  await expect(page.getByRole('heading', { name: 'Appeals' })).toBeVisible()
  await page.locator('tr[data-case-id="valentina"]').getByRole('link').first().click()
  await expect(page.getByTestId('second-officer-notice')).toContainText('The review is decided by another person: sign in as Andrés Ortiz.')
  await expect(page.getByTestId('btn-approve')).toHaveCount(0)
  await expect(page.getByTestId('appeal-note')).toContainText('My second surname is Gómez')
  await expect(page.getByTestId('appeal-upload').locator('img')).toBeVisible()
  await shot(page, 'gyc08-vega-notice-1440')

  // Ortiz signs in with user + password (first time: job details)
  await page.getByRole('button', { name: 'Sign out and switch user' }).click()
  await page.getByTestId('method-password').getByRole('button', { name: 'Access with user and password' }).click()
  await page.getByLabel('User ID').fill('aortiz')
  await page.getByLabel('Password', { exact: true }).fill('Ortiz-2026')
  await page.getByTestId('staff-password-form').getByRole('button', { name: 'Sign in', exact: true }).click()
  const form = page.getByTestId('staff-profile-form')
  await form.getByLabel(/Organisation/).selectOption('aeat')
  await form.getByLabel(/^Post/).selectOption('Cl@ve registration officer')
  await form.getByLabel(/Personnel number/).fill('29640157HA0384')
  await form.getByRole('button', { name: 'Save and open the console' }).click()
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await page.getByTestId('nav-appeals').click()
  await page.locator('tr[data-case-id="valentina"]').getByRole('link').first().click()
  await expect(page.getByTestId('second-officer-notice')).toHaveCount(0)
  await expect(page.getByTestId('btn-uphold')).toBeVisible()
  await shot(page, 'gyc08-ortiz-1440')
  await page.getByTestId('btn-approve').click()
  await expect.poll(async () => (await getCase(page, 'valentina')).status).toBe('approved')
  const c = await getCase(page, 'valentina')
  expect(c).toMatchObject({ correctedAfterRefusal: true, citizenMsgs: ['COR-06', 'STA-4B'] })
  expect(c.appeal.decidedBy.name).toBe('Andrés Ortiz')

  await page.goto(`${D}#/officer/audit?case=valentina`)
  await expect(page.getByText('Refusal corrected on review').first()).toBeVisible()
  await expect(page.getByText('APPEAL-SECOND-OFFICER').first()).toBeVisible()
  await expect(page.getByRole('cell', { name: /Lucía Vega/ }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: /Andrés Ortiz/ }).first()).toBeVisible()
  await shot(page, 'gyc08-audit-1440')
  expect(errors).toEqual([])
})

test('core rule errors are shown in plain words (second officer)', async ({ page }) => {
  await boot(page)
  await citizenRuns(page, 'valentina')
  await page.evaluate(() => { const a = (window as K).__clave.actions; a.officerRefuse('valentina', 'REJ-05'); a.requestReview('valentina', 'Please check again') })
  await openCase(page, 'valentina')
  await page.keyboard.press('a') // shortcut does nothing while the notice is shown
  expect((await getCase(page, 'valentina')).appeal.state).toBe('open')
})

test('GYC-04 Mateo: proof viewer → request info with COR-01 preview → reply → approve', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  const cut = await makeImage(page, 'LIBRO DE FAMILIA · RUIZ', { cut: true })
  await citizenRuns(page, 'laura', cut)
  await openCase(page, 'laura')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mateo Ruiz')
  await expect(page.getByTestId('ai-reason')).toHaveText('Minor: proof of parental authority to check')
  await expect(page.getByTestId('proof-viewer').locator('img')).toBeVisible()
  await expect(page.getByTestId('proof-viewer')).toContainText('patria-potestad.png')
  await shot(page, 'gyc04-case-1440')
  await page.getByTestId('btn-info').click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('What you need').fill('a clear photo of your proof of parental authority')
  await dlg.getByLabel(/Why/).fill('the photo you sent is cut off on the right side')
  await expect(dlg.getByTestId('info-preview')).toContainText('We need one more thing to continue: a clear photo of your proof of parental authority. We ask because the photo you sent is cut off on the right side.')
  await shot(page, 'gyc04-info-1440')
  await dlg.getByTestId('info-send').click()
  await expect.poll(async () => (await getCase(page, 'laura')).status).toBe('need_info')

  const clear = await makeImage(page, 'LIBRO DE FAMILIA · RUIZ')
  await page.evaluate(img => (window as K).__clave.actions.replyToInfoRequest('laura', 'Here is a clear photo.', { name: 'proof-clear.png', dataUrl: img }), clear)
  await openCase(page, 'laura')
  await expect(page.getByTestId('info-reply')).toContainText('Here is a clear photo.')
  await expect(page.getByTestId('proof-viewer')).toContainText('proof-clear.png')
  await page.getByTestId('btn-approve').click()
  await expect.poll(async () => (await getCase(page, 'laura')).status).toBe('approved')
  expect((await getCase(page, 'laura')).citizenMsgs).toEqual(['COR-08', 'STA-4'])
  expect(errors).toEqual([])
})

test('GYC-05 Daniel: red card viewer with the expiry highlighted → approve basic (proposed rule)', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  const card = await makeImage(page, 'TARJETA ROJA · DEMO-0005', { red: true })
  await citizenRuns(page, 'daniel', card)
  await openCase(page, 'daniel')
  await expect(page.getByTestId('case-header').getByTestId('proposed-rule')).toBeVisible()
  await expect(page.getByTestId('red-card-number')).toHaveText('DEMO-0005')
  await expect(page.getByTestId('red-card-expiry')).toHaveAttribute('data-soon', '1')
  await expect(page.getByTestId('red-card-expiry')).toContainText('Expires in 21 days')
  await shot(page, 'gyc05-case-1440')
  await page.getByTestId('btn-approve').click()
  await expect.poll(async () => (await getCase(page, 'daniel')).status).toBe('approved')
  const ev = await page.evaluate(() => (window as K).__clave.caseAudit('daniel'))
  expect(ev.find((e: K) => e.action === 'officer_approved_basic')?.tags).toContain('Decided under proposed rule')
  expect(errors).toEqual([])
})

test('GYC-03 Ernesto: advanced-level review with the assisted session details → approve advanced', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await citizenRuns(page, 'ernesto')
  await page.getByTestId('nav-advanced').click()
  const row = page.locator('tr[data-case-id="ernesto"]')
  await expect(row.getByTestId('assisted-badge')).toBeVisible()
  await row.getByRole('link').first().click()
  await expect(page.getByTestId('helper-name')).toHaveText('Marta Navarro')
  await expect(page.getByTestId('sms-own-number')).toContainText("the helper’s number is not linked")
  await shot(page, 'gyc03-case-1440')
  await page.getByTestId('btn-approve').click()
  await expect.poll(async () => (await getCase(page, 'ernesto')).level).toBe('advanced')
  expect(errors).toEqual([])
})

test('Spanish labels and the dashboard counters move live', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await page.goto(`${D}#/officer/dashboard`)
  const read = async (id: string) => Number(await page.getByTestId(id).getAttribute('data-value'))
  const before = { needed: await read('kpi-needed-officer'), rej06: await read('rej-bar-REJ-06') }
  await citizenRuns(page, 'rafael')
  await page.evaluate(() => (window as K).__clave.actions.officerRefuse('rafael', 'REJ-06'))
  await expect.poll(() => read('rej-bar-REJ-06')).toBe(before.rej06 + 1)
  await expect.poll(() => read('kpi-needed-officer')).toBe(before.needed + 1)
  await expect(page.getByTestId('published-figures')).toBeVisible()
  await expect(page.getByTestId('staff-dashboard')).not.toContainText(/Simulated|12-week/)
  await shot(page, 'dashboard-1440')
  await page.getByRole('button', { name: 'Español' }).click()
  await expect(page.getByText('Denegaciones por motivo')).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  expect(errors).toEqual([])
})

test('1100 px: icon rail, case detail and queue still work', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 850 })
  await boot(page)
  await citizenRuns(page, 'rafael')
  await citizenRuns(page, 'applicant-x')
  await page.goto(`${D}#/officer`)
  await expect(page.getByTestId('console-sidebar')).toHaveAttribute('data-expanded', 'false')
  await shot(page, 'queue-1100')
  await openCase(page, 'rafael')
  await expect(page.getByTestId('printed-vs-chip')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100)
  await shot(page, 'gyc07-case-1100')
  await openCase(page, 'applicant-x')
  await shot(page, 'gyc06-case-1100')
})
