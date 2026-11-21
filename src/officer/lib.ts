/* Officer-area helpers: language, derived case facts, hotkeys, CSV. */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuditEvent, Bilingual, Case, CheckId, CheckResult, Lang, RejectionReasonId, RiskLevel } from '@/contract/types'
import { CHECKS, ENGINE, REJECTION_REASONS } from '@/contract/seed'
import { useClave } from '@/core/store'
import { AUDIT_ACTION_LABEL } from './copy'

/* ------------------------------------------------------------ language */

export function useLang(): Lang {
  return useClave(s => s.lang)
}

/** Reactive translate: re-renders when the global lang changes. */
export function useTr() {
  const lang = useLang()
  return useCallback((b: Bilingual) => b[lang], [lang])
}

/** Re-render every `ms` so relative times stay fresh. */
export function useTick(ms = 30_000) {
  const [, set] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => set(n => n + 1), ms)
    return () => window.clearInterval(id)
  }, [ms])
}

/* ----------------------------------------------------------- case facts */

export const RISK_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 }

export type ReviewKind = 'advanced' | 'decision'

/** Advanced-level review = basic already granted, advanced pending, nothing else to decide. */
export function reviewKind(c: Case): ReviewKind {
  return c.level === 'basic' && c.advanced === 'pending_review' && !c.appeal ? 'advanced' : 'decision'
}

export function canApproveKind(c: Case): 'basic' | 'advanced' {
  return c.level === 'none' ? 'basic' : 'advanced'
}

export function needsVideoCall(c: Case): boolean {
  const v = c.checks.find(k => k.id === 'officer_video')
  if (v) return v.outcome !== 'pass'
  return c.route === 'FALLBACK'
}

export function hasVideoCheck(c: Case): boolean {
  return c.route === 'FALLBACK' || c.checks.some(k => k.id === 'officer_video')
}

export function lastDecisionAt(c: Case): string | undefined {
  return c.decisions.length ? c.decisions[c.decisions.length - 1].at : undefined
}

export const SCORED: Partial<Record<CheckId, number>> = {
  liveness: ENGINE.livenessMin,
  face_match: ENGINE.faceMatchMin,
}

/** Visual outcome: a pass whose score is under threshold is shown as a warning. */
export function effectiveOutcome(r: CheckResult): CheckResult['outcome'] {
  const th = SCORED[r.id]
  if (th !== undefined && r.score !== undefined && r.score < th && r.outcome === 'pass') return 'warn'
  return r.outcome
}

export function isExpired(iso: string, now = new Date()): boolean {
  return new Date(iso).getTime() < now.getTime()
}

export function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export function formatTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso))
}

export function formatDateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** Rejection reasons that line up with what the engine flagged (a hint, never preselected). */
export function suggestedReasons(c: Case): Set<RejectionReasonId> {
  const s = new Set<RejectionReasonId>()
  for (const f of c.flags) {
    if (f.code === 'low_liveness') s.add('liveness_failed')
    if (f.code === 'low_face_match') s.add('face_mismatch')
    if (f.code === 'chip_signature_failed') s.add('chip_invalid')
    if (f.code === 'residence_not_found') s.add('residence_not_found')
    if (f.code === 'eid_data_mismatch') s.add('data_mismatch')
    if (f.code === 'document_invalid') s.add('document_expired')
    if (f.code === 'chip_unreadable') s.add('chip_invalid')
  }
  for (const k of c.checks) {
    const o = effectiveOutcome(k)
    if (o !== 'fail') continue
    if (k.id === 'liveness') { s.add('liveness_failed'); s.add('suspected_fraud') }
    if (k.id === 'face_match') s.add('face_mismatch')
    if (k.id === 'chip_signature') { s.add('chip_invalid'); s.add('suspected_fraud') }
    if (k.id === 'document_validity') s.add('document_expired')
    if (k.id === 'residence') s.add('residence_not_found')
    if (k.id === 'eidas_login') s.add('data_mismatch')
  }
  return s
}

/* --------------------------------------------------------------- hotkeys */

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Single-letter shortcuts. Never fire while typing, with modifiers, or while a dialog is open.
 * Keys are matched case-insensitively ("j", "enter", "a"…).
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      const k = e.key.toLowerCase()
      const fn = ref.current[k]
      if (!fn) return
      // Enter on a focused button/link keeps its native behaviour.
      if (k === 'enter' && e.target instanceof HTMLElement && e.target.closest('button, a, [role="radio"]')) return
      e.preventDefault()
      fn(e)
    }
    // Capture phase: runs before Radix closes an open dialog on Escape, so the dialog guard
    // above still sees the dialog and the shortcut does not also fire (e.g. Escape leaving the case).
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])
}

/* ------------------------------------------------------------------- CSV */

function csvCell(v: string): string {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function auditToCsv(events: AuditEvent[], cases: Record<string, Case>, lang: Lang): string {
  const head = ['time', 'actor_kind', 'actor_id', 'actor_name', 'action', 'action_label', 'case_id', 'applicant', 'detail', 'evidence', 'reason_id', 'reason_label']
  const rows = events.map(e => [
    e.at,
    e.actor.kind,
    e.actor.id,
    e.actor.name,
    e.action,
    AUDIT_ACTION_LABEL[e.action]?.[lang] ?? e.action,
    e.caseId ?? '',
    e.caseId ? cases[e.caseId]?.persona.name ?? '' : '',
    e.detail,
    (e.evidence ?? []).map(id => CHECKS[id].label[lang]).join(' | '),
    e.reasonId ?? '',
    e.reasonId ? REJECTION_REASONS[e.reasonId].officerLabel[lang] : '',
  ])
  return [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
}

/** Local download only: Blob + object URL, no network. */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
