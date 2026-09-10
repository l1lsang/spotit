import { Check, MapPin, Pipette } from 'lucide-react'
import { useId } from 'react'
import { DEFAULT_POST_PIN_COLOR, PIN_COLOR_PALETTE, parsePinColorCode } from '../../types/post'

interface PinColorPickerProps {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

export function PinColorPicker({ value, onChange, disabled = false }: PinColorPickerProps) {
  const id = useId()
  const color = parsePinColorCode(value)
  const preset = PIN_COLOR_PALETTE.find(item => item.color === color)
  const previewColor = color || '#a0a49d'

  return <div className="pin-color-control" role="group" aria-labelledby={`${id}-label`}>
    <div className="pin-color-control-heading">
      <span id={`${id}-label`}>색상</span>
      <small>마음에 드는 색을 골라보세요</small>
    </div>
    <div className="pin-color-swatches" role="group" aria-label="추천 색상">
      {PIN_COLOR_PALETTE.map(item => <button key={item.color} type="button" className="pin-palette-swatch"
        style={{ backgroundColor: item.color }} disabled={disabled} aria-pressed={color === item.color}
        aria-label={`${item.name} ${item.color.toUpperCase()}`} title={`${item.name} · ${item.color.toUpperCase()}`}
        onClick={() => onChange(item.color.toUpperCase())}>
        {color === item.color && <Check size={18} strokeWidth={3} aria-hidden="true" />}
      </button>)}
    </div>
    <div className="pin-color-preview" style={{ backgroundColor: `${previewColor}12`, borderColor: `${previewColor}30` }}>
      <span className="pin-color-preview-icon" style={{ backgroundColor: previewColor }} aria-hidden="true"><MapPin size={23} /></span>
      <div><strong>{color ? preset?.name || '나만의 색상' : '색상 확인'}</strong><small>{color ? color.toUpperCase() : '올바른 코드를 입력해 주세요'}</small></div>
      <label className="pin-custom-color" title="색상 직접 선택">
        <Pipette size={16} aria-hidden="true" /><span>직접 선택</span>
        <input type="color" value={color || DEFAULT_POST_PIN_COLOR} disabled={disabled} aria-label="색상 직접 선택"
          onChange={event => onChange(event.target.value.toUpperCase())} />
      </label>
    </div>
    <label className="pin-hex-field" htmlFor={`${id}-hex`}>
      <span>HEX 색상 코드</span>
      <input id={`${id}-hex`} type="text" value={value} required disabled={disabled}
        placeholder="#DF7658" autoComplete="off" autoCapitalize="characters" spellCheck={false}
        pattern="\s*#?([a-fA-F0-9]{3}|[a-fA-F0-9]{6})\s*"
        aria-invalid={!color} aria-describedby={`${id}-hint`}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            event.stopPropagation()
          }
        }} />
    </label>
    <small id={`${id}-hint`} className={color ? 'pin-color-hint' : 'pin-color-error'}>
      {color ? '#을 포함하거나 생략한 3자리·6자리 코드를 입력할 수 있어요.' : '색상 코드는 0–9, A–F로 된 3자리 또는 6자리여야 해요.'}
    </small>
  </div>
}
