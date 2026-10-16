import { useEffect } from 'react'
import { absoluteUrl } from '../lib/site'

interface MetaOptions {
  title: string
  description?: string
  image?: string | null
  /** Caminho da página (ex.: "/produto/blusa") para a URL canônica. */
  path?: string
  noindex?: boolean
  jsonLd?: Record<string, unknown> | null
}

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (content == null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Título, descrição, Open Graph, canonical, noindex e dados estruturados por página. */
export function useDocumentMeta({ title, description, image, path, noindex, jsonLd }: MetaOptions) {
  const jsonKey = jsonLd ? JSON.stringify(jsonLd) : ''
  useEffect(() => {
    const prevTitle = document.title
    document.title = title
    const canonical = path ? absoluteUrl(path) : undefined

    setMeta('name', 'description', description ?? null)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description ?? null)
    setMeta('property', 'og:url', canonical ?? null)
    if (image) setMeta('property', 'og:image', image)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : null)

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) {
      if (!link) {
        link = document.createElement('link')
        link.rel = 'canonical'
        document.head.appendChild(link)
      }
      link.href = canonical
    } else {
      link?.remove()
    }

    let script: HTMLScriptElement | null = null
    if (jsonKey) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = 'ld-json'
      script.textContent = jsonKey
      document.head.appendChild(script)
    }
    return () => {
      document.title = prevTitle
      setMeta('name', 'robots', null)
      script?.remove()
    }
  }, [title, description, image, path, noindex, jsonKey])
}
