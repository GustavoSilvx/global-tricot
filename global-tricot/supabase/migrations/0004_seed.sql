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
