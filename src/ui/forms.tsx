import { forwardRef, type ReactNode, type TextareaHTMLAttributes, type InputHTMLAttributes } from 'react'
import * as RD from '@radix-ui/react-dialog'
import * as RS from '@radix-ui/react-select'
import * as RG from '@radix-ui/react-radio-group'
import * as SW from '@radix-ui/react-switch'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn, useTr, SPRING } from './utils'

/* ------------------------------------------------------------------ Dialog */

/**
 * Modal dialog (radix). Controlled via `open`/`onOpenChange`, or pass `trigger`.
 * `footer` is a row of actions; `tone="danger"` adds a red accent for destructive confirmations.
 */
export const Dialog = ({ open, onOpenChange, trigger, title, description, children, footer, className, tone = 'default', size = 'md' }: {
  open?: boolean; onOpenChange?: (o: boolean) => void; trigger?: ReactNode
  title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode
  className?: string; tone?: 'default' | 'danger'; size?: 'sm' | 'md' | 'lg'
}) => {
  const tr = useTr()
  const reduce = useReducedMotion()
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RD.Trigger asChild>{trigger}</RD.Trigger>}
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-[#0d1014]/45 backdrop-blur-[3px] data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <RD.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-[4px] border-t-4 border-brand bg-surface p-6 shadow-pop outline-none',
            'sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-[2px]',
            { sm: 'sm:max-w-[400px]', md: 'sm:max-w-[480px]', lg: 'sm:max-w-[640px]' }[size],
            className,
          )}
          asChild
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={SPRING}
          >
            {tone === 'danger' && <span aria-hidden className="absolute inset-x-0 -top-1 h-1 bg-danger" />}
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <RD.Title className="font-display text-[20px] leading-snug font-bold text-ink">{title}</RD.Title>
                {description ? (
                  <RD.Description className="text-sm leading-relaxed text-muted">{description}</RD.Description>
                ) : (
                  <RD.Description className="sr-only">{typeof title === 'string' ? title : ''}</RD.Description>
                )}
              </div>
              <RD.Close className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-[2px] text-muted hover:bg-surface-2 hover:text-ink" aria-label={tr('Close', 'Cerrar')}>
                <X className="size-[18px]" aria-hidden />
              </RD.Close>
            </div>
            {children}
            {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
          </motion.div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
/** Wrap a footer button to close the parent Dialog on click. */
export const DialogClose = RD.Close

/* ------------------------------------------------------------------ Select */

export interface SelectOption { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean }

/** Styled dropdown select (radix). Pass `label` for an accessible name. */
export const Select = ({ value, onValueChange, options, placeholder, label, className, id, required }: {
  value?: string; onValueChange: (v: string) => void; options: SelectOption[]
  placeholder?: string; label?: string; className?: string; id?: string; required?: boolean
}) => (
  <RS.Root value={value} onValueChange={onValueChange} required={required}>
    <RS.Trigger
      id={id}
      aria-label={label}
      className={cn(
        'inline-flex h-12 w-full items-center justify-between gap-2 rounded-field border border-line-strong bg-surface px-4 text-left text-[16px] text-ink',
        'hover:border-ink data-[placeholder]:text-muted',
        className,
      )}
    >
      <RS.Value placeholder={placeholder} />
      <RS.Icon><ChevronDown className="size-4 text-muted" aria-hidden /></RS.Icon>
    </RS.Trigger>
    <RS.Portal>
      <RS.Content position="popper" sideOffset={6} className="z-[60] max-h-[min(360px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[2px] bg-surface p-1 shadow-pop">
        <RS.Viewport>
          {options.map(o => (
            <RS.Item
              key={o.value} value={o.value} disabled={o.disabled}
              className="relative flex cursor-pointer flex-col rounded-[2px] py-2.5 pr-9 pl-3 text-[15px] text-ink outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-brand-soft"
            >
              <RS.ItemText>{o.label}</RS.ItemText>
              {o.description && <span className="text-xs text-muted">{o.description}</span>}
              <RS.ItemIndicator className="absolute top-1/2 right-3 -translate-y-1/2 text-brand"><Check className="size-4" aria-hidden /></RS.ItemIndicator>
            </RS.Item>
          ))}
        </RS.Viewport>
      </RS.Content>
    </RS.Portal>
  </RS.Root>
)

/* -------------------------------------------------------------- RadioCards */

export interface RadioCardOption {
  value: string
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** Small badge on the right (e.g. a tag). */
  badge?: ReactNode
  disabled?: boolean
}

/** Big tappable option cards (radix radio group) for the phone route assistant. Arrow keys move, space selects. */
export const RadioCards = ({ value, onValueChange, options, label, columns = 1, className }: {
  value?: string; onValueChange: (v: string) => void; options: RadioCardOption[]
  /** Accessible group name. */
  label?: string; columns?: 1 | 2; className?: string
}) => {
  const reduce = useReducedMotion()
  return (
    <RG.Root
      value={value} onValueChange={onValueChange} aria-label={label}
      className={cn('grid gap-2.5', columns === 2 && 'sm:grid-cols-2', className)}
    >
      {options.map((o, i) => {
        const on = value === o.value
        return (
          <motion.div
            key={o.value}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: i * 0.05 }}
          >
            <RG.Item
              value={o.value} disabled={o.disabled}
              className={cn(
                'group relative flex w-full items-center gap-3.5 rounded-[2px] border bg-surface p-4 text-left transition-colors duration-150',
                'min-h-[64px] border-line-strong hover:border-brand disabled:opacity-50',
                on && 'border-brand bg-brand-soft shadow-[inset_0_0_0_1px_var(--color-brand)]',
              )}
            >
              {o.icon && (
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-[2px] transition-colors [&_svg]:size-[22px]', on ? 'bg-brand text-brand-ink' : 'bg-brand-soft text-brand')} aria-hidden>
                  {o.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[16px] leading-snug font-bold text-ink">{o.label}</span>
                  {o.badge}
                </span>
                {o.description && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{o.description}</span>}
              </span>
              <span
                aria-hidden
                className={cn('grid size-6 shrink-0 place-items-center rounded-full ring-[1.5px] ring-inset transition-colors', on ? 'bg-brand ring-brand' : 'bg-surface ring-line-strong')}
              >
                <RG.Indicator asChild>
                  <motion.span initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={SPRING}>
                    <Check className="size-3.5 text-white" strokeWidth={3.2} />
                  </motion.span>
                </RG.Indicator>
              </span>
            </RG.Item>
          </motion.div>
        )
      })}
    </RG.Root>
  )
}

/* ------------------------------------------------------------------ Switch */

/** On/off switch (radix) with a visible label. */
export const Switch = ({ checked, onCheckedChange, label, className, tone = 'default' }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; className?: string; tone?: 'default' | 'stage'
}) => (
  <label className={cn('inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold', tone === 'stage' ? 'text-stage-ink' : 'text-ink', className)}>
    <SW.Root
      checked={checked} onCheckedChange={onCheckedChange}
      className={cn('relative h-6 w-[42px] shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand' : tone === 'stage' ? 'bg-white/20' : 'bg-line-strong/60')}
    >
      <SW.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-200 data-[state=checked]:translate-x-[20px]" />
    </SW.Root>
    {label}
  </label>
)

/* ------------------------------------------------------------ Field inputs */

/** Labelled field wrapper (label, hint, error). */
export const Field = ({ label, hint, error, htmlFor, children, className, required }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; htmlFor?: string; children: ReactNode; className?: string; required?: boolean
}) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={htmlFor} className="block text-[15px] font-bold text-ink">
      {label}{required && <span className="text-danger" aria-hidden> *</span>}
    </label>
    {children}
    {hint && !error && <p className="text-[13px] leading-snug text-muted">{hint}</p>}
    {error && <p role="alert" className="flex items-center gap-1 text-[13px] font-bold text-danger"><X className="size-3.5" aria-hidden />{error}</p>}
  </div>
)

const fieldCls = 'w-full rounded-field border border-line-strong bg-surface px-4 text-[16px] text-ink placeholder:text-muted/80 hover:border-ink focus-visible:border-brand focus-visible:shadow-[inset_0_0_0_1px_var(--color-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--color-danger)]'

/** Text input styled to the tokens. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(fieldCls, 'h-12', className)} {...p} />
})

/** Multiline textarea styled to the tokens. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(fieldCls, 'min-h-[104px] py-3 leading-relaxed', className)} {...p} />
})
