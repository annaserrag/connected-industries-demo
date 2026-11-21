/**
 * CHECK 3 — rejection reasons: 6–8 reasons, one EN + one ES citizen message each,
 * officer preview == what the citizen sees (EN and ES), for every reason, via the real UI.
 */
import { test, expect } from '@playwright/test'
import { BASE, signInAs } from './helpers'

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

test('3 every reason: officer preview equals citizen view (EN + ES)', async ({ browser }) => {
  const context = await browser.newContext()
  const officer = await context.newPage(); await officer.setViewportSize({ width: 1440, height: 900 })
  const citizen = await context.newPage(); await citizen.setViewportSize({ width: 390, height: 844 })
  await officer.goto(`${BASE}/?debug=1#/officer`)
  await officer.waitForFunction(() => !!window.__clave)
  const cases = ['noah', 'yusuf', 'deepfake', 'fakedoc', 'linwei', 'giulia', 'daniel', 'rafael']
  await officer.evaluate(async ids => {
    const k = window.__clave!
    k.setEngineSpeed(0)
    for (const id of ids) {
      const c = k.getState().cases[id]
      k.actions.startCase(id, c.presetAnswers, id === 'yusuf' ? 'FALLBACK' : 'B')
      k.actions.giveConsent(id)
      await k.actions.submitForVerification(id)
    }
    k.actions.officerSignIn('OF-DEMO-07')
  }, cases)
  const reasons = await officer.evaluate(() => {
    // read the closed list from the rendered dialog later; here count via state-free check of radios
    return null
  })
  void reasons
  await officer.goto(`${BASE}/?debug=1#/officer/case/noah`)
  await officer.getByRole('button', { name: /^Refuse/ }).click()
  const radios = officer.getByRole('dialog').getByRole('radio')
  const n = await radios.count()
  const labels = await radios.allInnerTexts()
  console.log('reasons:', n, labels.map(norm))
  expect(n).toBeGreaterThanOrEqual(6)
  expect(n).toBeLessThanOrEqual(8)
  await officer.keyboard.press('Escape')

  const report: unknown[] = []
  for (let i = 0; i < n; i++) {
    const id = cases[i]
    await officer.goto(`${BASE}/?debug=1#/officer/case/${id}`)
    await officer.getByRole('button', { name: /^Refuse/ }).click()
    const dlg = officer.getByRole('dialog')
    await dlg.getByRole('radio').nth(i).click()
    const grab = async (l: string) => {
      const ps = dlg.locator(`[lang="${l}"] p`)
      const msg = norm(await ps.nth(1).innerText())
      const fix = norm((await ps.nth(2).innerText()).replace(/^[^:]*:\s*/, ''))
      return [msg, fix]
    }
    const en = await grab('en')
    const es = await grab('es')
    await dlg.getByRole('button', { name: 'Confirm refusal' }).click()
    await expect(dlg).toBeHidden()

    await signInAs(officer, id)
    await citizen.goto(`${BASE}/#/citizen/case/${id}`)
    await citizen.getByRole('button', { name: 'English' }).click()
    const box = citizen.getByTestId('refusal-reason')
    for (const p of en) await expect(box, `${labels[i]} EN`).toContainText(p)
    await expect(box).toHaveCount(1)
    const cEn = norm(await box.innerText())
    await citizen.getByRole('button', { name: 'Español' }).click()
    for (const p of es) await expect(box, `${labels[i]} ES`).toContainText(p)
    const cEs = norm(await box.innerText())
    await expect(citizen.getByRole('button', { name: 'Recurrir' })).toBeVisible()
    await citizen.getByRole('button', { name: 'English' }).click()
    const row = { reason: norm(labels[i]), case: id, officerEN: en, officerES: es, citizenEN: cEn, citizenES: cEs }
    report.push(row)
    for (const p of en) expect(cEn, `${row.reason} EN`).toContain(p)
    for (const p of es) expect(cEs, `${row.reason} ES`).toContain(p)
  }
  console.log(JSON.stringify(report, null, 2))
  await context.close()
})
