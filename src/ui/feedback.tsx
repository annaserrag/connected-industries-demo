import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react'
import { Toaster as SonnerToaster, toast } from 'sonner'
import { Button, Skeleton, Spinner } from './primitives'
import { cn, useTr } from './utils'

export { toast }

/** Empty state: soft icon tile, title, optional body and action. */
export const EmptyState = ({ title, body, icon, action, className }: {
  title: string; body?: string; icon?: ReactNode; action?: ReactNode; className?: string
}) => {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
    >
      <div className="relative mb-4 grid size-14 place-items-center rounded-[2px] bg-brand-soft text-brand [&_svg]:size-6">
        {icon ?? <Inbox aria-hidden />}
      </div>
      <p className="text-[16px] font-bold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-[42ch] text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

/** Loading state: spinner + label, or skeleton rows when `rows` is set. */
export const LoadingState = ({ label, rows, className }: { label?: string; rows?: number; className?: string }) => {
  const tr = useTr()
  if (rows) {
    return (
      <div className={cn('space-y-3', className)} role="status" aria-label={label ?? tr('Loading', 'Cargando')}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[2px] border border-line bg-surface p-4">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-3/5" /></div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-sm font-medium text-muted', className)}>
      <Spinner size={22} className="text-brand" label={label} />
      <span aria-hidden>{label ?? tr('Loading…', 'Cargando…')}</span>
    </div>
  )
}

/** Error state: alert icon, title, body and an optional retry button. */
export const ErrorState = ({ title, body, onRetry, className }: {
  title?: string; body?: string; onRetry?: () => void; className?: string
}) => {
  const tr = useTr()
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-[2px] bg-danger-soft text-danger [&_svg]:size-6">
        <TriangleAlert aria-hidden />
      </div>
      <p className="text-[15px] font-semibold text-ink">{title ?? tr('Something went wrong', 'Algo ha fallado')}</p>
      {body && <p className="mt-1 max-w-[42ch] text-sm leading-relaxed text-muted">{body}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" icon={<RefreshCw className="size-4" aria-hidden />} onClick={onRetry}>
          {tr('Try again', 'Reintentar')}
        </Button>
      )}
    </div>
  )
}

/** Sonner toaster styled to the tokens. Mount once per app (Platform: in App). Use `toast()` from '@/ui'. */
export const Toaster = ({ position = 'top-center' }: { position?: 'top-center' | 'bottom-right' | 'top-right' | 'bottom-center' }) => (
  <SonnerToaster
    position={position}
    gap={10}
    toastOptions={{
      unstyled: true,
      classNames: {
        toast: 'flex w-[min(380px,calc(100vw-32px))] items-start gap-3 rounded-[2px] border-l-4 border-brand bg-surface p-4 text-sm text-ink shadow-pop font-sans',
        title: 'font-bold leading-snug',
        description: 'mt-0.5 text-muted leading-snug',
        icon: 'mt-0.5 [&_svg]:size-[18px]',
        success: '[&_[data-icon]]:text-success',
        error: '[&_[data-icon]]:text-danger',
        warning: '[&_[data-icon]]:text-warning',
        info: '[&_[data-icon]]:text-brand',
        actionButton: 'ml-auto shrink-0 rounded-[2px] bg-brand px-3 py-1.5 text-xs font-bold text-brand-ink',
        cancelButton: 'shrink-0 rounded-[2px] border border-brand px-3 py-1.5 text-xs font-bold text-brand',
      },
    }}
  />
)
