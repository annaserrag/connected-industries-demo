/**
 * Rules-driven outcomes (docs/SPEC-rules.md). Drives the store actions through window.__clave, never the UI.
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

test.describe('the 8 plan cases emerge from the rules', () => {
  test('GYC-01 Giulia typed in live: Route A → automatic basic level', async ({ page }) => {
    const errors = await boot(page)
    // sign-up refusals: a real DNI letter, a duplicate number
    const real = await ok(page, 'citizenSignUp', { givenNames: 'Test', surnames: 'Person', dateOfBirth: '1990-01-01', countryIndex: 0, documentType: 'DNI', documentNumber: '12345678Z', expiryDate: '2030-01-01', password: 'password-1' })
    expect(real).toEqual({ ok: false, reason: 'real_document_number' })
    const kenjiNo = await page.evaluate(() => window.__clave!.DEMO_PEOPLE[1].account.documentNumber)
    const dup = await ok(page, 'citizenSignUp', { givenNames: 'Test', surnames: 'Person', dateOfBirth: '1990-01-01', countryIndex: 9, documentType: 'TIE', documentNumber: kenjiNo, expiryDate: '2030-01-01', password: 'password-1' })
    expect(dup).toEqual({ ok: false, reason: 'duplicate_document' })
    // Only the plan's demo people carry GYC refs: any other new account gets a neutral SOL- reference.
    const other = await ok(page, 'citizenSignUp', { givenNames: 'Test', surnames: 'Person', dateOfBirth: '1990-01-01', countryIndex: 1, documentType: 'PASSPORT', documentNumber: 'ZZ1234567', expiryDate: '2030-01-01', password: 'password-1' })
    expect(other.ok).toBe(true)
    expect((await getCase(page, other.caseId)).caseRef).toMatch(/^SOL-[0-9A-Z]{4,}$/)
    const other2 = await ok(page, 'citizenSignUp', { givenNames: 'Otra', surnames: 'Persona', dateOfBirth: '1991-01-01', countryIndex: 1, documentType: 'PASSPORT', documentNumber: 'ZZ7654321', expiryDate: '2030-01-01', password: 'password-1' })
    expect((await getCase(page, other2.caseId)).caseRef).not.toBe((await getCase(page, other.caseId)).caseRef)

    const g = await page.evaluate(() => window.__clave!.DEMO_PEOPLE[0])
    expect(g.caseId).toBeNull() // not preloaded
    const res = await ok(page, 'citizenSignUp', { ...g.account, countryIndex: 1 })
    expect(res.ok).toBe(true)
    const id = res.caseId as string
    expect((await getCase(page, id)).caseRef).toBe('GYC-01')
    expect(await ok(page, 'citizenSignIn', g.account.documentNumber, 'giulia-demo')).toEqual({ ok: true, caseId: id })

    const rec = await ok(page, 'setAnswers', id, { document: 'EU_EID', euEid: 'yes', who: 'self' })
    expect(rec).toMatchObject({ route: 'A', msg: 'RA-07A', policyProposal: false })
    await ok(page, 'recordEidLogin', id)
    await ok(page, 'giveConsents', id, { residence: true })
    expect((await getCase(page, id)).status).toBe('received')
    expect(await finish(page, id, g.contact.mobile)).toEqual({ kind: 'auto_basic', ruleId: 'A-OK' })
    const c = await getCase(page, id)
    expect(c).toMatchObject({ status: 'approved', level: 'basic', advanced: 'not_requested', awaitingOfficer: false, citizenMsgs: ['STA-4'] })
    const ev = await auditOf(page, id)
    expect(ev.map(e => e.detail)).toContain('Approved automatically: Route A, eID verified (Italy), residence record matched, basic level (rule A-OK)')
    expect(await page.evaluate(() => window.__clave!.dashboardCounters().autoApprovals)).toBeGreaterThanOrEqual(1)
    expect(errors).toEqual([])
  })

  test('GYC-02 Kenji: chip unreadable twice → video call → officer approves basic → advanced queued', async ({ page }) => {
    await boot(page)
    expect((await ok(page, 'setAnswers', 'kenji', { document: 'TIE', who: 'self', nfc: 'unsure' })).route).toBe('B')
    await ok(page, 'giveConsents', 'kenji', { face: true, residence: true })
    const r1 = await ok(page, 'recordChipRead', 'kenji')
    expect(r1).toMatchObject({ read: 'failed', msg: 'VER-03', outcome: 'continue' })
    const r2 = await ok(page, 'recordChipRead', 'kenji')
    expect(r2).toMatchObject({ read: 'failed', msg: 'VER-04', outcome: 'fallback' })
    let c = await getCase(page, 'kenji')
    expect(c).toMatchObject({ status: 'need_info', ruleId: 'CHIP-TWICE', citizenMsgs: ['STA-3', 'VER-04', 'FALL-01'] })
    expect(c.session.fallback.offered).toBe('chip')
    // The selfie liveness check still runs (plan: "liveness check on his selfie"); no chip photo → no face match.
    const selfie = await ok(page, 'recordFaceAttempt', 'kenji', 'person')
    expect(selfie).toMatchObject({ result: 'pass', msg: 'FALL-01', outcome: 'fallback' })
    expect(selfie.faceMatch).toBeUndefined()
    c = await getCase(page, 'kenji')
    expect(c.status).toBe('need_info')
    const out = (id: string) => c.checks.find((k: AnyCase) => k.id === id)
    expect(out('chip_read').outcome).toBe('fail')
    expect(out('liveness').outcome).toBe('pass')
    expect(out('face_match')).toMatchObject({ outcome: 'skipped', detail: { en: 'Not possible without the chip: there is no chip photo to compare with' } })
    expect(out('residence').outcome).toBe('pass')
    expect((await auditOf(page, 'kenji')).filter(e => e.action === 'fallback_offered')).toHaveLength(1)

    await ok(page, 'joinVideoCall', 'kenji')
    c = await getCase(page, 'kenji')
    expect(c.checks.find((k: AnyCase) => k.id === 'liveness').outcome).toBe('pass')
    expect(c).toMatchObject({ status: 'checking', awaitingOfficer: true, risk: 'medium', route: 'F' })
    expect(c.aiReason.en).toBe('Chip could not be read twice; document integrity not verified')
    expect(await tier(page, 'kenji')).toBe('p5_video_call')

    expect((await call(page, 'officerApproveBasic', 'kenji')).error).toMatch(/ClaveRuleError: Start the video call/)
    await ok(page, 'officerStartVideoCall', 'kenji')
    expect((await getCase(page, 'kenji')).session.videoCall).toMatchObject({ state: 'live', officerName: 'Lucía Vega' })
    await ok(page, 'officerApproveBasic', 'kenji')
    c = await getCase(page, 'kenji')
    expect(c).toMatchObject({ status: 'approved', level: 'basic', advanced: 'pending_review', citizenMsgs: ['STA-4B'] })
    expect(c.session.videoCall.state).toBe('ended')
    expect(await page.evaluate(() => window.__clave!.advancedQueue().map(x => x.id))).toContain('kenji')
  })

  test('GYC-03 Ernesto: Route C assisted, reflections then retry → basic + advanced review with assisted flag', async ({ page }) => {
    await boot(page)
    const rec = await ok(page, 'setAnswers', 'ernesto', { document: 'DNI', who: 'helping' })
    expect(rec).toMatchObject({ route: 'C', policyProposal: true })
    await ok(page, 'setHelper', 'ernesto', { name: 'Marta Navarro', relation: 'family', mobile: '+34 600 000 102' })
    expect((await call(page, 'recordVideoAttempt', 'ernesto', 'person')).error).toMatch(/consent/i)
    await ok(page, 'giveConsents', 'ernesto', { face: true })
    expect((await call(page, 'recordVideoAttempt', 'ernesto', 'person')).error).toMatch(/MSG-ASS-01/)
    await ok(page, 'confirmApplicant', 'ernesto', true)
    expect(await ok(page, 'recordVideoAttempt', 'ernesto', 'reflections')).toMatchObject({ result: 'retry', msg: 'VER-06', outcome: 'continue' })
    expect(await ok(page, 'recordVideoAttempt', 'ernesto', 'person')).toMatchObject({ result: 'pass', outcome: 'continue' })
    // the helper's number is refused for the SMS
    expect((await call(page, 'setContact', 'ernesto', { mobile: '+34600000102' })).error).toMatch(/number of the person helping you/)
    expect(await finish(page, 'ernesto', '+34 600 000 002')).toEqual({ kind: 'auto_basic', ruleId: 'C-OK' })
    const c = await getCase(page, 'ernesto')
    expect(c).toMatchObject({ status: 'approved', level: 'basic', advanced: 'pending_review', risk: 'low', awaitingOfficer: true, citizenMsgs: ['STA-4B'] })
    expect(c.flags.map((f: AnyCase) => f.code)).toContain('assisted_shared_device')
    expect(await tier(page, 'ernesto')).toBe('p6_advanced_review')
    expect(await page.evaluate(() => window.__clave!.advancedQueue().map(x => x.id))).toContain('ernesto')
    const ev = await auditOf(page, 'ernesto')
    expect(ev.find(e => e.action === 'auto_approved_basic')?.tags).toContain('Assisted session')
    await ok(page, 'officerApproveAdvanced', 'ernesto')
    expect(await getCase(page, 'ernesto')).toMatchObject({ level: 'advanced', advanced: 'granted', citizenMsgs: ['STA-4C'] })
  })

  test('GYC-04 Mateo (minor): officer asks for a new proof photo → reply with upload → approve', async ({ page }) => {
    await boot(page)
    const laura = await page.evaluate(() => window.__clave!.DEMO_PEOPLE.find(p => p.caseId === 'laura')!)
    expect((await ok(page, 'setAnswers', 'laura', { document: 'TIE', who: 'child', nfc: 'yes' })).route).toBe('B')
    await ok(page, 'setMinor', 'laura', { givenNames: 'Mateo', surnames: 'Ruiz', dateOfBirth: laura.minor!.dateOfBirth, document: laura.minor!.document })
    expect((await call(page, 'setMinor', 'laura', { givenNames: 'X', surnames: 'Y', dateOfBirth: '1990-01-01', document: laura.minor!.document })).error).toMatch(/under 18/)
    expect(await ok(page, 'recordGuardianCheck', 'laura', 'person')).toEqual({ chip: 'ok', face: 'pass', passed: true })
    expect((await call(page, 'uploadProof', 'laura', { name: 'x.txt', dataUrl: 'data:text/plain;base64,aGVsbG8=' })).error).toMatch(/image/)
    await ok(page, 'uploadProof', 'laura', { name: 'proof-cut.png', dataUrl: PNG })
    await ok(page, 'giveConsents', 'laura', { face: true, residence: true })
    expect((await ok(page, 'recordChipRead', 'laura')).read).toBe('ok')
    expect((await ok(page, 'recordFaceAttempt', 'laura', 'person')).result).toBe('pass')
    expect(await finish(page, 'laura', '+34 600 000 004')).toEqual({ kind: 'to_officer', ruleId: 'MINOR' })
    let c = await getCase(page, 'laura')
    expect(c).toMatchObject({ status: 'checking', awaitingOfficer: true, risk: 'medium', level: 'none' })
    expect(c.persona.name).toBe('Mateo Ruiz')
    expect(c.aiReason.en).toBe('Minor: proof of parental authority to check')

    await ok(page, 'officerRequestInfo', 'laura', 'a clear photo of your proof of parental authority', 'the photo you sent is cut off on the right side')
    c = await getCase(page, 'laura')
    expect(c).toMatchObject({ status: 'need_info', awaitingOfficer: false, citizenMsgs: ['STA-3', 'COR-01'] })
    await ok(page, 'replyToInfoRequest', 'laura', 'Here is a clear photo.', { name: 'proof-clear.png', dataUrl: PNG })
    c = await getCase(page, 'laura')
    expect(c).toMatchObject({ status: 'checking', awaitingOfficer: true, citizenMsgs: ['COR-02', 'STA-2'] })
    expect(c.session.uploads.proof.name).toBe('proof-clear.png')
    expect(await tier(page, 'laura')).toBe('p3_citizen_replied')
    await ok(page, 'officerApproveBasic', 'laura')
    c = await getCase(page, 'laura')
    expect(c).toMatchObject({ status: 'approved', level: 'basic', advanced: 'not_requested', citizenMsgs: ['COR-08', 'STA-4'] })
  })

  test('GYC-05 Daniel: red card (Route X) → officer approves basic, proposed rule counted', async ({ page }) => {
    await boot(page)
    const d = await page.evaluate(() => window.__clave!.DEMO_PEOPLE.find(p => p.caseId === 'daniel')!)
    expect(await ok(page, 'setAnswers', 'daniel', { document: 'RED_CARD', who: 'self' })).toMatchObject({ route: 'X', msg: 'RA-07X', policyProposal: true })
    expect((await call(page, 'giveConsents', 'daniel', {})).error).toMatch(/face/)
    await ok(page, 'giveConsents', 'daniel', { face: true })
    await ok(page, 'setPassport', 'daniel', d.passport)
    expect((await ok(page, 'recordChipRead', 'daniel')).read).toBe('ok')
    expect((await ok(page, 'recordFaceAttempt', 'daniel', 'person')).result).toBe('pass')
    const expiry = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10)
    await ok(page, 'uploadRedCard', 'daniel', { name: 'red-card.png', dataUrl: PNG }, { number: 'DEMO-0005', expiry })
    expect(await finish(page, 'daniel', '+34 600 000 005')).toEqual({ kind: 'to_officer', ruleId: 'RED-CARD' })
    let c = await getCase(page, 'daniel')
    expect(c).toMatchObject({ risk: 'medium', awaitingOfficer: true, policyProposal: true })
    expect(c.aiReason.en).toBe('Red card cannot be verified automatically; passport chip and face match passed')
    expect(c.checks.find((k: AnyCase) => k.id === 'residence')).toBeUndefined()
    await ok(page, 'officerApproveBasic', 'daniel')
    c = await getCase(page, 'daniel')
    expect(c).toMatchObject({ status: 'approved', level: 'basic', advanced: 'not_requested' })
    expect(await page.evaluate(() => window.__clave!.dashboardCounters().decidedUnderProposedRule)).toBeGreaterThanOrEqual(1)
    const ev = await auditOf(page, 'daniel')
    expect(ev.find(e => e.action === 'officer_approved_basic')?.tags).toContain('Decided under proposed rule')
  })

  test('GYC-06 Applicant X: two synthetic face attempts → come back later → High → officer refuses REJ-07', async ({ page }) => {
    await boot(page)
    const { chip, face } = await routeB(page, 'applicant-x', { document: 'PASSPORT', euEid: 'no', who: 'self', nfc: 'yes' }, 'synthetic')
    expect(chip).toMatchObject({ read: 'ok', signatureValid: true, msg: 'VER-01' })
    expect(face).toMatchObject({ result: 'fail', msg: 'VER-05', outcome: 'continue' })
    expect(face.liveness).toBeLessThan(0.3)
    expect(face.faceMatch).toBeLessThan(0.7)
    const f2 = await ok(page, 'recordFaceAttempt', 'applicant-x', 'synthetic')
    expect(f2).toMatchObject({ result: 'fail', msg: 'FALL-01', outcome: 'fallback' })
    expect((await getCase(page, 'applicant-x')).status).toBe('need_info')
    await ok(page, 'comeBackLater', 'applicant-x')
    let c = await getCase(page, 'applicant-x')
    expect(c).toMatchObject({ status: 'checking', awaitingOfficer: true, risk: 'high', level: 'none', caseLabel: 'Applicant X' })
    expect(c.aiReason.en).toBe('The live-person check failed on every attempt and the face match stayed low. The document itself is genuine.')
    expect(c.decisions).toEqual([]) // never auto-refused
    expect(await tier(page, 'applicant-x')).toBe('p1_high_risk')
    expect((await call(page, 'officerRefuse', 'applicant-x')).error).toMatch(/ClaveRuleError/)
    expect((await call(page, 'officerRefuse', 'applicant-x', 'suspected_fraud')).error).toMatch(/closed list/)
    await ok(page, 'officerRefuse', 'applicant-x', 'REJ-07', 'Synthetic video on both attempts')
    c = await getCase(page, 'applicant-x')
    expect(c).toMatchObject({ status: 'not_approved', citizenMsgs: ['STA-5', 'REJ-07'] })
    expect(c.decisions.at(-1)).toMatchObject({ outcome: 'refused', reasonId: 'REJ-07', by: { kind: 'officer', id: VEGA } })
  })

  test('same typed data, real person in front of the camera → automatic basic (the rules decide, not the person)', async ({ page }) => {
    await boot(page)
    const { face } = await routeB(page, 'applicant-x', { document: 'PASSPORT', euEid: 'no', who: 'self', nfc: 'yes' }, 'person')
    expect(face).toMatchObject({ result: 'pass', msg: 'VER-02' })
    expect(face.liveness).toBeGreaterThanOrEqual(0.93)
    expect(await finish(page, 'applicant-x', '+34 600 000 006')).toEqual({ kind: 'auto_basic', ruleId: 'B-OK' })
    expect(await getCase(page, 'applicant-x')).toMatchObject({ status: 'approved', level: 'basic', advanced: 'pending_review', risk: 'low' })
  })

  test('GYC-07 Rafael: chip signature invalid + printed ≠ chip → High → officer refuses REJ-06', async ({ page }) => {
    await boot(page)
    expect((await ok(page, 'setAnswers', 'rafael', { document: 'TIE', who: 'self', nfc: 'yes' })).route).toBe('B')
    await ok(page, 'giveConsents', 'rafael', { face: true, residence: true })
    const r = await ok(page, 'recordChipRead', 'rafael')
    // The chip answered: the integrity rule waits for the face check against the chip photo.
    expect(r).toMatchObject({ read: 'ok', signatureValid: false, msg: 'VER-01', outcome: 'continue' })
    expect(r.printedMismatch).toEqual(['surnames', 'dateOfBirth'])
    expect((await getCase(page, 'rafael')).awaitingOfficer).toBe(false)
    const f = await ok(page, 'recordFaceAttempt', 'rafael', 'person')
    // A real person is there, but the chip photo is another record's (world fact) → face match low.
    expect(f).toMatchObject({ result: 'fail', msg: 'VER-07', outcome: 'to_officer' })
    expect(f.liveness).toBeGreaterThanOrEqual(0.93)
    expect(f.faceMatch).toBeLessThan(0.5)
    let c = await getCase(page, 'rafael')
    expect(c).toMatchObject({ status: 'checking', awaitingOfficer: true, risk: 'high', ruleId: 'CHIP-INTEGRITY', suggestedReason: 'REJ-06', citizenMsgs: ['STA-2', 'VER-07'] })
    expect(c.aiReason.en).toBe('The chip answered but its security signature is not valid, and the name and date of birth on the chip differ from the printed name and date of birth.')
    const out = (id: string) => c.checks.find((k: AnyCase) => k.id === id)
    expect(out('chip_signature').outcome).toBe('fail')
    expect(out('printed_vs_chip').outcome).toBe('fail')
    expect(out('liveness').outcome).toBe('pass')
    expect(out('face_match').outcome).toBe('fail')
    expect(out('face_match').score).toBeLessThan(0.5)
    expect(c.discrepancies.filter((d: AnyCase) => d.source === 'chip')).toEqual([
      { field: 'surnames', document: 'DUARTE', records: 'DUARTE SOUZA', source: 'chip' },
      { field: 'dateOfBirth', document: '1988-04-13', records: '1988-03-14', source: 'chip' },
    ])
    expect((await call(page, 'recordFaceAttempt', 'rafael', 'person')).error).toMatch(/closed/)
    await ok(page, 'officerRefuse', 'rafael', 'REJ-06', 'printed surname differs from chip surname')
    c = await getCase(page, 'rafael')
    expect(c).toMatchObject({ status: 'not_approved', citizenMsgs: ['STA-5', 'REJ-06'] })
    expect((await page.evaluate(() => window.__clave!.dashboardCounters().refusalsByReason))['REJ-06']).toBe(1)
  })

  test('GYC-08 Valentina: residence mismatch → Vega refuses REJ-05 → review → Vega cannot decide → Ortiz approves', async ({ page }) => {
    await boot(page)
    const { face } = await routeB(page, 'valentina', { document: 'TIE', who: 'self', nfc: 'yes' }, 'person')
    expect(face.result).toBe('pass')
    expect(await finish(page, 'valentina', '+34 600 000 008')).toEqual({ kind: 'to_officer', ruleId: 'RES-MISMATCH' })
    let c = await getCase(page, 'valentina')
    expect(c).toMatchObject({ risk: 'medium', suggestedReason: 'REJ-05', awaitingOfficer: true })
    expect(c.aiReason.en).toBe('The name in the residence record has one surname; the chip has two. Other checks passed')
    expect(c.discrepancies).toEqual([{ field: 'surnames', document: 'ROJAS GÓMEZ', records: 'ROJAS', source: 'residence' }])

    await ok(page, 'officerRefuse', 'valentina', 'REJ-05')
    expect((await getCase(page, 'valentina')).status).toBe('not_approved')
    expect((await call(page, 'requestReview', 'valentina', 'x'.repeat(501))).error).toMatch(/500/)
    await ok(page, 'requestReview', 'valentina', 'My second surname is Gómez, see my passport.', { name: 'passport-data-page.png', dataUrl: PNG })
    c = await getCase(page, 'valentina')
    expect(c).toMatchObject({ status: 'checking', awaitingOfficer: true, citizenMsgs: ['COR-04', 'COR-05'] })
    expect(c.appeal).toMatchObject({ state: 'open', refusedBy: VEGA, refusedReasonId: 'REJ-05' })
    expect(await tier(page, 'valentina')).toBe('p2_appeal')
    expect(await page.evaluate(() => window.__clave!.appealsQueue().map(x => x.id))).toContain('valentina')
    expect((await call(page, 'requestReview', 'valentina', 'again')).error).toMatch(/already open/)

    // second-officer rule: the officer who refused cannot decide the appeal, by any action
    for (const [fn, ...args] of [['officerDecideAppeal', 'valentina', 'approve'], ['officerApproveBasic', 'valentina'], ['officerRefuse', 'valentina', 'REJ-05']] as const) {
      expect((await call(page, fn, ...args)).error).toMatch(/different officer/)
    }
    await signInAs(page, ORTIZ)
    await ok(page, 'officerDecideAppeal', 'valentina', 'approve')
    c = await getCase(page, 'valentina')
    expect(c).toMatchObject({ status: 'approved', level: 'basic', advanced: 'pending_review', correctedAfterRefusal: true, citizenMsgs: ['COR-06', 'STA-4B'] })
    expect(c.appeal).toMatchObject({ state: 'upheld', decidedBy: { id: ORTIZ, name: 'Andrés Ortiz' } })
    const ev = await auditOf(page, 'valentina')
    expect(ev.find(e => e.action === 'appeal_decided')?.tags).toContain('Refusal corrected on review')
    const k = await page.evaluate(() => window.__clave!.dashboardCounters())
    expect(k.correctedOnReview).toBeGreaterThanOrEqual(1)
    expect(k.refusalsByReason['REJ-05']).toBe(1)
  })
})

test.describe('guards', () => {
  test('consent declined → MSG-CON-06, no checks; uploads over 1.5 MB refused; only an officer refuses', async ({ page }) => {
    await boot(page)
    await ok(page, 'setAnswers', 'kenji', { document: 'TIE', who: 'self', nfc: 'yes' })
    await ok(page, 'declineConsent', 'kenji')
    let c = await getCase(page, 'kenji')
    expect(c).toMatchObject({ ruleId: 'CONSENT-DECLINED', citizenMsgs: ['CON-06'] })
    expect(c.checks).toEqual([])
    expect((await call(page, 'recordChipRead', 'kenji')).error).toMatch(/consent/i)
    await ok(page, 'giveConsents', 'kenji', { face: true, residence: true }) // changed her mind
    c = await getCase(page, 'kenji')
    expect(c.session.fallback).toBeUndefined()

    const big = 'data:image/png;base64,' + 'A'.repeat(2_100_000)
    await ok(page, 'setAnswers', 'laura', { document: 'TIE', who: 'child', nfc: 'yes' })
    expect((await call(page, 'uploadProof', 'laura', { name: 'big.png', dataUrl: big })).error).toMatch(/1.5 MB/)

    await page.evaluate(() => window.__clave!.actions.officerSignOut())
    expect((await call(page, 'officerRefuse', 'bg-03', 'REJ-04')).error).toMatch(/signed-in officer/)
  })
})
