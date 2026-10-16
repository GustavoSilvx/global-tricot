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
