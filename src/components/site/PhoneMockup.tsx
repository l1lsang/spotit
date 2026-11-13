import type { ReactNode } from 'react'
import { screenSrc, type ShowcaseScreen } from '../../data/showcase'

/**
 * A CSS phone frame around real app screenshots. The captures already contain the Android status
 * bar, so the frame draws no notch or status bar of its own.
 */
export function PhoneMockup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`phone ${className}`}>
      <div className="phone-screen">{children}</div>
    </div>
  )
}

export function PhoneScreenImage({ screen, priority = false, hidden = false }: {
  screen: ShowcaseScreen
  priority?: boolean
  hidden?: boolean
}) {
  const { src, srcSet } = screenSrc(screen.file)
  return (
    <img className="phone-shot" src={src} srcSet={srcSet} sizes="(min-width: 1024px) 320px, 240px"
      width="945" height="2048" alt={hidden ? '' : screen.alt} aria-hidden={hidden || undefined}
      loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
  )
}

/** Brand intro inside the phone: the PINORI mark, drawn in CSS (not an app screenshot). */
export function PhoneSplash() {
  return (
    <div className="phone-splash" aria-hidden="true">
      <img src="/logo-mark.png" alt="" width="437" height="512" />
      <img className="phone-splash-wordmark" src="/logo-wordmark.png" alt="" width="1010" height="256" />
    </div>
  )
}
