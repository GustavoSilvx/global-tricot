// Pós-build: fallback de rotas para GitHub Pages, robots.txt e sitemap.xml.
// Roda automaticamente em `npm run build`. Nunca derruba o build: avisa e segue.
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { loadEnv } from 'vite'

const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
const siteUrl = (env.VITE_SITE_URL || '').trim().replace(/\/+$/, '')
const base = (env.VITE_BASE_PATH || '/').replace(/\/+$/, '')
const supaUrl = (env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const anon = (env.VITE_SUPABASE_ANON_KEY || '').trim()
const dist = 'dist'

// 1) GitHub Pages não tem "rewrite": servir index.html como 404.html mantém as rotas do React funcionando.
if (existsSync(`${dist}/index.html`)) {
  await copyFile(`${dist}/index.html`, `${dist}/404.html`)
  console.log('postbuild: 404.html criado (fallback de rotas para GitHub Pages).')
}

// 2) robots.txt e sitemap só fazem sentido com a URL pública definida.
if (!siteUrl) {
  console.warn('postbuild: VITE_SITE_URL vazio -> sitemap.xml e Sitemap do robots.txt não foram gerados.')
  process.exit(0)
}

await writeFile(
  `${dist}/robots.txt`,
  `User-agent: *\nAllow: /\nDisallow: ${base}/admin\n\nSitemap: ${siteUrl}${base}/sitemap.xml\n`,
)

const urls = [`${siteUrl}${base}/`, `${siteUrl}${base}/catalogo`]
if (supaUrl && anon) {
  try {
    const headers = { apikey: anon, Authorization: `Bearer ${anon}` }
    const fetchAll = async (path) => {
      const out = []
      for (let from = 0; ; from += 1000) {
        const res = await fetch(`${supaUrl}/rest/v1/${path}`, { headers: { ...headers, Range: `${from}-${from + 999}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const rows = await res.json()
        out.push(...rows)
        if (rows.length < 1000) break
      }
      return out
    }
    // O RLS já devolve só o que é público (publicados, em categorias ativas).
    const products = await fetchAll('products?select=slug,updated_at&status=eq.published&order=id')
    const cats = await fetchAll('categories?select=slug&active=eq.true&order=id')
    cats.forEach((c) => urls.push(`${siteUrl}${base}/catalogo?categoria=${encodeURIComponent(c.slug)}`))
    products.forEach((p) => urls.push(`${siteUrl}${base}/produto/${encodeURIComponent(p.slug)}`))
    console.log(`postbuild: sitemap com ${products.length} produto(s) e ${cats.length} categoria(s).`)
  } catch (e) {
    console.warn(`postbuild: não foi possível ler produtos do Supabase (${e.message}). Sitemap só com páginas fixas.`)
  }
} else {
  console.warn('postbuild: Supabase não configurado -> sitemap só com páginas fixas.')
}

const esc = (s) => s.replace(/&/g, '&amp;')
await writeFile(
  `${dist}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u)}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
)
console.log('postbuild: sitemap.xml e robots.txt gerados.')
