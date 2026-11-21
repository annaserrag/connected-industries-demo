import { test, expect } from '@playwright/test'
const D = '/?debug=1'
async function giuliaApprovedBasic(page: import('@playwright/test').Page) {
  await page.goto(`${D}#/officer`)
  await page.waitForFunction(() => !!(window as any).__clave)
  await page.evaluate(async () => {
    const k = (window as any).__clave
    k.actions.resetDemo(); k.setEngineSpeed(0)
    k.actions.startCase('giulia', k.getState().cases.giulia.presetAnswers, 'B')
    k.actions.giveConsent('giulia')
    await k.actions.submitForVerification('giulia')
    k.actions.officerSignIn('OF-DEMO-07')
  })
}
test('advanced-only refusal → appeal → dismissed keeps basic', async ({ page }) => {
  await giuliaApprovedBasic(page)
  const r = await page.evaluate(() => {
    const k = (window as any).__clave
    k.actions.officerRefuse('giulia', 'face_mismatch')
    k.actions.fileAppeal('giulia', 'please review')
    k.actions.officerRefuse('giulia', 'face_mismatch')
    const c = k.getState().cases.giulia
    return { level: c.level, appeal: c.appeal?.state }
  })
  expect(r).toEqual({ level: 'basic', appeal: 'dismissed' })
})
test('advanced-only refusal → appeal → upheld grants advanced; refuse then requires revoke', async ({ page }) => {
  await giuliaApprovedBasic(page)
  const r = await page.evaluate(() => {
    const k = (window as any).__clave
    k.actions.officerRefuse('giulia', 'face_mismatch')
    k.actions.fileAppeal('giulia', 'please review')
    k.actions.officerApprove('giulia')
    let refuse = 'ok'
    try { k.actions.officerRefuse('giulia', 'face_mismatch') } catch (e) { refuse = (e as Error).name }
    const c = k.getState().cases.giulia
    return { level: c.level, appeal: c.appeal?.state, refuse }
  })
  expect(r.level).toBe('advanced'); expect(r.appeal).toBe('upheld'); expect(r.refuse).not.toBe('ok')
})
test('refuse on a granted basic level with nothing open requires revoke; a dismissed appeal cannot be refiled', async ({ page }) => {
  await page.goto(`${D}#/officer`)
  await page.waitForFunction(() => !!(window as any).__clave)
  const r = await page.evaluate(async () => {
    const k = (window as any).__clave
    k.actions.resetDemo(); k.setEngineSpeed(0)
    k.actions.officerSignIn('OF-DEMO-07')
    // Route A: basic granted automatically, nothing pending.
    k.actions.startCase('giulia', { ...k.getState().cases.giulia.presetAnswers, hasEuEid: true }, 'A')
    k.actions.giveConsent('giulia'); await k.actions.submitForVerification('giulia')
    let refuseBasic = 'ok'
    try { k.actions.officerRefuse('giulia', 'face_mismatch') } catch (e) { refuseBasic = (e as Error).name }
    // Deepfake: refused, appealed, dismissed, then a second appeal is blocked.
    k.actions.startCase('deepfake', k.getState().cases.deepfake.presetAnswers, 'B')
    k.actions.giveConsent('deepfake'); await k.actions.submitForVerification('deepfake')
    k.actions.officerRefuse('deepfake', 'liveness_failed')
    k.actions.fileAppeal('deepfake', 'it was me')
    k.actions.officerRefuse('deepfake', 'liveness_failed')
    let reappeal = 'ok'
    try { k.actions.fileAppeal('deepfake', 'again') } catch (e) { reappeal = (e as Error).name }
    return { refuseBasic, level: k.getState().cases.giulia.level, reappeal, appeal: k.getState().cases.deepfake.appeal?.state }
  })
  expect(r.refuseBasic).not.toBe('ok'); expect(r.level).toBe('basic')
  expect(r.reappeal).not.toBe('ok'); expect(r.appeal).toBe('dismissed')
})
