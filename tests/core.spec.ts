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

test.describe('library cases end to end', () => {
  test('giulia and daniel: auto basic + advanced pending, then officer approves advanced', async ({ page }) => {
    const errors = await boot(page)
    for (const id of ['giulia', 'daniel']) {
      const c = await run(page, id, 'B')
      expect(c.status).toBe('approved')
      expect(c.level).toBe('basic')
      expect(c.advanced).toBe('pending_review')
      expect(c.awaitingOfficer).toBe(true)
      expect(c.risk).toBe('low')
      expect(codes(c)).toContain('advanced_level_review')
      expect(c.decisions[0]).toMatchObject({ outcome: 'approved_basic', by: { kind: 'system' } })
      expect(c.checks.map(x => x.id)).toEqual(['chip_read', 'chip_signature', 'document_validity', 'liveness', 'face_match', 'residence'])
      expect(await officer(page, 'officerApprove', id)).toBeNull()
      const after = await getCase(page, id)
      expect(after.level).toBe('advanced')
      expect(after.advanced).toBe('granted')
      expect(after.awaitingOfficer).toBe(false)
    }
    expect(errors).toEqual([])
  })

  test('giulia via route A (eIDAS): auto basic, no advanced review', async ({ page }) => {
    await boot(page)
    const c = await run(page, 'giulia', 'A', { hasEuEid: true })
    expect(c.status).toBe('approved')
    expect(c.level).toBe('basic')
    expect(c.advanced).toBe('not_requested')
    expect(c.awaitingOfficer).toBe(false)
  })

  test('rafael: auto basic + assisted flag (medium)', async ({ page }) => {
    await boot(page)
    const c = await run(page, 'rafael', 'B')
    expect(c.status).toBe('approved')
    expect(c.level).toBe('basic')
    expect(c.advanced).toBe('pending_review')
    expect(codes(c)).toContain('assisted_shared_device')
    expect(c.risk).toBe('medium')
    expect(c.awaitingOfficer).toBe(true)
  })

  test('noah (minor): never automatic, awaits officer, guardian_link checked', async ({ page }) => {
    await boot(page)
    const c = await run(page, 'noah', 'B')
    expect(c.status).toBe('checking')
    expect(c.level).toBe('none')
    expect(c.awaitingOfficer).toBe(true)
    expect(codes(c)).toContain('minor_with_guardian')
    expect(c.checks.map(x => x.id)).toContain('guardian_link')
    expect(c.decisions).toEqual([])
    expect(await officer(page, 'officerApprove', 'noah')).toBeNull()
    expect((await getCase(page, 'noah')).status).toBe('approved')
  })

  test('yusuf (red card): FALLBACK awaits officer, approved only after video call', async ({ page }) => {
    await boot(page)
    const c = await run(page, 'yusuf', 'FALLBACK')
    expect(c.route).toBe('FALLBACK')
    expect(c.status).toBe('checking')
    expect(c.awaitingOfficer).toBe(true)
    expect(codes(c)).toContain('policy_proposal_route')
    expect(c.checks.find(x => x.id === 'officer_video')?.outcome).toBe('pending')
    expect(await officer(page, 'officerApprove', 'yusuf')).toMatch(/ClaveRuleError/)
    expect(await officer(page, 'officerCompleteVideoCall', 'yusuf')).toBeNull()
    expect((await getCase(page, 'yusuf')).checks.find(x => x.id === 'officer_video')?.outcome).toBe('pass')
    expect(await officer(page, 'officerApprove', 'yusuf')).toBeNull()
    const done = await getCase(page, 'yusuf')
    expect(done.status).toBe('approved')
    expect(done.level).toBe('basic')
    expect(done.awaitingOfficer).toBe(false)
  })

  test('deepfake and fakedoc: high risk, awaiting officer, never auto-refused', async ({ page }) => {
    await boot(page)
    for (const [id, flag] of [['deepfake', 'low_liveness'], ['fakedoc', 'chip_signature_failed']] as const) {
      const c = await run(page, id, 'B')
      expect(c.risk).toBe('high')
      expect(c.awaitingOfficer).toBe(true)
      expect(c.status).toBe('checking')
      expect(c.level).toBe('none')
      expect(codes(c)).toContain(flag)
      expect(c.decisions).toEqual([])
    }
    const queue = await page.evaluate(() => window.__clave!.officerQueue().map(c => c.id))
    expect(queue.slice(0, 2).sort()).toEqual(['deepfake', 'fakedoc'])
    expect(await officer(page, 'officerRefuse', 'deepfake', 'liveness_failed')).toBeNull()
    const refused = await getCase(page, 'deepfake')
    expect(refused.status).toBe('not_approved')
    expect(refused.decisions.at(-1)).toMatchObject({ outcome: 'refused', reasonId: 'liveness_failed', by: { kind: 'officer' } })
  })

  test('linwei: refused residence_not_found → correction → officer approve → correctedAfterRefusal', async ({ page }) => {
    await boot(page)
    const c1 = await run(page, 'linwei', 'B')
    expect(c1.awaitingOfficer).toBe(true)
    expect(c1.status).toBe('checking')
    expect(codes(c1)).toContain('residence_not_found')
    expect(await officer(page, 'officerRefuse', 'linwei', 'residence_not_found')).toBeNull()
    expect((await getCase(page, 'linwei')).status).toBe('not_approved')

    await page.evaluate(() => window.__clave!.actions.submitCorrection('linwei', 'Padrón updated'))
    const c2 = await getCase(page, 'linwei')
    expect(c2.attempt).toBe(2)
    expect(c2.checks.find(x => x.id === 'residence')?.outcome).toBe('pass')
    expect(c2.status).toBe('checking')
    expect(c2.awaitingOfficer).toBe(true)
    expect(c2.risk).toBe('medium')
    expect(codes(c2)).toContain('second_attempt')
    expect(c2.level).toBe('none') // not auto-approved after a refusal

    expect(await officer(page, 'officerApprove', 'linwei')).toBeNull()
    const c3 = await getCase(page, 'linwei')
    expect(c3.status).toBe('approved')
    expect(c3.correctedAfterRefusal).toBe(true)
  })
})

test.describe('key rule', () => {
  test('refuse / revoke need an officer and a reason from the closed list', async ({ page }) => {
    await boot(page)
    await run(page, 'deepfake', 'B')
    expect(await officer(page, 'officerRefuse', 'deepfake')).toMatch(/ClaveRuleError/)
    expect(await officer(page, 'officerRefuse', 'deepfake', 'because_i_said_so')).toMatch(/ClaveRuleError/)
    await page.evaluate(() => window.__clave!.actions.officerSignOut())
    expect(await officer(page, 'officerRefuse', 'deepfake', 'liveness_failed')).toMatch(/ClaveRuleError/)
    expect(await officer(page, 'officerApprove', 'deepfake')).toMatch(/ClaveRuleError/)
    expect((await getCase(page, 'deepfake')).status).toBe('checking')

    await page.evaluate(() => window.__clave!.actions.officerSignIn('OF-DEMO-07'))
    await run(page, 'giulia', 'B')
    expect(await officer(page, 'officerRevoke', 'giulia')).toMatch(/ClaveRuleError/)
    expect(await officer(page, 'officerRevoke', 'giulia', 'suspected_fraud')).toBeNull()
    const g = await getCase(page, 'giulia')
    expect(g.level).toBe('none')
    expect(g.status).toBe('not_approved')
  })

  test('appeal: open → officer approve upholds it', async ({ page }) => {
    await boot(page)
    await run(page, 'fakedoc', 'B')
    await officer(page, 'officerRefuse', 'fakedoc', 'chip_invalid')
    await page.evaluate(() => window.__clave!.actions.fileAppeal('fakedoc', 'My passport is genuine'))
    let c = await getCase(page, 'fakedoc')
    expect(c.status).toBe('not_approved')
    expect(c.awaitingOfficer).toBe(true)
    expect(codes(c)).toContain('appeal_filed')
    expect(await officer(page, 'officerApprove', 'fakedoc')).toBeNull()
    c = await getCase(page, 'fakedoc')
    expect(c.appeal?.state).toBe('upheld')
    expect(c.correctedAfterRefusal).toBe(true)
  })

  test('audit trail: seeded background history + events per action', async ({ page }) => {
    await boot(page)
    const bg = await page.evaluate(() => window.__clave!.caseAudit('bg-07').map(e => e.action))
    expect(bg).toEqual(expect.arrayContaining(['check_completed', 'escalated_to_officer', 'officer_refused', 'appeal_filed']))
    await run(page, 'giulia', 'B')
    const ev = await page.evaluate(() => window.__clave!.caseAudit('giulia'))
    expect(ev.filter(e => e.action === 'check_completed')).toHaveLength(6)
    expect(ev.find(e => e.action === 'auto_approved_basic')?.evidence?.length).toBeGreaterThan(0)
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
      const c = window.__clave!.getState().cases.deepfake
      a.startCase('deepfake', c.presetAnswers, 'B')
    })
    const t0 = Date.now()
    await officerPage.waitForFunction(() => window.__clave!.getState().cases.deepfake.route === 'B', null, { polling: 10, timeout: 1000 })
    expect(Date.now() - t0).toBeLessThan(500)

    await citizenPage.evaluate(() => { window.__clave!.setEngineSpeed(0.05); return window.__clave!.actions.submitForVerification('deepfake') })
    await officerPage.waitForFunction(() => window.__clave!.getState().cases.deepfake.awaitingOfficer, null, { polling: 10, timeout: 2000 })

    // officer → citizen, timed
    // Time the sync itself: when the citizen tab's store holds the refusal (not when its UI finishes rendering,
    // which in dev mode includes React's development overhead).
    await citizenPage.evaluate(() => {
      const w = window as unknown as { __seenAt?: number }
      window.__clave!.subscribe(() => {
        if (w.__seenAt === undefined && window.__clave!.getState().cases.deepfake.status === 'not_approved') w.__seenAt = performance.timeOrigin + performance.now()
      })
    })
    const sent = await officerPage.evaluate(() => { window.__clave!.actions.officerRefuse('deepfake', 'suspected_fraud'); return performance.timeOrigin + performance.now() })
    await citizenPage.waitForFunction(() => window.__clave!.getState().cases.deepfake.status === 'not_approved', null, { polling: 5, timeout: 1000 })
    const seen = await citizenPage.evaluate(() => (window as unknown as { __seenAt?: number }).__seenAt ?? Infinity)
    expect(seen - sent).toBeLessThan(150)

    // receiving tab knows which case changed
    const live = await citizenPage.evaluate(() => window.__clave!.getState().cases.deepfake.decisions.length)
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
    await run(page, 'giulia', 'B')
    await page.goto('/?debug=1#/citizen?embed=1')
    await page.reload()
    await page.waitForFunction(() => Boolean(window.__clave))
    expect(await page.evaluate(() => window.__clave!.getState().cases.giulia.status)).toBe('approved')
    await expect(page.locator('html')).toHaveAttribute('data-embed', '1')
    await expect(page.getByText('Student prototype — not an official Government of Spain service.')).toBeVisible()
  })
})
