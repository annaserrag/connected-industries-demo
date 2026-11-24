/* Officer-area helpers: language, derived case facts, hotkeys, CSV. */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuditEvent, Bilingual, Case, CheckId, CheckResult, Lang, RejectionReasonId, RiskLevel } from '@/contract/types'
import { CHECKS, ENGINE, OFFICERS, REJECTION_REASONS } from '@/contract/seed'
import { fillMsg } from '@/contract/messages'
import { fieldLabel } from '@/core/engine'
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

export type ReviewKind = 'advanced' | 'appeal' | 'decision'

/** What the officer is asked to decide: an open review request, an advanced-level review, or a first decision. */
export function reviewKind(c: Case): ReviewKind {
  if (c.appeal?.state === 'open') return 'appeal'
  return c.level === 'basic' && c.advanced === 'pending_review' ? 'advanced' : 'decision'
}

/** Officer-side title: "Applicant X" when the applicant is unknown, else the applicant's name. */
export function caseTitle(c: Case): string {
  return c.caseLabel ?? c.persona.name
}

/** On the Fallback the officer must see the document and the face live before approving (core rule). */
export function onFallback(c: Case): boolean {
  return c.route === 'F'
}

/** A video call is useful (or required) whenever a person still has a first decision to take. */
export function videoCallState(c: Case): 'none' | 'waiting' | 'live' | 'ended' {
  const v = c.session?.videoCall?.state
  if (v === 'live' || v === 'ended' || v === 'waiting') return v
  return c.session?.fallback?.joined ? 'waiting' : 'none'
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

/** Whole days from today to an ISO date (negative when past). */
export function daysUntil(iso: string, now = new Date()): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime()
  const t = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((d - t) / 86_400_000)
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

/** Name of an officer by id (falls back to the id). */
export function officerName(id: string | undefined | null): string {
  return OFFICERS.find(o => o.id === id)?.name ?? id ?? ''
}

/** The citizen text of MSG-REJ-0x, with {fields} filled from the case's discrepancy table (REJ-05). */
export function rejCitizenText(c: Case, id: RejectionReasonId, lang: Lang): string {
  const all = c.discrepancies ?? []
  const residence = all.filter(r => r.source === 'residence')
  const rows = id === 'REJ-05' && residence.length ? residence : all
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
  const fields = rows.length
    ? rows.map(r => `${cap(fieldLabel(r.field)[lang])}: ${r.document} / ${r.records}`).join('; ')
    : lang === 'es' ? 'los datos que no coinciden' : 'the data that does not match'
  return fillMsg(REJECTION_REASONS[id].citizenMessage[lang], { fields })
}

/** Core rule errors (English, technical) in plain words for the officer, in both languages. */
export function plainRuleError(msg: string): Bilingual {
  const m = msg.toLowerCase()
  if (m.includes('different officer')) return { en: 'Another officer must decide this review: you took the first decision. Sign in as a different officer.', es: 'Esta revisión la decide otra persona: tú tomaste la primera decisión. Entra con otro usuario.' }
  if (m.includes('synthetic-video')) return { en: 'Start the video call first: this case has a synthetic-video signal that must be checked live before you approve.', es: 'Inicia primero la videollamada: este caso tiene una señal de vídeo sintético que hay que comprobar en directo antes de aprobar.' }
  if (m.includes('start the video call')) return { en: 'Start the video call first: on this route you must see the original document and the face live before approving.', es: 'Inicia primero la videollamada: en esta vía tienes que ver el documento original y la cara en directo antes de aprobar.' }
  if (m.includes('ask for more information first')) return { en: 'Ask for more information first. The citizen must answer before you can refuse with this reason.', es: 'Pide primero más información. La persona tiene que responder antes de que puedas denegar con este motivo.' }
  if (m.includes('offer a video call first')) return { en: 'Offer a video call first before refusing with this reason.', es: 'Ofrece primero una videollamada antes de denegar con este motivo.' }
  if (m.includes('two independent signals')) return { en: 'REJ-07 needs two independent signals (for example liveness and face match). One is not enough.', es: 'REJ-07 necesita dos señales independientes (por ejemplo prueba de vida y coincidencia facial). Una sola no basta.' }
  if (m.includes('waiting for the citizen')) return { en: 'You already asked the citizen for something. Wait for the reply.', es: 'Ya pediste algo a la persona. Espera su respuesta.' }
  if (m.includes('closed list')) return { en: 'Pick a reason from the list to refuse.', es: 'Elige un motivo de la lista para denegar.' }
  if (m.includes('signed-in officer')) return { en: 'Your session has ended. Sign in again.', es: 'Tu sesión ha terminado. Vuelve a entrar.' }
  if (m.includes('already live')) return { en: 'The video call is already live.', es: 'La videollamada ya está en curso.' }
  if (m.includes('nothing') || m.includes('already granted')) return { en: 'This application has nothing left to decide.', es: 'Esta solicitud ya no tiene nada pendiente de decidir.' }
  return { en: msg, es: msg }
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
  const head = ['time', 'actor_kind', 'actor_id', 'actor_name', 'action', 'action_label', 'case_id', 'applicant', 'detail', 'evidence', 'reason_id', 'reason_label', 'rule_id', 'tags']
  const rows = events.map(e => [
    e.at,
    e.actor.kind,
    e.actor.id,
    e.actor.name,
    e.action,
    AUDIT_ACTION_LABEL[e.action]?.[lang] ?? e.action,
    e.caseId ?? '',
    e.caseId && cases[e.caseId] ? caseTitle(cases[e.caseId]) : '',
    e.detail,
    (e.evidence ?? []).map(id => CHECKS[id].label[lang]).join(' | '),
    e.reasonId ?? '',
    e.reasonId ? REJECTION_REASONS[e.reasonId].officerLabel[lang] : '',
    e.ruleId ?? '',
    (e.tags ?? []).join(' | '),
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

/** Fill "{name}" placeholders in a translated string. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

/** True for `ms` after `value` changes (not on first render) — used to flash live numbers. */
export function useFlash(value: unknown, ms = 1600): boolean {
  const prev = useRef<string | null>(null)
  const [on, setOn] = useState(false)
  const key = JSON.stringify(value)
  useEffect(() => {
    // Compare with the last value seen (not "first run"), so StrictMode's double effect never flashes.
    if (prev.current === null || prev.current === key) { prev.current = key; return }
    prev.current = key
    setOn(true)
    const id = window.setTimeout(() => setOn(false), ms)
    return () => window.clearTimeout(id)
  }, [key, ms])
  return on
}

/** Actor name for display: the engine is shown by its role, without the internal "(simulated)" tag. */
export function actorName(a: { kind: string; name: string }): string {
  return a.name.replace(/\s*\((simulated|simulado)\)\s*/i, '').trim()
}
