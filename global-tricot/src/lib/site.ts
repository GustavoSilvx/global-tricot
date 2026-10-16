/** Endereço público do site (sem barra no fim). Vazio quando não configurado. */
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? '').trim().replace(/\/+$/, '')

/** Caminho-base da aplicação (ex.: "/global-tricot/" no GitHub Pages). */
export const BASE_PATH = import.meta.env.BASE_URL ?? '/'

export function absoluteUrl(path: string): string | undefined {
  if (!SITE_URL) return undefined
  const base = BASE_PATH.replace(/\/+$/, '')
  return `${SITE_URL}${base}${path.startsWith('/') ? path : `/${path}`}`
}

export const assetUrl = (file: string): string => `${BASE_PATH}${file.replace(/^\/+/, '')}`
