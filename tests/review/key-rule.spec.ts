/**
 * CHECK 4 — key rule at runtime (window.__clave, ?debug=1) + citizen sees reason + appeal in every refusal path.
 */
import { test, expect, type Page } from '@playwright/test'
import { BASE, attachConsole, shot, signInAs, type Problems } from './helpers'

const D = `${BASE}/?debug=1`

async function submitted(page: Page, id: string) {
  await page.evaluate(async id => {
    const k = window.__clave!
    k.setEngineSpeed(0)
    const c = k.getState().cases[id]
    k.actions.startCase(id, c.presetAnswers, id === 'yusuf' ? 'FALLBACK' : 'B')
    k.actions.giveConsent(id)
    await k.actions.submitForVerification(id)
  }, id)
}

const tryCall = (page: Page, code: string) => page.evaluate(code => {
  const k = window.__clave!
  const before = JSON.stringify(k.getState().cases)
  try {
    new Function('k', code)(k)
    return { threw: false, msg: '', unchanged: JSON.stringify(k.getState().cases) === before }
  } catch (e) {
    return { threw: true, msg: `${(e as Error).name}: ${(e as Error).message}`, unchanged: JSON.stringify(k.getState().cases) === before }
  }
}, code)

test.describe('4. Key rule', () => {
  test('4a refuse/revoke throw without officer or without a closed-list reason', async ({ page }) => {
    const problems: Problems = { console: [], external: [] }
    attachConsole(page, problems)
    await page.goto(`${D}#/officer`)
    await page.waitForFunction(() => !!window.__clave)
    await submitted(page, 'deepfake')
    await submitted(page, 'giulia') // auto basic → revocable
    const results: Record<string, unknown> = {}
    await page.evaluate(() => window.__clave!.actions.officerSignOut())
    results.signedOutRefuse = await tryCall(page, "k.actions.officerRefuse('deepfake','suspected_fraud')")
    results.signedOutRevoke = await tryCall(page, "k.actions.officerRevoke('giulia','suspected_fraud')")
    await page.evaluate(() => window.__clave!.actions.officerSignIn('OF-DEMO-07'))
    for (const [name, code] of Object.entries({
      bogusReason: "k.actions.officerRefuse('deepfake','i_just_dont_like_it')",
      noReason: "k.actions.officerRefuse('deepfake')",
      nullReason: "k.actions.officerRefuse('deepfake', null)",
      emptyReason: "k.actions.officerRefuse('deepfake', '')",
      protoReason: "k.actions.officerRefuse('deepfake', 'toString')",
      dunderProto: "k.actions.officerRefuse('deepfake', '__proto__')",
      revokeBogus: "k.actions.officerRevoke('giulia','nope')",
      revokeNone: "k.actions.officerRevoke('giulia')",
      fakeOfficerSignIn: "k.actions.officerSignIn('OF-EVIL-1')",
    })) results[name] = await tryCall(page, code)
    console.log(JSON.stringify(results, null, 2))
    for (const [k, r] of Object.entries(results) as [string, { threw: boolean; unchanged: boolean; msg: string }][]) {
      expect(r.threw, k).toBe(true)
      expect(r.msg, k).toContain('ClaveRuleError')
      expect(r.unchanged, k).toBe(true)
    }
    // positive control
    const ok = await tryCall(page, "k.actions.officerRefuse('deepfake','suspected_fraud')")
    expect(ok.threw).toBe(false)
    // engine never refused: no refusal decision by system anywhere
    const sys = await page.evaluate(() => Object.values(window.__clave!.getState().cases).flatMap(c => c.decisions).filter(d => (d.outcome === 'refused' || d.outcome === 'revoked') && (d.by.kind !== 'officer' || !d.reasonId)))
    expect(sys).toEqual([])
    const s = await page.evaluate(() => window.__clave!.getState().cases.deepfake.decisions.length)
    expect(s).toBe(1)
  })

  test('4b engine never auto-refuses: every library case run to engine end with no decision other than approved_basic by system', async ({ page }) => {
    await page.goto(`${D}#/officer`)
    await page.waitForFunction(() => !!window.__clave)
    for (const id of ['giulia', 'daniel', 'rafael', 'noah', 'yusuf', 'deepfake', 'fakedoc', 'linwei']) await submitted(page, id)
    const out = await page.evaluate(() => Object.fromEntries(Object.values(window.__clave!.getState().cases).filter(c => c.origin === 'library').map(c => [c.id, { status: c.status, level: c.level, dec: c.decisions.map(d => `${d.outcome}/${d.by.kind}`), awaiting: c.awaitingOfficer }])))
    console.log(JSON.stringify(out))
    for (const v of Object.values(out)) {
      expect(v.status).not.toBe('not_approved')
      for (const d of v.dec) expect(d).toBe('approved_basic/system')
    }
    expect(out.deepfake.level).toBe('none')
    expect(out.fakedoc.level).toBe('none')
  })

  test('4c refusal of ONLY the advanced level: citizen sees reason + appeal (UI)', async ({ browser }) => {
    const context = await browser.newContext()
    const citizen = await context.newPage(); await citizen.setViewportSize({ width: 390, height: 844 })
    const officer = await context.newPage(); await officer.setViewportSize({ width: 1440, height: 900 })
    await officer.goto(`${D}#/officer`)
    await officer.waitForFunction(() => !!window.__clave)
    await submitted(officer, 'giulia')
    await officer.evaluate(() => { window.__clave!.actions.officerSignIn('OF-DEMO-07'); window.__clave!.actions.setActiveCitizenCase('giulia') })
    await citizen.goto(`${BASE}/#/citizen/case/giulia`)
    await expect(citizen.getByTestId('advanced-card')).toBeVisible()
    await officer.getByRole('table').getByRole('link', { name: 'Giulia Ferraro', exact: true }).click()
    await officer.getByRole('button', { name: /^Reject with reason/ }).click()
    const dlg = officer.getByRole('dialog')
    await expect(dlg.getByText('The basic level stays granted')).toBeVisible()
    await dlg.getByRole('radio', { name: /Face does not match/ }).click()
    await dlg.getByRole('button', { name: 'Confirm refusal' }).click()
    await expect(citizen.getByTestId('refusal-reason')).toContainText('The face in the camera did not match', { timeout: 10_000 })
    await expect(citizen.getByRole('button', { name: 'Appeal' })).toBeVisible()
    await expect(citizen.getByTestId('levels')).toContainText('Basic')
    await shot(citizen, '4c-advanced-only-refusal-citizen')
    // appeal it
    await citizen.getByRole('button', { name: 'Appeal' }).click()
    await citizen.getByRole('dialog').getByRole('textbox').fill('Please review the advanced level again.')
    await citizen.getByRole('button', { name: 'Send appeal' }).click()
    await expect(citizen.getByTestId('appeal-state')).toBeVisible()
    // appeal outcomes (uphold / dismiss) are covered separately in 4e-uphold and 4e-dismiss
    await context.close()
  })

  async function appealedAdvanced(page: Page) {
    await page.goto(`${D}#/officer`)
    await page.waitForFunction(() => !!window.__clave)
    await submitted(page, 'giulia')
    await page.evaluate(() => {
      const k = window.__clave!
      k.actions.officerSignIn('OF-DEMO-07')
      k.actions.officerRefuse('giulia', 'face_mismatch')
      k.actions.fileAppeal('giulia', 'please review')
    })
  }

  test('4e-uphold: appeal against advanced-only refusal can be upheld → advanced granted, citizen sees it', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await appealedAdvanced(page)
    const r = await page.evaluate(() => {
      const k = window.__clave!
      k.actions.officerApprove('giulia')
      const c = k.getState().cases.giulia
      return { level: c.level, advanced: c.advanced, status: c.status, appeal: c.appeal?.state, last: c.decisions.at(-1)?.outcome }
    })
    console.log('4e-uphold', JSON.stringify(r))
    expect(r).toMatchObject({ level: 'advanced', advanced: 'granted', status: 'approved', appeal: 'upheld', last: 'approved_advanced' })
    const citizen = await context.newPage(); await citizen.setViewportSize({ width: 390, height: 844 })
    await citizen.goto(`${BASE}/#/citizen/case/giulia`)
    await expect(citizen.getByTestId('levels')).toContainText('Advanced level granted')
    await shot(citizen, '4e-uphold-citizen')
    await context.close()
  })

  test('4e-dismiss: dismissing that appeal keeps basic, appeal dismissed, citizen still sees reason', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await appealedAdvanced(page)
    const r = await page.evaluate(() => {
      const k = window.__clave!
      k.actions.officerRefuse('giulia', 'face_mismatch', 'appeal dismissed')
      const c = k.getState().cases.giulia
      return { level: c.level, advanced: c.advanced, status: c.status, appeal: c.appeal?.state, awaiting: c.awaitingOfficer }
    })
    console.log('4e-dismiss', JSON.stringify(r))
    expect(r).toMatchObject({ level: 'basic', status: 'approved', appeal: 'dismissed', awaiting: false })
    const citizen = await context.newPage(); await citizen.setViewportSize({ width: 390, height: 844 })
    await citizen.goto(`${BASE}/#/citizen/case/giulia`)
    await expect(citizen.getByTestId('levels')).toContainText('Basic')
    await expect(citizen.getByTestId('refusal-reason')).toContainText('The face in the camera did not match')
    const dismissedShown = await citizen.getByText(/appeal.*(dismissed|not upheld)|recurso.*desestimado/i).count()
    const appealBtn = await citizen.getByRole('button', { name: 'Appeal' }).count()
    console.log('4e-dismiss citizen: dismissed state shown =', dismissedShown, ', Appeal button =', appealBtn)
    test.info().annotations.push({ type: 'citizen-after-dismissal', description: `dismissedShown=${dismissedShown} appealButton=${appealBtn}` })
    await shot(citizen, '4e-dismiss-citizen')
    await context.close()
  })

  test('4f refuse vs revoke on granted levels', async ({ page }) => {
    await page.goto(`${D}#/officer`)
    await page.waitForFunction(() => !!window.__clave)
    await submitted(page, 'giulia')
    await submitted(page, 'daniel')
    const r = await page.evaluate(() => {
      const k = window.__clave!
      k.actions.officerSignIn('OF-DEMO-07')
      k.actions.officerApprove('giulia') // advanced granted
      const out: Record<string, unknown> = {}
      try { k.actions.officerRefuse('giulia', 'suspected_fraud'); out.refuseAdvancedGranted = 'no throw' } catch (e) { out.refuseAdvancedGranted = (e as Error).message }
      // basic granted, advanced already refused (nothing pending, no appeal): refuse via API
      k.actions.officerRefuse('daniel', 'face_mismatch')
      try { k.actions.officerRefuse('daniel', 'suspected_fraud'); const c = k.getState().cases.daniel; out.refuseBasicOnly = { status: c.status, level: c.level, last: c.decisions.at(-1)?.outcome } } catch (e) { out.refuseBasicOnly = (e as Error).message }
      return out
    })
    console.log('4f', JSON.stringify(r))
    expect(String(r.refuseAdvancedGranted)).toContain('Use Revoke')
    test.info().annotations.push({ type: 'refuse-on-basic-only', description: JSON.stringify(r.refuseBasicOnly) })
  })

  test('4d revoke path and refusal during need_info: citizen sees reason + appeal', async ({ browser }) => {
    const context = await browser.newContext()
    const citizen = await context.newPage(); await citizen.setViewportSize({ width: 390, height: 844 })
    const officer = await context.newPage(); await officer.setViewportSize({ width: 1440, height: 900 })
    await officer.goto(`${D}#/officer`)
    await officer.waitForFunction(() => !!window.__clave)
    await submitted(officer, 'daniel')
    await submitted(officer, 'noah')
    await officer.evaluate(() => window.__clave!.actions.officerSignIn('OF-DEMO-07'))
    // revoke via UI
    await officer.goto(`${D}#/officer/case/daniel`)
    await officer.getByRole('button', { name: 'Revoke level' }).click()
    const dlg = officer.getByRole('dialog')
    await dlg.getByRole('radio', { name: /Data mismatch/ }).click()
    await dlg.getByRole('button', { name: /Confirm/ }).click()
    await signInAs(officer, 'daniel')
    await citizen.goto(`${BASE}/#/citizen/case/daniel`)
    await expect(citizen.getByTestId('refusal-reason')).toContainText('Your name or date of birth is different')
    await expect(citizen.getByRole('button', { name: 'Appeal' })).toBeVisible()
    // refuse during need_info
    await officer.evaluate(() => { const k = window.__clave!; k.actions.officerRequestInfo('noah', 'Send proof of guardianship please.'); k.actions.officerRefuse('noah', 'data_mismatch') })
    await signInAs(officer, 'noah')
    await citizen.goto(`${BASE}/#/citizen/case/noah`)
    await expect(citizen.getByTestId('refusal-reason')).toBeVisible()
    await expect(citizen.getByRole('button', { name: 'Appeal' })).toBeVisible()
    await context.close()
  })
})
