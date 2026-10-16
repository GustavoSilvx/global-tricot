# Publicação

O projeto é um site estático (Vite + React). O banco, o login e as imagens ficam no Supabase, então qualquer hospedagem estática serve.

Pré-requisitos: Supabase configurado (`docs/SETUP.md`) e as variáveis abaixo.

| Variável | Para quê |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | chave pública (anon/publishable) |
| `VITE_SITE_URL` | endereço público final, sem `/` no fim (sitemap, robots, metadados) |
| `VITE_BASE_PATH` | **só** GitHub Pages em subpasta (ex.: `/global-tricot/`) |

Build: `npm run build` → pasta `dist/`. O build roda a checagem de tipos, gera `404.html` (fallback de rotas), `robots.txt` e `sitemap.xml` (com os produtos publicados, se `VITE_SITE_URL` e o Supabase estiverem configurados).

## Vercel (recomendado)
1. Importe o repositório. Framework: **Vite**. Build: `npm run build`. Saída: `dist`.
2. Adicione as variáveis em **Settings > Environment Variables**.
3. `vercel.json` já reescreve todas as rotas para `index.html` (a atualização da página em `/produto/...` e `/admin` funciona).

## Netlify
Build `npm run build`, publish `dist`, variáveis em *Site settings > Environment variables*. O arquivo `public/_redirects` já cuida das rotas.

## GitHub Pages
1. Em *Settings > Pages*, fonte **GitHub Actions**.
2. Em *Settings > Secrets and variables > Actions*: *Secrets* `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; *Variables* `VITE_SITE_URL` (ex.: `https://usuario.github.io`) e `VITE_BASE_PATH` (ex.: `/global-tricot/`; deixe vazio com domínio próprio).
3. O workflow `.github/workflows/deploy-pages.yml` roda testes + build e publica. (Ele não foi executado neste ambiente de desenvolvimento.)
4. O GitHub Pages não tem backend nem rewrite: o site depende do Supabase para dados/login, e o `404.html` gerado no build mantém as rotas funcionando (a página abre, mas o servidor responde com status 404 ao atualizar em rota interna; Vercel/Netlify não têm essa limitação).

## Domínio próprio
Configure o domínio na hospedagem, ajuste `VITE_SITE_URL`, refaça o deploy e atualize **Site URL** e **Redirect URLs** no Supabase (`docs/SETUP.md`, passo 5).

## Testar no endereço público (checklist)
1. Abrir `/`, `/catalogo` e um `/produto/<slug>` **atualizando a página** (F5) em cada um.
2. `/admin` sem login → vai para o login. Entrar, recarregar o painel (a sessão deve continuar), sair.
3. Cadastrar um produto de teste com foto, publicar, vê-lo no site em janela anônima, depois arquivá-lo.
4. Fazer um pedido de teste até a tela “Abrir WhatsApp” e conferir o texto e o número de destino.
5. `/robots.txt` e `/sitemap.xml` abrem; imagens dos produtos carregam.

## Atualizar o sitemap
O sitemap é gerado no build. Quando o catálogo mudar bastante, dispare um novo deploy (ex.: botão “Redeploy”).

## Limitações conhecidas
- **Prévia ao compartilhar um produto** (WhatsApp/Facebook): o site é uma SPA e esses robôs não executam JavaScript; a prévia mostra a imagem e o texto gerais da loja (definidos em `index.html`). Prévias por produto exigem pré-renderização (próxima evolução possível).
- **Catálogo muito grande**: filtros e ordenação rodam no navegador sobre todos os produtos publicados (carregados em páginas de 1.000). É confortável para centenas ou poucos milhares de peças; acima disso, migre filtros para o servidor.
