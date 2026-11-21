import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClave } from '@/core/store'
import type { Bilingual, Lang } from '@/contract/types'

/** Reactive language + translator (re-renders on EN/ES switch). */
export function useLang(): Lang {
  return useClave(s => s.lang)
}

export function useTr() {
  const lang = useLang()
  return useCallback((b: Bilingual) => b[lang], [lang])
}

export function useFmt() {
  const lang = useLang()
  return useMemo(() => {
    const locale = lang === 'es' ? 'es-ES' : 'en-GB'
    const n = new Intl.NumberFormat(locale, { useGrouping: 'always' } as Intl.NumberFormatOptions)
    const p1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
    return {
      num: (v: number) => n.format(v),
      pct1: (v: number) => `${p1.format(v)}%`,
      pct: (v: number) => `${n.format(v)}%`,
    }
  }, [lang])
}

export interface ChartColors {
  brand: string
  brandSoft: string
  muted: string
  ink: string
  line: string
  surface: string
  sim: string
}

const FALLBACK: ChartColors = {
  brand: '#1f4fd6',
  brandSoft: '#e7edfd',
  muted: '#5b5b66',
  ink: '#17171a',
  line: '#e3e1db',
  surface: '#ffffff',
  sim: '#6b3fd1',
}

function readColors(): ChartColors {
  if (typeof window === 'undefined') return FALLBACK
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb
  return {
    brand: v('--color-brand', FALLBACK.brand),
    brandSoft: v('--color-brand-soft', FALLBACK.brandSoft),
    muted: v('--color-muted', FALLBACK.muted),
    ink: v('--color-ink', FALLBACK.ink),
    line: v('--color-line', FALLBACK.line),
    surface: v('--color-surface', FALLBACK.surface),
    sim: v('--color-sim', FALLBACK.sim),
  }
}

/** Chart colours from the Design tokens; re-read when the theme attribute or OS scheme changes. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(readColors)
  useEffect(() => {
    const update = () => setColors(readColors())
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    return () => {
      mo.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [])
  return colors
}

/** `?embed=1` in the hash query (HashRouter) or the real query. */
export function isEmbed(search: string): boolean {
  const fromHash = new URLSearchParams(search).get('embed')
  const fromReal = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('embed') : null
  return fromHash === '1' || fromReal === '1'
}
