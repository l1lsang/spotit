import { useEffect, useRef, useState } from 'react'
import { getActiveMention, insertMention, MAX_COMMENT_MENTIONS } from '../../lib/commentMentions'
import { searchMentionUsers, type MentionUser } from '../../services/mentionService'
import { COMMENT_MAX_LENGTH } from '../../types/comment'

interface MentionTextareaProps {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  autoFocus?: boolean
  rows?: number
}

export function MentionTextarea({ id, value, onChange, placeholder, disabled, autoFocus, rows = 2 }: MentionTextareaProps) {
  const input = useRef<HTMLTextAreaElement>(null)
  const [cursor, setCursor] = useState(0)
  const [focused, setFocused] = useState(false)
  const [selectedText, setSelectedText] = useState(false)
  const [dismissed, setDismissed] = useState('')
  const [selected, setSelected] = useState(0)
  const [search, setSearch] = useState<{ key: string; users: MentionUser[]; loading: boolean; error: string }>({ key: '', users: [], loading: false, error: '' })
  const active = focused && !disabled && !selectedText ? getActiveMention(value, Math.min(cursor, value.length)) : null
  const queryKey = active ? `${active.start}:${active.query}` : ''
  const queryText = active?.query ?? ''
  const open = Boolean(active && queryKey !== dismissed)
  const results = search.key === queryKey ? search.users : []
  const activeIndex = Math.min(selected, Math.max(0, results.length - 1))
  const listId = `${id}-mentions`

  useEffect(() => {
    if (!open) return
    let canceled = false
    setSelected(0)
    setSearch({ key: queryKey, users: [], loading: true, error: '' })
    const timer = setTimeout(() => {
      void searchMentionUsers(queryText).then(users => {
        if (!canceled) setSearch({ key: queryKey, users, loading: false, error: '' })
      }).catch(() => {
        if (!canceled) setSearch({ key: queryKey, users: [], loading: false, error: '사용자 검색을 불러오지 못했습니다. 잠시 후 다시 입력해 주세요.' })
      })
    }, 200)
    return () => { canceled = true; clearTimeout(timer) }
  }, [open, queryKey, queryText])

  function trackSelection(element: HTMLTextAreaElement) {
    setCursor(element.selectionStart)
    setSelectedText(element.selectionStart !== element.selectionEnd)
  }

  function choose(user: MentionUser) {
    if (!active) return
    const next = insertMention(value, active, user.username)
    if (next.content.length > COMMENT_MAX_LENGTH) return
    onChange(next.content)
    setCursor(next.cursor)
    setDismissed(queryKey)
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelectionRange(next.cursor, next.cursor)
    })
  }

  return <div className="mention-composer">
    <textarea ref={input} id={id} value={value} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
      rows={rows} maxLength={COMMENT_MAX_LENGTH} role="combobox" aria-autocomplete="list" aria-haspopup="listbox"
      aria-expanded={open && results.length > 0} aria-controls={open && results.length ? listId : undefined}
      aria-activedescendant={open && results.length ? `${listId}-${activeIndex}` : undefined}
      aria-describedby={`${id}-mention-hint`}
      onChange={event => { onChange(event.target.value); trackSelection(event.target); setDismissed('') }}
      onSelect={event => trackSelection(event.currentTarget)}
      onFocus={event => { setFocused(true); trackSelection(event.target) }} onBlur={() => setFocused(false)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229 || !open) return
        if (event.key === 'Escape') { event.preventDefault(); setDismissed(queryKey); return }
        if (!results.length) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setSelected((activeIndex + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length)
        } else if (event.key === 'Enter') { event.preventDefault(); choose(results[activeIndex]) }
      }} />
    {open && <div className="mention-suggestions">
      {search.key !== queryKey || search.loading ? <p role="status">사용자를 찾는 중…</p>
        : search.error ? <p role="status">{search.error}</p>
          : !results.length ? <p role="status">일치하는 사용자 이름이 없습니다.</p>
            : <ul id={listId} role="listbox" aria-label="멘션할 사용자">
              {results.map((user, index) => <li key={user.uid} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}
                onPointerDown={event => event.preventDefault()} onClick={() => choose(user)}>
                {user.photoURL ? <img className="comment-avatar" src={user.photoURL} alt="" /> : <span className="comment-avatar" aria-hidden="true">@</span>}
                <span><strong>{user.nickname}</strong><small>@{user.username}</small></span>
              </li>)}
            </ul>}
    </div>}
    <small className="mention-hint" id={`${id}-mention-hint`}>@사용자이름으로 멘션 · 최대 {MAX_COMMENT_MENTIONS}명</small>
  </div>
}
