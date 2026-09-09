import { useEffect, useRef, useState, type ChangeEvent, type CompositionEvent } from 'react'
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom'

export function useSearchKeyword() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const urlKeyword = searchParams.get('q') || ''
  const [inputValue, setInputValue] = useState(urlKeyword)
  const [keyword, setKeyword] = useState(urlKeyword)
  const composing = useRef(false)
  const lastCommitted = useRef(urlKeyword)

  useEffect(() => {
    // Our search updates replace the URL asynchronously. They must never write
    // back into the live input, especially while the IME is composing a syllable.
    if (navigationType === 'REPLACE') return
    composing.current = false
    lastCommitted.current = urlKeyword
    setInputValue(urlKeyword)
    setKeyword(urlKeyword)
  }, [location.key, navigationType, urlKeyword])

  function commit(nextKeyword: string) {
    setKeyword(nextKeyword)
    if (lastCommitted.current === nextKeyword) return
    lastCommitted.current = nextKeyword
    setSearchParams(previous => {
      const next = new URLSearchParams(previous)
      if (nextKeyword) next.set('q', nextKeyword)
      else next.delete('q')
      return next
    }, { replace: true, preventScrollReset: true })
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.currentTarget.value
    // Keep the browser's exact input synchronously; only committed text searches.
    setInputValue(next)
    if (!composing.current && !(event.nativeEvent as InputEvent).isComposing) commit(next)
  }

  function onCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    composing.current = false
    const next = event.currentTarget.value
    setInputValue(next)
    commit(next)
  }

  function clearKeyword() {
    composing.current = false
    setInputValue('')
    commit('')
  }

  return {
    keyword,
    inputValue,
    searchParams,
    clearKeyword,
    inputProps: {
      value: inputValue,
      onChange,
      onCompositionStart: () => { composing.current = true },
      onCompositionEnd,
    },
  }
}
