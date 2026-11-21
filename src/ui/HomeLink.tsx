import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from './utils'

const isEmbedded = () => typeof window !== 'undefined' && window.self !== window.top

/**
 * Wraps the brand mark so clicking it always goes back to the home page.
 * Inside an iframe it opens home in the whole window, not inside the frame.
 */
export function HomeLink({ children, className, label = 'Get your Cl@ve, home' }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <Link
      to="/"
      aria-label={label}
      target={isEmbedded() ? '_top' : undefined}
      className={cn('inline-flex min-w-0 items-center gap-2', className)}
    >
      {children}
    </Link>
  )
}
