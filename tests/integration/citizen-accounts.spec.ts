/**
 * Citizen accounts: sign in with document number + password, typed sign-up (MSG-AI-02 fields) with plain-word
 * errors, sign out, access control, no persona listing anywhere, reset.
 * Run: PORT=5181 npx playwright test -c pw.local.config.ts tests/integration/citizen-accounts.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { C } from '../../src/citizen/copy'
import { DEMO_PEOPLE } from '../../src/contract/world'
import { SIGNUP_COUNTRIES, STATE_VERSION, STORAGE_KEY } from '../../src/contract/seed'

const PHONE = { width: 390, height: 844 }
const PRELOADED = DEMO_PEOPLE.filter(p => p.caseId)
const NAMES = DEMO_PEOPLE.map(p => `${p.account.givenNames} ${p.account.surnames}`)
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
  await page.evaluate(() => { const k = window.__clave!; k.actions.resetDemo(); k.actions.officerSignOut(); k.actions.citizenSignOut(); k.actions.setLang('en') })
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
  // Mid-flow the sign-out asks for a small confirmation first.
  const confirm = page.getByTestId('signout-confirm')
  await confirm.waitFor({ state: 'visible', timeout: 800 }).then(() => confirm.click(), () => {})
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

  test('every preloaded account signs in (draft → route assistant); wrong credentials fail with one generic message', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    for (const p of PRELOADED) {
      const typed = p.caseId === 'daniel' ? ` ${p.account.documentNumber.toLowerCase()} ` : p.account.documentNumber
      await signInForm(page, typed, p.account.password)
      await expect(page).toHaveURL(new RegExp(`#/citizen/start/${p.caseId}`))
      await expect(page.getByText(`Hi, ${p.account.givenNames.split(' ')[0]}.`)).toBeVisible()
      await signOut(page)
    }
    const kenji = PRELOADED[0].account
    await signInForm(page, kenji.documentNumber, 'not-the-password')
    const alert = page.getByRole('alert').filter({ hasText: C.invalidCredentials.en })
    await expect(alert).toBeVisible()
    const msg = await alert.innerText()
    await signInForm(page, 'XX0000000', kenji.password)
    await expect(page.getByRole('alert').filter({ hasText: C.invalidCredentials.en })).toHaveText(msg)
    expect(await page.evaluate(() => window.__clave!.getState().activeCitizenCaseId)).toBeNull()
    const raw = await page.evaluate(k => localStorage.getItem(k), STORAGE_KEY)
    for (const p of PRELOADED) expect(raw).not.toContain(p.account.password)
    expect(errors).toEqual([])
  })

  test('sign-up: MSG-AI-02 fields, plain-word errors (real DNI letter, wrong shape, duplicate, underage)', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    await page.getByRole('button', { name: 'Create your account' }).click()
    const form = page.getByTestId('signup-form')
    await expect(page.getByTestId('msg-AI-01')).toBeVisible()
    await form.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert').filter({ hasText: C.fixFields.en })).toBeVisible()
    await expect(page.getByLabel('Given names')).toBeFocused()

    await page.getByLabel('Given names').fill('Tomás')
    await page.getByLabel('Surnames').fill('Ibarra Ruiz')
    await page.getByLabel('Date of birth').fill(yearsAgo(15))
    await page.getByLabel('Date of birth').blur()
    await expect(page.getByText('You must be 18 or older', { exact: false })).toBeVisible()
    await page.getByLabel('Date of birth').fill(yearsAgo(30))
    await page.getByLabel('Nationality').selectOption({ label: 'Spain' })
    await page.getByText('Spanish DNI', { exact: true }).click()
    // a DNI with a valid check letter could be a real person's: refused
    await page.getByLabel('Document number').fill('12345678Z')
    await page.getByLabel('Document number').blur()
    await expect(page.getByText(C.errRealNumber.en)).toBeVisible()
    await page.getByLabel('Document number').fill('ABC')
    await expect(page.getByText(C.errDocShape.en)).toBeVisible()
    // duplicate of a preloaded account (Ernesto's fictional DNI)
    const ernesto = DEMO_PEOPLE.find(p => p.caseId === 'ernesto')!.account
    await page.getByLabel('Document number').fill(ernesto.documentNumber)
    await page.getByLabel('Expiry date').fill('2031-01-01')
    await page.getByLabel('Create a password').fill('long-enough-1')
    await page.getByLabel('Repeat the password').fill('long-enough-1')
    await form.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert').filter({ hasText: C.errDuplicate.en })).toBeVisible()
    await page.getByLabel('Nationality').selectOption({ label: 'Italy' })
    await expect(page.getByText(C.errDocForCountry.en)).toBeVisible()

    const italy = SIGNUP_COUNTRIES.findIndex(c => c.name.en === 'Italy')
    const r = await page.evaluate(({ italy, dob }) => {
      const a = window.__clave!.actions
      const base = { givenNames: 'Tomás', surnames: 'Ibarra', dateOfBirth: dob, countryIndex: italy, documentType: 'PASSPORT' as const, documentNumber: 'TI1234567', expiryDate: '2031-01-01', password: 'long-enough-1' }
      return { dni: a.citizenSignUp({ ...base, documentType: 'DNI' }), weak: a.citizenSignUp({ ...base, password: 'abc' }), real: a.citizenSignUp({ ...base, documentType: 'TIE', documentNumber: 'X1234567L' }) }
    }, { italy, dob: yearsAgo(30) })
    expect(r.dni).toEqual({ ok: false, reason: 'invalid_document_for_country' })
    expect(r.weak).toEqual({ ok: false, reason: 'weak_password' })
    expect(r.real).toEqual({ ok: false, reason: 'real_document_number' })
    expect(await page.evaluate(() => Object.keys(window.__clave!.getState().accounts).length)).toBe(PRELOADED.length)
    expect(errors).toEqual([])
  })

  test('a typed sign-up signs in with its document number afterwards', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    await page.getByRole('button', { name: 'Create your account' }).click()
    await page.getByLabel('Given names').fill('  Amira ')
    await page.getByLabel('Surnames').fill('Benali')
    await page.getByLabel('Date of birth').fill('1996-04-12')
    await page.getByLabel('Nationality').selectOption({ label: 'Morocco' })
    await page.getByText('Passport', { exact: true }).click()
    await page.getByLabel('Document number').fill('mb 4417203')
    await page.getByLabel('Expiry date').fill('2032-02-02')
    await page.getByLabel('Create a password').fill('sunflower-42')
    await page.getByLabel('Repeat the password').fill('sunflower-42')
    await page.getByTestId('signup-form').getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/#\/citizen\/welcome\//)
    await expect(page.getByTestId('assigned-number')).toHaveText('MB4417203')
    const st = await page.evaluate(() => {
      const s = window.__clave!.getState()
      const c = s.cases[s.activeCitizenCaseId!]
      return { origin: c.origin, status: c.status, typed: c.typed, audit: s.audit.filter(e => e.caseId === c.id).map(e => e.action) }
    })
    expect(st).toMatchObject({ origin: 'signup', status: 'draft', typed: { type: 'PASSPORT', number: 'MB4417203', expiry: '2032-02-02', data: { givenNames: 'Amira', surnames: 'Benali', dateOfBirth: '1996-04-12' } } })
    expect(st.audit).toEqual(['account_created'])
    await page.getByRole('button', { name: 'Find my route' }).click()
    await expect(page.getByText('Hi, Amira.')).toBeVisible()
    await signOut(page)
    await signInForm(page, 'MB4417203', 'sunflower-42')
    await expect(page).toHaveURL(/#\/citizen\/start\//)
    expect(errors).toEqual([])
  })

  test('personas never appear on the citizen sign-in screen (phone and desktop)', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    for (const vp of [PHONE, { width: 1440, height: 900 }]) {
      await page.setViewportSize(vp)
      await page.getByRole('button', { name: 'Create your account' }).click()
      const body = await page.locator('body').innerText()
      for (const n of NAMES) expect(body, n).not.toContain(n)
      for (const p of DEMO_PEOPLE) {
        expect(body).not.toContain(p.account.documentNumber)
        expect(body).not.toContain(p.account.password)
      }
    }
    expect(errors).toEqual([])
  })

  test('deep link to a case: blocked while signed out and for another person', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page, '#/citizen/case/kenji')
    await expect(page.getByTestId('signin-notice')).toHaveText(C.signedOutNote.en)
    for (const p of ['start', 'verify', 'welcome']) {
      await page.goto(`${D}#/citizen/${p}/kenji`)
      await expect(page.getByTestId('signin-form')).toBeVisible()
    }
    const daniel = DEMO_PEOPLE.find(p => p.caseId === 'daniel')!.account
    await page.goto(`${D}#/citizen`)
    await signInForm(page, daniel.documentNumber, daniel.password)
    await expect(page).toHaveURL(/#\/citizen\/start\/daniel/)
    await page.goto(`${D}#/citizen/case/kenji`)
    await expect(page.getByTestId('signin-notice')).toHaveText(C.otherCaseNote.en)
    await expect(page.getByText('Kenji Mori')).toHaveCount(0)
    await page.goto(`${D}#/citizen/case/bg-07`)
    await expect(page.getByTestId('signin-form')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('sign out from the header ends the session in every tab', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: PHONE })
    const a = await ctx.newPage()
    const errors = trackErrors(a)
    await fresh(a)
    const kenji = DEMO_PEOPLE.find(p => p.caseId === 'kenji')!.account
    await signInForm(a, kenji.documentNumber, kenji.password)
    await expect(a).toHaveURL(/#\/citizen\/start\/kenji/)
    const b = await ctx.newPage()
    await b.goto(`${D}#/citizen/start/kenji`)
    await expect(b.getByText('Hi, Kenji.')).toBeVisible()
    await a.bringToFront()
    await a.getByRole('button', { name: /^Sign out \(Kenji Mori\)/ }).click()
    await expect(a.getByTestId('signin-form')).toBeVisible()
    await expect(b.getByTestId('signin-form')).toBeVisible()
    expect(errors).toEqual([])
    await ctx.close()
  })

  test('reset removes sign-up accounts; resetCase brings a sign-up back to draft', async ({ page }) => {
    const errors = trackErrors(page)
    await fresh(page)
    const r = await page.evaluate(async () => {
      const k = window.__clave!
      k.setEngineSpeed(0)
      const res = k.actions.citizenSignUp({ givenNames: 'Lena', surnames: 'Vogel', dateOfBirth: '1990-01-01', countryIndex: 3, documentType: 'EU_EID', documentNumber: 'L01X00T47', expiryDate: '2031-01-01', password: 'lena-test-pass' })
      if (!res.ok) throw new Error(res.reason)
      const id = res.caseId
      const a = k.actions
      a.setAnswers(id, { document: 'EU_EID', euEid: 'yes', who: 'self' })
      a.giveConsents(id, { residence: true })
      a.recordEidLogin(id)
      a.setContact(id, { mobile: '+34 611 222 333' })
      a.confirmSms(id, '123456')
      a.confirmReview(id)
      await a.submit(id)
      const done = k.getState().cases[id]
      a.resetCase(id)
      const reset = k.getState().cases[id]
      return { id, doc: res.documentNumber, done: [done.status, done.level], reset: [reset.status, reset.checks.length] }
    })
    expect(r.done).toEqual(['approved', 'basic'])
    expect(r.reset).toEqual(['draft', 0])
    await page.evaluate(() => window.__clave!.actions.resetDemo())
    const after = await page.evaluate(([doc, id]) => {
      const s = window.__clave!.getState()
      return { accounts: Object.keys(s.accounts).length, hasCase: Boolean(s.cases[id]), signIn: window.__clave!.actions.citizenSignIn(doc, 'lena-test-pass') }
    }, [r.doc, r.id] as const)
    expect(after).toEqual({ accounts: PRELOADED.length, hasCase: false, signIn: { ok: false, reason: 'invalid_credentials' } })
    expect(errors).toEqual([])
  })

  test('saved state from an older version is discarded cleanly', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto(`${D}#/`)
    await page.waitForFunction(() => Boolean(window.__clave))
    await page.evaluate(() => window.__clave!.actions.resetDemo())
    await page.evaluate(k => {
      const s = JSON.parse(localStorage.getItem(k)!)
      delete s.accounts
      s.version = 1
      s.activeCitizenCaseId = 'kenji'
      localStorage.setItem(k, JSON.stringify(s))
    }, STORAGE_KEY)
    await page.reload()
    await page.waitForFunction(() => Boolean(window.__clave))
    const s = await page.evaluate(() => { const s = window.__clave!.getState(); return { v: s.version, n: Object.keys(s.accounts).length, active: s.activeCitizenCaseId } })
    expect(s).toEqual({ v: STATE_VERSION, n: PRELOADED.length, active: null })
    expect(errors).toEqual([])
  })
})
