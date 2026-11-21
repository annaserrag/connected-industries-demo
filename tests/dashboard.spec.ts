import { expect, test } from '@playwright/test'
import { REFERENCE_FIGURES } from '../src/contract/seed'

/** Dashboard (screen 9): simulated labelling, published figures verbatim, live demo-session counts. */

test.beforeEach(async ({ page }) => {
  // Fresh demo state once per test page (guarded so HMR reloads don't wipe it again).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('dash-test-cleared')) {
      localStorage.clear()
      sessionStorage.setItem('dash-test-cleared', '1')
    }
  })
  await page.goto('/#/dashboard')
  await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 15000 })
})

test('shows the page-level Simulated banner', async ({ page }) => {
  const banner = page.getByTestId('simulated-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Simulated data')
})

test('every chart and KPI tile carries a Simulated badge', async ({ page }) => {
  const charts = page.getByTestId('chart-card')
  await expect(charts).toHaveCount(5)
  for (const card of await charts.all()) {
    await expect(card.getByTestId('sim-badge')).toHaveText('Simulated')
    // Text alternative: an accessible chart image and a data table (hidden until toggled).
    await expect(card.getByRole('img')).toHaveAttribute('aria-label', /.+/)
    await expect(card.locator('table')).toHaveCount(1)
  }
  const tiles = page.getByTestId('kpi-tile')
  await expect(tiles).toHaveCount(4)
  for (const tile of await tiles.all()) await expect(tile.getByTestId('sim-badge')).toBeVisible()
})

test('data table toggles open', async ({ page }) => {
  const card = page.getByTestId('chart-card').first()
  const btn = card.getByRole('button', { name: 'Show data table' })
  await btn.click()
  await expect(card.getByRole('button', { name: 'Hide data table' })).toHaveAttribute('aria-expanded', 'true')
  await expect(card.getByRole('table')).toBeVisible()
})

test('each published figure appears verbatim with its year and source', async ({ page }) => {
  const section = page.getByTestId('published-figures')
  await expect(section.getByTestId('published-figure')).toHaveCount(REFERENCE_FIGURES.length)
  for (const fig of REFERENCE_FIGURES) {
    const card = section.locator(`[data-figure-id="${fig.id}"]`)
    await expect(card.getByTestId('figure-value')).toHaveText(fig.value)
    await expect(card.getByTestId('figure-year')).toHaveText(fig.year)
    const link = card.getByTestId('figure-source')
    await expect(link).toContainText(fig.source)
    await expect(link).toHaveAttribute('href', fig.sourceUrl)
    await expect(link).toHaveAttribute('rel', 'noreferrer')
    await expect(link).toHaveAttribute('target', '_blank')
  }
  // Published figures never sit inside a simulated chart card.
  await expect(section.getByTestId('chart-card')).toHaveCount(0)
})

test('Spanish labels switch with the toggle', async ({ page }) => {
  await page.getByTestId('dashboard-page').locator('header button', { hasText: /^\s*es\s*$/i }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rendimiento del servicio')
  await expect(page.getByTestId('simulated-banner')).toContainText('Datos simulados')
})

test('embed mode hides the page header', async ({ page }) => {
  await page.goto('/#/dashboard?embed=1')
  await expect(page.getByTestId('simulated-banner')).toBeVisible()
  await expect(page.locator('header')).toHaveCount(0)
})

test('demo-session counts update live from another tab', async ({ page, context }) => {
  const live = page.getByTestId('live-session')
  const awaitingTile = live.locator('li', { hasText: 'Awaiting an officer' })
  const before = Number(await awaitingTile.locator('p').first().innerText())
  expect(before).toBeGreaterThan(0)

  const other = await context.newPage()
  await other.goto('/#/officer')
  await other.evaluate(async () => {
    const store = await import('/src/core/store.ts')
    const sel = await import('/src/core/selectors.ts')
    const { OFFICERS } = await import('/src/contract/seed.ts')
    store.actions.officerSignIn(OFFICERS[0].id)
    const c = sel.officerQueue(store.useClave.getState()).find(x => x.status !== 'need_info')!
    store.actions.officerApprove(c.id, 'dashboard test')
  })
  await expect(awaitingTile.locator('p').first()).toHaveText(String(before - 1), { timeout: 5000 })
})
