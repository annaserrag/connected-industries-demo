import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import type { Bilingual, Case, Lang } from '@/contract/types'
import { useClave } from '@/core/store'
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

/** True when the hash query has ?embed=1 (embedded views). */
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

/* ---- per-browser conveniences (localStorage / sessionStorage, always wrapped) ---- */

const LARGE_KEY = 'getyourclave.citizen.largeText'
const largeListeners = new Set<() => void>()
function readLarge(): boolean {
  try { return localStorage.getItem(LARGE_KEY) === '1' } catch { return false }
}
let largeText = typeof window !== 'undefined' ? readLarge() : false
/** MSG-HELP-01 "Letra grande": remembered per browser. */
export function useLargeText(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    cb => { largeListeners.add(cb); return () => { largeListeners.delete(cb) } },
    () => largeText,
    () => false,
  )
  const set = useCallback((v: boolean) => {
    largeText = v
    try { localStorage.setItem(LARGE_KEY, v ? '1' : '0') } catch { /* private mode */ }
    largeListeners.forEach(l => l())
  }, [])
  return [on, set]
}

/** The helper of an assisted session finished on this tab: show MSG-ASS-03 only, never the result. */
const HELPER_DONE = (id: string) => `getyourclave.citizen.helperDone.${id}`
export function markHelperDone(id: string) {
  try { sessionStorage.setItem(HELPER_DONE(id), '1') } catch { /* ignore */ }
}
export function isHelperDone(id: string): boolean {
  try { return sessionStorage.getItem(HELPER_DONE(id)) === '1' } catch { return false }
}
export function clearHelperDone() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k?.startsWith('getyourclave.citizen.helperDone.')) sessionStorage.removeItem(k)
    }
  } catch { /* ignore */ }
}

/** Browser speech ("Leer en voz alta"). Returns null when the browser has no speech synthesis. */
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined'
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => { if (supported) try { window.speechSynthesis.cancel() } catch { /* ignore */ } }, [supported])
  const speak = useCallback((text: string, lang: Lang) => {
    if (!supported) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang === 'es' ? 'es-ES' : 'en-GB'
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(u)
    } catch { setSpeaking(false) }
  }, [supported])
  const stop = useCallback(() => {
    try { window.speechSynthesis.cancel() } catch { /* ignore */ }
    setSpeaking(false)
  }, [])
  return supported ? { speaking, speak, stop } : null
}

export const UPLOAD_MAX = 1.5 * 1024 * 1024
/** Reads an image file into a data URL. Rejects non-images and files over 1.5 MB with 'type' / 'size'. */
export function readImage(file: File): Promise<{ name: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { reject(new Error('type')); return }
    if (file.size > UPLOAD_MAX) { reject(new Error('size')); return }
    const r = new FileReader()
    r.onload = () => resolve({ name: file.name, dataUrl: String(r.result) })
    r.onerror = () => reject(new Error('read'))
    r.readAsDataURL(file)
  })
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
