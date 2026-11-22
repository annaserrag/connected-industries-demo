/**
 * Staff console: certificate + PIN and user + password sign-in outcomes, sidebar by width, job details, priority tiers,
 * age bump, by-document view, live dashboard, landing entry points.
 * Run: PORT=5182 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test tests/integration/staff-console.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

type K = any // eslint-disable-line @typescript-eslint/no-explicit-any
const D = '/?debug=1'

function track(page: Page) {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  return errors
}

async function boot(page: Page, path = '#/officer') {
  await page.goto(`${D}${path}`)
  await page.waitForFunction(() => Boolean((window as K).__clave))
  await page.evaluate(() => {
    const k = (window as K).__clave
    k.setEngineSpeed(0)
    k.actions.officerSignOut()
    k.actions.resetDemo()
  })
}

const SECRETS = { pins: { 'cert-laura': '2580', 'cert-javier': '1357', 'cert-marta': '4826', 'cert-diego': '9031', 'cert-old': '2580' } as Record<string, string> }

async function pickCertificate(page: Page, certId: string) {
  await page.getByTestId('method-certificate').getByRole('button', { name: 'Access with certificate' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByText('Simulated', { exact: true })).toHaveCount(0)
  await page.getByTestId(`cert-${certId}`).click()
  await dlg.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(page.getByTestId('staff-pin-step')).toBeVisible()
}

async function certSignIn(page: Page, certId: string, pin = SECRETS.pins[certId]) {
  await pickCertificate(page, certId)
  await page.getByLabel('PIN', { exact: true }).fill(pin)
  await page.getByRole('button', { name: 'Continue' }).click()
}

async function passwordSignIn(page: Page, user: string, password: string) {
  await page.getByTestId('method-password').getByRole('button', { name: 'Access with user and password' }).click()
  await page.getByLabel('User ID').fill(user)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByTestId('staff-password-form').getByRole('button', { name: 'Sign in', exact: true }).click()
}

const lastAudit = (page: Page) => page.evaluate(() => (window as K).__clave.getState().audit.at(-1))
const auditText = (page: Page) => page.evaluate(() => JSON.stringify((window as K).__clave.getState().audit))

test.use({ viewport: { width: 1440, height: 900 } })

test('sign-in page looks like the gateway: two method cards, visible demo access, no simulated wording', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Staff identification' })).toBeVisible()
  await expect(page.getByText('Choose how to sign in')).toBeVisible()
  await expect(page.getByTestId('staff-methods').locator('article')).toHaveCount(2)
  await expect(page.getByTestId('method-certificate')).toContainText('Recommended')
  await expect(page.locator('body')).not.toContainText(/Simulated|Demo data|\(demo\)|DEMO-/)
  await page.getByRole('button', { name: 'Español' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Identificación del personal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Acceder con certificado' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/Simulado/)
  // the demo access box shows the fictional PIN and user/password for recording
  await expect(page.getByTestId('staff-demo-access')).toContainText('2580')
  await page.getByRole('button', { name: 'English' }).click()
  expect(errors).toEqual([])
})

test('Laura, certificate + PIN: wrong PIN is generic and counted; then job details → console; second sign-in skips the form', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await certSignIn(page, 'cert-laura', '1111')
  await expect(page.getByTestId('staff-pin-step')).toContainText('The PIN is not correct.')
  await expect(page.getByTestId('pin-attempts')).toHaveText('2 attempts left before a short pause.')
  await expect(page.getByLabel('PIN', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_access_denied', actor: { name: 'Laura Navarro' } })
  expect((await lastAudit(page)).detail).toContain('wrong PIN')
  // show/hide toggles the field type
  await page.getByLabel('PIN', { exact: true }).fill('2580')
  await page.getByRole('button', { name: 'Show PIN' }).click()
  await expect(page.getByLabel('PIN', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Continue' }).click()

  const form = page.getByTestId('staff-profile-form')
  await expect(form).toBeVisible()
  await expect(form.getByText('50731842J').first()).toBeVisible()
  await expect(form.getByLabel(/Organisation/)).toHaveValue('aeat')
  await expect(form.getByLabel(/Office/)).toHaveValue('E04999101')
  await expect(form.getByLabel(/^Post/)).toHaveValue('Cl@ve registration officer')
  await expect(form.getByLabel(/Personnel number/)).toHaveAttribute('placeholder', '50731842JA0611')
  await expect(form.getByText(/your DNI number and letter, “A”, and your 4-digit body code/)).toBeVisible()
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_signed_in', actor: { kind: 'officer', name: 'Laura Navarro' } })
  expect(await page.evaluate(() => (window as K).__clave.getState().officerId)).toBeNull()

  await form.getByLabel(/Personnel number/).fill('50731842ja0611')
  await form.getByRole('button', { name: 'Save and open the console' }).click()
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await expect(page.getByTestId('officer-identity')).toContainText('Cl@ve registration officer')
  await expect(page.getByTestId('officer-identity')).toContainText('E04999101')
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_profile_completed', actor: { id: 'OF-DEMO-07' } })
  const p = await page.evaluate(() => (window as K).__clave.getState().officerProfiles['OF-DEMO-07'])
  expect(p).toMatchObject({ personnelNumber: '50731842JA0611', signInMethod: 'certificate', certificateId: 'cert-laura' })

  await page.getByTestId('nav-profile').click()
  await expect(page.getByTestId('profile-details')).toContainText('50731842JA0611')
  await expect(page.getByTestId('profile-details')).toContainText('Electronic certificate + PIN')
  await expect(page.getByTestId('staff-profile')).toContainText('Public employee certificate (cryptocard)')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await certSignIn(page, 'cert-laura')
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await expect(page.getByTestId('staff-profile-form')).toHaveCount(0)
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_signed_in' })

  // the PIN never reaches the audit trail
  const text = await auditText(page)
  expect(text).toContain('method: certificate + PIN')
  expect(text).not.toMatch(/2580|1111/)
  await page.goto(`${D}#/officer/audit`)
  await expect(page.getByRole('cell', { name: 'Staff signed in' }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Job details confirmed' }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('three wrong PINs give a short pause, never a permanent lock', async ({ page }) => {
  await boot(page)
  await certSignIn(page, 'cert-marta', '0000')
  for (const pin of ['0001', '0002']) {
    await page.getByLabel('PIN', { exact: true }).fill(pin)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByLabel('PIN', { exact: true })).toHaveValue('')
  }
  await expect(page.getByTestId('staff-pin-step')).toContainText(/Too many wrong PINs\. For your security, try again in \d+ s\./)
  await expect(page.getByLabel('PIN', { exact: true })).toBeDisabled()
  // the core never locks: the right PIN still works through the action
  const r = await page.evaluate(() => (window as K).__clave.actions.officerSignInWithCertificate('cert-marta', '4826'))
  expect(r).toMatchObject({ status: 'needs_profile', method: 'certificate', certificateId: 'cert-marta' })
})

test('Javier with user + password: generic error, then picks organisation, office and post himself', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await passwordSignIn(page, 'jprieto', 'wrong-password')
  await expect(page.getByTestId('staff-password-step')).toContainText('The user or password is not correct.')
  await page.getByLabel('Password', { exact: true }).fill('Prieto-2026')
  await expect(page.getByLabel('User ID')).toHaveAttribute('autocomplete', 'username')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
  await page.getByTestId('staff-password-form').getByRole('button', { name: 'Sign in', exact: true }).click()
  const form = page.getByTestId('staff-profile-form')
  await expect(form).toBeVisible()
  await expect(form.getByText('From your staff account')).toBeVisible()
  await expect(form.getByText('jprieto', { exact: true })).toBeVisible()
  await expect(form.getByLabel(/Organisation/)).toHaveValue('')
  await expect(form.getByLabel(/Office/)).toBeDisabled()
  await form.getByLabel(/Organisation/).selectOption('seg_social')
  await expect(form.getByLabel(/Office/)).toHaveValue('E04999214')
  await form.getByLabel(/^Post/).selectOption('Citizen information officer')
  await form.getByLabel(/Personnel number/).fill('29640157HA0384')
  await form.getByText('Supervisor', { exact: true }).click()
  await form.getByRole('button', { name: 'Save and open the console' }).click()
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await expect(page.getByTestId('officer-identity')).toContainText('Valencia Ruzafa')
  const p = await page.evaluate(() => (window as K).__clave.getState().officerProfiles['OF-DEMO-12'])
  expect(p).toMatchObject({ authorityId: 'seg_social', officeCode: 'E04999214', role: 'supervisor', signInMethod: 'password' })
  expect(p.certificateId).toBeUndefined()
  const text = await auditText(page)
  expect(text).toContain('method: user + password')
  expect(text).not.toMatch(/Prieto-2026|wrong-password/)
  expect(errors).toEqual([])
})

test('Diego is refused by both methods: not staff of a registration authority', async ({ page }) => {
  await boot(page)
  await certSignIn(page, 'cert-diego')
  const denied = page.getByTestId('staff-denied')
  await expect(denied).toHaveAttribute('data-reason', 'not_staff')
  await expect(denied.getByRole('heading', { level: 1 })).toHaveText(/isn’t linked to registration staff/)
  await expect(denied).toContainText('office supervisor')
  expect(await page.evaluate(() => (window as K).__clave.getState().officerId)).toBeNull()
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_access_denied', actor: { name: 'Diego Romero' } })
  await denied.getByRole('button', { name: 'Sign in another way' }).click()
  await passwordSignIn(page, 'dromero', 'Romero-2026')
  await expect(page.getByTestId('staff-denied')).toHaveAttribute('data-reason', 'not_staff')
  await expect(page.getByTestId('staff-denied')).toContainText('dromero')
  // the console stays closed even by URL
  await page.goto(`${D}#/officer/dashboard`)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Access with certificate' })).toBeVisible()
})

test('expired certificate: a wrong PIN reveals nothing; the right PIN shows the expiry', async ({ page }) => {
  await boot(page)
  await certSignIn(page, 'cert-old', '9999')
  await expect(page.getByTestId('staff-pin-step')).toContainText('The PIN is not correct.')
  await expect(page.getByTestId('staff-denied')).toHaveCount(0)
  expect((await lastAudit(page)).detail).not.toContain('expired')
  await page.getByLabel('PIN', { exact: true }).fill('2580')
  await page.getByRole('button', { name: 'Continue' }).click()
  const denied = page.getByTestId('staff-denied')
  await expect(denied).toHaveAttribute('data-reason', 'expired')
  await expect(denied.getByRole('heading', { level: 1 })).toHaveText('This certificate has expired')
  await expect(denied).toContainText('30 Jun 2025')
  expect((await lastAudit(page)).detail).toContain('certificate expired')
  await denied.getByRole('button', { name: 'Choose another certificate' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('core: generic invalid_credentials, same outcomes by password, officerSignIn kept for tests', async ({ page }) => {
  await boot(page)
  const r = await page.evaluate(() => {
    const a = (window as K).__clave.actions
    return {
      wrongPin: a.officerSignInWithCertificate('cert-old', '1234'),
      badPinShape: a.officerSignInWithCertificate('cert-laura', 'abcd'),
      unknownUser: a.officerSignInWithPassword('nobody', 'Navarro-2026'),
      wrongPw: a.officerSignInWithPassword('lnavarro', 'nope'),
      emptyPw: a.officerSignInWithPassword('lnavarro', ''),
      caseInsensitiveUser: a.officerSignInWithPassword('  LNavarro ', 'Navarro-2026'),
      diego: a.officerSignInWithPassword('dromero', 'Romero-2026'),
    }
  })
  expect(r.wrongPin).toEqual({ status: 'invalid_credentials' })
  expect(r.badPinShape).toEqual({ status: 'invalid_credentials' })
  expect(r.unknownUser).toEqual({ status: 'invalid_credentials' })
  expect(r.wrongPw).toEqual({ status: 'invalid_credentials' })
  expect(r.emptyPw).toEqual({ status: 'invalid_credentials' })
  expect(r.caseInsensitiveUser).toEqual({ status: 'needs_profile', officerId: 'OF-DEMO-07', method: 'password' })
  expect(r.diego).toEqual({ status: 'not_authorised', reason: 'not_staff' })
  const text = await auditText(page)
  for (const secret of ['Navarro-2026', 'Romero-2026', '"1234"', 'abcd']) expect(text).not.toContain(secret)
  await page.evaluate(() => (window as K).__clave.actions.officerSignIn('OF-DEMO-07'))
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
})

test('personnel number (NRP) is validated in the form and in core', async ({ page }) => {
  await boot(page)
  await certSignIn(page, 'cert-marta')
  const form = page.getByTestId('staff-profile-form')
  const nrp = form.getByLabel(/Personnel number/)
  // 12345678Z has the REAL check letter: refused, like any real-looking DNI
  for (const bad of ['12345678', 'DEMO-NRP-1234', '71385096AB0952', '12345678ZA0952', '71385096AA095']) {
    await nrp.fill(bad)
    await form.getByRole('button', { name: 'Save and open the console' }).click()
    await expect(nrp).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByText(/Enter a valid personnel number/)).toBeVisible()
  }
  await nrp.fill('50731842JA0611') // Laura's DNI, not Marta's
  await form.getByRole('button', { name: 'Save and open the console' }).click()
  await expect(form.getByText('The personnel number must start with your own DNI number and letter.')).toBeVisible()
  expect(await page.evaluate(() => (window as K).__clave.getState().officerProfiles['OF-DEMO-21'])).toBeUndefined()

  const errs = await page.evaluate(() => {
    const a = (window as K).__clave.actions
    const tryIt = (fn: () => void) => { try { fn(); return null } catch (e) { return (e as Error).name } }
    const ok = { authorityId: 'delegacion', officeCode: 'E04999377', post: 'Office supervisor', personnelNumber: '71385096AA0952', role: 'supervisor' }
    return {
      badNrp: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'certificate', 'cert-marta', { ...ok, personnelNumber: 'X-1' })),
      realLetter: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'certificate', 'cert-marta', { ...ok, personnelNumber: '12345678ZA0952' })),
      wrongOffice: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'certificate', 'cert-marta', { ...ok, officeCode: 'E04999101' })),
      wrongCert: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'certificate', 'cert-laura', ok)),
      noCert: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'certificate', null, ok)),
      expired: tryIt(() => a.officerCompleteProfile('OF-DEMO-07', 'certificate', 'cert-old', { ...ok, authorityId: 'aeat', officeCode: 'E04999101', personnelNumber: '50731842JA0611' })),
      notAuthorisedPw: tryIt(() => a.officerCompleteProfile('OF-DEMO-99', 'password', null, ok)),
      good: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'certificate', 'cert-marta', ok)),
    }
  })
  expect(errs).toEqual({ badNrp: 'ClaveRuleError', realLetter: 'ClaveRuleError', wrongOffice: 'ClaveRuleError', wrongCert: 'ClaveRuleError', noCert: 'ClaveRuleError', expired: 'ClaveRuleError', notAuthorisedPw: 'ClaveRuleError', good: null })
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
})

test('the console menu never disappears: full sidebar, icon rail, phone drawer', async ({ browser }) => {
  const ROUTES = ['#/officer', '#/officer/dashboard', '#/officer/documents', '#/officer/applications', '#/officer/audit', '#/officer/profile', '#/officer/case/bg-03']
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = track(page)
  await boot(page)
  await page.evaluate(() => { localStorage.removeItem('getyourclave.officer.nav'); (window as K).__clave.actions.officerSignIn('OF-DEMO-07') })
  // ≥ 1280: full sidebar with labels on every route
  for (const r of ROUTES) {
    await page.goto(`${D}${r}`)
    const side = page.getByTestId('console-sidebar')
    await expect(side).toBeVisible()
    await expect(side).toHaveAttribute('data-expanded', 'true')
    await expect(side.getByText('Dashboard', { exact: true })).toBeVisible()
  }
  await expect(page.getByTestId('nav-queue')).toHaveAttribute('aria-current', 'page') // case detail belongs to the queue
  // 768–1279: icon rail with tooltips, expand toggle remembered across reloads
  await page.setViewportSize({ width: 1100, height: 800 })
  for (const r of ROUTES) {
    await page.goto(`${D}${r}`)
    await expect(page.getByTestId('console-sidebar')).toHaveAttribute('data-expanded', 'false')
    await expect(page.getByTestId('nav-dashboard')).toBeVisible()
  }
  await page.getByTestId('nav-dashboard').hover()
  await expect(page.getByRole('tooltip')).toContainText('Dashboard')
  await page.getByTestId('nav-toggle').click()
  await expect(page.getByTestId('console-sidebar')).toHaveAttribute('data-expanded', 'true')
  await page.reload()
  await expect(page.getByTestId('console-sidebar')).toHaveAttribute('data-expanded', 'true')
  await page.getByTestId('nav-toggle').click()
  await expect(page.getByTestId('console-sidebar')).toHaveAttribute('data-expanded', 'false')
  // < 768: visible Menu button opens a drawer with the same items
  await page.setViewportSize({ width: 390, height: 844 })
  for (const r of ROUTES) {
    await page.goto(`${D}${r}`)
    await expect(page.getByTestId('console-menu-button')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  }
  await page.getByTestId('console-menu-button').click()
  const drawer = page.getByTestId('console-drawer')
  await expect(drawer).toBeVisible()
  for (const name of ['Case queue', 'Dashboard', 'By document', 'All applications', 'Audit trail', 'My profile']) await expect(drawer.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  await drawer.getByRole('link', { name: /Dashboard/ }).click()
  await expect(drawer).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
  await ctx.close()
})

test('queue follows the priority tiers; overdue cases go first within their own tier', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  const r = await page.evaluate(async () => {
    const k = (window as K).__clave, a = k.actions
    for (const id of ['giulia', 'daniel', 'deepfake']) {
      const c = k.getState().cases[id]
      a.startCase(id, c.presetAnswers, 'B'); a.giveConsent(id)
      await a.submitForVerification(id)
    }
    a.officerSignIn('OF-DEMO-07')
    // advanced-level refusal (basic kept), then the citizen appeals
    a.officerRefuse('giulia', 'face_mismatch')
    a.fileAppeal('giulia', 'Please look again, I had new glasses')
    const q = k.officerQueue().map((c: K) => c.id)
    const in25h = new Date(Date.now() + 25 * 3600_000).toISOString()
    return {
      q,
      tiers: Object.fromEntries(q.map((id: string) => [id, k.priorityOf(id)])),
      later: { daniel: k.priorityOf('daniel', in25h), bg03: k.priorityOf('bg-03', in25h), deepfake: k.priorityOf('deepfake', in25h) },
    }
  })
  expect(r.tiers.deepfake).toBe('p1_high_risk')
  expect(r.tiers.giulia).toBe('p2_appeal')
  expect(r.tiers.daniel).toBe('p6_advanced_review')
  expect(r.tiers['bg-09']).toBe('p5_video_call')
  expect(r.tiers['bg-03']).toBe('p4_medium_risk')
  // Aisha's appeal has waited over 24 h: it stays an appeal (never "possible fraud") and goes first among appeals
  expect(r.tiers['bg-07']).toBe('p2_appeal')
  expect(r.q.indexOf('deepfake')).toBeLessThan(r.q.indexOf('bg-07'))
  expect(r.q.indexOf('bg-07')).toBeLessThan(r.q.indexOf('giulia'))
  expect(r.q.indexOf('giulia')).toBeLessThan(r.q.indexOf('bg-03'))
  expect(r.q.indexOf('bg-03')).toBeLessThan(r.q.indexOf('bg-09'))
  expect(r.q.indexOf('bg-09')).toBeLessThan(r.q.indexOf('daniel'))
  // waiting time never changes the tier
  expect(r.later).toEqual({ daniel: 'p6_advanced_review', bg03: 'p4_medium_risk', deepfake: 'p1_high_risk' })

  // UI: tier groups in order, legend, bump indicator
  await page.goto(`${D}#/officer`)
  await expect(page.getByTestId('priority-legend')).toContainText('P1 high risk → P6 advanced level')
  const tiers = await page.locator('[data-testid^="tier-row-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  expect(tiers).toEqual(['tier-row-p1_high_risk', 'tier-row-p2_appeal', 'tier-row-p4_medium_risk', 'tier-row-p5_video_call', 'tier-row-p6_advanced_review'])
  const rows = await page.locator('tr[data-case-id]').evaluateAll(els => els.map(e => e.getAttribute('data-case-id')))
  expect(rows).toEqual(r.q)
  await expect(page.locator('tr[data-case-id="bg-07"]').getByTestId('age-bump')).toBeVisible()
  await expect(page.locator('tr[data-case-id="deepfake"]').getByTestId('age-bump')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('by-document tab counts match the store', async ({ page }) => {
  await boot(page)
  await page.evaluate(async () => {
    const k = (window as K).__clave, a = k.actions
    for (const id of ['daniel', 'noah']) {
      const c = k.getState().cases[id]
      a.startCase(id, c.presetAnswers, 'B'); a.giveConsent(id)
      await a.submitForVerification(id)
    }
    a.officerSignIn('OF-DEMO-07')
  })
  await page.goto(`${D}#/officer/documents`)
  const expected = await page.evaluate(() => {
    const out: Record<string, number> = { DNI: 0, EU_EID: 0, PASSPORT: 0, TIE: 0, NIE_PAPER: 0, RED_CARD: 0 }
    for (const c of Object.values((window as K).__clave.getState().cases) as K[]) {
      if (c.status !== 'draft') out[c.answers?.document ?? c.document.type]++
    }
    return out
  })
  expect(expected.TIE).toBeGreaterThan(0)
  for (const [doc, n] of Object.entries(expected)) {
    await expect(page.getByTestId(`doc-count-${doc}`)).toHaveText(String(n))
  }
  await page.getByTestId('doc-tab-TIE').click()
  await expect(page.getByTestId('doc-panel-TIE').locator('tr[data-case-id]')).toHaveCount(expected.TIE)
  await expect(page.getByTestId('doc-panel-TIE').getByRole('link', { name: 'Daniel Mwangi' })).toBeVisible()
  await page.getByTestId('doc-tab-RED_CARD').click()
  // policy-proposal documents are shown as normal routes
  await expect(page.getByTestId('doc-panel-RED_CARD')).toContainText('No chip: officer video call')
  await expect(page.getByTestId('doc-panel-RED_CARD').getByText('Policy proposal')).toHaveCount(0)
})

test('dashboard updates live when a citizen tab submits a case', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const officer = await ctx.newPage()
  const citizen = await ctx.newPage()
  const errors = [...track(officer), ...track(citizen)]
  await boot(officer, '#/officer/dashboard')
  await officer.evaluate(() => (window as K).__clave.actions.officerSignIn('OF-DEMO-07'))
  await expect(officer.getByText('Live', { exact: true }).first()).toBeVisible()
  await expect(officer.getByTestId('staff-dashboard')).not.toContainText(/Simulated|Demo data/)
  const read = async (id: string) => Number(await officer.getByTestId(id).getAttribute('data-value'))
  const before = { awaiting: await read('kpi-awaiting'), passport: await read('doc-bar-PASSPORT'), p1: await read('tier-count-p1_high_risk') }

  await citizen.goto(`${D}#/citizen`)
  await citizen.waitForFunction(() => Boolean((window as K).__clave))
  await citizen.evaluate(async () => {
    const k = (window as K).__clave, a = k.actions
    k.setEngineSpeed(0.05)
    const c = k.getState().cases.deepfake
    a.startCase('deepfake', c.presetAnswers, 'B'); a.giveConsent('deepfake')
    await a.submitForVerification('deepfake')
  })
  await expect.poll(() => read('kpi-awaiting')).toBe(before.awaiting + 1)
  await expect.poll(() => read('doc-bar-PASSPORT')).toBe(before.passport + 1)
  await expect.poll(() => read('tier-count-p1_high_risk')).toBe(before.p1 + 1)
  await expect(officer.getByTestId('activity').getByText('Sent to officer queue').first()).toBeVisible()
  expect(errors).toEqual([])
  await ctx.close()
})

test('the site menu leads to staff access (phone)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const errors = track(page)
  await page.goto('/#/')
  await page.getByTestId('gov-menu-button').first().click()
  await page.getByRole('link', { name: /^Staff access/ }).first().click()
  await expect(page).toHaveURL(/#\/officer/)
  await expect(page.getByRole('button', { name: 'Access with certificate' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
  await ctx.close()
})
