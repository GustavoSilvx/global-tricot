-- Global Tricot: instalação completa (gerado de supabase/migrations/*.sql com npm run build:sql)
-- Cole tudo no SQL Editor do Supabase e execute UMA vez.

-- >>> 0001_schema.sql
-- =====================================================================
-- Global Tricot — 0001: esquema de dados
-- Execute no SQL Editor do Supabase (ou via `supabase db push`).
-- =====================================================================

create type public.product_status as enum ('draft', 'published', 'archived');
create type public.product_availability as enum ('available', 'unavailable');

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Administradores
-- Só entra aqui quem for inserido manualmente (SQL Editor / service role).
-- Não existe nenhuma policy de escrita: ninguém se promove sozinho.
-- ---------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text,
  cover_image_path text,
  active           boolean not null default true,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Produtos
-- Campos como preço e categoria são opcionais para permitir rascunhos
-- incompletos; a publicação é validada pelo trigger enforce_publish_rules.
-- ---------------------------------------------------------------------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 1 and 160),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  code              text check (code is null or char_length(code) <= 40),
  description       text,
  category_id       uuid references public.categories (id) on delete restrict,
  price             numeric(10, 2) check (price is null or price >= 0),
  promotional_price numeric(10, 2) check (promotional_price is null or promotional_price > 0),
  availability      public.product_availability not null default 'available',
  track_stock       boolean not null default false,
  featured          boolean not null default false,
  status            public.product_status not null default 'draft',
  -- Cache da imagem principal; mantido por trigger a partir de product_images.
  main_image_path   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint products_promo_below_price
    check (promotional_price is null or price is null or promotional_price < price)
);

create unique index products_code_unique
  on public.products (lower(code)) where code is not null and btrim(code) <> '';
create index products_status_idx   on public.products (status);
create index products_category_idx on public.products (category_id);
create index products_featured_idx on public.products (featured) where featured;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Variantes (cor x tamanho). Cada combinação é um item distinto no carrinho.
-- color/size nulos = produto sem aquela opção (ex.: peça de tamanho único).
-- ---------------------------------------------------------------------
create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  color          text check (color is null or char_length(btrim(color)) between 1 and 40),
  color_hex      text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  size           text check (size is null or char_length(btrim(size)) between 1 and 20),
  sku            text check (sku is null or char_length(sku) <= 40),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  available      boolean not null default true,
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);

create unique index product_variants_combo_unique
  on public.product_variants (product_id, coalesce(lower(color), ''), coalesce(lower(size), ''));
create index product_variants_product_idx on public.product_variants (product_id);

-- ---------------------------------------------------------------------
-- Imagens dos produtos (arquivos ficam no Storage, bucket "catalog")
-- ---------------------------------------------------------------------
create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  storage_path  text not null,
  alt_text      text,
  position      integer not null default 0,
  is_main       boolean not null default false,
  color_variant text,
  created_at    timestamptz not null default now()
);

create unique index product_images_one_main
  on public.product_images (product_id) where is_main;
create index product_images_product_idx on public.product_images (product_id, position);

-- ---------------------------------------------------------------------
-- Configurações da loja (linha única)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id               smallint primary key default 1 check (id = 1),
  store_name       text not null default 'Global Tricot' check (char_length(btrim(store_name)) > 0),
  logo_path        text,
  hero_image_path  text,
  hero_title       text,
  hero_subtitle    text,
  about_text       text,
  -- Somente dígitos, com DDI: 55 + DDD + número (12 ou 13 dígitos).
  whatsapp_number  text check (whatsapp_number is null or whatsapp_number ~ '^55[0-9]{10,11}$'),
  instagram_url    text check (instagram_url is null or instagram_url ~ '^https://'),
  city             text,
  location_text    text,
  contact_email    text,
  contact_info     text,
  delivery_enabled boolean not null default true,
  pickup_enabled   boolean not null default true,
  delivery_info    text,
  pickup_info      text,
  order_greeting   text,
  order_closing    text,
  updated_at       timestamptz not null default now()
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Imagem principal: mantém products.main_image_path em dia
-- ---------------------------------------------------------------------
create or replace function public.refresh_product_main_image(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products p
     set main_image_path = (
       select i.storage_path
         from public.product_images i
        where i.product_id = p.id
        order by i.is_main desc, i.position asc, i.created_at asc
        limit 1)
   where p.id = p_product_id;
end;
$$;

revoke all on function public.refresh_product_main_image(uuid) from public;

create or replace function public.product_images_sync_main()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_product_main_image(old.product_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_product_main_image(new.product_id);
  end if;
  return null;
end;
$$;

create trigger product_images_sync_main
  after insert or update or delete on public.product_images
  for each row execute function public.product_images_sync_main();

-- ---------------------------------------------------------------------
-- Regras de publicação (defesa no banco, além da validação do formulário)
-- ---------------------------------------------------------------------
create or replace function public.enforce_publish_rules()
returns trigger
language plpgsql
as $$
declare
  missing text[] := '{}';
begin
  if new.status <> 'published' then
    return new;
  end if;

  if new.price is null or new.price <= 0 then
    missing := array_append(missing, 'um preço válido');
  end if;
  if new.category_id is null then
    missing := array_append(missing, 'uma categoria');
  end if;
  if new.main_image_path is null then
    missing := array_append(missing, 'ao menos uma imagem');
  end if;
  if tg_op = 'INSERT'
     or not exists (select 1 from public.product_variants v where v.product_id = new.id) then
    missing := array_append(missing, 'ao menos uma opção de compra (cor/tamanho ou peça única)');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'Não é possível publicar: falta %.', array_to_string(missing, ', ')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger products_enforce_publish_rules
  before insert or update on public.products
  for each row execute function public.enforce_publish_rules();

-- >>> 0002_rls.sql
-- =====================================================================
-- Global Tricot — 0002: Row Level Security
-- Regra geral: visitantes só LEEM o que está publicado; somente
-- administradores (public.admin_users) escrevem.
-- =====================================================================

alter table public.admin_users      enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images   enable row level security;
alter table public.store_settings   enable row level security;

-- Privilégios mínimos (o RLS continua sendo a barreira principal)
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

revoke insert, update, delete, truncate on
  public.categories, public.products, public.product_variants,
  public.product_images, public.store_settings
  from anon;
grant select on
  public.categories, public.products, public.product_variants,
  public.product_images, public.store_settings
  to anon;

-- admin_users: cada usuário só enxerga a própria linha (para o painel saber se é admin).
create policy "admin_users_select_own" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());

-- categories
create policy "categories_public_read" on public.categories
  for select to anon, authenticated
  using (active);
create policy "categories_admin_all" on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- products: público vê só publicados cuja categoria esteja ativa
create policy "products_public_read" on public.products
  for select to anon, authenticated
  using (
    status = 'published'
    and exists (select 1 from public.categories c where c.id = category_id and c.active)
  );
create policy "products_admin_all" on public.products
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- variantes e imagens: visíveis quando o produto-pai é visível (o RLS de products vale na subconsulta)
create policy "variants_public_read" on public.product_variants
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_variants.product_id));
create policy "variants_admin_all" on public.product_variants
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "images_public_read" on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id));
create policy "images_admin_all" on public.product_images
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- store_settings: leitura pública (dados são exibidos no site); escrita só admin
create policy "settings_public_read" on public.store_settings
  for select to anon, authenticated
  using (true);
create policy "settings_admin_write" on public.store_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- >>> 0003_storage.sql
-- =====================================================================
-- Global Tricot — 0003: Storage (imagens)
-- Bucket público para leitura (URLs públicas das fotos); upload, troca
-- e exclusão somente por administradores. Limite de 5 MB e só imagens.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "catalog_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'catalog' and public.is_admin());

create policy "catalog_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalog' and public.is_admin());

create policy "catalog_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog' and public.is_admin())
  with check (bucket_id = 'catalog' and public.is_admin());

create policy "catalog_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'catalog' and public.is_admin());

-- >>> 0004_seed.sql
-- =====================================================================
-- Global Tricot — 0004: dados iniciais (idempotente)
-- Categorias iniciais citadas no briefing e linha única de configurações.
-- NÃO cria produtos de exemplo e NÃO define número de WhatsApp.
-- Cidade e Instagram vieram da bio pública da loja — confirme no painel.
-- =====================================================================

insert into public.categories (name, slug, position) values
  ('Tricô',         'trico',         1),
  ('Blusas',        'blusas',        2),
  ('Regatas',       'regatas',       3),
  ('Moda Academia', 'moda-academia', 4)
on conflict (slug) do nothing;

insert into public.store_settings (id, store_name, instagram_url, city, location_text)
values (1, 'Global Tricot', 'https://www.instagram.com/globaltrico/', 'Toritama - PE', 'Q22 - Parque das Feiras')
on conflict (id) do nothing;
