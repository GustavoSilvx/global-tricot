# Global Tricot — loja virtual com painel e pedidos pelo WhatsApp

Loja de tricô e moda feminina: catálogo público, **painel administrativo protegido** e finalização que monta o pedido e **abre o WhatsApp** da loja. Sem pagamento online e sem cadastro de cliente.

- **Front-end:** React 18 + TypeScript + Vite + Tailwind CSS + React Router
- **Dados, login e imagens:** Supabase (Postgres com RLS, Auth e Storage)
- **Formulários:** React Hook Form + Zod · **Testes:** Vitest + Testing Library

## Como funciona
1. A loja cadastra produtos no painel (`/admin`): fotos, cores, tamanhos, preço, rascunho/publicado.
2. O visitante navega, filtra, escolhe cor/tamanho e monta a **sacola** (salva só no aparelho).
3. Ao finalizar, o site **reconfere preço e disponibilidade no banco**, mostra a mensagem completa e abre `wa.me` com o texto pronto. O cliente ainda precisa **enviar** a mensagem; a loja confirma disponibilidade, frete e pagamento na conversa.

## Começar
```bash
npm install
cp .env.example .env          # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev                   # http://localhost:5173
```
Antes: configure o Supabase em **`docs/SETUP.md`** (executa `supabase/setup-completo.sql`, cria o primeiro administrador, define o WhatsApp).
Sem o Supabase configurado o site avisa claramente e **não exibe produtos de exemplo**.

## Comandos
| Comando | Faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | tipos + build de produção em `dist/` (+ `404.html`, `robots.txt`, `sitemap.xml`) |
| `npm test` | testes unitários e de componentes |
| `npm run test:integration` | integração contra PostgREST + Postgres reais (veja `docs/TESTES.md`) |
| `npm run build:sql` | regenera `supabase/setup-completo.sql` a partir das migrations |

## Documentação
- `docs/SETUP.md` — Supabase, primeiro administrador, variáveis, pendências do responsável
- `docs/OPERACAO.md` — guia do dia a dia (produtos, fotos, status, pedidos)
- `docs/DEPLOY.md` — Vercel, Netlify, GitHub Pages, domínio e checklist de publicação
- `docs/TESTES.md` — resultados reais e o que ainda falta validar

## Estrutura
```
src/
  pages/            Home, Catálogo, Produto, Sacola, Finalizar, 404
  pages/admin/      Login, Painel, Produtos (lista/form), Categorias, Configurações
  components/       ui/ (botões, campos, avisos), layout/, product/, cart/, admin/
  context/          Configurações da loja, Sessão admin, Carrinho, Avisos
  hooks/            useCatalog, useCartValidation, useDocumentMeta, useCategories
  services/         Acesso ao Supabase (catálogo, painel, categorias, configurações, storage)
  lib/              Regras puras e testadas: dinheiro, telefone, carrinho, reconciliação de preços,
                    mensagem do WhatsApp, filtros, variantes, regras de publicação, imagens
supabase/
  migrations/       0001 esquema · 0002 RLS · 0003 Storage · 0004 dados iniciais
  setup-completo.sql  as 4 juntas, para colar no SQL Editor
  tests/            testes de RLS e de integração (+ proxy e config do PostgREST local)
scripts/            pós-build (404.html, robots, sitemap)
```

## Decisões importantes
- **Segurança no banco, não no React:** RLS em todas as tabelas; administradores vêm de `admin_users` (só alterável pelo painel do Supabase); upload/edição/exclusão de imagens só para admin; a chave `service_role` nunca entra no front-end.
- **Variantes reais:** cada combinação cor × tamanho é um item distinto no carrinho, com disponibilidade e estoque opcional próprios. “Peça única” é uma escolha explícita.
- **Publicar exige o essencial** (nome, preço, categoria, foto, opções) — validado no formulário **e** por gatilho no banco. Rascunhos aceitam dados parciais.
- **Nada de vendas inventadas:** o painel só mostra contagens reais do catálogo.
- **Privacidade:** dados do cliente só vivem na mensagem do WhatsApp; nada é salvo.
- **Identidade:** magenta `#B82182` medido no avatar oficial do Instagram; textura de ponto canelado como único elemento decorativo; fotos somente as reais cadastradas.
