import { useEffect, useId, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { GovWordmark, LogoGlyph, cn } from '@/ui'
import { useReduced } from '../hooks'

/** Logo mark: the kit's neutral glyph (no official branding). */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return <LogoGlyph size={size} className={className} />
}

export function Wordmark({ className }: { className?: string }) {
  return <GovWordmark className={className} />
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
        'group relative flex cursor-pointer items-center gap-3 rounded-[2px] border bg-surface p-4 transition-colors',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
        checked ? 'border-brand bg-brand-soft shadow-[inset_0_0_0_1px_var(--color-brand)]' : 'border-line-strong hover:border-brand',
      )}
    >
      <input id={id} type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      {icon && (
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-[2px] transition-colors', checked ? 'bg-brand text-brand-ink' : 'bg-brand-soft text-brand')}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-snug text-ink">{title}</span>
        {sub && <span className="mt-0.5 block text-[14px] leading-snug text-muted">{sub}</span>}
        {aside}
      </span>
      <span
        aria-hidden
        className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all', checked ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong bg-surface')}
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
                className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[520px] rounded-t-[4px] border-t-4 border-brand bg-surface p-5 pb-7 shadow-pop outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[2px]"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <Dialog.Title className="font-display text-xl font-bold text-ink">{title}</Dialog.Title>
                    <Dialog.Close className="-m-1 rounded-[2px] p-1.5 text-muted hover:bg-surface-2" aria-label={closeLabel}>
                      <X size={18} />
                    </Dialog.Close>
                  </div>
                  {description ? (
                    <Dialog.Description className="mt-1 text-[15px] text-muted">{description}</Dialog.Description>
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
            className="flex items-center gap-2 rounded-[2px] bg-ink px-4 py-2 text-sm font-bold text-surface shadow-pop"
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
      <div className="mb-1.5 text-[13px] font-bold text-muted">{label}</div>
      <div className="h-2 w-full overflow-hidden rounded-[1px] bg-surface-2 ring-1 ring-inset ring-line" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
        <motion.div className="h-full bg-brand" initial={false} animate={{ width: `${Math.max(4, value * 100)}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
      </div>
    </div>
  )
}

/** Route code chip ("A", "B", "C", "Fallback"), without repeating the route name. */
export function RouteCode({ code, className }: { code: string; className?: string }) {
  return <span className={cn('inline-flex rounded-[2px] bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink', className)}>{code}</span>
}

/** Primary full-width button for the phone layout. */
export function BigButton({
  children, onClick, disabled, variant = 'primary', type = 'button', className,
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; type?: 'button' | 'submit'; className?: string
}) {
  const v = {
    primary: 'border-2 border-brand bg-brand text-brand-ink hover:border-brand-strong hover:bg-brand-strong',
    secondary: 'border-2 border-brand bg-surface text-brand hover:bg-brand-soft hover:text-brand-strong',
    ghost: 'text-brand underline underline-offset-[3px] hover:text-brand-strong hover:decoration-2',
    danger: 'border-2 border-danger bg-danger text-white hover:bg-[#951d16]',
  }[variant]
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[2px] px-5 py-3 text-[16px] font-bold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        v, className,
      )}
    >
      {children}
    </motion.button>
  )
}
