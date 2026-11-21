/**
 * Citizen UI (agent B): clicks through every library persona on a phone viewport, in EN and ES,
 * with officer actions from a second tab (same browser context → BroadcastChannel sync).
 * Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PORT=5172 npx playwright test tests/citizen.spec.ts
 * Screenshots: /tmp/citizen-shots
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { C } from '../src/citizen/copy'
import { CASE_LIBRARY, CITIZEN_MESSAGES, DEMO_ACCOUNT_PASSWORDS, KEY_RULE, REJECTION_REASONS } from '../src/contract/seed'
import type { Lang, RejectionReasonId } from '../src/contract/types'

const SHOTS = process.env.CITIZEN_SHOTS ?? '/tmp/citizen-shots'
const PHONE = { width: 390, height: 844 }

type Plan = {
  id: string
  /** what the officer tab does after the citizen submits */
  officer: 'approveAdvanced' | 'needInfoThenApprove' | 'videoThenApprove' | { refuse: RejectionReasonId; then: 'appeal' | 'correct' | 'book' }
}

const PLANS: Plan[] = [
  { id: 'giulia', officer: 'approveAdvanced' },
  { id: 'daniel', officer: 'approveAdvanced' },
  { id: 'rafael', officer: 'approveAdvanced' },
  { id: 'noah', officer: 'needInfoThenApprove' },
  { id: 'yusuf', officer: 'videoThenApprove' },
  { id: 'deepfake', officer: { refuse: 'liveness_failed', then: 'appeal' } },
  { id: 'fakedoc', officer: { refuse: 'chip_invalid', then: 'book' } },
  { id: 'linwei', officer: { refuse: 'residence_not_found', then: 'correct' } },
]

async function openCitizen(ctx: BrowserContext, lang: Lang, errors: string[]) {
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(`[citizen] ${m.text()}`) })
  page.on('pageerror', e => errors.push(`[citizen] ${e.message}`))
  await page.goto('/#/citizen')
  await page.waitForFunction(() => Boolean(window.__clave))
  await page.evaluate(lang => {
    const c = window.__clave!
    c.setEngineSpeed(0.35)
    c.actions.resetDemo()
    c.actions.citizenSignOut()
    c.actions.setLang(lang)
  }, lang)
  await page.goto('/#/citizen')
  return page
}

async function openOfficer(ctx: BrowserContext) {
  const page = await ctx.newPage()
  await page.goto('/#/')
  await page.waitForFunction(() => Boolean(window.__clave))
  await page.evaluate(() => window.__clave!.actions.officerSignIn('OF-DEMO-07'))
  return page
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
const status = (page: Page, id: string) => page.evaluate(id => window.__clave!.getState().cases[id].status, id)

async function runPersona(citizen: Page, officer: Page, plan: Plan, lang: Lang) {
  const tr = (b: { en: string; es: string }) => b[lang]
  const btn = (b: { en: string; es: string }) => citizen.getByRole('button', { name: tr(b), exact: true })
  const tag = `${lang}-${plan.id}`
  await citizen.bringToFront()

  // sign in with the persona's saved demo account (credentials live only in the README)
  const seed = CASE_LIBRARY.find(c => c.id === plan.id)!
  await citizen.getByTestId('signin-doc').fill(seed.document.number)
  await citizen.getByTestId('signin-password').fill(DEMO_ACCOUNT_PASSWORDS[plan.id])
  await citizen.getByTestId('signin-form').getByRole('button', { name: tr(C.signInCta), exact: true }).click()
  await expect(citizen).toHaveURL(new RegExp(`/citizen/start/${plan.id}`))
  if (plan.id === 'giulia' || plan.id === 'rafael') await shot(citizen, `${tag}-01-assistant`)

  // assistant: Next … See my route
  for (let i = 0; i < 6; i++) {
    if (await citizen.getByTestId('recommended-route').isVisible()) break
    if (await btn(C.seeRecommendation).isVisible()) await btn(C.seeRecommendation).click()
    else await btn(C.next).click()
    await citizen.waitForTimeout(260)
  }
  await expect(citizen.getByTestId('recommended-route')).toBeVisible()
  await shot(citizen, `${tag}-02-route`)
  await btn(C.confirmRoute).click()

  // consent
  await expect(citizen.getByRole('heading', { name: tr(CITIZEN_MESSAGES.consentTitle) })).toBeVisible()
  await expect(citizen.getByText(tr({ en: 'Simulated', es: 'Simulado' })).first()).toBeVisible()
  if (plan.id === 'giulia') await shot(citizen, `${tag}-03-consent`)
  await btn(CITIZEN_MESSAGES.consentAccept).click()

  if (plan.id === 'noah') {
    await btn(C.approveSignIn).click({ timeout: 8000 })
    await citizen.getByRole('checkbox').check({ timeout: 8000 })
    await shot(citizen, `${tag}-03b-guardian`)
    await btn(C.continue).click()
  }
  if (plan.id === 'yusuf') {
    await expect(citizen.getByText(tr({ en: 'Policy proposal', es: 'Propuesta normativa' })).first()).toBeVisible()
    await shot(citizen, `${tag}-04-book`)
    await btn(C.bookConfirm).click()
    await btn(C.sendForChecks).click()
  } else {
    await btn(C.chipStart).click()
    await citizen.waitForTimeout(1500)
    if (plan.id === 'giulia' || plan.id === 'daniel') await shot(citizen, `${tag}-04-chip`)
    if (plan.id === 'daniel') await expect(citizen.getByTestId('tie-assumption')).toBeVisible()
    await btn(C.continue).click({ timeout: 8000 })
    await btn(C.faceStart).click()
    await citizen.waitForTimeout(1800)
    if (plan.id === 'giulia' || plan.id === 'rafael') await shot(citizen, `${tag}-05-face`)
    await btn(C.continue).click({ timeout: 8000 })
  }

  // live checks
  await citizen.waitForTimeout(1200)
  if (plan.id === 'giulia' || plan.id === 'deepfake') await shot(citizen, `${tag}-06-checks`)
  await expect(citizen).toHaveURL(new RegExp(`/citizen/case/${plan.id}`), { timeout: 15000 })
  await citizen.waitForTimeout(600)
  await shot(citizen, `${tag}-07-status`)

  // officer acts in the other tab
  const o = plan.officer
  const act = (fn: string, ...args: unknown[]) =>
    officer.evaluate(([fn, id, args]) => (window.__clave!.actions as never as Record<string, (...a: unknown[]) => void>)[fn as string](id, ...(args as unknown[])), [fn, plan.id, args] as const)

  if (o === 'approveAdvanced') {
    expect(await status(citizen, plan.id)).toBe('approved')
    await expect(citizen.getByTestId('advanced-card')).toBeVisible()
    await act('officerApprove')
    await expect(citizen.getByText(tr(C.levelAdvGranted)).first()).toBeVisible()
    await expect(citizen.getByText(tr(C.updatedJustNow))).toBeVisible()
    await shot(citizen, `${tag}-08-advanced-granted`)
  } else if (o === 'needInfoThenApprove') {
    await act('officerRequestInfo', 'Please confirm your mother’s address is the same as yours (demo).')
    await expect(citizen.getByTestId('need-info')).toBeVisible()
    await shot(citizen, `${tag}-08-need-info`)
    await citizen.getByRole('button', { name: tr(C.replySuggest) }).click()
    await btn(C.sendReply).click()
    await expect(citizen.getByTestId('need-info')).toHaveCount(0)
    await act('officerApprove')
    await expect(citizen.getByTestId('result-approved')).toBeVisible()
    await shot(citizen, `${tag}-09-approved`)
  } else if (o === 'videoThenApprove') {
    await act('officerCompleteVideoCall')
    await act('officerApprove')
    await expect(citizen.getByTestId('result-approved')).toBeVisible()
    await shot(citizen, `${tag}-08-approved`)
  } else {
    await act('officerRefuse', o.refuse)
    await expect(citizen.getByTestId('refusal-reason')).toContainText(tr(REJECTION_REASONS[o.refuse].citizenMessage))
    await expect(citizen.getByTestId('refusal-reason')).toContainText(tr(REJECTION_REASONS[o.refuse].howToFix))
    await expect(citizen.getByTestId('key-rule')).toContainText(tr(KEY_RULE))
    await expect(btn(C.appeal)).toBeVisible()
    await expect(citizen.getByText('Laura Navarro')).toHaveCount(0) // officer's name is never shown
    await shot(citizen, `${tag}-08-refused`)
    if (o.then === 'appeal') {
      await btn(C.appeal).click()
      await citizen.getByRole('button', { name: tr(C.replySuggest) }).click()
      await shot(citizen, `${tag}-09-appeal-dialog`)
      await btn(C.sendAppeal).click()
      await expect(citizen.getByTestId('appeal-state')).toContainText(tr(C.appealUnderReview))
      await shot(citizen, `${tag}-10-appeal-review`)
    } else if (o.then === 'book') {
      await citizen.getByRole('button', { name: tr(C.bookVideoCall) }).click()
      await btn(C.bookConfirm).click()
      await expect(citizen.getByText(tr(C.booked).split('{')[0]).first()).toBeVisible()
      await shot(citizen, `${tag}-09-booked`)
    } else {
      await citizen.getByRole('button', { name: tr(C.corrected) }).click()
      await citizen.getByRole('button', { name: tr(C.replySuggest) }).click()
      await btn(C.sendCorrection).click()
      await expect(citizen.getByText(tr(CITIZEN_MESSAGES.correctionSubmitted)).or(citizen.getByText(tr(C.checksRunning)))).toBeVisible()
      await citizen.waitForFunction(id => window.__clave!.getState().cases[id].awaitingOfficer, plan.id, { timeout: 15000 })
      await shot(citizen, `${tag}-09b-corrected-review`)
      await act('officerApprove')
      await expect(citizen.getByTestId('result-approved')).toBeVisible({ timeout: 15000 })
      await shot(citizen, `${tag}-09-corrected-approved`)
    }
  }

  // sign out: back to the sign-in screen
  await citizen.getByRole('button', { name: new RegExp(`^${tr(C.signOut)}`) }).click()
  await expect(citizen).toHaveURL(/#\/citizen$/)
  await expect(citizen.getByTestId('signin-form')).toHaveCount(1)
  await expect(citizen.getByTestId('signin-form')).toBeVisible()
  await expect(citizen.getByText(seed.persona.name)).toHaveCount(0)
}

for (const lang of ['en', 'es'] as const) {
  test(`citizen flow: all library personas (${lang})`, async ({ browser }) => {
    test.setTimeout(420_000)
    const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const errors: string[] = []
    const citizen = await openCitizen(ctx, lang, errors)
    const officer = await openOfficer(ctx)
    await shot(citizen, `${lang}-00-signin`)
    for (const plan of PLANS) await runPersona(citizen, officer, plan, lang)
    expect(errors).toEqual([])
    await ctx.close()
  })
}

test('landing page (phone + laptop)', async ({ browser }) => {
  for (const [name, viewport] of [['phone', PHONE], ['laptop', { width: 1440, height: 900 }]] as const) {
    const ctx = await browser.newContext({ viewport })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/#/')
    await expect(page.getByTestId('landing-citizen')).toBeVisible()
    await expect(page.getByTestId('figure-users')).toContainText('2024')
    await page.screenshot({ path: `${SHOTS}/landing-${name}.png`, fullPage: true })
    if (name === 'laptop') {
      await page.getByTestId('landing-citizen').click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SHOTS}/citizen-laptop-frame.png` })
    }
    expect(errors).toEqual([])
    await ctx.close()
  }
})
