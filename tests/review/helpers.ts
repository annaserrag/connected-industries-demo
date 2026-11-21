import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

/** Override with REVIEW_BASE / REVIEW_SHOTS to run a second copy on another port (defaults unchanged). */
export const BASE = process.env.REVIEW_BASE ?? 'http://localhost:4180'
export const SHOTS = process.env.REVIEW_SHOTS ?? '/tmp/review-shots'

/** Saved demo accounts of the library personas (documented only in the README, never shown in the app). */
export const DEMO_LOGINS: Record<string, { doc: string; password: string; name: string }> = {
  giulia: { doc: 'DEMO-P-IT-482913', password: 'giulia-demo', name: 'Giulia Ferraro' },
  daniel: { doc: 'DEMO-TIE-Y0042719-K', password: 'daniel-demo', name: 'Daniel Mwangi' },
  rafael: { doc: 'DEMO-TIE-X0019583-R', password: 'rafael-demo', name: 'Rafael Medina' },
  noah: { doc: 'DEMO-P-DE-C01X58', password: 'noah-demo', name: 'Noah Becker' },
  yusuf: { doc: 'DEMO-RC-0117-H', password: 'yusuf-demo', name: 'Yusuf Haddad' },
  deepfake: { doc: 'DEMO-P-BG-391027', password: 'ivo-demo', name: 'Ivo Petrov (claimed)' },
  fakedoc: { doc: 'DEMO-P-HR-005521', password: 'hana-demo', name: 'Hana Kovač (claimed)' },
  linwei: { doc: 'DEMO-TIE-Z0088104-W', password: 'linwei-demo', name: 'Lin Wei' },
}

/** Citizen: open /citizen, sign out if someone is signed in, then sign in through the form as persona `id`. */
export async function citizenSignIn(citizen: Page, id: string) {
  await citizen.goto(`${BASE}/#/citizen`)
  const form = citizen.getByTestId('signin-form')
  const signOut = citizen.getByTestId('citizen-signout')
  await expect(form.or(signOut).first()).toBeVisible()
  if (await signOut.isVisible().catch(() => false)) {
    await signOut.click()
    await expect(citizen).toHaveURL(/#\/citizen$/)
  }
  await expect(form).toHaveCount(1)
  await citizen.getByTestId('signin-doc').fill(DEMO_LOGINS[id].doc)
  await citizen.getByTestId('signin-password').fill(DEMO_LOGINS[id].password)
  await form.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(citizen).toHaveURL(new RegExp(`#/citizen/(start|verify|case)/${id}`))
}

export interface Problems {
  console: string[]
  external: string[]
}

/** Records console errors/warnings, page errors and any request to a host other than localhost. */
export function watch(context: BrowserContext, problems: Problems) {
  context.on('request', req => {
    const u = req.url()
    if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return
    try {
      const host = new URL(u).hostname
      if (host !== 'localhost' && host !== '127.0.0.1') problems.external.push(u)
    } catch { problems.external.push(u) }
  })
  context.on('page', p => attachConsole(p, problems))
}

export function attachConsole(page: Page, problems: Problems) {
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') problems.console.push(`[${m.type()}] ${page.url()} :: ${m.text()}`)
  })
  page.on('pageerror', e => problems.console.push(`[pageerror] ${page.url()} :: ${e.message}`))
}

export async function twoViews(browser: Browser) {
  const problems: Problems = { console: [], external: [] }
  const context = await browser.newContext({ reducedMotion: 'no-preference' })
  watch(context, problems)
  const citizen = await context.newPage()
  await citizen.setViewportSize({ width: 390, height: 844 })
  const officer = await context.newPage()
  await officer.setViewportSize({ width: 1440, height: 900 })
  // Count full navigations (reloads) so we can prove sync happens without reload.
  const loads = { citizen: 0, officer: 0 }
  citizen.on('load', () => loads.citizen++)
  officer.on('load', () => loads.officer++)
  return { context, citizen, officer, problems, loads }
}

export async function officerSignIn(officer: Page) {
  await officer.goto(`${BASE}/#/officer`)
  await officer.getByRole('button', { name: /Laura Navarro/ }).click()
  await expect(officer.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

/** Citizen: pick persona and go through the route assistant with preset answers. Returns the recommended-route text. */
export async function citizenAssistant(citizen: Page, id: string, opts?: { assisted?: boolean }) {
  await citizenSignIn(citizen, id)
  for (let i = 0; i < 6; i++) {
    const see = citizen.getByRole('button', { name: 'See my route' })
    if (await see.isVisible().catch(() => false)) break
    if (opts?.assisted !== undefined) {
      const q = citizen.getByText('Is someone helping you on their phone?')
      if (await q.isVisible().catch(() => false)) {
        await citizen.locator(`input[name="assisted"][value="${opts.assisted ? 'yes' : 'no'}"]`).check({ force: true })
      }
    }
    await citizen.getByRole('button', { name: 'Next', exact: true }).click()
    await citizen.waitForTimeout(350)
  }
  if (opts?.assisted !== undefined) {
    // the assisted question is the last before "See my route"
    const q = citizen.getByText('Is someone helping you on their phone?')
    if (await q.isVisible().catch(() => false)) {
      await citizen.locator(`input[name="assisted"][value="${opts.assisted ? 'yes' : 'no'}"]`).check({ force: true })
    }
  }
  await citizen.getByRole('button', { name: 'See my route' }).click()
  const rec = citizen.getByTestId('recommended-route')
  await expect(rec).toBeVisible()
  return (await rec.innerText()).replace(/\s+/g, ' ')
}

export async function citizenConsent(citizen: Page) {
  await citizen.getByRole('button', { name: 'Continue with this route' }).click()
  await citizen.getByRole('button', { name: 'I agree, start the checks' }).click()
}

export async function citizenChipAndFace(citizen: Page) {
  await citizen.getByRole('button', { name: 'Start reading the chip' }).click()
  await citizen.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 15_000 })
  await citizen.getByRole('button', { name: 'Start the face check' }).click()
  await citizen.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 15_000 })
}

export async function citizenToStatus(citizen: Page) {
  await citizen.getByRole('button', { name: 'Go to my status' }).click({ timeout: 30_000 })
  await expect(citizen).toHaveURL(/#\/citizen\/case\//)
}

/** Officer: wait (no reload) for the case to appear in the queue and open it. */
export async function officerOpenFromQueue(officer: Page, name: string) {
  if (!/#\/officer\/?$/.test(officer.url())) await officer.getByRole('link', { name: /^Case queue/ }).first().click()
  const link = officer.getByRole('table').getByRole('link', { name, exact: true })
  await expect(link).toBeVisible({ timeout: 30_000 })
  await link.click()
  await expect(officer).toHaveURL(/#\/officer\/case\//)
}

export async function officerRefuse(officer: Page, reasonLabel: string) {
  await officer.getByRole('button', { name: /^Refuse/ }).click()
  const dlg = officer.getByRole('dialog')
  await expect(dlg).toBeVisible()
  await dlg.getByRole('radio', { name: new RegExp(reasonLabel) }).click()
  await dlg.getByRole('button', { name: 'Confirm refusal' }).click()
  await expect(dlg).toBeHidden()
}

export async function shot(page: Page, name: string) {
  const p = `${SHOTS}/${name}.png`
  await page.screenshot({ path: p, fullPage: true })
  return p
}

export const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('getyourclave.state.v1') || 'null'))

/** Sign a persona in through the store action (page must expose window.__clave, i.e. ?debug=1). Synced to every tab. */
export async function signInAs(page: Page, id: string) {
  const ok = await page.evaluate(([d, p]) => window.__clave!.actions.citizenSignIn(d, p).ok, [DEMO_LOGINS[id].doc, DEMO_LOGINS[id].password] as const)
  expect(ok, `sign in as ${id}`).toBe(true)
}
