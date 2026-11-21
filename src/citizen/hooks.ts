import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import type { Bilingual, Case, Lang } from '@/contract/types'
import { useClave, actions } from '@/core/store'
import { relativeTime } from '@/core/selectors'

/** Lang-reactive translator (re-renders when the language changes). */
export function useTr() {
  const lang = useClave(s => s.lang) as Lang
  const tr = useCallback((b: Bilingual) => b[lang] ?? b.en, [lang])
  return { tr, lang }
}

export function useCase(id: string | undefined): Case | undefined {
  return useClave(s => (id ? s.cases[id] : undefined))
}

/** True when the hash query has ?embed=1 (demo panel iframes). */
export function useEmbed(): boolean {
  const { search } = useLocation()
  return new URLSearchParams(search).get('embed') === '1'
}

/** navigate() that keeps ?embed=1 across citizen screens. */
export function useGo() {
  const navigate = useNavigate()
  const embed = useEmbed()
  return useCallback(
    (path: string, opts?: { replace?: boolean }) => navigate(embed ? `${path}?embed=1` : path, opts),
    [navigate, embed],
  )
}

export function withEmbed(path: string, embed: boolean) {
  return embed ? `${path}?embed=1` : path
}

const mq = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null)
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    cb => {
      const m = mq(query)
      m?.addEventListener('change', cb)
      return () => m?.removeEventListener('change', cb)
    },
    () => mq(query)?.matches ?? false,
    () => false,
  )
}

export function useReduced(): boolean {
  return Boolean(useReducedMotion())
}

/** Re-render every `ms` (for relative times). */
export function useTick(ms = 20_000) {
  const [, set] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => set(n => n + 1), ms)
    return () => window.clearInterval(id)
  }, [ms])
}

export function rel(iso: string | undefined, lang: Lang) {
  if (!iso) return ''
  try {
    return relativeTime(iso, lang)
  } catch {
    return ''
  }
}

export function fmtDate(iso: string, lang: Lang) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function fmtTime(d: Date, lang: Lang) {
  return d.toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
}

/* ---- tiny per-tab memory for the booked video-call slot (convenience only) ---- */
const SLOT_KEY = (id: string) => `getyourclave.citizen.slot.${id}`
export function saveSlot(id: string, iso: string) {
  try { sessionStorage.setItem(SLOT_KEY(id), iso) } catch { /* ignore */ }
  try { actions.bookVideoCall(id, iso) } catch (e) { console.warn('[citizen] bookVideoCall', e) }
}
export function readSlot(id: string): string | null {
  const fromStore = useClave.getState().cases[id]?.videoCallSlot
  if (fromStore) return fromStore
  try { return sessionStorage.getItem(SLOT_KEY(id)) } catch { return null }
}
export function clearSlot(id: string) {
  try { sessionStorage.removeItem(SLOT_KEY(id)) } catch { /* ignore */ }
}

/** Three fake video-call slots later today. */
export function todaySlots(now = new Date()): Date[] {
  const base = new Date(now)
  base.setSeconds(0, 0)
  const m = base.getMinutes()
  base.setMinutes(m - (m % 15) + 15)
  return [45, 150, 255].map(add => new Date(base.getTime() + add * 60_000))
}
