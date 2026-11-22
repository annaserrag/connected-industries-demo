/**
 * CHECKS 2, 6 (runtime), 7 — every route: footer (EN+ES), html lang, console, external requests,
 * images/branding, no "Simulated"/"Demo" markers (disclosed on /about instead), privacy scan (every DNI/NIE-shaped
 * value shown or stored fails the real check letter), reference figures + number inventory.
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { BASE, SHOTS, attachConsole, citizenSignIn, isFictionalDniNie, shot, staffCertificateSignIn, watch, type Problems } from './helpers'

const FOOT_EN = '© 2026 Get your Cl@ve · Academic prototype of IE University'
const FOOT_ES = '© 2026 Get your Cl@ve · Prototipo académico de IE University'
/** Words that mark a screen as a demo. What is simulated is listed once, on /about. */
const MARKERS = /\bSimulated\b|\bSimulad[oa]s?\b|Demo data|Datos de demo|\(demo\)|\bDEMO-|Demo mode|Modo demo/

/** DNI (8 digits + letter) or NIE (X/Y/Z + 7 digits + letter) shaped tokens, also inside an NRP. */
const DNI_NIE = /(?<![A-Z0-9])(?:\d{8}|[XYZ]\d{7})[A-Z](?=A\d{4}(?![0-9])|(?![A-Z0-9]))/g
function realLookingIds(text: string): string[] {
  return [...new Set((text.toUpperCase().match(DNI_NIE) ?? []).filter(v => !isFictionalDniNie(v)))]
}

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
  '/#/officer/documents', '/#/officer/applications', '/#/officer/profile', '/#/dashboard', '/#/about', '/#/help',
  '/#/accessibility', '/#/legal', '/#/privacy',
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
    test.setTimeout(480_000) // 19 routes × 2 languages
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
        const bodyText = await page.locator('body').innerText()
        if (r !== '/#/about') expect(bodyText.match(MARKERS)?.[0] ?? null, `${r} ${lang}: demo marker`).toBeNull()
        expect(realLookingIds(bodyText), `${r} ${lang}: DNI/NIE with a real check letter on screen`).toEqual([])
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
    // privacy scan of the stored state too: every DNI/NIE-shaped value must carry a wrong check letter
    const stored = await page.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k) ?? '').join('\n'))
    expect(stored.length).toBeGreaterThan(1000)
    expect(realLookingIds(stored), 'DNI/NIE with a real check letter in localStorage').toEqual([])
    expect(problems.external, 'external requests').toEqual([])
    expect(problems.console, 'console errors/warnings').toEqual([])
    await context.close()
  })

  test('6b privacy: the scan catches a real check letter, and the seed only holds fictional ones', async () => {
    expect(realLookingIds('DNI 12345678Z, NRP 12345678ZA0611')).toEqual(['12345678Z'])
    expect(realLookingIds('NIE X1234567L')).toEqual(['X1234567L'])
    expect(realLookingIds('50731842J 50731842JA0611 Y8042719P X9019583W Z9088104B')).toEqual([])
    const seed = fs.readFileSync(new URL('../../src/contract/seed.ts', import.meta.url), 'utf8')
    expect(realLookingIds(seed), 'seed').toEqual([])
    const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8')
    expect(realLookingIds(readme), 'README').toEqual([])
    const staff = readme.slice(readme.indexOf('## Staff accounts'), readme.indexOf('\n## ', readme.indexOf('## Staff accounts') + 5))
    expect(staff).toContain('50731842JA0611')
    expect(staff).not.toMatch(/DEMO-/)
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
    // no demo markers on the statistics page (what is invented is listed on /about)
    await expect(page.getByTestId('dashboard-page')).not.toContainText(MARKERS)
  })

  test('7b no "Simulated" badges in the citizen flow or the staff console; /about discloses them instead', async ({ browser }) => {
    const context = await browser.newContext()
    const citizen = await context.newPage(); await citizen.setViewportSize({ width: 390, height: 844 })
    const seen: Record<string, number> = {}
    const count = async (p: typeof citizen, k: string) => { seen[k] = await p.getByText(MARKERS).filter({ visible: true }).count() }
    // eIDAS (route A): Giulia answers "Yes" to having her eID
    await citizenSignIn(citizen, 'giulia')
    await citizen.getByRole('button', { name: 'Next', exact: true }).click()
    await citizen.getByRole('button', { name: 'Next', exact: true }).click()
    await citizen.locator('input[name="hasEuEid"][value="yes"]').check({ force: true })
    await citizen.getByRole('button', { name: 'Next', exact: true }).click()
    await citizen.getByRole('button', { name: 'See my route' }).click()
    await expect(citizen.getByTestId('recommended-route')).toContainText('EU digital ID (eIDAS)')
    await citizen.getByRole('button', { name: 'Continue with this route' }).click()
    await count(citizen, 'consent')
    await citizen.getByRole('button', { name: 'I agree, start the checks' }).click()
    await expect(citizen.getByRole('heading', { name: 'EU digital ID (eIDAS)' })).toBeVisible()
    await count(citizen, 'eidas')
    await shot(citizen, '7b-eidas-step')
    await citizen.getByRole('button', { name: 'Approve sign-in' }).click({ timeout: 10_000 })
    await citizen.getByRole('button', { name: 'Go to my status' }).click({ timeout: 20_000 })
    await count(citizen, 'status')
    // chip + face (route B)
    await citizenSignIn(citizen, 'daniel')
    while (!(await citizen.getByRole('button', { name: 'See my route' }).isVisible())) {
      await citizen.getByRole('button', { name: 'Next', exact: true }).click(); await citizen.waitForTimeout(300)
    }
    await citizen.getByRole('button', { name: 'See my route' }).click()
    await citizen.getByRole('button', { name: 'Continue with this route' }).click()
    await citizen.getByRole('button', { name: 'I agree, start the checks' }).click()
    await expect(citizen.getByRole('button', { name: 'Start reading the chip' })).toBeVisible()
    await count(citizen, 'chip')
    await shot(citizen, '7b-chip-step')
    await citizen.getByRole('button', { name: 'Start reading the chip' }).click()
    await citizen.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 15_000 })
    await expect(citizen.getByRole('button', { name: 'Start the face check' })).toBeVisible()
    await count(citizen, 'face')
    // officer engine results
    const officer = await context.newPage(); await officer.setViewportSize({ width: 1440, height: 900 })
    await officer.goto(`${BASE}/#/officer`)
    await count(officer, 'staffSignIn')
    await staffCertificateSignIn(officer)
    await count(officer, 'officerQueue')
    await officer.getByRole('table').getByRole('link', { name: 'Priya Nair' }).click()
    await expect(officer.getByRole('heading', { name: 'Priya Nair' })).toBeVisible()
    await count(officer, 'officerCase')
    await shot(officer, '7b-officer-case-detail')
    console.log(JSON.stringify(seen))
    for (const [k, v] of Object.entries(seen)) expect(v, k).toBe(0)
    // the disclosure lives on the About page
    await officer.goto(`${BASE}/#/about`)
    await expect(officer.getByTestId('about-page')).toContainText('What is simulated')
    await context.close()
  })
})
