/**
 * CHECKS 2, 6 (runtime), 7 — every route: footer (EN+ES), html lang, console, external requests,
 * images/branding, Simulated labels, reference figures + number inventory.
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { BASE, SHOTS, attachConsole, citizenSignIn, shot, staffCertificateSignIn, watch, type Problems } from './helpers'

const FOOT_EN = 'Student prototype — not an official Government of Spain service.'
const FOOT_ES = 'Prototipo de estudiantes — no es un servicio oficial del Gobierno de España.'

const REF: Record<string, { value: string; year: string; source: string }> = {
  users: { value: '21,558,192 (+10.4%)', year: '2024', source: 'OBSAE' },
  logins: { value: '1,020,194,629 (+26%)', year: '2024', source: 'OBSAE' },
  movil: { value: '9,235,043 → 41,383,759', year: '2023 → 2024', source: 'OBSAE' },
  pin: { value: '53,362,134 → 47,920,189', year: '2023 → 2024', source: 'OBSAE' },
  eidas: { value: '71,063', year: '2024', source: 'OBSAE' },
  residence: { value: '29,521,948 (+53%)', year: '2024', source: 'OBSAE' },
  online: { value: '80.7%', year: '2025', source: 'INE TIC-H' },
  eid_used: { value: '54.43% (EU 41.11%)', year: '2023', source: 'Digital Decade' },
  no_eid: { value: '13.99%', year: '2023', source: 'Digital Decade' },
  dps_score: { value: '88.75 (EU 82.32)', year: '2024', source: 'Digital Decade' },
}

const ROUTES = [
  '/#/', '/#/citizen', '/#/citizen/start/giulia', '/#/citizen/case/bg-07', '/#/citizen/case/giulia',
  '/#/officer', '/#/officer/case/bg-03', '/#/officer/case/giulia', '/#/officer/audit', '/#/officer/dashboard',
  '/#/officer/documents', '/#/officer/applications', '/#/officer/profile', '/#/dashboard', '/#/demo',
]

async function prep(page: Page) {
  // put one library case in a submitted state + an officer signed in (for officer routes)
  await page.goto(`${BASE}/?debug=1#/`)
  await page.waitForFunction(() => !!window.__clave)
  await page.evaluate(async () => {
    const k = window.__clave!
    k.setEngineSpeed(0)
    const c = k.getState().cases.giulia
    k.actions.startCase('giulia', c.presetAnswers, 'B'); k.actions.giveConsent('giulia')
    await k.actions.submitForVerification('giulia')
  })
}

/** Text nodes containing a digit, with whether their card/section is labelled simulated or a published figure. */
async function numbers(page: Page) {
  return page.evaluate(() => {
    const out: { text: string; ctx: string }[] = []
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = w.nextNode())) {
      const t = (n.textContent || '').trim()
      if (!/\d/.test(t)) continue
      const el = n.parentElement!
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden="true"]') && !el.closest('svg')) continue
      const card = el.closest('[data-testid=kpi-tile],[data-testid=chart-card],[data-testid=published-figure],[data-testid^=figure-],li,section') as HTMLElement | null
      const ctxText = (card?.innerText || '').slice(0, 4000)
      const ctx = /Simulated|Simulado|simulated|simulad/i.test(ctxText) ? 'SIM' : /Published|publicada|OBSAE|INE|Digital Decade/.test(ctxText) ? 'PUB' : 'other'
      out.push({ text: t.slice(0, 120), ctx })
    }
    return out
  })
}

test.describe('Routes sweep', () => {
  test('7a/6/5 footer, html lang, console, network, images on every route (EN + ES)', async ({ browser }) => {
    test.setTimeout(420_000) // 15 routes × 2 languages (the staff console added four)
    const problems: Problems = { console: [], external: [] }
    const context = await browser.newContext()
    watch(context, problems)
    const page = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })
    attachConsole(page, problems)
    await prep(page)
    const rows: unknown[] = []
    const inventory: Record<string, unknown> = {}
    for (const lang of ['en', 'es'] as const) {
      for (const r of ROUTES) {
        if (r.startsWith('/#/officer') && r !== '/#/officer') await page.evaluate(() => window.__clave?.actions.officerSignIn('OF-DEMO-07'))
        if (r === '/#/officer') await page.evaluate(() => window.__clave?.actions.officerSignOut())
        await page.goto(`${BASE}/?debug=1${r.slice(1)}`)
        // Hash routes are same-document navigations: after /#/demo (iframes) Playwright can stop reporting
        // 'networkidle' for the rest of the page's life (seen with the original build too), so cap the wait.
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
        await page.evaluate(l => window.__clave!.actions.setLang(l), lang)
        await page.waitForTimeout(600)
        const footer = (await page.locator('footer').last().innerText()).trim()
        const htmlLang = await page.evaluate(() => document.documentElement.lang)
        const imgs = await page.evaluate(() => [...document.querySelectorAll('img, image, object, embed, picture source')].map(e => (e as HTMLImageElement).src || e.getAttribute('href') || e.outerHTML.slice(0, 80)))
        const bgImgs = await page.evaluate(() => [...document.querySelectorAll('*')].map(e => getComputedStyle(e).backgroundImage).filter(b => b.includes('url(')))
        rows.push({ lang, r, footer, htmlLang, imgs, bgImgs })
        expect(footer, `${r} ${lang}`).toContain(lang === 'en' ? FOOT_EN : FOOT_ES)
        expect(htmlLang, `${r} ${lang}`).toBe(lang)
        expect(imgs, r).toEqual([])
        expect(bgImgs, r).toEqual([])
        if (lang === 'en') {
          inventory[r] = await numbers(page)
          await shot(page, `route-${r.replace(/[^a-z0-9]+/gi, '_')}-${lang}`)
        }
      }
    }
    fs.mkdirSync(SHOTS, { recursive: true })
    fs.writeFileSync(SHOTS + '/routes.json', JSON.stringify({ rows, problems }, null, 2))
    fs.writeFileSync(SHOTS + '/number-inventory.json', JSON.stringify(inventory, null, 2))
    expect(problems.external, 'external requests').toEqual([])
    expect(problems.console, 'console errors/warnings').toEqual([])
    await context.close()
  })

  test('2 reference figures on landing + dashboard: exact value, year, source', async ({ page }) => {
    await page.goto(`${BASE}/#/`)
    for (const id of ['users', 'eidas', 'online']) {
      const li = page.getByTestId(`figure-${id}`)
      await expect(li).toContainText(REF[id].value)
      await expect(li).toContainText(REF[id].year)
      await expect(li).toContainText(REF[id].source)
    }
    await page.goto(`${BASE}/#/dashboard`)
    const figs = page.getByTestId('published-figure')
    await expect(figs).toHaveCount(10)
    for (const [id, f] of Object.entries(REF)) {
      const li = page.locator(`[data-figure-id="${id}"]`)
      await expect(li.getByTestId('figure-value')).toHaveText(f.value)
      await expect(li.getByTestId('figure-year')).toHaveText(f.year)
      await expect(li.getByTestId('figure-source')).toContainText(f.source)
    }
    // every KPI tile and chart card is labelled simulated
    const tiles = page.getByTestId('kpi-tile')
    const cards = page.getByTestId('chart-card')
    const nT = await tiles.count(), nC = await cards.count()
    expect(nT).toBeGreaterThan(0); expect(nC).toBeGreaterThan(0)
    for (let i = 0; i < nT; i++) await expect(tiles.nth(i), `kpi ${i}`).toContainText(/Simulated/)
    for (let i = 0; i < nC; i++) await expect(cards.nth(i), `chart ${i}`).toContainText(/Simulated/)
    await expect(page.getByTestId('simulated-banner')).toContainText('Simulated data')
    await expect(page.getByTestId('live-session')).toContainText(/demo|Demo|Simulated/)
  })

  test('7b "Simulated" labels on eIDAS step, chip, face, engine results (citizen + officer)', async ({ browser }) => {
    const context = await browser.newContext()
    const citizen = await context.newPage(); await citizen.setViewportSize({ width: 390, height: 844 })
    const found: Record<string, boolean> = {}
    // eIDAS (route A): Giulia answers "Yes" to having her eID
    await citizenSignIn(citizen, 'giulia')
    await citizen.getByRole('button', { name: 'Next', exact: true }).click()
    await citizen.getByRole('button', { name: 'Next', exact: true }).click()
    await citizen.locator('input[name="hasEuEid"][value="yes"]').check({ force: true })
    await citizen.getByRole('button', { name: 'Next', exact: true }).click()
    await citizen.getByRole('button', { name: 'See my route' }).click()
    await expect(citizen.getByTestId('recommended-route')).toContainText('EU digital ID (eIDAS)')
    await citizen.getByRole('button', { name: 'Continue with this route' }).click()
    found.consent = await citizen.getByText('Simulated', { exact: true }).first().isVisible()
    await citizen.getByRole('button', { name: 'I agree, start the checks' }).click()
    await expect(citizen.getByRole('heading', { name: 'EU digital ID (eIDAS)' })).toBeVisible()
    found.eidas = await citizen.getByText('Simulated', { exact: true }).first().isVisible()
    await shot(citizen, '7b-eidas-step')
    await citizen.getByRole('button', { name: 'Approve sign-in' }).click({ timeout: 10_000 })
    await expect(citizen.getByRole('heading', { name: /checks|comprob/i }).first()).toBeVisible({ timeout: 10_000 })
    found.engineLive = await citizen.getByText('Simulated', { exact: true }).first().isVisible()
    await citizen.getByRole('button', { name: 'Go to my status' }).click({ timeout: 20_000 })
    found.statusChecks = await citizen.getByText('Simulated', { exact: true }).first().isVisible()
    // chip + face (route B)
    await citizenSignIn(citizen, 'daniel') // signs Giulia out first, then Daniel in
    while (!(await citizen.getByRole('button', { name: 'See my route' }).isVisible())) {
      await citizen.getByRole('button', { name: 'Next', exact: true }).click(); await citizen.waitForTimeout(300)
    }
    await citizen.getByRole('button', { name: 'See my route' }).click()
    await citizen.getByRole('button', { name: 'Continue with this route' }).click()
    await citizen.getByRole('button', { name: 'I agree, start the checks' }).click()
    await expect(citizen.getByRole('button', { name: 'Start reading the chip' })).toBeVisible()
    found.chip = await citizen.getByText('Simulated', { exact: true }).first().isVisible()
    await shot(citizen, '7b-chip-step')
    await citizen.getByRole('button', { name: 'Start reading the chip' }).click()
    await citizen.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 15_000 })
    await expect(citizen.getByRole('button', { name: 'Start the face check' })).toBeVisible()
    found.face = await citizen.getByText('Simulated', { exact: true }).first().isVisible()
    await shot(citizen, '7b-face-step')
    // officer engine results
    const officer = await context.newPage(); await officer.setViewportSize({ width: 1440, height: 900 })
    await officer.goto(`${BASE}/#/officer`)
    await staffCertificateSignIn(officer)
    found.officerQueue = await expect(officer.getByText('Simulated', { exact: true }).filter({ visible: true }).first()).toBeVisible().then(() => true, () => false)
    await officer.getByRole('table').getByRole('link', { name: 'Priya Nair' }).click()
    found.officerCase = await expect(officer.getByText('Simulated', { exact: true }).filter({ visible: true }).first()).toBeVisible().then(() => true, () => false)
    await shot(officer, '7b-officer-case-detail')
    console.log(JSON.stringify(found))
    for (const [k, v] of Object.entries(found)) expect(v, k).toBe(true)
    await context.close()
  })
})
