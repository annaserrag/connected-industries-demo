/**
 * CHECK 8 — readiness as a real platform: entry points from the landing page, no demo stage, no persona list,
 * staff sign-in by certificate + PIN or by user + password, the About page discloses what is simulated.
 */
import { test, expect } from '@playwright/test'
import { BASE, DEMO_LOGINS, attachConsole, shot, staffCertificateSignIn, staffPasswordSignIn, type Problems } from './helpers'

test('8a landing leads with Apply; the menu leads to staff sign-in; no /demo stage, no persona list', async ({ page }) => {
  const problems: Problems = { console: [], external: [] }
  attachConsole(page, problems)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/#/`)
  await expect(page.getByTestId('landing-apply')).toBeVisible()
  await expect(page.getByTestId('landing-apply')).toContainText('Apply')
  await expect(page.getByRole('link', { name: /Demo mode/i })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('gov-menu-button').first().click()
  await page.getByRole('link', { name: /^Staff access/ }).first().click()
  await expect(page).toHaveURL(/#\/officer/)
  await expect(page.getByRole('heading', { level: 1, name: 'Staff identification' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Access with certificate' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Access with user and password' })).toBeVisible()
  // the demo stage is gone: /#/demo falls back to the landing page, no iframes
  await page.goto(`${BASE}/#/demo`)
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByTestId('landing-apply')).toBeVisible()
  await page.goto(`${BASE}/#/citizen`)
  // sign in / create account, and no persona list (the saved logins live only in the README)
  await expect(page.getByTestId('signin-form')).toBeVisible()
  await expect(page.locator('[data-testid^="persona-"]')).toHaveCount(0)
  for (const l of Object.values(DEMO_LOGINS)) await expect(page.getByText(l.name)).toHaveCount(0)
  expect(problems.console).toEqual([])
})

test('8b staff sign-in: certificate + PIN and user + password both reach the console; no secrets on screen', async ({ browser }) => {
  const problems: Problems = { console: [], external: [] }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  attachConsole(page, problems)
  await page.goto(`${BASE}/?debug=1#/officer`)
  await page.waitForFunction(() => !!window.__clave)
  await page.evaluate(() => { window.__clave!.actions.officerSignOut(); window.__clave!.actions.resetDemo() })
  // a wrong PIN is refused with a generic message and reveals nothing about the certificate
  await page.getByRole('button', { name: 'Access with certificate' }).click()
  await page.getByTestId('cert-cert-old').click()
  await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click()
  await page.getByLabel('PIN', { exact: true }).fill('0000')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('The PIN is not correct.')).toBeVisible()
  await expect(page.getByTestId('staff-denied')).toHaveCount(0)
  await page.getByRole('button', { name: 'Other sign-in methods' }).click()
  await staffCertificateSignIn(page)
  await shot(page, '8b-staff-console-certificate')
  await page.getByRole('button', { name: 'Sign out' }).click()
  // user + password: wrong password is generic, right one signs in (Laura already has her job details)
  await page.getByRole('button', { name: 'Access with user and password' }).click()
  await page.getByLabel('User ID').fill('lnavarro')
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await expect(page.getByText('The user or password is not correct.')).toBeVisible()
  await page.getByRole('button', { name: 'Other sign-in methods' }).click()
  await staffPasswordSignIn(page)
  const body = await page.locator('body').innerText()
  for (const secret of ['2580', 'Navarro-2026', 'not-the-password', '0000']) expect(body).not.toContain(secret)
  const audit = await page.evaluate(() => JSON.stringify(window.__clave!.getState().audit))
  for (const secret of ['Navarro-2026', 'not-the-password', '"0000"']) expect(audit).not.toContain(secret)
  expect(problems.console).toEqual([])
  await context.close()
})

test('8c About page lists what is simulated (EN + ES)', async ({ page }) => {
  await page.goto(`${BASE}/#/about`)
  const about = page.getByTestId('about-page')
  await expect(about).toBeVisible()
  await expect(about.getByRole('heading', { name: 'What is simulated' })).toBeVisible()
  for (const part of [/verification engine/i, /eIDAS/, /chip/i, /face check/i, /residence/i, /Staff certificates, PINs and staff accounts/, /wrong check letter/, /Service statistics/]) {
    await expect(about, String(part)).toContainText(part)
  }
  await page.getByRole('button', { name: 'Español' }).first().click()
  await expect(about.getByRole('heading', { name: 'Qué está simulado' })).toBeVisible()
  await expect(about).toContainText(/letra de control/i)
  await page.getByRole('button', { name: 'English' }).first().click()
})
