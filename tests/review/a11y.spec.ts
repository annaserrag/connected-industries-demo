/**
 * CHECK 5 — accessibility (hand-written; no axe): keyboard runs, focus visibility, Escape, labels,
 * text contrast (canvas-resolved colours, alpha + ancestor opacity), SVG labelling, html lang.
 */
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import { BASE, SHOTS, shot } from './helpers'

/** Describe the focused element and whether a focus indicator is visible (outline or box-shadow ring). */
async function focusInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return { tag: 'body', name: '', visible: false }
    const cs = getComputedStyle(el)
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
    const shadow = cs.boxShadow && cs.boxShadow !== 'none'
    // label wrapping a focused native radio/checkbox shows the ring via :has(:focus-visible)
    const wrap = el.closest('label') as HTMLElement | null
    const wrapShadow = wrap ? getComputedStyle(wrap).boxShadow !== 'none' || getComputedStyle(wrap).outlineStyle !== 'none' : false
    return {
      tag: el.tagName.toLowerCase() + (el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''),
      name: (el.getAttribute('aria-label') || el.innerText || (el as HTMLInputElement).value || '').trim().slice(0, 60),
      visible: Boolean(outline || shadow || wrapShadow),
    }
  })
}

/** Tab until the focused element's text/label matches, recording each stop. */
async function tabTo(page: Page, re: RegExp, log: unknown[], max = 60, key = 'Tab') {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key)
    const f = await focusInfo(page)
    log.push(f)
    if (re.test(f.name)) return f
  }
  throw new Error(`could not reach ${re} with ${key}; last stops: ${JSON.stringify(log.slice(-5))}`)
}

const CONTRAST = () => {
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 1
  const ctx = cvs.getContext('2d', { willReadFrequently: true })!
  const rgba = (c: string): [number, number, number, number] => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }
  const blend = (fg: number[], bg: number[]) => [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]))
  const lum = (c: number[]) => {
    const a = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
  }
  const ratio = (a: number[], b: number[]) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
  const out: unknown[] = []
  const seen = new Set<string>()
  const els = [...document.querySelectorAll<HTMLElement>('body *')].filter(el =>
    [...el.childNodes].some(n => n.nodeType === 3 && (n.textContent || '').trim().length > 0))
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || el.closest('[aria-hidden="true"],.sr-only,svg')) continue
    if (cs.color === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue // gradient-clipped text
    if (el.closest('button:disabled, [aria-disabled="true"], [data-disabled]')) continue // disabled controls are exempt (WCAG 1.4.3)
    const tr = el.getBoundingClientRect(); const cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2
    // effective background: walk up; stop at first opaque bg; note gradients
    let bg = [255, 255, 255]; let layers: number[][] = []; let gradient = false; let opacity = 1
    let n: HTMLElement | null = el
    while (n) {
      const s = getComputedStyle(n)
      opacity *= parseFloat(s.opacity)
      if (s.backgroundImage && s.backgroundImage !== 'none' && n !== document.body && /gradient/.test(s.backgroundImage)) {
        const r2 = n.getBoundingClientRect(); if (r2.width * r2.height < 600_000) gradient = true
      }
      // absolutely positioned decoration (e.g. animated "active" pill) painted behind the text
      for (const ch of [...n.children] as HTMLElement[]) {
        if (ch === el || ch.contains(el)) continue
        const chs = getComputedStyle(ch)
        if (chs.position !== 'absolute') continue
        const cr = ch.getBoundingClientRect(); const cc = rgba(chs.backgroundColor)
        if (cc[3] > 0 && cr.left <= cx && cr.right >= cx && cr.top <= cy && cr.bottom >= cy) layers.push(cc)
      }
      const c = rgba(s.backgroundColor)
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break }
      n = n.parentElement
    }
    if (!n) layers.push(rgba(getComputedStyle(document.body).backgroundColor))
    for (let i = layers.length - 1; i >= 0; i--) bg = i === layers.length - 1 && layers[i][3] >= 0.999 ? layers[i].slice(0, 3) : blend(layers[i], bg)
    const fgc = rgba(cs.color); const fgA = fgc[3] * opacity
    const fg = blend([fgc[0], fgc[1], fgc[2], fgA], bg)
    const ratioV = ratio(fg, bg)
    const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight) >= 700
    const large = size >= 24 || (bold && size >= 18.66)
    const need = large ? 3 : 4.5
    if (ratioV < need) {
      const text = [...el.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim().slice(0, 50)
      const key = `${text}|${cs.color}`
      if (seen.has(key)) continue; seen.add(key)
      out.push({ manual: gradient, text, ratio: +ratioV.toFixed(2), need, fg: cs.color, bg: `rgb(${bg.map(Math.round).join(',')})`, size, gradientBehind: gradient, cls: (el.className || '').toString().slice(0, 90) })
    }
  }
  return out
}

const LABELS = () => {
  const bad: string[] = []
  const name = (el: Element) => {
    const id = el.id
    const lab = el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(' ').map(i => document.getElementById(i)?.textContent || '').join(' ')
      || (id ? document.querySelector(`label[for="${id}"]`)?.textContent : '') || el.closest('label')?.textContent || (el as HTMLElement).title
    const txt = ['BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') ? (el as HTMLElement).innerText : ''
    return (lab || txt || '').trim()
  }
  for (const el of document.querySelectorAll('input, textarea, select, button, a[href], [role=radio], [role=checkbox], [role=switch], [role=combobox], [role=tab]')) {
    const r = (el as HTMLElement).getBoundingClientRect()
    if ((el as HTMLInputElement).type === 'hidden' || (r.width === 0 && r.height === 0 && el.tagName !== 'INPUT')) continue
    if (!name(el)) bad.push(el.outerHTML.slice(0, 140))
  }
  return bad
}

const SVGS = () => [...document.querySelectorAll('svg')].filter(s => {
  if (s.closest('[aria-hidden="true"]')) return false
  if (s.getAttribute('aria-hidden') === 'true') return false
  if ((s.getAttribute('role') === 'img' || s.closest('[role=img]')) && (s.getAttribute('aria-label') || s.closest('[role=img]')?.getAttribute('aria-label') || s.querySelector('title'))) return false
  if (s.closest('[aria-label]') && s.closest('button, a, [role=img]')) return false
  const r = s.getBoundingClientRect(); return r.width > 0
}).map(s => `${s.getAttribute('class') ?? ''} in <${s.parentElement?.tagName.toLowerCase()} class="${(s.parentElement?.getAttribute('class') ?? '').slice(0, 50)}">`)

test.describe('5. Accessibility', () => {
  test('5a keyboard only: landing → citizen assistant → consent', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const log: unknown[] = []
    await page.goto(`${BASE}/#/`)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await tabTo(page, /^Apply\s+From your phone/i, log)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/citizen/)
    // sign in with the keyboard only (saved demo account; credentials are only in the README)
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      log.push(await focusInfo(page))
      if (await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'signin-doc')) break
    }
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('signin-doc')
    await page.keyboard.type('demo-p-it-482913')
    await page.keyboard.press('Tab')
    log.push(await focusInfo(page))
    await page.keyboard.type('giulia-demo')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/citizen\/start\/giulia/)
    // assistant: arrow keys on radios, then Next with keyboard
    for (let i = 0; i < 6; i++) {
      if (await page.getByRole('button', { name: 'See my route' }).isVisible()) break
      await tabTo(page, /^Next$/, log)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
    }
    await tabTo(page, /See my route/, log)
    await page.keyboard.press('Enter')
    await tabTo(page, /Continue with this route/, log)
    await page.keyboard.press('Enter')
    await tabTo(page, /I agree, start the checks/, log)
    await shot(page, '5a-keyboard-consent-focus')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Start reading the chip' })).toBeVisible()
    const invisible = (log as { visible: boolean; name: string; tag: string }[]).filter(f => !f.visible && f.tag !== 'body')
    fs.writeFileSync(SHOTS + '/5a-focus-log.json', JSON.stringify(log, null, 2))
    console.log('stops', log.length, 'without visible focus:', JSON.stringify(invisible))
    expect(invisible).toEqual([])
  })

  test('5b keyboard only: officer sign-in → queue → case → refuse dialog (Escape)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const log: unknown[] = []
    await page.goto(`${BASE}/#/officer`)
    // Certificate sign-in by keyboard: open the picker, pick Laura's valid certificate, sign in,
    // then complete the first-time job details form.
    await tabTo(page, /Sign in with your electronic certificate/, log)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await tabTo(page, /^Laura Navarro, Public employee/, log) // first radio = Laura's valid certificate
    await page.keyboard.press('Space')
    await tabTo(page, /^Sign in$/, log)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('staff-profile-form')).toBeVisible({ timeout: 10_000 })
    // the form focuses the first field still to fill (the NRP: the rest is prefilled from the certificate)
    await expect(page.getByLabel(/Personnel number/)).toBeFocused()
    await page.keyboard.type('DEMO-NRP-20481')
    await tabTo(page, /Save and open the console/, log)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Case queue' })).toBeVisible()
    await tabTo(page, /^Priya Nair$/, log)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/officer\/case\/bg-03/)
    const refuse = await tabTo(page, /^Refuse/, log)
    expect(refuse.visible).toBe(true)
    await page.keyboard.press('Enter')
    const dlg = page.getByRole('dialog')
    await expect(dlg).toBeVisible()
    const inDialog = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))
    // Tab 25 times: focus must stay in the dialog (modal) and keep moving
    const trail: string[] = []
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      trail.push(await page.evaluate(() => (document.activeElement?.closest('[role=dialog]') ? 'in:' : 'OUT:') + (document.activeElement?.getAttribute('aria-label') || (document.activeElement as HTMLElement)?.innerText || document.activeElement?.tagName || '').slice(0, 30)))
    }
    // radios reachable + arrow keys select a reason
    await dlg.getByRole('radio').first().focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Space')
    const checked = await dlg.getByRole('radio', { checked: true }).count()
    const radioFocus = await focusInfo(page)
    await shot(page, '5b-refuse-dialog-keyboard')
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
    const urlAfterEsc = page.url()
    const focusAfter = await focusInfo(page)
    console.log(JSON.stringify({ inDialog, trail, checked, radioFocus, urlAfterEsc, focusAfter }, null, 1))
    expect(inDialog).toBe(true)
    expect(trail.every(t => t.startsWith('in:'))).toBe(true)
    expect(new Set(trail).size).toBeGreaterThan(3)
    expect(checked).toBe(1)
    expect(radioFocus.visible).toBe(true)
    expect.soft(urlAfterEsc, 'Escape should close the dialog only, not also leave the case').toContain('/officer/case/bg-03')
    const invisible = (log as { visible: boolean; tag: string }[]).filter(f => !f.visible && f.tag !== 'body')
    console.log('officer stops without visible focus:', JSON.stringify(invisible))
    expect(invisible).toEqual([])
  })

  test('5c labels, SVGs and contrast on key screens', async ({ browser }) => {
    const report: Record<string, unknown> = {}
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${BASE}/?debug=1#/`)
    await page.waitForFunction(() => !!window.__clave)
    await page.evaluate(async () => {
      const k = window.__clave!; k.setEngineSpeed(0)
      for (const id of ['giulia', 'deepfake']) {
        const c = k.getState().cases[id]; k.actions.startCase(id, c.presetAnswers, 'B'); k.actions.giveConsent(id)
        await k.actions.submitForVerification(id)
      }
      k.actions.officerSignIn('OF-DEMO-07'); k.actions.officerRefuse('deepfake', 'liveness_failed'); k.actions.officerSignOut()
    })
    const screens: [string, string, number][] = [
      ['landing', '/#/', 1440], ['landing-phone', '/#/', 390], ['citizen-signin', '/#/citizen', 390], ['citizen-signup', '/#/citizen?mode=signup', 390],
      ['citizen-assistant', '/#/citizen/start/daniel', 390], ['citizen-status-approved', '/#/citizen/case/giulia', 390],
      ['citizen-status-refused', '/#/citizen/case/deepfake', 390], ['officer-signin', '/#/officer', 1440],
      ['officer-queue', '/#/officer', 1440], ['officer-case', '/#/officer/case/deepfake', 1440], ['officer-audit', '/#/officer/audit', 1440],
      ['officer-dashboard', '/#/officer/dashboard', 1440], ['officer-documents', '/#/officer/documents', 1440],
      ['officer-applications', '/#/officer/applications', 1440], ['officer-profile', '/#/officer/profile', 1440],
      ['dashboard', '/#/dashboard', 1440], ['demo', '/#/demo', 1440],
    ]
    const signIn: Record<string, [string, string]> = {
      'citizen-assistant': ['DEMO-TIE-Y0042719-K', 'daniel-demo'],
      'citizen-status-approved': ['DEMO-P-IT-482913', 'giulia-demo'],
      'citizen-status-refused': ['DEMO-P-BG-391027', 'ivo-demo'],
    }
    for (const [name, r, w] of screens) {
      // case screens are only shown to their signed-in owner
      if (signIn[name]) await page.evaluate(([d, p]) => window.__clave!.actions.citizenSignIn(d, p), signIn[name])
      else await page.evaluate(() => window.__clave!.actions.citizenSignOut())
      await page.setViewportSize({ width: w, height: w > 1000 ? 900 : 844 })
      if (name === 'officer-queue') await page.evaluate(() => window.__clave!.actions.officerSignIn('OF-DEMO-07'))
      await page.goto(`${BASE}/?debug=1${r.slice(1)}`)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.waitForTimeout(1200)
      for (const lang of ['en', 'es'] as const) {
        await page.evaluate(l => window.__clave!.actions.setLang(l), lang)
        await page.waitForTimeout(300)
        const contrast = await page.evaluate(CONTRAST)
        report[`${name}:${lang}`] = { contrast, unlabelled: await page.evaluate(LABELS), svgsUnlabelled: lang === 'en' ? await page.evaluate(SVGS) : undefined }
      }
      await page.evaluate(() => window.__clave!.actions.setLang('en'))
    }
    // refuse dialog open
    await page.goto(`${BASE}/?debug=1#/officer/case/giulia`)
    await page.getByRole('button', { name: /^Refuse/ }).click()
    await page.getByRole('dialog').getByRole('radio').nth(2).click()
    await page.waitForTimeout(500)
    report['refuse-dialog:en'] = { contrast: await page.evaluate(CONTRAST), unlabelled: await page.evaluate(LABELS) }
    fs.writeFileSync(SHOTS + '/5c-a11y-report.json', JSON.stringify(report, null, 2))
    let fails = 0, unl = 0
    for (const [k, v] of Object.entries(report) as [string, { contrast: unknown[]; unlabelled: unknown[] }][]) {
      fails += (v.contrast as { manual: boolean }[]).filter(c => !c.manual).length; unl += v.unlabelled.length
      if (v.contrast.length || v.unlabelled.length) console.log(k, 'contrast<AA:', v.contrast.length, 'unlabelled:', v.unlabelled.length)
    }
    expect.soft(unl, 'unlabelled controls').toBe(0)
    expect(fails, 'text pairs under WCAG AA (see /tmp/review-shots/5c-a11y-report.json)').toBe(0)
    await context.close()
  })
})
