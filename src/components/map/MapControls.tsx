import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, Ref } from 'react'
import { DEFAULT_POST_PIN_COLOR, FOLLOWING_PIN_COLOR } from '../../types/post'

interface MapControlButtonProps {
  icon: LucideIcon
  label: string
  ariaLabel?: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  expanded?: boolean
  hasPopup?: 'dialog'
  className?: string
  buttonRef?: Ref<HTMLButtonElement>
}

// Secondary map control: icon above a short label on a white tile.
export function MapControlButton({
  icon: Icon, label, ariaLabel, onClick, disabled = false, busy = false, expanded, hasPopup, className = '', buttonRef,
}: MapControlButtonProps) {
  const name = ariaLabel || label
  return (
    <button ref={buttonRef} type="button" className={`map-control${busy ? ' is-busy' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick} disabled={disabled} aria-label={name} aria-busy={busy || undefined}
      aria-expanded={expanded} aria-haspopup={hasPopup} title={name}>
      <Icon size={20} aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
    </button>
  )
}

interface MapPinLegendProps {
  // Colours of my pins currently on the map; each record can have its own.
  mineColors: string[]
  othersLabel: string
}

// Mini pins drawn like the real markers. Others' pins always share one colour.
export function MapPinLegend({ mineColors, othersLabel }: MapPinLegendProps) {
  const mine = mineColors.length ? mineColors.slice(0, 3) : [DEFAULT_POST_PIN_COLOR]
  const pin = (color: string, key: number | string) => (
    <i key={key} className="map-legend-pin" style={{ '--legend-pin-color': color } as CSSProperties} />
  )
  return (
    <ul className="map-pin-legend" aria-label="핀 색 안내">
      <li><span className="map-legend-pins" aria-hidden="true">{mine.map(pin)}</span>내 핀</li>
      <li><span className="map-legend-pins" aria-hidden="true">{pin(FOLLOWING_PIN_COLOR, 'others')}</span>{othersLabel}</li>
    </ul>
  )
}
