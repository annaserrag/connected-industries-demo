/**
 * Appeals on the advanced level (rules-driven) (docs/SPEC-rules.md). Drives the store actions through window.__clave, never the UI.
 * Every outcome below must EMERGE from the typed data + the simulated world + the camera input + the rules +
 * the officer's decisions. Nothing is scripted per person (see the "same data, real person" test).
 *
 * Run: npx playwright test -c pw.local.config.ts tests/rules.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyCase = any

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const VEGA = 'OF-DEMO-07'
const ORTIZ = 'OF-DEMO-12'

async function boot(page: Page) {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/?debug=1#/')
  await page.waitForFunction(() => Boolean(window.__clave))
  await page.evaluate(([vega]) => {
    window.__clave!.setEngineSpeed(0.02)
    window.__clave!.actions.resetDemo()
    window.__clave!.actions.officerSignIn(vega)
  }, [VEGA])
  return errors
}

/** Calls one action; returns { value } or { error: 'ClaveRuleError: …' }. Awaits promises. */
async function call(page: Page, fn: string, ...args: unknown[]): Promise<{ value?: any; error?: string }> {
  return page.evaluate(async ([fn, args]) => {
    try {
      const value = await (window.__clave!.actions as any)[fn as string](...(args as unknown[]))
      return { value }
    } catch (e) {
      return { error: `${(e as Error).name}: ${(e as Error).message}` }
    }
  }, [fn, args] as const)
}
/** Same, but fails the test on an error. */
async function ok(page: Page, fn: string, ...args: unknown[]) {
  const r = await call(page, fn, ...args)
  expect(r.error, `${fn} should succeed`).toBeUndefined()
  return r.value
}

const getCase = (page: Page, id: string) => page.evaluate(id => window.__clave!.getState().cases[id], id) as Promise<AnyCase>
const tier = (page: Page, id: string) => page.evaluate(id => window.__clave!.priorityOf(id), id)
const auditOf = (page: Page, id: string) => page.evaluate(id => window.__clave!.caseAudit(id), id) as Promise<AnyCase[]>
const signInAs = (page: Page, officerId: string) => page.evaluate(id => window.__clave!.actions.officerSignIn(id), officerId)

/** Contact + SMS + final confirmation + submit. */
async function finish(page: Page, id: string, mobile: string) {
  expect(await ok(page, 'setContact', id, { mobile })).toEqual({ demoCode: '123456' })
  expect(await ok(page, 'confirmSms', id, '000000')).toBe(false)
  expect(await ok(page, 'confirmSms', id, '123456')).toBe(true)
  await ok(page, 'confirmReview', id)
  return ok(page, 'submit', id)
}

/** Route B, everything typed by the citizen, with a camera input for the face check. */
async function routeB(page: Page, id: string, answers: Record<string, unknown>, camera: string) {
  expect((await ok(page, 'setAnswers', id, answers)).route).toBe('B')
  await ok(page, 'giveConsents', id, { face: true, residence: true })
  return { chip: await ok(page, 'recordChipRead', id), face: await ok(page, 'recordFaceAttempt', id, camera) }
}


/** A new person with a passport, Route B, real person on camera → basic automatic, advanced pending review. */
async function routeBApproved(page: Page) {
  const r = await ok(page, 'citizenSignUp', { givenNames: 'Inês', surnames: 'Prova Lopes', dateOfBirth: '1991-06-02', countryIndex: 2, documentType: 'PASSPORT', documentNumber: 'PT7712093', expiryDate: '2032-01-01', password: 'password-1' })
  const id = r.caseId as string
  await routeB(page, id, { document: 'PASSPORT', euEid: 'no', who: 'self', nfc: 'yes' }, 'person')
  await finish(page, id, '+34 600 111 222')
  const c = await getCase(page, id)
  expect([c.status, c.level, c.advanced]).toEqual(['approved', 'basic', 'pending_review'])
  return id
}

test('advanced-only refusal keeps the basic level; review by the same officer is blocked; a different officer upholds it', async ({ page }) => {
  await boot(page)
  const id = await routeBApproved(page)
  await ok(page, 'officerRefuse', id, 'REJ-02', 'advanced evidence unclear')
  let c = await getCase(page, id)
  expect(c.level).toBe('basic')
  await ok(page, 'requestReview', id, 'The photo is old; I can show my passport on a video call.')
  expect((await call(page, 'officerDecideAppeal', id, 'uphold', 'REJ-02')).error).toMatch(/ClaveRuleError/)
  await signInAs(page, ORTIZ)
  await ok(page, 'officerDecideAppeal', id, 'uphold', 'REJ-02')
  c = await getCase(page, id)
  expect(c.level).toBe('basic')
  expect(c.advanced).not.toBe('granted')
})

test('advanced-only refusal → review approved by a different officer grants the advanced level', async ({ page }) => {
  await boot(page)
  const id = await routeBApproved(page)
  await ok(page, 'officerRefuse', id, 'REJ-02')
  await ok(page, 'requestReview', id, 'Please review.')
  await signInAs(page, ORTIZ)
  await ok(page, 'officerDecideAppeal', id, 'approve')
  const c = await getCase(page, id)
  expect([c.status, c.level, c.advanced]).toEqual(['approved', 'advanced', 'granted'])
})

test('only an officer refuses, always with a closed-list reason', async ({ page }) => {
  await boot(page)
  const id = await routeBApproved(page)
  expect((await call(page, 'officerRefuse', id)).error).toMatch(/ClaveRuleError/)
  expect((await call(page, 'officerRefuse', id, 'because')).error).toMatch(/ClaveRuleError/)
  await page.evaluate(() => window.__clave!.actions.officerSignOut())
  expect((await call(page, 'officerRefuse', id, 'REJ-02')).error).toMatch(/ClaveRuleError/)
})
