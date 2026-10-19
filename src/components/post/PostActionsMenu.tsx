import { Flag, Pencil, Share2, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Post } from '../../types/post'
import type { ReportTarget } from '../../types/moderation'
import { ReportDialog } from '../moderation/ReportButton'

interface PostActionsMenuProps {
  post: Post
  isOwner: boolean
  canReport: boolean
  busy: boolean
  onEdit: () => void
  onShare: () => void
  onDelete: () => void
}

export function PostActionsMenu({ post, isOwner, canReport, busy, onEdit, onShare, onDelete }: PostActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const initialFocus = useRef<'first' | 'last'>('first')

  useEffect(() => {
    if (!open) return
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    const index = initialFocus.current === 'last' ? (items?.length ?? 1) - 1 : 0
    items?.[index]?.focus()
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function close() {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }

  function select(action: () => void) {
    close()
    action()
  }

  function handleMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  return <>
    <div className="post-actions-menu" ref={container} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button ref={trigger} className="button-icon post-more-button" type="button" aria-label="기록 더보기"
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={busy}
        onClick={() => { initialFocus.current = 'first'; setOpen(value => !value) }}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            close()
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            initialFocus.current = event.key === 'ArrowUp' ? 'last' : 'first'
            setOpen(true)
          }
        }}>
        <img src="/icons/post-more.svg" alt="" aria-hidden="true" />
      </button>
      {open && <div className="post-actions-list" ref={menu} id={menuId} role="menu" aria-label="기록 메뉴" onKeyDown={handleMenuKey}>
        {isOwner && <button type="button" role="menuitem" tabIndex={-1} onClick={() => select(onEdit)}><Pencil size={18} aria-hidden="true" />수정</button>}
        <button type="button" role="menuitem" tabIndex={-1} onClick={() => select(onShare)}><Share2 size={18} aria-hidden="true" />공유</button>
        {isOwner && <button className="post-action-danger" type="button" role="menuitem" tabIndex={-1} onClick={() => select(onDelete)}><Trash2 size={18} aria-hidden="true" />삭제</button>}
        {canReport && <>
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => select(() => setReportTarget({ kind: 'pin', targetId: post.id, label: post.title }))}><Flag size={18} aria-hidden="true" />핀 신고</button>
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => select(() => setReportTarget({ kind: 'user', targetId: post.uid, label: post.authorNickname }))}><ShieldAlert size={18} aria-hidden="true" />작성자 신고</button>
        </>}
      </div>}
    </div>
    {reportTarget && <ReportDialog target={reportTarget} onClose={() => {
      setReportTarget(null)
      requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
    }} />}
  </>
}
