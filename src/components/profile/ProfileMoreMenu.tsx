import { Ellipsis, Flag } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { ReportTarget } from '../../types/moderation'
import type { DaymarkUser } from '../../types/user'
import { ReportDialog } from '../moderation/ReportButton'

// Reports live in an overflow menu so they stay reachable without competing with follow and chat.
export function ProfileMoreMenu({ user }: { user: DaymarkUser }) {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<ReportTarget | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = useId()
  const name = user.nickname || '스팟잇 사용자'
  const items: { label: string; target: ReportTarget }[] = [
    { label: '사용자 신고', target: { kind: 'user', targetId: user.uid, label: name } },
    ...(user.photoURL ? [{ label: '프로필 사진 신고', target: { kind: 'photo', sourceKind: 'user', targetId: user.uid, photoUrl: user.photoURL, label: `${name} 프로필 사진` } as ReportTarget }] : []),
  ]

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    function closeOutside(event: PointerEvent) {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  function closeMenu() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const menuItems = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])]
    const index = menuItems.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      menuItems[(index + step + menuItems.length) % menuItems.length]?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return <div className="profile-view-menu">
    <button ref={buttonRef} className="profile-view-icon-button" type="button" aria-label="더보기" title="더보기"
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(value => !value)}>
      <Ellipsis size={22} aria-hidden="true" />
    </button>
    {open && <ul ref={menuRef} id={menuId} role="menu" aria-label={`${name} 더보기`} onKeyDown={handleMenuKeyDown}>
      {items.map(item => <li key={item.label} role="none">
        <button type="button" role="menuitem" onClick={() => { setOpen(false); setReport(item.target) }}>
          <Flag size={16} aria-hidden="true" />{item.label}
        </button>
      </li>)}
    </ul>}
    {report && <ReportDialog target={report} onClose={() => { setReport(null); buttonRef.current?.focus() }} />}
  </div>
}
