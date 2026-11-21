import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Bilingual, Lang } from '@/contract/types'
import { useClave } from '@/core/store'

/** Merge Tailwind classes (clsx + tailwind-merge). */
export function cn(...c: ClassValue[]) {
  return twMerge(clsx(c))
}

/** Current UI language; re-renders on change. */
export function useLang(): Lang {
  return useClave(s => s.lang)
}

/** Translator bound to the current language; re-renders on change. `tr({en, es})` or `tr('en text', 'es text')`. */
export function useTr() {
  const lang = useLang()
  return (b: Bilingual | string, es?: string) => (typeof b === 'string' ? (lang === 'es' && es ? es : b) : b[lang])
}

/** Motion durations in seconds, mirrored from tokens.css. */
export const DUR = { fast: 0.14, base: 0.24, slow: 0.42 } as const

/** Default spring for page/step transitions. */
export const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 } as const
/** Bouncier spring for small confirmations (ticks, pills). */
export const SPRING_POP = { type: 'spring', stiffness: 520, damping: 22 } as const
