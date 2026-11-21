/**
 * Staff console (branch feature/staff-console): certificate sign-in outcomes, job details, priority tiers,
 * age bump, by-document view, live dashboard, landing entry points.
 * Run: PORT=5182 PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test tests/integration/staff-console.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

type K = any // eslint-disable-line @typescript-eslint/no-explicit-any
const D = '/?debug=1'

function track(page: Page) {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  return errors
}

async function boot(page: Page, path = '#/officer') {
  await page.goto(`${D}${path}`)
  await page.waitForFunction(() => Boolean((window as K).__clave))
  await page.evaluate(() => {
    const k = (window as K).__clave
    k.setEngineSpeed(0)
    k.actions.officerSignOut()
    k.actions.resetDemo()
  })
}

async function pickCertificate(page: Page, certId: string) {
  await page.getByRole('button', { name: 'Sign in with your electronic certificate' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByText('Simulated', { exact: true })).toBeVisible()
  await page.getByTestId(`cert-${certId}`).click()
  await dlg.getByRole('button', { name: 'Sign in', exact: true }).click()
}

const lastAudit = (page: Page) => page.evaluate(() => (window as K).__clave.getState().audit.at(-1))

test.use({ viewport: { width: 1440, height: 900 } })

test('Laura, first time: certificate → job details → console; second sign-in skips the form', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  await pickCertificate(page, 'cert-laura')
  const form = page.getByTestId('staff-profile-form')
  await expect(form).toBeVisible()
  // read from the certificate, prefilled from it
  await expect(form.getByText('DEMO-NIF-0007-L').first()).toBeVisible()
  await expect(form.getByLabel(/Organisation/)).toHaveValue('aeat')
  await expect(form.getByLabel(/Office/)).toHaveValue('DEMO-E04000101')
  await expect(form.getByLabel(/^Post/)).toHaveValue('Cl@ve registration officer')
  await expect(form.getByText(/every decision you take is recorded with these details/)).toBeVisible()
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_signed_in', actor: { kind: 'officer', name: 'Laura Navarro' } })
  expect(await page.evaluate(() => (window as K).__clave.getState().officerId)).toBeNull()

  await form.getByLabel(/Personnel number/).fill('DEMO-NRP-20481')
  await form.getByRole('button', { name: 'Save and open the console' }).click()
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await expect(page.getByTestId('officer-identity')).toContainText('Cl@ve registration officer')
  await expect(page.getByTestId('officer-identity')).toContainText('DEMO-E04000101')
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_profile_completed', actor: { id: 'OF-DEMO-07' } })

  // profile tab shows the details and the certificate used
  await page.getByRole('link', { name: 'My profile' }).first().click()
  await expect(page.getByTestId('profile-details')).toContainText('DEMO-NRP-20481')
  await expect(page.getByTestId('staff-profile')).toContainText('Public employee certificate (cryptocard)')

  // sign out, sign in again: no form this time
  await page.getByRole('button', { name: 'Sign out' }).click()
  await pickCertificate(page, 'cert-laura')
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await expect(page.getByTestId('staff-profile-form')).toHaveCount(0)
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_signed_in' })

  // audit trail shows the staff sign-in events
  await page.goto(`${D}#/officer/audit`)
  await expect(page.getByRole('cell', { name: 'Staff signed in' }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Job details confirmed' }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('Javier with his DNIe: picks organisation, office and post himself', async ({ page }) => {
  await boot(page)
  await pickCertificate(page, 'cert-javier')
  const form = page.getByTestId('staff-profile-form')
  await expect(form).toBeVisible()
  await expect(form.getByText('Electronic DNI (DNIe)').first()).toBeVisible()
  await expect(form.getByLabel(/Organisation/)).toHaveValue('')
  await expect(form.getByLabel(/Office/)).toBeDisabled()
  await form.getByLabel(/Organisation/).selectOption('seg_social')
  await expect(form.getByLabel(/Office/)).toHaveValue('DEMO-E04000214') // only office of that body
  await form.getByLabel(/^Post/).selectOption('Citizen information officer')
  await form.getByLabel(/Personnel number/).fill('DEMO-NRP-55120')
  await form.getByText('Supervisor', { exact: true }).click()
  await form.getByRole('button', { name: 'Save and open the console' }).click()
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
  await expect(page.getByTestId('officer-identity')).toContainText('Valencia Ruzafa')
  const p = await page.evaluate(() => (window as K).__clave.getState().officerProfiles['OF-DEMO-12'])
  expect(p).toMatchObject({ authorityId: 'seg_social', officeCode: 'DEMO-E04000214', role: 'supervisor', certificateId: 'cert-javier' })
})

test('Diego is refused: not staff of a registration authority', async ({ page }) => {
  await boot(page)
  await pickCertificate(page, 'cert-diego')
  const denied = page.getByTestId('staff-denied')
  await expect(denied).toBeVisible()
  await expect(denied).toHaveAttribute('data-reason', 'not_staff')
  await expect(denied.getByRole('heading', { level: 1 })).toHaveText(/isn’t linked to registration staff/)
  await expect(denied).toContainText('office supervisor')
  expect(await page.evaluate(() => (window as K).__clave.getState().officerId)).toBeNull()
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_access_denied', actor: { name: 'Diego Romero' } })
  // the console stays closed even by URL
  await page.goto(`${D}#/officer/dashboard`)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign in with your electronic certificate' })).toBeVisible()
})

test('an expired certificate is refused, and "Choose another certificate" reopens the picker', async ({ page }) => {
  await boot(page)
  await pickCertificate(page, 'cert-old')
  const denied = page.getByTestId('staff-denied')
  await expect(denied).toHaveAttribute('data-reason', 'expired')
  await expect(denied.getByRole('heading', { level: 1 })).toHaveText('This certificate has expired')
  await expect(denied).toContainText('30 Jun 2025')
  expect(await lastAudit(page)).toMatchObject({ action: 'staff_access_denied' })
  expect((await lastAudit(page)).detail).toContain('certificate expired')
  await denied.getByRole('button', { name: 'Choose another certificate' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('personnel number (NRP) is validated in the form and in core', async ({ page }) => {
  await boot(page)
  await pickCertificate(page, 'cert-marta')
  const form = page.getByTestId('staff-profile-form')
  const nrp = form.getByLabel(/Personnel number/)
  await expect(form.getByText(/use a DEMO-NRP-… number/)).toBeVisible()
  for (const bad of ['12345678', 'DEMO-NRP-12', 'NRP-1234']) {
    await nrp.fill(bad)
    await form.getByRole('button', { name: 'Save and open the console' }).click()
    await expect(nrp).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByText('Use the demo format DEMO-NRP- followed by 4 to 8 digits.')).toBeVisible()
  }
  expect(await page.evaluate(() => (window as K).__clave.getState().officerProfiles['OF-DEMO-21'])).toBeUndefined()

  const errs = await page.evaluate(() => {
    const a = (window as K).__clave.actions
    const tryIt = (fn: () => void) => { try { fn(); return null } catch (e) { return (e as Error).name } }
    const ok = { authorityId: 'delegacion', officeCode: 'DEMO-E04000377', post: 'Office supervisor', personnelNumber: 'DEMO-NRP-7781', role: 'supervisor' }
    return {
      badNrp: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'cert-marta', { ...ok, personnelNumber: 'X-1' })),
      wrongOffice: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'cert-marta', { ...ok, officeCode: 'DEMO-E04000101' })),
      wrongCert: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'cert-laura', ok)),
      expired: tryIt(() => a.officerCompleteProfile('OF-DEMO-07', 'cert-old', { ...ok, authorityId: 'aeat', officeCode: 'DEMO-E04000101' })),
      good: tryIt(() => a.officerCompleteProfile('OF-DEMO-21', 'cert-marta', ok)),
    }
  })
  expect(errs).toEqual({ badNrp: 'ClaveRuleError', wrongOffice: 'ClaveRuleError', wrongCert: 'ClaveRuleError', expired: 'ClaveRuleError', good: null })
  await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
})

test('queue follows the priority tiers, with the age bump', async ({ page }) => {
  const errors = track(page)
  await boot(page)
  const r = await page.evaluate(async () => {
    const k = (window as K).__clave, a = k.actions
    for (const id of ['giulia', 'daniel', 'deepfake']) {
      const c = k.getState().cases[id]
      a.startCase(id, c.presetAnswers, 'B'); a.giveConsent(id)
      await a.submitForVerification(id)
    }
    a.officerSignIn('OF-DEMO-07')
    // advanced-level refusal (basic kept), then the citizen appeals
    a.officerRefuse('giulia', 'face_mismatch')
    a.fileAppeal('giulia', 'Please look again, I had new glasses')
    const q = k.officerQueue().map((c: K) => c.id)
    const in25h = new Date(Date.now() + 25 * 3600_000).toISOString()
    return {
      q,
      tiers: Object.fromEntries(q.map((id: string) => [id, k.priorityOf(id)])),
      later: { daniel: k.priorityOf('daniel', in25h), bg03: k.priorityOf('bg-03', in25h), deepfake: k.priorityOf('deepfake', in25h) },
    }
  })
  expect(r.tiers.deepfake).toBe('p1_high_risk')
  expect(r.tiers.giulia).toBe('p2_appeal')
  expect(r.tiers.daniel).toBe('p6_advanced_review')
  expect(r.tiers['bg-09']).toBe('p5_video_call')
  expect(r.tiers['bg-03']).toBe('p4_medium_risk')
  // Aisha's appeal has waited over 24 h: moved up from P2 to P1, behind the fresh high-risk case
  expect(r.tiers['bg-07']).toBe('p1_high_risk')
  expect(r.q.indexOf('deepfake')).toBeLessThan(r.q.indexOf('bg-07'))
  expect(r.q.indexOf('bg-07')).toBeLessThan(r.q.indexOf('giulia'))
  expect(r.q.indexOf('giulia')).toBeLessThan(r.q.indexOf('bg-03'))
  expect(r.q.indexOf('bg-03')).toBeLessThan(r.q.indexOf('bg-09'))
  expect(r.q.indexOf('bg-09')).toBeLessThan(r.q.indexOf('daniel'))
  // age bump: one tier up after 24 h, never above P1
  expect(r.later).toEqual({ daniel: 'p5_video_call', bg03: 'p3_citizen_replied', deepfake: 'p1_high_risk' })

  // UI: tier groups in order, legend, bump indicator
  await page.goto(`${D}#/officer`)
  await expect(page.getByTestId('priority-legend')).toContainText('P1 high risk → P6 advanced level')
  const tiers = await page.locator('[data-testid^="tier-row-"]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))
  expect(tiers).toEqual(['tier-row-p1_high_risk', 'tier-row-p2_appeal', 'tier-row-p4_medium_risk', 'tier-row-p5_video_call', 'tier-row-p6_advanced_review'])
  const rows = await page.locator('tr[data-case-id]').evaluateAll(els => els.map(e => e.getAttribute('data-case-id')))
  expect(rows).toEqual(r.q)
  await expect(page.locator('tr[data-case-id="bg-07"]').getByTestId('age-bump')).toBeVisible()
  await expect(page.locator('tr[data-case-id="deepfake"]').getByTestId('age-bump')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('by-document tab counts match the store', async ({ page }) => {
  await boot(page)
  await page.evaluate(async () => {
    const k = (window as K).__clave, a = k.actions
    for (const id of ['daniel', 'noah']) {
      const c = k.getState().cases[id]
      a.startCase(id, c.presetAnswers, 'B'); a.giveConsent(id)
      await a.submitForVerification(id)
    }
    a.officerSignIn('OF-DEMO-07')
  })
  await page.goto(`${D}#/officer/documents`)
  const expected = await page.evaluate(() => {
    const out: Record<string, number> = { DNI: 0, EU_EID: 0, PASSPORT: 0, TIE: 0, NIE_PAPER: 0, RED_CARD: 0 }
    for (const c of Object.values((window as K).__clave.getState().cases) as K[]) {
      if (c.status !== 'draft') out[c.answers?.document ?? c.document.type]++
    }
    return out
  })
  expect(expected.TIE).toBeGreaterThan(0)
  for (const [doc, n] of Object.entries(expected)) {
    await expect(page.getByTestId(`doc-count-${doc}`)).toHaveText(String(n))
  }
  await page.getByTestId('doc-tab-TIE').click()
  await expect(page.getByTestId('doc-panel-TIE').locator('tr[data-case-id]')).toHaveCount(expected.TIE)
  await expect(page.getByTestId('doc-panel-TIE').getByRole('link', { name: 'Daniel Mwangi' })).toBeVisible()
  await page.getByTestId('doc-tab-RED_CARD').click()
  await expect(page.getByTestId('doc-panel-RED_CARD').getByText('Policy proposal').first()).toBeVisible()
})

test('dashboard updates live when a citizen tab submits a case', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const officer = await ctx.newPage()
  const citizen = await ctx.newPage()
  const errors = [...track(officer), ...track(citizen)]
  await boot(officer, '#/officer/dashboard')
  await officer.evaluate(() => (window as K).__clave.actions.officerSignIn('OF-DEMO-07'))
  await expect(officer.getByTestId('demo-live-badge').first()).toHaveText('Demo data · live')
  await expect(officer.getByTestId('simulated-trends')).toContainText('Simulated')
  const read = async (id: string) => Number(await officer.getByTestId(id).getAttribute('data-value'))
  const before = { awaiting: await read('kpi-awaiting'), passport: await read('doc-bar-PASSPORT'), p1: await read('tier-count-p1_high_risk') }

  await citizen.goto(`${D}#/citizen`)
  await citizen.waitForFunction(() => Boolean((window as K).__clave))
  await citizen.evaluate(async () => {
    const k = (window as K).__clave, a = k.actions
    k.setEngineSpeed(0.05)
    const c = k.getState().cases.deepfake
    a.startCase('deepfake', c.presetAnswers, 'B'); a.giveConsent('deepfake')
    await a.submitForVerification('deepfake')
  })
  await expect.poll(() => read('kpi-awaiting')).toBe(before.awaiting + 1)
  await expect.poll(() => read('doc-bar-PASSPORT')).toBe(before.passport + 1)
  await expect.poll(() => read('tier-count-p1_high_risk')).toBe(before.p1 + 1)
  await expect(officer.getByTestId('activity').getByText('Sent to officer queue').first()).toBeVisible()
  expect(errors).toEqual([])
  await ctx.close()
})

test('landing: Apply first, Staff access tab leads to certificate sign-in (phone)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const errors = track(page)
  await page.goto('/#/')
  await expect(page.getByRole('tab', { name: 'Apply' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('landing-citizen')).toContainText('Apply')
  await expect(page.getByRole('link', { name: /dashboard|Demo mode/i })).toHaveCount(0)
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(390)
  await page.getByRole('tab', { name: 'Staff access' }).click()
  await expect(page.getByTestId('landing-staff-panel')).toContainText('registration authorities')
  await page.getByRole('link', { name: 'Sign in with your certificate' }).click()
  await expect(page).toHaveURL(/#\/officer/)
  await expect(page.getByRole('button', { name: 'Sign in with your electronic certificate' })).toBeVisible()
  expect(errors).toEqual([])
  await ctx.close()
})
