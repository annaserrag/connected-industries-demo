/**
 * Officer UI tests (Officer agent C).
 * Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test tests/officer.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  return errors
}

test.use({ viewport: { width: 1440, height: 900 } })

test('live: citizen runs Giulia, officer sees her arrive and approves advanced', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const citizen = await ctx.newPage()
  const officer = await ctx.newPage()
  const errs = [...[citizen, officer].map(trackErrors)]

  await citizen.goto('/?debug=1#/')
  await citizen.waitForFunction(() => Boolean(window.__clave))
  await citizen.evaluate(() => {
    window.__clave!.setEngineSpeed(0.1)
    window.__clave!.actions.resetDemo()
    window.__clave!.actions.officerSignOut()
  })

  // Officer: simulated sign-in by picking a card.
  await officer.goto('/?debug=1#/officer')
  await officer.getByRole('button', { name: /Laura Navarro/ }).click()
  await expect(officer.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await expect(officer.getByRole('link', { name: 'Giulia Ferraro', exact: true })).toHaveCount(0)

  // Citizen tab runs Giulia through the store.
  await citizen.evaluate(async () => {
    const a = window.__clave!.actions
    const c = window.__clave!.getState().cases.giulia
    a.startCase('giulia', c.presetAnswers, 'B')
    a.giveConsent('giulia')
    await a.submitForVerification('giulia')
  })

  // Officer tab: Giulia slides in live with a toast.
  await expect(officer.getByRole('link', { name: 'Giulia Ferraro', exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(officer.getByText('New case: Giulia Ferraro').first()).toBeVisible()

  await officer.getByRole('link', { name: 'Giulia Ferraro', exact: true }).click()
  await expect(officer.getByRole('heading', { name: 'Giulia Ferraro' })).toBeVisible()
  await officer.getByRole('button', { name: /Grant advanced level/ }).click()
  await expect(officer.getByRole('heading', { name: 'Case queue' })).toBeVisible()

  await expect.poll(() => citizen.evaluate(() => window.__clave!.getState().cases.giulia.advanced)).toBe('granted')
  expect(errs.flat()).toEqual([])
  await ctx.close()
})

test('refuse needs a reason; info request and keyboard shortcuts work', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/?debug=1#/officer')
  await page.waitForFunction(() => Boolean(window.__clave))
  await page.evaluate(async () => {
    const a = window.__clave!.actions
    window.__clave!.setEngineSpeed(0.05)
    a.resetDemo()
    a.officerSignIn('OF-DEMO-07')
    const c = window.__clave!.getState().cases.deepfake
    a.startCase('deepfake', c.presetAnswers, 'B'); a.giveConsent('deepfake')
    await a.submitForVerification('deepfake')
  })

  // Highest risk first: J/K + Enter opens the deepfake case.
  await page.goto('/?debug=1#/officer')
  await expect(page.getByRole('link', { name: 'Ivo Petrov (claimed)', exact: true })).toBeVisible()
  await page.keyboard.press('j'); await page.keyboard.press('k'); await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Ivo Petrov (claimed)' })).toBeVisible()
  await expect(page.getByText('Liveness failed: not a live person').first()).toBeVisible()

  // R opens the refuse dialog; confirm stays disabled until a reason is picked.
  await page.keyboard.press('r')
  const confirm = page.getByRole('button', { name: 'Confirm refusal' })
  await expect(confirm).toBeDisabled()
  // Typing "a" in the note must not approve.
  await page.getByLabel(/Internal note/).fill('aaa')
  await expect(confirm).toBeDisabled()
  await page.getByRole('radio', { name: /Liveness failed/ }).click()
  await expect(page.getByText('We could not confirm that a real person was in front of the camera.')).toBeVisible()
  await expect(page.getByText('No pudimos confirmar que hubiera una persona real ante la cámara.')).toBeVisible()
  await confirm.click()
  await expect.poll(() => page.evaluate(() => window.__clave!.getState().cases.deepfake.decisions.at(-1))).toMatchObject({ outcome: 'refused', reasonId: 'liveness_failed' })

  // Info request on a flagged background case.
  await page.goto('/?debug=1#/officer/case/bg-03')
  await page.keyboard.press('i')
  await page.getByRole('button', { name: 'Retake face check' }).click()
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect.poll(() => page.evaluate(() => window.__clave!.getState().cases['bg-03'].status)).toBe('need_info')

  // Audit trail shows the refusal with its reason.
  await page.goto('/?debug=1#/officer/audit')
  await expect(page.getByRole('cell', { name: 'Liveness failed' }).first()).toBeVisible()
  expect(errors).toEqual([])
})
