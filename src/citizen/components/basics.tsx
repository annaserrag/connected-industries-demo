import { useEffect, useId, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { cn } from '@/ui'
import { useReduced } from '../hooks'

/** Local logo mark: a neutral "@" tile (no official branding). */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn('grid shrink-0 place-items-center rounded-[30%] bg-brand text-brand-ink shadow-sm', className)}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <circle cx="12" cy="12" r="3.6" />
        <path d="M15.6 12v1.4a2.4 2.4 0 0 0 4.8 0V12a8.4 8.4 0 1 0-3.3 6.7" />
      </svg>
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display font-semibold tracking-tight text-ink', className)}>
      Get your Cl<span className="text-brand">@</span>ve
    </span>
  )
}

/** Big tappable option card backed by a native radio input (keyboard + screen-reader friendly). */
export function OptionCard({
  name, value, checked, onChange, title, sub, icon, aside,
}: {
  name: string; value: string; checked: boolean; onChange: (v: string) => void
  title: string; sub?: string; icon?: ReactNode; aside?: ReactNode
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cn(
        'group relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-surface p-4 transition-all',
        'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/30',
        checked ? 'border-brand bg-brand-soft/60 shadow-[0_6px_20px_-12px_var(--color-brand)]' : 'border-line hover:border-brand/40',
      )}
    >
      <input id={id} type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      {icon && (
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl transition-colors', checked ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted')}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-ink">{title}</span>
        {sub && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{sub}</span>}
        {aside}
      </span>
      <span
        aria-hidden
        className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all', checked ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface')}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
    </label>
  )
}

/** Accessible modal on Radix Dialog. */
export function Modal({
  open, onOpenChange, title, description, children, closeLabel,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; closeLabel: string
}) {
  const reduced = useReduced()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[440px] rounded-t-3xl bg-surface p-5 pb-7 shadow-2xl outline-none"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              >
                <div>
                  <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" aria-hidden />
                  <div className="flex items-start justify-between gap-3">
                    <Dialog.Title className="font-display text-xl font-semibold text-ink">{title}</Dialog.Title>
                    <Dialog.Close className="-m-1 rounded-full p-1.5 text-muted hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30" aria-label={closeLabel}>
                      <X size={18} />
                    </Dialog.Close>
                  </div>
                  {description ? (
                    <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
                  ) : (
                    <Dialog.Description className="sr-only">{title}</Dialog.Description>
                  )}
                  <div className="mt-4">{children}</div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/** Small toast shown inside the citizen shell; announced politely. */
export function LiveToast({ message, show, onDone }: { message: string; show: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!show) return
    const id = window.setTimeout(onDone, 2600)
    return () => window.clearTimeout(id)
  }, [show, onDone])
  return (
    <div aria-live="polite" role="status" className="pointer-events-none sticky bottom-5 z-40 h-0">
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface shadow-xl"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {message}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

/** Progress dots/bar for multi-step flows. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted">{label}</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
        <motion.div className="h-full rounded-full bg-brand" initial={false} animate={{ width: `${Math.max(4, value * 100)}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
      </div>
    </div>
  )
}

/** Route code chip ("A", "B", "C", "Fallback"), without repeating the route name. */
export function RouteCode({ code, className }: { code: string; className?: string }) {
  return <span className={cn('inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand', className)}>{code}</span>
}

/** Primary full-width button for the phone layout. */
export function BigButton({
  children, onClick, disabled, variant = 'primary', type = 'button', className,
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; type?: 'button' | 'submit'; className?: string
}) {
  const v = {
    primary: 'bg-brand text-brand-ink shadow-[0_10px_24px_-12px_var(--color-brand)] hover:brightness-110',
    secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
    ghost: 'text-brand hover:bg-brand-soft',
    danger: 'bg-danger text-white hover:brightness-110',
  }[variant]
  return (
    <motion.button
      type={type}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-50',
        v, className,
      )}
    >
      {children}
    </motion.button>
  )
}
