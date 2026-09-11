import { useEffect, useRef, useState } from 'react'

// Keep live Firestore connections only around the viewport and in an active tab.
export function useLiveVisibility(alwaysVisible = false) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(alwaysVisible)
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const update = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (alwaysVisible || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const element = ref.current
    if (!element) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(entries => {
      clearTimeout(timer)
      const next = entries.some(entry => entry.isIntersecting)
      timer = setTimeout(() => setVisible(next), next ? 100 : 300)
    }, { rootMargin: '150px' })
    observer.observe(element)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [alwaysVisible])
  return { ref, live: (alwaysVisible || visible) && tabVisible }
}
