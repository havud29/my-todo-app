import type { ReactNode } from 'react'

interface Props {
  title: string
  icon?: string
  className?: string
  onClose?: () => void
  children: ReactNode
}

// A Windows 7 style window frame. Only the Classic theme draws the frame and
// title bar; in other themes the wrapper is layout-neutral.
export default function Window({ title, icon, className = '', onClose, children }: Props) {
  return (
    <section className={`win ${className}`} aria-label={title}>
      <header className="win-title">
        {icon && <img className="win-icon" src={`${import.meta.env.BASE_URL}aero/${icon}.svg`} alt="" />}
        <span className="win-title-text">{title}</span>
        <span className="win-controls">
          <span className="win-btn min" aria-hidden />
          <span className="win-btn max" aria-hidden />
          {onClose ? (
            <button type="button" className="win-btn close" onClick={onClose} aria-label="Close" />
          ) : (
            <span className="win-btn close" aria-hidden />
          )}
        </span>
      </header>
      <div className="win-body">{children}</div>
    </section>
  )
}
