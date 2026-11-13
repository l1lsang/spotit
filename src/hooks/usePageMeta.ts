import { useEffect } from 'react'

/** Sets the document title and meta/og descriptions for client-rendered routes. */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title
    const set = (selector: string, value: string) => document.querySelector(selector)?.setAttribute('content', value)
    set('meta[name="description"]', description)
    set('meta[property="og:title"]', title)
    set('meta[property="og:description"]', description)
    set('meta[name="twitter:title"]', title)
    set('meta[name="twitter:description"]', description)
  }, [title, description])
}
