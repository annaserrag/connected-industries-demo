/**
 * Optional shared demo store (Supabase). When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 * are set at build time, every browser (phone + laptop) reads/writes the same world state.
 *
 * Local-only fields stay on each device: lang, officerId, activeCitizenCaseId.
 * Shared fields: version, cases, accounts, audit, officerProfiles.
 *
 * Without the env vars the app keeps the previous localStorage + BroadcastChannel behaviour.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { AppState } from '@/contract/types'
import { STATE_VERSION } from '@/contract/seed'

const ROW_ID = 'main'
const TABLE = 'clave_demo_state'
const PUSH_DEBOUNCE_MS = 450
const POLL_MS = 2500

export type SharedDemoState = Pick<AppState, 'version' | 'cases' | 'accounts' | 'audit' | 'officerProfiles'>

export function cloudConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return Boolean(url && key && String(url).startsWith('http'))
}

function client(): SupabaseClient | null {
  if (!cloudConfigured()) return null
  return createClient(
    String(import.meta.env.VITE_SUPABASE_URL),
    String(import.meta.env.VITE_SUPABASE_ANON_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export function sharedFrom(s: AppState): SharedDemoState {
  return {
    version: s.version,
    cases: s.cases,
    accounts: s.accounts,
    audit: s.audit,
    officerProfiles: s.officerProfiles ?? {},
  }
}

export function applyShared(shared: SharedDemoState, local: AppState): AppState {
  return {
    ...local,
    version: shared.version,
    cases: shared.cases,
    accounts: shared.accounts,
    audit: shared.audit,
    officerProfiles: shared.officerProfiles ?? {},
  }
}

export function isUsableShared(shared: unknown): shared is SharedDemoState {
  if (!shared || typeof shared !== 'object') return false
  const s = shared as SharedDemoState
  return s.version === STATE_VERSION && Boolean(s.cases) && Boolean(s.accounts) && Array.isArray(s.audit)
}

type Row = { id: string; shared: SharedDemoState; writer: string | null; rev: number }

export type CloudHandlers = {
  /** Apply a remote shared snapshot (preserve local session fields). */
  onRemote: (shared: SharedDemoState, meta: { writer: string | null; rev: number }) => void
  /** Tab id so we ignore our own echoes. */
  writerId: string
}

let supabase: SupabaseClient | null = null
let channel: RealtimeChannel | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
let lastRev = 0
let started = false
let pushing = false

export function cloudLastRev(): number {
  return lastRev
}

/** Fetch the shared row. null when missing or cloud off. */
export async function cloudPull(): Promise<Row | null> {
  const sb = supabase ?? client()
  if (!sb) return null
  supabase = sb
  const { data, error } = await sb.from(TABLE).select('id,shared,writer,rev').eq('id', ROW_ID).maybeSingle()
  if (error) {
    console.warn('[cloud] pull', error.message)
    return null
  }
  if (!data) return null
  return data as Row
}

/** Write shared state now (used after reset and when seeding an empty row). */
export async function cloudPushNow(shared: SharedDemoState, writerId: string): Promise<boolean> {
  const sb = supabase ?? client()
  if (!sb) return false
  supabase = sb
  const rev = Date.now()
  pushing = true
  const { error } = await sb.from(TABLE).upsert({
    id: ROW_ID,
    shared,
    writer: writerId,
    rev,
    updated_at: new Date().toISOString(),
  })
  pushing = false
  if (error) {
    console.warn('[cloud] push', error.message)
    return false
  }
  lastRev = rev
  return true
}

/** Debounced push from the normal commit path. */
export function cloudPushDebounced(shared: SharedDemoState, writerId: string) {
  if (!cloudConfigured()) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void cloudPushNow(shared, writerId)
  }, PUSH_DEBOUNCE_MS)
}

/**
 * Start cloud sync: pull (or seed), subscribe to changes, poll as backup.
 * Safe to call once from the browser after the store exists.
 */
export async function startCloudSync(handlers: CloudHandlers): Promise<'off' | 'ready' | 'seeded' | 'error'> {
  if (started) return cloudConfigured() ? 'ready' : 'off'
  started = true
  if (!cloudConfigured()) return 'off'

  const sb = client()
  if (!sb) return 'off'
  supabase = sb

  const applyIfNewer = async () => {
    if (pushing) return
    const row = await cloudPull()
    if (!row || !isUsableShared(row.shared)) return
    if (row.writer === handlers.writerId) {
      lastRev = Math.max(lastRev, row.rev ?? 0)
      return
    }
    if ((row.rev ?? 0) <= lastRev) return
    lastRev = row.rev
    handlers.onRemote(row.shared, { writer: row.writer, rev: row.rev })
  }

  try {
    const existing = await cloudPull()
    if (existing && isUsableShared(existing.shared)) {
      lastRev = existing.rev ?? 0
      if (existing.writer !== handlers.writerId) {
        handlers.onRemote(existing.shared, { writer: existing.writer, rev: existing.rev })
      }
    } else {
      // Empty or wrong version: the store will seed via the callback return value.
      return 'seeded'
    }
  } catch (e) {
    console.warn('[cloud] bootstrap', e)
    return 'error'
  }

  channel = sb
    .channel('clave-demo-state')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` }, () => {
      void applyIfNewer()
    })
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR') console.warn('[cloud] realtime channel error — polling still runs')
    })

  pollTimer = setInterval(() => { void applyIfNewer() }, POLL_MS)
  return 'ready'
}

export function stopCloudSync() {
  if (pushTimer) clearTimeout(pushTimer)
  if (pollTimer) clearInterval(pollTimer)
  pushTimer = null
  pollTimer = null
  if (channel && supabase) {
    void supabase.removeChannel(channel)
  }
  channel = null
  started = false
}
