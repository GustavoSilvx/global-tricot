# Relatório de testes

Resultados **reais**, executados no ambiente de desenvolvimento. Nada abaixo foi marcado como funcionando sem ter sido executado.

## Resumo

| Camada | O que roda | Resultado |
|---|---|---|
| Migrations + RLS | 4 migrations aplicadas em Postgres 16; 35 verificações como visitante, usuário comum e admin (`supabase/tests/rls_test.sql`) | **35 de 35 passaram** |
| Tipos | `tsc --noEmit` em modo estrito, sem variáveis sem uso | **0 erros** |
| Unitários e de componentes | Vitest + Testing Library (`npm test`): 20 arquivos | **141 de 141 passaram** |
| Integração | Serviços reais do app + `supabase-js` real + **PostgREST 12.2.3 real** + Postgres com RLS (`npm run test:integration`) | **19 de 19 passaram** |
| Build de produção | `npm run build` (tsc + vite + pós-build) | **ok** (painel em chunks separados; bundle público ≈ 150 kB gzip) |
| Sitemap | Gerado contra o PostgREST local com 1.250 produtos | **1.256 URLs** (2 fixas + 4 categorias + 1.250 produtos) |

## Como reproduzir
```bash
npm install
npm run typecheck
npm test                       # unitários + componentes
npm run build
# integração (precisa de Postgres local, usuário "postgres" via su e o binário do PostgREST):
POSTGREST_BIN=/caminho/postgrest npm run test:integration
```

## O que a integração prova (contra PostgREST + Postgres reais)
- Visitante lê só produtos **publicados** em categorias **ativas**; rascunhos, arquivados e categorias inativas ficam invisíveis.
- Visitante e usuário comum **não escrevem** nada (nem se promovem a admin); admin escreve.
- Rascunho salva só com o nome; o **banco recusa** publicar sem preço, categoria, imagem ou opções, com mensagem clara.
- Salvar produto (opções + imagens), trocar opções/fotos de um produto já publicado sem deixá-lo inválido, imagem principal recalculada pelo banco, slug repetido, exclusão em cascata.
- Categoria em uso não é excluída; desativar categoria esconde os produtos; configurações (WhatsApp fora do padrão é recusado).
- Contagens do painel calculadas no banco; **catálogo com 1.250 produtos** atravessa o limite de 1.000 linhas por requisição, sem perder nem duplicar.
- Achado durante os testes e corrigido: com RLS, um `UPDATE`/`DELETE` sem permissão **não dá erro, afeta 0 linhas**. Toda escrita agora confirma as linhas afetadas, então a tela nunca mostra sucesso sem gravação.

## O que NÃO foi testado (depende de configuração externa ou de navegador)
| Item | Por quê | Como validar |
|---|---|---|
| **Login/logout reais** e recuperação de senha | Exigem o Supabase Auth (GoTrue) real. Só a guarda de rotas foi testada (4 cenários) e o RLS foi testado com sessões simuladas por JWT. | `docs/SETUP.md` passos 3-5, depois entrar em `/admin` |
| **Upload real de imagens** e leitura pública no Storage | O Storage é simulado nos testes. As políticas de `storage.objects` foram testadas só em um esquema simulado (35 verificações) e não na plataforma. | Subir uma foto pelo painel e abrir em janela anônima |
| **Aparência e responsividade** (celular, tablet, notebook) | Não havia navegador disponível. As telas usam classes responsivas, mas **não foram vistas renderizadas**. | Abrir no celular e no computador; checar o fluxo completo |
| **Abrir o WhatsApp de verdade** | Só se verifica o link `https://wa.me/...` e a mensagem. O envio depende do aparelho do cliente. | Fazer um pedido de teste |
| **Publicação** (Vercel/Netlify/GitHub Pages) e rotas internas no servidor | Configurações incluídas, nenhuma hospedagem foi usada. O workflow do GitHub Pages não foi executado. | `docs/DEPLOY.md`, checklist final |
| Sincronização do carrinho entre abas | Implementada (`storage` event), sem teste automatizado. | Abrir duas abas |
| Acessibilidade com leitor de tela | Uso de rótulos, foco e `aria-*` revisado em código; sem teste com tecnologia assistiva. | Teste manual |

## Checklist do briefing (itens 1 a 35)

Legenda: **A** automatizado e passando · **P** parcial · **M** manual pendente

| # | Item | Status | Evidência / pendência |
|---|---|---|---|
| 1 | Página inicial | A | testes de `HomePage` (conteúdo, destaques do banco, sem dados inventados); visual não visto |
| 2 | Catálogo e carregamento | A | unitário + integração (1.250 produtos) |
| 3 | Pesquisa e filtros | A | `catalogFilters` + `CatalogPage` |
| 4 | Detalhes do produto | A | `ProductPage` |
| 5 | Cor e tamanho | A | seleção obrigatória, combinações indisponíveis, foto por cor |
| 6 | Carrinho | A | `CartPage` + `cart` |
| 7 | Alterar e remover itens | A | idem |
| 8 | Cálculo de preços | A | em centavos, sem erro de arredondamento |
| 9 | Persistência local do carrinho | A | localStorage validado com zod; sincronização entre abas: M |
| 10 | Produto indisponível | A | unitário + integração |
| 11 | Login e logout | M | exige Supabase Auth real |
| 12 | Bloqueio de acesso não autorizado | A | RLS (SQL + integração) + `RequireAdmin` |
| 13 | Cadastro de produto | A | formulário (6 testes) + serviço real |
| 14 | Edição e exclusão | A | lista do painel (5 testes) + serviço real |
| 15 | Rascunhos | A | formulário + integração |
| 16 | Validação da publicação | A | cliente + gatilho do banco |
| 17 | Upload e remoção de imagens | P | gerenciador de imagens e linhas no banco: A; arquivo no Storage real: M |
| 18 | Categorias | P | serviços reais: A; a tela de categorias não tem teste de componente |
| 19 | Configurações | P | serviço real e validações do banco: A; a tela não tem teste de componente |
| 20 | Persistência após atualizar a página | P | dados persistem no banco (leitura após escrita): A; recarregar no navegador: M |
| 21 | Formulário de finalização | A | validação, endereço só na entrega |
| 22 | Mensagem com todos os produtos | A | |
| 23 | Formatação monetária | A | `R$ 89,90` |
| 24 | Acentos e caracteres especiais | A | ida e volta por `encodeURIComponent` |
| 25 | WhatsApp inválido ou ausente | A | informa a pendência, sem URL |
| 26 | Carrinho vazio | A | |
| 27 | Preço alterado | A | bloqueia, exige aceitar; reconferido ao revisar |
| 28 | Botão copiar pedido | A | |
| 29 | Aviso de que falta enviar | A | nunca diz “enviado” |
| 30 | Compilação de produção | A | |
| 31 | Rotas internas | M | `vercel.json`, `_redirects`, `404.html` incluídos |
| 32 | Responsividade | M | sem navegador |
| 33 | Acesso às imagens | M | Storage real |
| 34 | Políticas de segurança | A | SQL + PostgREST reais; Storage: M |
| 35 | Funcionamento com Supabase configurado | P | PostgREST/Postgres reais: A; plataforma Supabase (Auth/Storage): M |
