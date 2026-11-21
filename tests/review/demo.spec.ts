/**
 * CHECK 8 — demo readiness: entry points from the landing page, /#/demo side by side, case library, reset.
 */
import { test, expect } from '@playwright/test'
import { BASE, attachConsole, shot, staffCertificateSignIn, type Problems } from './helpers'

test('8a landing leads with Apply; Staff access tab leads to sign-in; /demo by URL only', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/#/`)
  await expect(page.getByTestId('landing-citizen')).toBeVisible()
  await expect(page.getByTestId('landing-citizen')).toContainText('Apply')
  // the dashboard now lives in the staff console; demo mode is reachable by URL only
  await expect(page.getByRole('link', { name: /Demo mode|dashboard/i })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Staff access' }).click()
  await expect(page.getByTestId('landing-officer')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('landing-officer')).toBeVisible()
  await page.getByTestId('landing-officer').click()
  await expect(page.getByRole('button', { name: 'Sign in with your electronic certificate' })).toBeVisible()
  await page.goto(`${BASE}/#/demo`)
  await expect(page.locator('iframe')).toHaveCount(2)
  await page.goto(`${BASE}/#/citizen`)
  await expect(page.locator('[data-testid^="persona-"]')).toHaveCount(8)
})

test('8b /#/demo: citizen + officer side by side, live sync inside iframes, reset works', async ({ page }) => {
  const problems: Problems = { console: [], external: [] }
  attachConsole(page, problems)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/#/demo`)
  const frames = page.locator('iframe')
  await expect(frames).toHaveCount(2)
  const srcs = await frames.evaluateAll(f => f.map(x => (x as HTMLIFrameElement).getAttribute('src')))
  expect(srcs).toEqual(['#/citizen?embed=1', '#/officer?embed=1'])
  const boxes = await frames.evaluateAll(f => f.map(x => x.getBoundingClientRect()).map(r => ({ x: r.x, y: r.y, w: r.width, h: r.height })))
  expect(boxes[0].x + boxes[0].w).toBeLessThanOrEqual(boxes[1].x) // side by side
  expect(boxes[0].w).toBeGreaterThan(200); expect(boxes[1].w).toBeGreaterThan(500)
  const phone = page.frameLocator('iframe').first()
  const laptop = page.frameLocator('iframe').nth(1)
  // officer signs in inside the laptop frame
  await staffCertificateSignIn(laptop)
  // pick Giulia from the case library
  await page.getByRole('button', { name: 'Choose a case from the library' }).click()
  await page.getByRole('button', { name: /Giulia Ferraro/ }).click()
  await expect(phone.getByText('Hi, Giulia.')).toBeVisible({ timeout: 10_000 })
  // run Giulia on the phone frame
  while (!(await phone.getByRole('button', { name: 'See my route' }).isVisible())) {
    await phone.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(300)
  }
  await phone.getByRole('button', { name: 'See my route' }).click()
  await phone.getByRole('button', { name: 'Continue with this route' }).click()
  await phone.getByRole('button', { name: 'I agree, start the checks' }).click()
  await phone.getByRole('button', { name: 'Start reading the chip' }).click()
  await phone.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 15_000 })
  await phone.getByRole('button', { name: 'Start the face check' }).click()
  await phone.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 15_000 })
  await expect(laptop.getByRole('link', { name: 'Giulia Ferraro', exact: true }).first()).toBeVisible({ timeout: 20_000 })
  await shot(page, '8b-demo-side-by-side')
  // reset everything
  await page.getByRole('button', { name: 'Reset all demo data' }).click()
  await page.getByRole('button', { name: 'Reset everything' }).click()
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('getyourclave.state.v1')!).cases.giulia)
  expect(st.status).toBe('draft')
  expect(st.decisions).toEqual([])
  await expect(laptop.getByRole('link', { name: 'Giulia Ferraro', exact: true })).toHaveCount(0, { timeout: 10_000 })
  await shot(page, '8b-demo-after-reset')
  expect(problems.console).toEqual([])
})
