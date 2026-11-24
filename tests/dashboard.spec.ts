import { expect, test } from '@playwright/test'
import { REFERENCE_FIGURES } from '../src/contract/seed'

/** Public "Service statistics" page: no Simulated labels (disclosed on About), published figures verbatim, live counts. */

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

test('no Simulated banner or badges: the About page discloses the data instead', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Service statistics')
  await expect(page.getByTestId('simulated-banner')).toHaveCount(0)
  await expect(page.getByText(/Simulated|demo/)).toHaveCount(0)
  await page.goto('/#/about')
  await expect(page.getByTestId('about-page')).toContainText('Service statistics page')
})

test('live counters from the store (no invented projections); refusals by reason REJ-01…08', async ({ page }) => {
  await expect(page.getByTestId('chart-card')).toHaveCount(0)
  await expect(page.getByTestId('kpi-tile')).toHaveCount(0)
  for (const id of ['applications', 'auto', 'needed-officer', 'awaiting', 'refusals', 'corrected', 'proposed']) {
    await expect(page.getByTestId(`live-${id}`)).toBeVisible()
  }
  for (const r of ['REJ-01', 'REJ-05', 'REJ-08']) await expect(page.getByTestId(`live-rej-${r}`)).toBeVisible()
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
  await page.getByRole('button', { name: 'Español' }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Estadísticas del servicio')
})

test('embed mode hides the page header', async ({ page }) => {
  await page.goto('/#/dashboard?embed=1')
  await expect(page.getByTestId('live-session')).toBeVisible()
  await expect(page.getByTestId('gov-header')).toHaveCount(0)
})

test('live counts update from another tab', async ({ page, context }) => {
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
    const c = sel.officerQueue(store.useClave.getState()).find(x => x.level === 'none' && x.appeal?.state !== 'open')!
    store.actions.officerRefuse(c.id, 'REJ-01', 'dashboard test')
  })
  await expect(awaitingTile.locator('p').first()).toHaveText(String(before - 1), { timeout: 5000 })
})
