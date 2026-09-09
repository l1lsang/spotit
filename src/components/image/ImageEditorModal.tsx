import { Check, FlipHorizontal2, RotateCcw, RotateCw, Undo2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { drawEditedImage, exportEditedImage, getImagePlacement, getRotatedSize, INITIAL_IMAGE_EDIT } from '../../lib/imageEditing'
import './image-editor.css'

interface ImageEditorModalProps {
  source: File | string
  square?: boolean
  onApply: (file: File) => void
  onClose: () => void
  allowOriginal?: boolean
}

export function ImageEditorModal({ source, square = false, onApply, onClose, allowOriginal = false }: ImageEditorModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const savingRef = useRef(false)
  const titleId = useId()
  const hintId = useId()
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [edit, setEdit] = useState({ ...INITIAL_IMAGE_EDIT })
  const [aspect, setAspect] = useState(square ? '1' : 'original')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const rotated = getRotatedSize(image?.width || 1, image?.height || 1, edit.rotation)
  const ratio = aspect === 'original' ? rotated.width / rotated.height : Number(aspect)
  const previewWidth = Math.max(1, Math.round(Math.min(600, 340 * ratio)))
  const previewHeight = Math.max(1, Math.round(previewWidth / ratio))

  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    const viewport = window.visualViewport
    function updateViewport() {
      if (!dialog) return
      dialog.style.setProperty('--image-editor-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
      dialog.style.setProperty('--image-editor-viewport-width', `${viewport?.width ?? window.innerWidth}px`)
      dialog.style.setProperty('--image-editor-viewport-top', `${viewport?.offsetTop ?? 0}px`)
      dialog.style.setProperty('--image-editor-viewport-left', `${viewport?.offsetLeft ?? 0}px`)
    }
    updateViewport()
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    viewport?.addEventListener('resize', updateViewport)
    viewport?.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    return () => {
      viewport?.removeEventListener('resize', updateViewport)
      viewport?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    let active = true
    let loadedBitmap: ImageBitmap | null = null
    const localUrl = typeof source === 'string' ? null : URL.createObjectURL(source)
    const nextImage = new Image()
    if (!localUrl) nextImage.crossOrigin = 'anonymous'
    setImage(null)
    setError('')
    setEdit({ ...INITIAL_IMAGE_EDIT })
    setAspect(square ? '1' : 'original')
    const loadFailed = () => {
      if (active) setError('사진을 불러오지 못했습니다. JPG·PNG·WebP·GIF 파일을 기기에서 다시 선택해 주세요.')
    }
    nextImage.onload = () => {
      // Freeze animated images so the exported frame matches the preview.
      void createImageBitmap(nextImage).then(bitmap => {
        if (!active) { bitmap.close(); return }
        loadedBitmap = bitmap
        setImage(bitmap)
      }).catch(loadFailed)
    }
    nextImage.onerror = loadFailed
    nextImage.src = localUrl || (source as string)
    return () => {
      active = false
      nextImage.onload = null
      nextImage.onerror = null
      loadedBitmap?.close()
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [source, square])

  useEffect(() => {
    if (!image || !canvasRef.current) return
    try { drawEditedImage(canvasRef.current, image, edit) }
    catch (drawError) { setError(drawError instanceof Error ? drawError.message : '사진 미리보기를 만들지 못했습니다.') }
  }, [image, edit, previewWidth, previewHeight])

  function movePhoto(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId || !image || saving) return
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    const { maxX, maxY } = getImagePlacement(image.width, image.height, canvas.width, canvas.height, edit)
    const dx = (event.clientX - drag.x) * canvas.width / rect.width
    const dy = (event.clientY - drag.y) * canvas.height / rect.height
    dragRef.current = { id: drag.id, x: event.clientX, y: event.clientY }
    setEdit(previous => ({ ...previous,
      panX: maxX ? Math.max(-1, Math.min(1, previous.panX + dx / maxX)) : 0,
      panY: maxY ? Math.max(-1, Math.min(1, previous.panY + dy / maxY)) : 0,
    }))
  }

  function handleArrowKey(event: KeyboardEvent<HTMLCanvasElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || saving) return
    event.preventDefault()
    const step = event.shiftKey ? 0.2 : 0.05
    setEdit(previous => ({ ...previous,
      panX: Math.max(-1, Math.min(1, previous.panX + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))),
      panY: Math.max(-1, Math.min(1, previous.panY + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))),
    }))
  }

  async function apply() {
    if (!image || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try { onApply(await exportEditedImage(image, source, ratio, edit)) }
    catch { setError('사진을 편집하지 못했습니다. 다른 사진을 선택하거나 다시 시도해 주세요.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  return createPortal(
    <dialog className="image-editor-dialog" ref={dialogRef} aria-labelledby={titleId} aria-describedby={hintId}
      onCancel={event => { event.preventDefault(); if (!savingRef.current) onClose() }}>
      <div className="image-editor-header">
        <div><h2 id={titleId}>{square ? '프로필 사진 편집' : '사진 편집'}</h2>
          <p id={hintId}>사진을 드래그하거나 방향키로 움직여 영역을 맞춰 주세요.</p></div>
        <button className="button-icon" type="button" onClick={onClose} disabled={saving} aria-label="사진 편집 닫기"><X size={20} aria-hidden="true" /></button>
      </div>
      <div className="image-editor-body">
        <div className="image-editor-preview">
          {image ? <div className="image-editor-crop" style={{
            width: `min(100%, ${previewWidth}px, calc(var(--image-editor-preview-height) * ${previewWidth / previewHeight}))`,
            aspectRatio: `${previewWidth} / ${previewHeight}`,
          }}>
            <canvas ref={canvasRef} width={previewWidth} height={previewHeight} tabIndex={0}
              aria-label="자르기 미리보기. 드래그 또는 방향키로 사진 이동" onKeyDown={handleArrowKey}
              onPointerDown={event => {
                if (saving || dragRef.current || event.button !== 0) return
                event.currentTarget.focus()
                event.currentTarget.setPointerCapture(event.pointerId)
                dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
              }} onPointerMove={movePhoto} onPointerUp={() => { dragRef.current = null }}
              onPointerCancel={() => { dragRef.current = null }} onLostPointerCapture={() => { dragRef.current = null }} />
            <div className="image-editor-grid" aria-hidden="true" />
          </div> : <p role="status">{error ? '사진을 열 수 없습니다.' : '사진을 불러오는 중…'}</p>}
        </div>
        <fieldset className="image-editor-controls" disabled={!image || saving}>
          <legend className="image-editor-control-title">사진 조절</legend>
          {!square && <label className="image-editor-ratio">자르기 비율
            <select value={aspect} onChange={event => { setAspect(event.target.value); setEdit(previous => ({ ...previous, zoom: 1, panX: 0, panY: 0 })) }}>
              <option value="original">원본 비율</option><option value="1">정사각형 1:1</option>
              <option value={4 / 3}>가로 4:3</option><option value={3 / 4}>세로 3:4</option><option value={16 / 9}>가로 16:9</option>
            </select>
          </label>}
          <label className="image-editor-zoom"><span>확대 <output>{Math.round(edit.zoom * 100)}%</output></span>
            <input type="range" min="1" max="4" step="0.01" value={edit.zoom}
              onChange={event => setEdit(previous => ({ ...previous, zoom: Number(event.target.value) }))} />
          </label>
          <div className="image-editor-tools">
            <button type="button" onClick={() => setEdit(previous => ({ ...previous, rotation: (previous.rotation + 270) % 360, panX: 0, panY: 0 }))}><RotateCcw size={17} aria-hidden="true" />왼쪽 회전</button>
            <button type="button" onClick={() => setEdit(previous => ({ ...previous, rotation: (previous.rotation + 90) % 360, panX: 0, panY: 0 }))}><RotateCw size={17} aria-hidden="true" />오른쪽 회전</button>
            <button type="button" aria-pressed={edit.flip} onClick={() => setEdit(previous => ({ ...previous, flip: !previous.flip }))}><FlipHorizontal2 size={17} aria-hidden="true" />좌우 반전</button>
            <button type="button" onClick={() => { setEdit({ ...INITIAL_IMAGE_EDIT }); setAspect(square ? '1' : 'original') }}><Undo2 size={17} aria-hidden="true" />초기화</button>
          </div>
        </fieldset>
        {typeof source !== 'string' && source.type === 'image/gif' && <p className="image-editor-note">GIF를 편집하면 움직임이 없는 사진으로 저장됩니다.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="image-editor-footer">
        {allowOriginal && typeof source !== 'string' && <button className="image-editor-original" type="button" disabled={!image || saving} onClick={() => onApply(source)}>원본 사용</button>}
        <button className="button button-secondary" type="button" disabled={saving} onClick={onClose}>취소</button>
        <button className="button button-primary" type="button" disabled={!image || saving} onClick={() => void apply()}><Check size={17} aria-hidden="true" />{saving ? '적용 중…' : '편집 적용'}</button>
      </div>
    </dialog>, document.body,
  )
}
