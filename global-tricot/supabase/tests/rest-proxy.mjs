// Proxy mínimo: o supabase-js chama <URL>/rest/v1/..., mas o PostgREST puro atende na raiz.
import http from 'node:http'
const TARGET_PORT = Number(process.env.PGRST_PORT || 3000)
const PORT = Number(process.env.PROXY_PORT || 54321)
http
  .createServer((req, res) => {
    const path = (req.url || '/').replace(/^\/rest\/v1/, '') || '/'
    const upstream = http.request(
      { host: '127.0.0.1', port: TARGET_PORT, path, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${TARGET_PORT}` } },
      (r) => {
        res.writeHead(r.statusCode || 500, r.headers)
        r.pipe(res)
      },
    )
    upstream.on('error', (e) => {
      res.writeHead(502)
      res.end(String(e))
    })
    req.pipe(upstream)
  })
  .listen(PORT, '127.0.0.1', () => console.log(`proxy /rest/v1 -> :${TARGET_PORT} em :${PORT}`))
