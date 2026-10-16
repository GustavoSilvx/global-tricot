-- Testes de RLS/regras. Cada bloco imprime PASS/FAIL.
\set ON_ERROR_STOP off
create or replace function pg_temp.expect(label text, ok boolean) returns void language plpgsql as $$
begin raise notice '% : %', case when ok then 'PASS' else 'FAIL' end, label; end $$;

-- Usuários: admin e comum
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001','admin@loja.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002','cliente@loja.test');
insert into public.admin_users (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');

-- Dados como superusuário: 1 publicado completo, 1 rascunho, 1 de categoria inativa
insert into public.categories (id,name,slug,active) values
  ('c0000000-0000-0000-0000-000000000001','Tricô','trico-t',true),
  ('c0000000-0000-0000-0000-000000000002','Oculta','oculta',false);
insert into public.products (id,name,slug,category_id,price,status) values
  ('d0000000-0000-0000-0000-000000000001','Blusa Pub','blusa-pub','c0000000-0000-0000-0000-000000000001',89.90,'draft'),
  ('d0000000-0000-0000-0000-000000000002','Blusa Rascunho','blusa-rasc',null,null,'draft'),
  ('d0000000-0000-0000-0000-000000000003','Blusa Oculta','blusa-oculta','c0000000-0000-0000-0000-000000000002',50,'draft');
insert into public.product_variants (product_id,color,size) values
  ('d0000000-0000-0000-0000-000000000001','Rosa','P'),
  ('d0000000-0000-0000-0000-000000000003','Azul','M');
insert into public.product_images (product_id,storage_path,is_main) values
  ('d0000000-0000-0000-0000-000000000001','products/a.webp',true),
  ('d0000000-0000-0000-0000-000000000003','products/c.webp',true);
select pg_temp.expect('trigger sincroniza main_image_path', (select main_image_path='products/a.webp' from public.products where slug='blusa-pub'));
update public.products set status='published' where slug in ('blusa-pub','blusa-oculta');
select pg_temp.expect('publicação válida passa', (select count(*)=2 from public.products where status='published'));

-- Regras de publicação (como superusuário também valem: são triggers)
do $$ begin
  begin update public.products set status='published' where slug='blusa-rasc'; perform pg_temp.expect('publicar rascunho incompleto é bloqueado', false);
  exception when sqlstate 'P0001' then raise notice 'PASS : publicar rascunho incompleto é bloqueado -> %', sqlerrm; end;
  begin update public.products set promotional_price=100 where slug='blusa-pub'; perform pg_temp.expect('promo >= preço bloqueada', false);
  exception when check_violation then raise notice 'PASS : promo >= preço bloqueada'; end;
  begin insert into public.product_variants (product_id,color,size) values ('d0000000-0000-0000-0000-000000000001','rosa','p'); perform pg_temp.expect('variante duplicada (case-insens.) bloqueada', false);
  exception when unique_violation then raise notice 'PASS : variante duplicada (case-insens.) bloqueada'; end;
  begin delete from public.product_images where product_id='d0000000-0000-0000-0000-000000000001'; perform pg_temp.expect('remover última imagem de publicado é bloqueado', false);
  exception when sqlstate 'P0001' then raise notice 'PASS : remover última imagem de publicado é bloqueado'; end;
  begin update public.store_settings set whatsapp_number='81999999999'; perform pg_temp.expect('whatsapp sem 55 bloqueado', false);
  exception when check_violation then raise notice 'PASS : whatsapp sem 55 bloqueado'; end;
end $$;
update public.store_settings set whatsapp_number='5581999999999';
select pg_temp.expect('whatsapp válido (55+DDD+número) aceito', (select whatsapp_number='5581999999999' from public.store_settings));

-- ===== VISITANTE (anon)
set role anon;
select pg_temp.expect('anon vê só o produto publicado visível (1)', (select count(*)=1 from public.products));
select pg_temp.expect('anon não vê produto de categoria inativa', (select count(*)=0 from public.products where slug='blusa-oculta'));
select pg_temp.expect('anon vê variantes só do visível', (select count(*)=1 from public.product_variants));
select pg_temp.expect('anon vê imagens só do visível', (select count(*)=1 from public.product_images));
select pg_temp.expect('anon vê só categorias ativas', (select count(*)=1 from public.categories where slug in ('trico-t','oculta')));
select pg_temp.expect('anon lê configurações', (select count(*)=1 from public.store_settings));
do $$ begin
  begin update public.products set price=1; perform pg_temp.expect('anon UPDATE bloqueado', false); exception when insufficient_privilege then raise notice 'PASS : anon UPDATE bloqueado (privilégio)'; end;
  begin insert into public.products (name,slug) values ('x','x'); perform pg_temp.expect('anon INSERT bloqueado', false); exception when insufficient_privilege then raise notice 'PASS : anon INSERT bloqueado (privilégio)'; end;
  begin delete from public.categories; perform pg_temp.expect('anon DELETE bloqueado', false); exception when insufficient_privilege then raise notice 'PASS : anon DELETE bloqueado (privilégio)'; end;
  begin perform 1 from public.admin_users; perform pg_temp.expect('anon lê admin_users bloqueado', false); exception when insufficient_privilege then raise notice 'PASS : anon não lê admin_users'; end;
  begin insert into storage.objects (bucket_id,name) values ('catalog','products/hack.webp'); perform pg_temp.expect('anon upload bloqueado', false); exception when insufficient_privilege or sqlstate '42501' then raise notice 'PASS : anon upload bloqueado (RLS storage)'; end;
end $$;
reset role;

-- ===== USUÁRIO COMUM autenticado (não admin)
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002', false);
select pg_temp.expect('comum: is_admin() = false', not public.is_admin());
select pg_temp.expect('comum: vê só publicado visível (1)', (select count(*)=1 from public.products));
do $$ begin
  begin update public.products set price=1 where slug='blusa-pub'; if found then perform pg_temp.expect('comum UPDATE em products bloqueado', false); else raise notice 'PASS : comum UPDATE não afeta nenhuma linha (RLS)'; end if;
  exception when others then raise notice 'PASS : comum UPDATE bloqueado (%)', sqlerrm; end;
  begin insert into public.products (name,slug) values ('x','x'); perform pg_temp.expect('comum INSERT bloqueado', false); exception when others then raise notice 'PASS : comum INSERT bloqueado (%)', sqlerrm; end;
  begin insert into public.admin_users (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002'); perform pg_temp.expect('auto-promoção a admin bloqueada', false); exception when others then raise notice 'PASS : auto-promoção a admin bloqueada (%)', sqlerrm; end;
  begin insert into storage.objects (bucket_id,name) values ('catalog','products/hack.webp'); perform pg_temp.expect('comum upload bloqueado', false); exception when others then raise notice 'PASS : comum upload bloqueado (%)', sqlerrm; end;
end $$;
select pg_temp.expect('comum não lê admin_users de outros', (select count(*)=0 from public.admin_users));
reset role;

-- ===== ADMIN
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001', false);
select pg_temp.expect('admin: is_admin() = true', public.is_admin());
select pg_temp.expect('admin: vê todos os 3 produtos (incl. rascunho/oculto)', (select count(*)=3 from public.products));
select pg_temp.expect('admin: vê categoria inativa', (select count(*)=2 from public.categories where slug in ('trico-t','oculta')));
select pg_temp.expect('admin lê a própria linha em admin_users', (select count(*)=1 from public.admin_users));
update public.products set name='Blusa Pub 2' where slug='blusa-pub';
select pg_temp.expect('admin UPDATE funciona', (select name='Blusa Pub 2' from public.products where slug='blusa-pub'));
insert into public.categories (name,slug) values ('Nova','nova');
select pg_temp.expect('admin INSERT categoria funciona', (select count(*)=1 from public.categories where slug='nova'));
insert into storage.objects (bucket_id,name) values ('catalog','products/ok.webp');
select pg_temp.expect('admin upload funciona', (select count(*)=1 from storage.objects where name='products/ok.webp'));
update public.store_settings set city='Toritama';
select pg_temp.expect('admin altera configurações', (select city='Toritama' from public.store_settings));
do $$ begin
  begin delete from public.categories where slug='trico-t'; perform pg_temp.expect('excluir categoria em uso é bloqueado (RESTRICT)', false);
  exception when foreign_key_violation then raise notice 'PASS : excluir categoria em uso é bloqueado (RESTRICT)'; end;
end $$;
reset role;
