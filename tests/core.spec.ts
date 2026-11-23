/**
 * Core store + engine tests (Platform agent A). Drives window.__clave in the running app.
 * Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test tests/core.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

type AnyCase = {
  status: string; level: string; advanced: string; route: string | null; risk: string
  awaitingOfficer: boolean; correctedAfterRefusal: boolean; attempt: number
  flags: { code: string; severity: string }[]
  checks: { id: string; outcome: string }[]
  decisions: { outcome: string; reasonId?: string; by: { kind: string } }[]
  presetAnswers: unknown
  appeal?: { state: string }
}

async function boot(page: Page) {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/?debug=1#/')
  await page.waitForFunction(() => Boolean(window.__clave))
  await page.evaluate(() => {
    window.__clave!.setEngineSpeed(0.05)
    window.__clave!.actions.resetDemo()
    window.__clave!.actions.officerSignIn('OF-DEMO-07')
  })
  return errors
}

const getCase = (page: Page, id: string) =>
  page.evaluate(id => window.__clave!.getState().cases[id], id) as Promise<AnyCase>

/** Runs a library case end to end through the store with its preset answers. */
async function run(page: Page, id: string, route: string, answers?: Record<string, unknown>) {
  await page.evaluate(async ([id, route, answers]) => {
    const c = window.__clave!.getState().cases[id as string]
    const a = window.__clave!.actions
    a.startCase(id as string, { ...c.presetAnswers, ...(answers as object) }, route as 'A')
    a.giveConsent(id as string)
    await a.submitForVerification(id as string)
  }, [id, route, answers ?? {}] as const)
  return getCase(page, id)
}

const officer = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([fn, args]) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window.__clave!.actions as any)[fn as string](...(args as unknown[]))
      return null
    } catch (e) {
      return `${(e as Error).name}: ${(e as Error).message}`
    }
  }, [fn, args] as const)

const codes = (c: AnyCase) => c.flags.map(f => f.code)

test.describe('deprecated shims still drive the rules (old screens)', () => {
  test('applicant-x via startCase + giveConsent + submitForVerification: camera defaults to a real person → automatic basic', async ({ page }) => {
    const errors = await boot(page)
    const c = await run(page, 'applicant-x', 'B', { euEid: 'no', nfc: 'yes' })
    expect(c).toMatchObject({ status: 'approved', level: 'basic', advanced: 'pending_review', risk: 'low', awaitingOfficer: true })
    expect(codes(c)).toContain('advanced_level_review')
    expect(c.decisions[0]).toMatchObject({ outcome: 'approved_basic', by: { kind: 'system' } })
    expect(await officer(page, 'officerApprove', 'applicant-x')).toBeNull()
    expect(await getCase(page, 'applicant-x')).toMatchObject({ level: 'advanced', advanced: 'granted', awaitingOfficer: false })
    expect(errors).toEqual([])
  })

  test('valentina via the shims: residence mismatch waits for an officer, never auto-refused', async ({ page }) => {
    await boot(page)
    const c = await run(page, 'valentina', 'B', { nfc: 'yes' })
    expect(c).toMatchObject({ status: 'checking', level: 'none', risk: 'medium', awaitingOfficer: true })
    expect(codes(c)).toContain('residence_mismatch')
    expect(c.decisions).toEqual([])
  })
})

test.describe('key rule', () => {
  test('refuse / revoke need an officer and a reason from the closed list', async ({ page }) => {
    await boot(page)
    await run(page, 'valentina', 'B', { nfc: 'yes' })
    expect(await officer(page, 'officerRefuse', 'valentina')).toMatch(/ClaveRuleError/)
    expect(await officer(page, 'officerRefuse', 'valentina', 'because_i_said_so')).toMatch(/ClaveRuleError/)
    await page.evaluate(() => window.__clave!.actions.officerSignOut())
    expect(await officer(page, 'officerRefuse', 'valentina', 'REJ-05')).toMatch(/ClaveRuleError/)
    expect(await officer(page, 'officerApprove', 'valentina')).toMatch(/ClaveRuleError/)
    expect((await getCase(page, 'valentina')).status).toBe('checking')

    await page.evaluate(() => window.__clave!.actions.officerSignIn('OF-DEMO-07'))
    await run(page, 'applicant-x', 'B', { euEid: 'no', nfc: 'yes' })
    expect(await officer(page, 'officerRevoke', 'applicant-x')).toMatch(/ClaveRuleError/)
    expect(await officer(page, 'officerRevoke', 'applicant-x', 'REJ-07')).toBeNull()
    expect(await getCase(page, 'applicant-x')).toMatchObject({ level: 'none', status: 'not_approved' })
  })

  test('audit trail: seeded background history + events per action', async ({ page }) => {
    await boot(page)
    const bg = await page.evaluate(() => window.__clave!.caseAudit('bg-07').map(e => e.action))
    expect(bg).toEqual(expect.arrayContaining(['check_completed', 'escalated_to_officer', 'officer_refused', 'appeal_filed']))
    await run(page, 'applicant-x', 'B', { euEid: 'no', nfc: 'yes' })
    const ev = await page.evaluate(() => window.__clave!.caseAudit('applicant-x'))
    expect(ev.filter(e => e.action === 'check_completed').length).toBeGreaterThanOrEqual(6)
    expect(ev.find(e => e.action === 'auto_approved_basic')).toMatchObject({ ruleId: 'B-OK' })
  })
})

test.describe('live sync', () => {
  test('two tabs (citizen + officer) stay in sync within ~100 ms', async ({ context }) => {
    const officerPage = await context.newPage()
    const citizenPage = await context.newPage()
    const errors: string[] = []
    for (const p of [officerPage, citizenPage]) {
      p.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      p.on('pageerror', e => errors.push(e.message))
    }
    await officerPage.goto('/?debug=1#/officer')
    await officerPage.waitForFunction(() => Boolean(window.__clave))
    await officerPage.evaluate(() => { window.__clave!.actions.resetDemo(); window.__clave!.actions.officerSignIn('OF-DEMO-07') })
    await citizenPage.goto('/?debug=1#/citizen')
    await citizenPage.waitForFunction(() => Boolean(window.__clave))

    // citizen → officer
    await citizenPage.evaluate(() => {
      const a = window.__clave!.actions
      const c = window.__clave!.getState().cases['applicant-x']
      a.startCase('applicant-x', { ...c.presetAnswers, euEid: 'no', nfc: 'yes' }, 'B')
    })
    const t0 = Date.now()
    await officerPage.waitForFunction(() => window.__clave!.getState().cases['applicant-x'].route === 'B', null, { polling: 10, timeout: 1000 })
    expect(Date.now() - t0).toBeLessThan(500)

    // two synthetic face attempts, then "come back later": the case waits for an officer
    await citizenPage.evaluate(() => {
      const a = window.__clave!.actions
      a.giveConsent('applicant-x'); a.recordChipRead('applicant-x')
      a.recordFaceAttempt('applicant-x', 'synthetic'); a.recordFaceAttempt('applicant-x', 'synthetic'); a.comeBackLater('applicant-x')
    })
    await officerPage.waitForFunction(() => window.__clave!.getState().cases['applicant-x'].awaitingOfficer, null, { polling: 10, timeout: 2000 })

    // officer → citizen, timed
    // Time the sync itself: when the citizen tab's store holds the refusal (not when its UI finishes rendering,
    // which in dev mode includes React's development overhead).
    await citizenPage.evaluate(() => {
      const w = window as unknown as { __seenAt?: number }
      window.__clave!.subscribe(() => {
        if (w.__seenAt === undefined && window.__clave!.getState().cases['applicant-x'].status === 'not_approved') w.__seenAt = performance.timeOrigin + performance.now()
      })
    })
    const sent = await officerPage.evaluate(() => { window.__clave!.actions.officerRefuse('applicant-x', 'REJ-07'); return performance.timeOrigin + performance.now() })
    await citizenPage.waitForFunction(() => window.__clave!.getState().cases['applicant-x'].status === 'not_approved', null, { polling: 5, timeout: 1000 })
    const seen = await citizenPage.evaluate(() => (window as unknown as { __seenAt?: number }).__seenAt ?? Infinity)
    expect(seen - sent).toBeLessThan(150)

    // receiving tab knows which case changed
    const live = await citizenPage.evaluate(() => window.__clave!.getState().cases['applicant-x'].decisions.length)
    expect(live).toBe(1)
    // language stays per tab
    await citizenPage.evaluate(() => window.__clave!.actions.setLang('es'))
    await officerPage.waitForTimeout(150)
    expect(await officerPage.evaluate(() => window.__clave!.getState().lang)).toBe('en')
    expect(await officerPage.evaluate(() => document.documentElement.lang)).toBe('en')
    expect(await citizenPage.evaluate(() => document.documentElement.lang)).toBe('es')
    expect(errors).toEqual([])
  })

  test('reload keeps state (localStorage) and embed flag sets data-embed', async ({ page }) => {
    await boot(page)
    await run(page, 'applicant-x', 'B', { euEid: 'no', nfc: 'yes' })
    await page.goto('/?debug=1#/citizen?embed=1')
    await page.reload()
    await page.waitForFunction(() => Boolean(window.__clave))
    expect(await page.evaluate(() => window.__clave!.getState().cases['applicant-x'].status)).toBe('approved')
    await expect(page.locator('html')).toHaveAttribute('data-embed', '1')
    await expect(page.getByTestId('gov-copyright')).toHaveText('© 2026 Get your Cl@ve · Academic prototype of IE University')
  })
})
