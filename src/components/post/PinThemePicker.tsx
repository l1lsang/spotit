import { Plus, Save, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { saveUserPinTheme } from '../../services/userService'
import { PinColorPicker } from './PinColorPicker'
import {
  DEFAULT_POST_PIN_COLOR, FOLLOWING_PIN_COLOR, PIN_COLOR_PALETTE, PIN_THEME_NAME_MAX_LENGTH,
  getPinThemeError, getPostPinColor, parsePinColorCode, type PinTheme, type PostFormInput,
} from '../../types/post'

type PinSelection = Pick<PostFormInput, 'pinColor' | 'pinThemeId'>

interface PinThemePickerProps {
  value?: PinSelection
  onChange?: (value: PinSelection) => void
}

export function PinThemePicker({ value, onChange }: PinThemePickerProps) {
  const { currentUser, profile } = useAuth()
  const [editingTheme, setEditingTheme] = useState<PinTheme | null>(null)
  const themes = profile?.pinThemes || []
  const color = value
    ? value.pinThemeId ? getPostPinColor(value, themes) : value.pinColor
    : PIN_COLOR_PALETTE[0].color

  return (
    <fieldset className="field pin-theme-settings">
      <legend>{value ? '내 핀 색상과 테마' : '내 핀 테마'}</legend>
      {value && !editingTheme && (
        <PinColorPicker value={color} onChange={pinColor => onChange?.({ pinColor, pinThemeId: '' })} />
      )}
      <div className="pin-group-palette">
        {themes.map((theme) => (
          <button
            key={theme.id}
            className={`color-swatch-button ${value?.pinThemeId === theme.id ? 'active' : ''}`}
            type="button"
            aria-pressed={value ? value.pinThemeId === theme.id : undefined}
            title={value ? theme.name : `${theme.name} 테마 수정`}
            onClick={() => value ? onChange?.({ pinColor: theme.color, pinThemeId: theme.id }) : setEditingTheme(theme)}
          >
            <i style={{ backgroundColor: theme.color }} aria-hidden="true" />
            {theme.name}
          </button>
        ))}
        <button className="color-swatch-button pin-theme-add" type="button" disabled={!currentUser} onClick={() => setEditingTheme({ id: crypto.randomUUID(), name: '', color: parsePinColorCode(color) || DEFAULT_POST_PIN_COLOR })}>
          <Plus size={14} aria-hidden="true" />핀 테마 추가
        </button>
      </div>
      {themes.length === 0 && <small className="field-help">이름과 색상을 정해 나만의 핀 테마를 추가해 보세요.</small>}
      {!value && themes.length > 0 && <small className="field-help">테마를 누르면 이름과 색상을 바꿀 수 있어요.</small>}
      {editingTheme && currentUser && (
        <PinThemeEditor
          key={editingTheme.id}
          theme={editingTheme}
          uid={currentUser.uid}
          onCancel={() => setEditingTheme(null)}
          onSaved={(theme) => {
            onChange?.({ pinColor: theme.color, pinThemeId: theme.id })
            setEditingTheme(null)
          }}
        />
      )}
      <small className="field-help pin-following-color"><i style={{ backgroundColor: FOLLOWING_PIN_COLOR }} aria-hidden="true" />팔로잉 핀은 고정 색상으로 표시됩니다.</small>
    </fieldset>
  )
}

function PinThemeEditor({ theme, uid, onSaved, onCancel }: {
  theme: PinTheme
  uid: string
  onSaved: (theme: PinTheme) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(theme.name)
  const [color, setColor] = useState(theme.color)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (saving) return
    const parsedColor = parsePinColorCode(color)
    if (!parsedColor) { setError('올바른 HEX 색상 코드를 입력해 주세요.'); return }
    const next = { id: theme.id, name: name.trim(), color: parsedColor }
    const validationError = getPinThemeError(next)
    if (validationError) { setError(validationError); return }
    setSaving(true)
    setError('')
    try {
      await saveUserPinTheme(uid, next)
      onSaved(next)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '핀 테마를 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pin-theme-editor" onKeyDown={(event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type === 'text' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); void save() }
      if (event.key === 'Escape' && !saving) { event.preventDefault(); event.stopPropagation(); onCancel() }
    }}>
      <label className="field">
        <span>테마 이름</span>
        <input autoFocus maxLength={PIN_THEME_NAME_MAX_LENGTH} value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 다시 가고 싶은 곳" disabled={saving} />
      </label>
      <PinColorPicker value={color} onChange={setColor} disabled={saving} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="pin-theme-editor-actions">
        <button className="button button-secondary" type="button" onClick={onCancel} disabled={saving}><X size={15} aria-hidden="true" />취소</button>
        <button className="button button-primary" type="button" onClick={() => void save()} disabled={saving || !parsePinColorCode(color)}><Save size={15} aria-hidden="true" />{saving ? '저장 중' : '테마 저장'}</button>
      </div>
    </div>
  )
}
