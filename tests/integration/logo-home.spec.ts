import { test, expect } from '@playwright/test'

const home = /#\/$/

for (const route of ['/#/citizen', '/#/officer', '/#/dashboard', '/#/demo']) {
  test(`brand mark on ${route} goes back home`, async ({ page }) => {
    await page.goto(route)
    await page.getByRole('link', { name: /Get your Cl@ve, home/ }).first().click()
    await expect(page).toHaveURL(home)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
}

test('brand mark inside a demo-stage frame takes the whole window home', async ({ page }) => {
  await page.goto('/#/demo')
  const phone = page.frameLocator('iframe').first()
  await phone.getByRole('link', { name: /Get your Cl@ve, home/ }).first().click()
  await expect(page).toHaveURL(home)
})

test('signed-in officer: brand mark goes home', async ({ page }) => {
  await page.goto('/?debug=1#/officer')
  await page.waitForFunction(() => Boolean((window as any).__clave))
  await page.evaluate(() => (window as any).__clave.actions.officerSignIn('OF-DEMO-07'))
  await page.getByRole('link', { name: /Get your Cl@ve, home/ }).first().click()
  await expect(page).toHaveURL(/\?debug=1#\/$|#\/$/)
})
