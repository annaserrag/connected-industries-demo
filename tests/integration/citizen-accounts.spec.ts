/**
 * Citizen accounts (branch feature/citizen-accounts): sign in, sign up, sign out, access control,
 * no persona listing anywhere in the app, reset.
 * Run: PORT=5181 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test tests/integration/citizen-accounts.spec.ts --output /tmp/ca-results
 */
import { test, expect, type Page } from '@playwright/test'
import { C } from '../../src/citizen/copy'
import { CASE_LIBRARY, DEMO_ACCOUNT_PASSWORDS, SIGNUP_COUNTRIES, STATE_VERSION, STORAGE_KEY, isFictionalDniNie } from '../../src/contract/seed'

const PHONE = { width: 390, height: 844 }
const NAMES = CASE_LIBRARY.map(c => c.persona.name)
const D = '/?debug=1'

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  return errors
}

async function fresh(page: Page, path = '#/citizen') {
  await page.goto(`${D}#/`)
  await page.waitForFunction(() => Boolean(window.__clave))
  await page.evaluate(() => { const k = window.__clave!; k.actions.resetDemo(); k.actions.officerSignOut(); k.actions.setLang('en') })
  await page.goto(`${D}${path}`)
}

async function signInForm(page: Page, doc: string, password: string) {
  await expect(page.getByTestId('signin-form')).toHaveCount(1)
  await page.getByTestId('signin-doc').fill(doc)
  await page.getByTestId('signin-password').fill(password)
  await page.getByTestId('signin-form').getByRole('button', { name: 'Sign in', exact: true }).click()
}

async function signOut(page: Page) {
  await page.getByTestId('citizen-signout').click()
  await expect(page).toHaveURL(/#\/citizen$/)
  await expect(page.getByTestId('signin-form')).toBeVisible()
}

const yearsAgo = (n: number) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return d.toISOString().slice(0, 10)
}

test.describe('citizen accounts', () => {
  test.use({ viewport: PHONE })

  test('all 8 personas sign in; wrong credentials fail with one generic message', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    for (const c of CASE_LIBRARY) {
      // case and spaces in the document number don't matter
      const typed = c.id === 'daniel' ? ` ${c.document.number.toLowerCase()} ` : c.document.number
      await signInForm(page, typed, DEMO_ACCOUNT_PASSWORDS[c.id])
      await expect(page).toHaveURL(new RegExp(`#/citizen/start/${c.id}`))
      await expect(page.getByText(`Hi, ${c.persona.name.split(' ')[0]}.`)).toBeVisible()
      expect(await page.evaluate(() => window.__clave!.getState().activeCitizenCaseId)).toBe(c.id)
      await signOut(page)
    }
    // wrong password and unknown number: same generic message, no hint which part was wrong
    await signInForm(page, CASE_LIBRARY[0].document.number, 'not-the-password')
    const alert = page.getByRole('alert').filter({ hasText: C.invalidCredentials.en })
    await expect(alert).toBeVisible()
    const msgWrongPwd = await alert.innerText()
    await signInForm(page, 'XX0000000', DEMO_ACCOUNT_PASSWORDS.giulia)
    await expect(page.getByRole('alert').filter({ hasText: C.invalidCredentials.en })).toHaveText(msgWrongPwd)
    await expect(page.getByText(/password is wrong|wrong password|unknown document|not registered/i)).toHaveCount(0)
    expect(await page.evaluate(() => window.__clave!.getState().activeCitizenCaseId)).toBeNull()
    // the action itself
    const r = await page.evaluate(giulia => [
      window.__clave!.actions.citizenSignIn(giulia, 'nope'),
      window.__clave!.actions.citizenSignIn('ZZ0000000', 'giulia-demo'),
      window.__clave!.actions.citizenSignIn('', ''),
    ], CASE_LIBRARY[0].document.number)
    for (const x of r) expect(x).toEqual({ ok: false, reason: 'invalid_credentials' })
    // passwords are never stored in plain text
    const raw = await page.evaluate(k => localStorage.getItem(k), STORAGE_KEY)
    for (const p of Object.values(DEMO_ACCOUNT_PASSWORDS)) expect(raw).not.toContain(p)
    expect(errors).toEqual([])
  })

  test('sign-up validation: underage, weak password, wrong document for the country (UI + action)', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    await page.getByRole('button', { name: 'Create your account' }).click()
    const form = page.getByTestId('signup-form')
    // empty submit: every field explains itself, focus goes to the first invalid one
    await form.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert').filter({ hasText: C.fixFields.en })).toBeVisible()
    await expect(page.getByLabel('Full name')).toBeFocused()
    await expect(page.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await page.getByLabel('Full name').getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy!.split(' ')[0]}"]`)).toContainText(C.errName.en)

    await page.getByLabel('Full name').fill('Tomás Ibarra Ruiz')
    // underage
    await page.getByLabel('Date of birth').fill(yearsAgo(15))
    await page.getByLabel('Date of birth').blur()
    await expect(page.getByText('You must be 18 or older to create an account.', { exact: false })).toBeVisible()
    await page.getByLabel('Date of birth').fill(yearsAgo(30))
    await expect(page.getByText('You must be 18 or older', { exact: false })).toHaveCount(0)
    // wrong document for the country: DNI is only for Spanish nationals
    await page.getByLabel('Nationality').selectOption({ label: 'Spain' })
    await page.getByText('Spanish DNI', { exact: true }).click()
    await page.getByLabel('Nationality').selectOption({ label: 'Italy' })
    await expect(page.getByText(C.errDocForCountry.en)).toBeVisible()
    await expect(page.getByText('Spanish DNI', { exact: true })).toHaveCount(0)
    await expect(page.getByText('EU national eID', { exact: true })).toBeVisible()
    // weak password + mismatch
    await page.getByLabel('Create a password').fill('short')
    await page.getByLabel('Create a password').blur()
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
    await page.getByLabel('Repeat the password').fill('different-one')
    await page.getByLabel('Repeat the password').blur()
    await expect(page.getByText(C.errMismatch.en)).toBeVisible()
    await page.screenshot({ path: '/tmp/ca-shots/test-signup-errors.png', fullPage: true })
    await form.getByRole('button', { name: 'Create account' }).click()
    expect(await page.evaluate(() => Object.keys(window.__clave!.getState().accounts).length)).toBe(8)

    // the action validates on its own too
    const italy = SIGNUP_COUNTRIES.findIndex(c => c.name.en === 'Italy')
    const r = await page.evaluate(({ italy, dob, kid }) => {
      const a = window.__clave!.actions
      const base = { fullName: 'Tomás Ibarra', dateOfBirth: dob, countryIndex: italy, documentType: 'PASSPORT' as const, password: 'long-enough-1' }
      return {
        dni: a.citizenSignUp({ ...base, documentType: 'DNI' }),
        kid: a.citizenSignUp({ ...base, dateOfBirth: kid }),
        weak: a.citizenSignUp({ ...base, password: 'abc' }),
        name: a.citizenSignUp({ ...base, fullName: 'X' }),
        badCountry: a.citizenSignUp({ ...base, countryIndex: 999 }),
      }
    }, { italy, dob: yearsAgo(30), kid: yearsAgo(17) })
    expect(r.dni).toEqual({ ok: false, reason: 'invalid_document_for_country' })
    expect(r.kid).toEqual({ ok: false, reason: 'underage' })
    expect(r.weak).toEqual({ ok: false, reason: 'weak_password' })
    expect(r.name).toEqual({ ok: false, reason: 'invalid_name' })
    expect(r.badCountry).toEqual({ ok: false, reason: 'invalid_document_for_country' })
    expect(await page.evaluate(() => Object.keys(window.__clave!.getState().accounts).length)).toBe(8)
    expect(errors).toEqual([])
  })

  test('a new sign-up runs end to end, appears live in the officer queue, officer approves, citizen sees it', async ({ browser }) => {
    const ctx = await browser.newContext()
    const citizen = await ctx.newPage(); await citizen.setViewportSize(PHONE)
    const officer = await ctx.newPage(); await officer.setViewportSize({ width: 1440, height: 900 })
    const errors = [...trackErrors(citizen), ...trackErrors(officer)]
    await fresh(citizen)
    await citizen.evaluate(() => window.__clave!.setEngineSpeed(0.3))
    await officer.goto('/?debug=1#/officer')
    await officer.waitForFunction(() => Boolean(window.__clave))
    await officer.evaluate(() => window.__clave!.actions.officerSignIn('OF-DEMO-07'))

    await citizen.bringToFront()
    await citizen.getByRole('button', { name: 'Create your account' }).click()
    await citizen.getByLabel('Full name').fill('  Amira   Benali ')
    await citizen.getByLabel('Date of birth').fill('1996-04-12')
    await citizen.getByLabel('Nationality').selectOption({ label: 'Morocco' })
    await citizen.getByText('Passport', { exact: true }).click()
    await citizen.getByLabel('Create a password').fill('sunflower-42')
    await citizen.getByLabel('Repeat the password').fill('sunflower-42')
    await citizen.getByTestId('signup-form').getByRole('button', { name: 'Create account' }).click()

    // success step: the assigned applicant number (realistic passport shape), a copy button, then the route assistant
    await expect(citizen).toHaveURL(/#\/citizen\/welcome\/su-/)
    await expect(citizen.getByRole('heading', { name: 'Account created' })).toBeVisible()
    const number = (await citizen.getByTestId('assigned-number').innerText()).trim()
    expect(number).toMatch(/^[A-Z]{2}\d{7}$/)
    await expect(citizen.getByText('Your applicant number', { exact: true })).toBeVisible()
    await expect(citizen.locator('body')).not.toContainText(/demo/i)
    await citizen.getByRole('button', { name: 'Copy applicant number' }).click()
    await expect(citizen.getByRole('button', { name: 'Copy applicant number' })).toContainText(/Copied|Copy/)
    const id = await citizen.evaluate(() => window.__clave!.getState().activeCitizenCaseId)
    expect(id).toMatch(/^su-/)
    const st = await citizen.evaluate(id => {
      const s = window.__clave!.getState()
      const c = s.cases[id!]
      return {
        origin: c.origin, status: c.status, persona: c.persona, doc: c.document, preset: c.presetAnswers, attempts: c.simulation.attempts.length,
        account: s.accounts[id!], audit: s.audit.filter(e => e.caseId === id),
      }
    }, id)
    expect(st).toMatchObject({ origin: 'signup', status: 'draft', attempts: 0 })
    expect(st.persona).toMatchObject({ name: 'Amira Benali', initials: 'AB', nationality: 'Moroccan', age: expect.any(Number) })
    expect(st.doc.number).toBe(number)
    expect(st.doc.expires > new Date().toISOString().slice(0, 10)).toBe(true)
    expect(st.preset).toEqual({ nationalityGroup: 'non_eu', document: 'PASSPORT', hasEuEid: false, assisted: false })
    expect(st.account).toMatchObject({ caseId: id, documentNumber: number, origin: 'signup' })
    expect(st.account.passwordHash).not.toContain('sunflower')
    expect(st.audit.map(e => e.action)).toEqual(['account_created'])
    expect(JSON.stringify(st.audit)).not.toContain('sunflower')

    await citizen.getByRole('button', { name: 'Find my route' }).click()
    await expect(citizen).toHaveURL(new RegExp(`#/citizen/start/${id}`))
    await expect(citizen.getByText('Hi, Amira.')).toBeVisible()
    for (let i = 0; i < 6; i++) {
      if (await citizen.getByRole('button', { name: 'See my route' }).isVisible()) break
      await citizen.getByRole('button', { name: 'Next', exact: true }).click()
      await citizen.waitForTimeout(300)
    }
    await citizen.getByRole('button', { name: 'See my route' }).click()
    await expect(citizen.getByTestId('recommended-route')).toContainText('Passport or TIE chip')
    await citizen.getByRole('button', { name: 'Continue with this route' }).click()
    await citizen.getByRole('button', { name: 'I agree, start the checks' }).click()
    await citizen.getByRole('button', { name: 'Start reading the chip' }).click()
    await citizen.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 15_000 })
    await citizen.getByRole('button', { name: 'Start the face check' }).click()
    await citizen.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 15_000 })
    await expect(citizen.getByText('All done: you have Cl@ve.')).toBeVisible({ timeout: 20_000 })
    await citizen.getByRole('button', { name: 'Go to my status' }).click()
    await expect(citizen.getByTestId('levels')).toContainText('Advanced: pending review by a person')

    // officer (second page, no reload) sees the new case live and grants the advanced level
    const link = officer.getByRole('table').getByRole('link', { name: 'Amira Benali', exact: true })
    await expect(link).toBeVisible({ timeout: 15_000 })
    await link.click()
    await officer.getByRole('button', { name: /Grant advanced level/ }).click()
    await expect(citizen.getByTestId('levels')).toContainText('Advanced level granted', { timeout: 10_000 })

    // sign out, sign back in with the assigned number
    await citizen.bringToFront()
    await signOut(citizen)
    await signInForm(citizen, number, 'sunflower-42')
    await expect(citizen).toHaveURL(new RegExp(`#/citizen/case/${id}`))
    await expect(citizen.getByTestId('levels')).toContainText('Advanced level granted')
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('personas never appear on the citizen sign-in screen (phone and desktop)', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    await expect(page.getByTestId('signin-form')).toBeVisible()
    const body = await page.locator('body').innerText()
    for (const n of NAMES) expect(body, n).not.toContain(n)
    await page.getByRole('button', { name: 'Create your account' }).click()
    const body2 = await page.locator('body').innerText()
    for (const n of NAMES) expect(body2, n).not.toContain(n)
    for (const c of CASE_LIBRARY) {
      expect(body2).not.toContain(c.document.number)
      expect(body2).not.toContain(DEMO_ACCOUNT_PASSWORDS[c.id])
    }
    await expect(page.locator('[data-testid^="persona-"]')).toHaveCount(0)

    // the old demo stage is gone; the desktop sign-in page shows no personas either
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${D}#/demo`)
    await expect(page.locator('iframe')).toHaveCount(0)
    await page.goto(`${D}#/citizen`)
    await expect(page.getByTestId('signin-form')).toBeVisible()
    const desk = await page.locator('body').innerText()
    for (const n of NAMES) expect(desk, n).not.toContain(n)
    expect(desk).not.toMatch(/Simulated|demo/i)
    expect(errors).toEqual([])
  })

  test('deep link to a case: blocked while signed out and for another person', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page, '#/citizen/case/giulia')
    await expect(page.getByTestId('signin-form')).toBeVisible()
    await expect(page.getByTestId('signin-notice')).toHaveText(C.signedOutNote.en)
    await expect(page.getByText('Giulia Ferraro')).toHaveCount(0)
    for (const p of ['start', 'verify', 'welcome']) {
      await page.goto(`${D}#/citizen/${p}/giulia`)
      await expect(page.getByTestId('signin-form')).toBeVisible()
    }
    // signed in as Daniel: Giulia's application is not reachable
    await page.goto(`${D}#/citizen`)
    await signInForm(page, CASE_LIBRARY.find(c => c.id === 'daniel')!.document.number, DEMO_ACCOUNT_PASSWORDS.daniel)
    await expect(page).toHaveURL(/#\/citizen\/start\/daniel/)
    await page.goto(`${D}#/citizen/case/giulia`)
    await expect(page.getByTestId('signin-notice')).toHaveText(C.otherCaseNote.en)
    await expect(page.getByText('Giulia Ferraro')).toHaveCount(0)
    await expect(page.getByTestId('levels')).toHaveCount(0)
    // background cases are never reachable from the citizen side either
    await page.goto(`${D}#/citizen/case/bg-07`)
    await expect(page.getByTestId('signin-form')).toBeVisible()
    await expect(page.getByText('Aisha Rahman')).toHaveCount(0)
    // signing in as the owner opens it
    await signInForm(page, CASE_LIBRARY.find(c => c.id === 'giulia')!.document.number, DEMO_ACCOUNT_PASSWORDS.giulia)
    await expect(page).toHaveURL(/#\/citizen\/start\/giulia/)
    expect(errors).toEqual([])
  })

  test('sign out from the header ends the session in every tab', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: PHONE })
    const a = await ctx.newPage()
    const errors = trackErrors(a)
    await fresh(a)
    await signInForm(a, CASE_LIBRARY.find(c => c.id === 'yusuf')!.document.number, DEMO_ACCOUNT_PASSWORDS.yusuf)
    await expect(a).toHaveURL(/#\/citizen\/start\/yusuf/)
    const b = await ctx.newPage()
    await b.goto(`${D}#/citizen/start/yusuf`)
    await expect(b.getByText('Hi, Yusuf.')).toBeVisible()
    await a.bringToFront()
    await a.getByRole('button', { name: /^Sign out \(Yusuf Haddad\)/ }).click()
    await expect(a.getByTestId('signin-form')).toBeVisible()
    expect(await a.evaluate(() => window.__clave!.getState().activeCitizenCaseId)).toBeNull()
    await expect(b.getByTestId('signin-form')).toBeVisible()
    await expect(b.getByText('Hi, Yusuf.')).toHaveCount(0)
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('reset removes sign-up accounts and their cases; resetCase works for sign-ups', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    const r = await page.evaluate(() => {
      const k = window.__clave!
      k.setEngineSpeed(0)
      const res = k.actions.citizenSignUp({ fullName: 'Lena Vogel', dateOfBirth: '1990-01-01', countryIndex: 3, documentType: 'EU_EID', password: 'lena-test-pass' })
      if (!res.ok) throw new Error(res.reason)
      const c = k.getState().cases[res.caseId]
      return { ...res, hasEuEid: c.presetAnswers.hasEuEid, group: c.presetAnswers.nationalityGroup }
    })
    expect(r.ok).toBe(true)
    expect(r.documentNumber).toMatch(/^[A-Z][A-Z0-9]{8}$/)
    // DNI / NIE-shaped generated numbers always fail the real check-letter test
    const shapes = await page.evaluate(() => {
      const k = window.__clave!
      const out: Record<string, string> = {}
      for (const [i, t] of [[0, 'DNI'], [9, 'TIE'], [9, 'NIE_PAPER'], [9, 'RED_CARD'], [9, 'PASSPORT']] as const) {
        const res = k.actions.citizenSignUp({ fullName: 'Ana Prueba Ficticia', dateOfBirth: '1990-01-01', countryIndex: i, documentType: t, password: 'long-enough-pass' })
        if (!res.ok) throw new Error(res.reason)
        out[t] = res.documentNumber
      }
      return out
    })
    for (const t of ['DNI', 'TIE', 'NIE_PAPER', 'RED_CARD']) expect(isFictionalDniNie(shapes[t]), `${t} ${shapes[t]}`).toBe(true)
    expect(shapes.DNI).toMatch(/^\d{8}[A-Z]$/)
    expect(shapes.TIE).toMatch(/^[XYZ]\d{7}[A-Z]$/)
    expect(shapes.PASSPORT).toMatch(/^[A-Z]{2}\d{7}$/)
    expect(JSON.stringify(shapes)).not.toContain('DEMO')
    expect(r).toMatchObject({ hasEuEid: true, group: 'eu' })
    // run it through route A, then reset only this case
    const afterRun = await page.evaluate(async id => {
      const k = window.__clave!
      const c = k.getState().cases[id]
      k.actions.startCase(id, c.presetAnswers, 'A'); k.actions.giveConsent(id)
      await k.actions.submitForVerification(id)
      const done = k.getState().cases[id]
      k.actions.resetCase(id)
      const reset = k.getState().cases[id]
      return { done: { status: done.status, level: done.level }, reset: { status: reset.status, checks: reset.checks.length, name: reset.persona.name } }
    }, r.caseId)
    expect(afterRun.done).toEqual({ status: 'approved', level: 'basic' })
    expect(afterRun.reset).toEqual({ status: 'draft', checks: 0, name: 'Lena Vogel' })

    expect(await page.evaluate(() => Object.keys(window.__clave!.getState().accounts).length)).toBe(14)
    await page.evaluate(() => window.__clave!.actions.resetDemo())
    const after = await page.evaluate(([doc, id]) => {
      const s = window.__clave!.getState()
      return {
        accounts: Object.keys(s.accounts).length, hasCase: Boolean(s.cases[id]), active: s.activeCitizenCaseId,
        signIn: window.__clave!.actions.citizenSignIn(doc, 'lena-test-pass'),
      }
    }, [r.documentNumber, r.caseId] as const)
    expect(after).toEqual({ accounts: 8, hasCase: false, active: null, signIn: { ok: false, reason: 'invalid_credentials' } })
    await expect(page.getByTestId('signin-form')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('saved state from the previous version (v1) is discarded cleanly', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto(`${D}#/`)
    await page.waitForFunction(() => Boolean(window.__clave))
    await page.evaluate(() => window.__clave!.actions.resetDemo()) // persists the current state
    await page.evaluate(k => {
      const s = JSON.parse(localStorage.getItem(k)!)
      delete s.accounts
      s.version = 1
      s.activeCitizenCaseId = 'giulia'
      localStorage.setItem(k, JSON.stringify(s))
    }, STORAGE_KEY)
    await page.reload()
    await page.waitForFunction(() => Boolean(window.__clave))
    const s = await page.evaluate(() => { const s = window.__clave!.getState(); return { v: s.version, n: Object.keys(s.accounts).length, active: s.activeCitizenCaseId } })
    expect(s).toEqual({ v: STATE_VERSION, n: 8, active: null })
    await page.goto(`${D}#/citizen`)
    await expect(page.getByTestId('signin-form')).toBeVisible()
    expect(errors).toEqual([])
  })
})
