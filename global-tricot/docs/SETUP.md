# Configuração do Supabase (passo a passo)

Tempo estimado: 15 a 20 minutos. Você precisa de uma conta gratuita em https://supabase.com.

## 1. Criar o projeto
1. Em **New project**, escolha um nome (ex.: `global-tricot`), uma senha forte para o banco (guarde-a) e a região mais próxima (ex.: São Paulo).
2. Aguarde o projeto ficar pronto.

## 2. Criar tabelas, regras de segurança e o bucket de imagens
1. Abra **SQL Editor > New query**.
2. Cole **todo** o conteúdo de `supabase/setup-completo.sql` e clique em **Run**. (Ele junta as 4 migrations versionadas em `supabase/migrations/`; também é possível executá-las uma a uma, em ordem.)
3. Resultado esperado: "Success. No rows returned".

O que isso cria:
- `0001_schema.sql`: tabelas `categories`, `products`, `product_variants`, `product_images`, `store_settings`, `admin_users`, gatilhos e a regra de publicação no banco.
- `0002_rls.sql`: **Row Level Security** em todas as tabelas. Visitantes só leem o que está publicado; só administradores escrevem.
- `0003_storage.sql`: bucket público de leitura `catalog` (máx. 5 MB, só JPG/PNG/WebP) com upload, troca e exclusão **somente por administradores**.
- `0004_seed.sql`: categorias iniciais (Tricô, Blusas, Regatas, Moda Academia) e a linha de configurações. **Não cria produtos e não define WhatsApp.**

> Se algo falhar no meio, leia a mensagem de erro, corrija e rode de novo: os scripts de dados são idempotentes, mas os de tabela não. Em um projeto novo, o caminho mais simples é apagar o que foi criado e repetir.

## 3. Fechar o cadastro público (importante)
Em **Authentication > Sign In / Providers** (em algumas versões: **Providers > Email**), **desative “Allow new users to sign up”**.
Mesmo que alguém consiga criar uma conta, ela **não vira administradora**: o poder de administrar vem da tabela `admin_users`, que só pode ser alterada por você aqui no painel do Supabase.

## 4. Criar e autorizar o primeiro administrador
1. **Authentication > Users > Add user > Create new user**: informe e-mail e senha forte e marque a confirmação automática.
2. No **SQL Editor**, rode (trocando o e-mail):

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'SEU-EMAIL@exemplo.com';
```
3. Conferir: `select * from public.admin_users;` deve listar 1 linha.

Para dar acesso a outra pessoa, repita os passos 1 e 2. Para remover o acesso: `delete from public.admin_users where user_id = '...';`.

## 5. Endereços de retorno do login
Em **Authentication > URL Configuration**:
- **Site URL**: o endereço público do site (ex.: `https://www.globaltricot.com.br`).
- **Redirect URLs**: adicione `https://SEU-DOMINIO/admin/redefinir-senha` e, para testar localmente, `http://localhost:5173/admin/redefinir-senha`. No GitHub Pages em subpasta, inclua a subpasta (ex.: `https://usuario.github.io/global-tricot/admin/redefinir-senha`).

Recuperação de senha: o link do e-mail precisa ser aberto **no mesmo navegador** em que o pedido foi feito (o site usa o fluxo PKCE, mais seguro).
O e-mail padrão do Supabase tem limite de envios por hora; para produção, configure um SMTP próprio em **Authentication > Emails > SMTP Settings**.

## 6. Chaves e variáveis de ambiente
Em **Project Settings > API**, copie:
- **Project URL** → `VITE_SUPABASE_URL`
- chave pública **anon / publishable** → `VITE_SUPABASE_ANON_KEY`

```bash
cp .env.example .env     # e preencha os dois valores
```
**Nunca** use a chave `service_role` nem a senha do banco neste projeto: tudo com prefixo `VITE_` vai para o navegador. A chave `anon` é pública por natureza; quem protege os dados é o RLS configurado no passo 2.

## 7. Primeiro acesso e configurações da loja
1. `npm install` e `npm run dev`; abra http://localhost:5173/admin e entre com o administrador.
2. Vá em **Configurações** e preencha, no mínimo:
   - **WhatsApp oficial da loja** (com DDD). *Este valor não vem de nenhuma imagem: precisa ser informado pelo responsável.* Sem ele, os clientes só conseguem copiar o pedido, não abrir a conversa.
   - Instagram, cidade/localização (já vêm preenchidos com os dados da bio pública; **confirme**), logo e textos.
   - Se faz **entrega** e/ou **retirada** (aparece na finalização).
3. Cadastre os primeiros produtos (veja `docs/OPERACAO.md`).

## 8. Verificação rápida de segurança
- Abra o site em uma janela anônima: só aparecem produtos publicados.
- Abra `/admin` anônimo: deve ir para o login.
- No Supabase, **Storage > catalog**: o bucket deve estar como *Public*, com limite de 5 MB e tipos `image/jpeg, image/png, image/webp`.
- No **SQL Editor**: `select tablename, rowsecurity from pg_tables where schemaname='public';` — todas as tabelas devem mostrar `true`.

## Pendências que dependem do responsável pela loja
| Item | Onde informar |
|---|---|
| Número oficial de WhatsApp | Painel > Configurações |
| Logo oficial em boa resolução (o perfil do Instagram tem só 150 px) | Painel > Configurações |
| Fotos reais e dados das peças | Painel > Produtos |
| Formas de recebimento (entrega/retirada) e textos | Painel > Configurações |
| Domínio próprio | Hospedagem (`docs/DEPLOY.md`) |
| Credenciais do Supabase | `.env` e variáveis da hospedagem |
