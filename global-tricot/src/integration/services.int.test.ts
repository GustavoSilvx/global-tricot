/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminClient, anonClient, sql, userClient } from './helpers'

const ctx = vi.hoisted(() => ({ client: null as unknown as SupabaseClient, removed: [] as string[][] }))
vi.mock('../lib/supabase', () => ({
  requireSupabase: () => ctx.client,
  supabase: null,
  isSupabaseConfigured: true,
  STORAGE_BUCKET: 'catalog',
  publicImageUrl: (p: string | null) => (p ? `https://img.test/${p}` : null),
}))
// O Storage não existe fora do Supabase: simulamos só o envio/remoção de arquivos.
vi.mock('../services/storage', () => ({
  uploadImage: async (_s: string, owner: string, f: File) => `products/${owner}/${f.name}`,
  removeImages: async (p: string[]) => { ctx.removed.push(p) },
}))

import { fetchFreshVariants, fetchProductBySlug, fetchPublishedProducts } from '../services/catalog'
import { adminDashboardCounts, adminGetProduct, adminListProducts, deleteProduct, saveProduct, updateProductFlags, type ProductInput } from '../services/adminProducts'
import { adminListCategories, deleteCategory, fetchActiveCategories, saveCategory } from '../services/categories'
import { fetchStoreSettings, saveStoreSettings } from '../services/settings'
import { friendlyError } from '../lib/errors'

const as = (c: SupabaseClient) => { ctx.client = c }
const file = (name: string) => new File([new Uint8Array(8)], name, { type: 'image/webp' })
const base = (o: Partial<ProductInput> = {}): ProductInput => ({
  name: 'Blusa Canelada', slug: 'blusa-canelada', code: 'BC-1', description: 'Tricô canelado', category_id: null,
  price: 89.9, promotional_price: null, availability: 'available', track_stock: false, featured: true, status: 'published', ...o,
})
const v = (color: string | null, size: string | null, o: object = {}) => ({ color, color_hex: null, size, sku: null, stock_quantity: null, available: true, ...o })

let catTrico = ''
let pubId = ''

beforeAll(() => { as(anonClient()) })

describe('integração: leitura pública (visitante)', () => {
  it('lê só categorias ativas e a linha de configurações', async () => {
    const cats = await fetchActiveCategories()
    expect(cats.map((c) => c.slug)).toEqual(['trico', 'blusas', 'regatas', 'moda-academia'])
    catTrico = cats[0].id
    const s = await fetchStoreSettings()
    expect(s).toMatchObject({ id: 1, store_name: 'Global Tricot', whatsapp_number: null })
  })
  it('catálogo vazio no início (sem produtos de exemplo)', async () => {
    expect(await fetchPublishedProducts()).toEqual([])
  })
})

describe('integração: administração (RLS + triggers reais)', () => {
  it('salva rascunho incompleto (só nome) sem exigir preço, categoria ou fotos', async () => {
    as(adminClient())
    const r = await saveProduct(base({ name: 'Rascunho', slug: 'rascunho', code: null, description: null, price: null, featured: false, status: 'draft' }), [], [])
    expect(r).toMatchObject({ status: 'draft' })
    const p = await adminGetProduct(r.id)
    expect(p).toMatchObject({ status: 'draft', price: null, category_id: null })
  })

  it('banco recusa publicar rascunho incompleto e diz o que falta', async () => {
    as(adminClient())
    const [draft] = (await adminListProducts()).filter((p) => p.slug === 'rascunho')
    let err: any
    try { await updateProductFlags(draft.id, { status: 'published' }) } catch (e) { err = e }
    expect(err?.code).toBe('P0001')
    expect(friendlyError(err)).toMatch(/Não é possível publicar: falta um preço válido, uma categoria, ao menos uma imagem, ao menos uma opção/)
  })

  it('cria e publica produto completo (fotos + cores/tamanhos); trigger define a imagem principal', async () => {
    as(adminClient())
    const r = await saveProduct(
      base({ category_id: catTrico, promotional_price: 69.9 }),
      [v('Rosa', 'P'), v('Rosa', 'M'), v('Preto', 'P', { available: false })],
      [
        { file: file('geral.webp'), alt_text: 'Blusa rosa', color_variant: null, is_main: false },
        { file: file('preto.webp'), alt_text: null, color_variant: 'Preto', is_main: true },
      ],
    )
    pubId = r.id
    expect(r).toMatchObject({ status: 'published' })
    const p = await adminGetProduct(pubId)
    expect(p?.status).toBe('published')
    expect(p?.product_variants).toHaveLength(3)
    expect(p?.product_images.filter((i) => i.is_main)).toHaveLength(1)
    expect(p?.main_image_path).toMatch(/preto\.webp$/) // a principal escolhida
    expect(p?.price).toBe(89.9)
    expect(p?.promotional_price).toBe(69.9)
  })

  it('slug repetido é recusado com mensagem amigável', async () => {
    as(adminClient())
    let err: unknown
    try { await saveProduct(base({ category_id: catTrico }), [v(null, null)], [{ file: file('x.webp'), alt_text: null, color_variant: null, is_main: true }]) } catch (e: any) { err = e.cause ?? e }
    expect((err as any).code).toBe('23505')
    expect(friendlyError(err)).toMatch(/Já existe um registro/)
  })
})

describe('integração: o que o visitante enxerga depois', () => {
  beforeAll(() => as(anonClient()))

  it('só o publicado, com categoria, variantes e imagens embutidas', async () => {
    const list = await fetchPublishedProducts()
    expect(list).toHaveLength(1)
    const p = list[0]
    expect(p).toMatchObject({ name: 'Blusa Canelada', code: 'BC-1', price: 89.9, promotional_price: 69.9, featured: true })
    expect(p.category).toMatchObject({ slug: 'trico', active: true })
    expect(p.product_variants.map((x) => `${x.color}/${x.size}`)).toEqual(['Rosa/P', 'Rosa/M', 'Preto/P'])
    expect(p.product_images).toHaveLength(2)
    expect(typeof p.price).toBe('number')
  })
  it('detalhe por slug: achado para publicado, nulo para rascunho', async () => {
    expect((await fetchProductBySlug('blusa-canelada'))?.id).toBe(pubId)
    expect(await fetchProductBySlug('rascunho')).toBeNull()
  })
  it('dados atuais do carrinho (preço/estoque) só para produtos visíveis', async () => {
    as(adminClient())
    const full = await adminGetProduct(pubId)
    const ids = full!.product_variants.map((x) => x.id)
    as(anonClient())
    const fresh = await fetchFreshVariants(ids)
    expect(fresh).toHaveLength(3)
    expect(fresh.find((f) => f.color === 'Rosa' && f.size === 'P')).toMatchObject({ price: 89.9, promotionalPrice: 69.9, productStatus: 'published', availability: 'available' })
    expect(fresh.find((f) => f.color === 'Preto')?.variantAvailable).toBe(false)
    // variante de um rascunho não volta (=> "removed" no carrinho)
    as(adminClient())
    const [draft] = (await adminListProducts()).filter((p) => p.slug === 'rascunho')
    await saveProduct({ ...base({ name: 'Rascunho', slug: 'rascunho', code: null, description: null, price: null, status: 'draft', featured: false }), id: draft.id }, [v('Azul', 'G')], [], { status: 'draft', variantIds: [], images: [] })
    const draftFull = await adminGetProduct(draft.id)
    as(anonClient())
    expect(await fetchFreshVariants([draftFull!.product_variants[0].id])).toEqual([])
  })
  it('visitante não consegue escrever nada', async () => {
    let err: any
    try { await updateProductFlags(pubId, { featured: false }) } catch (e) { err = e }
    expect(err?.code).toBe('42501')
    let err2: any
    try { await saveStoreSettings({ whatsapp_number: '5511999999999' }) } catch (e) { err2 = e }
    expect(err2).toBeTruthy()
    expect((await fetchStoreSettings())?.whatsapp_number).toBeNull()
  })
  it('usuário comum (logado, não admin) também não escreve nem vê rascunhos', async () => {
    as(userClient())
    expect((await fetchPublishedProducts())).toHaveLength(1)
    let err: any
    try { await updateProductFlags(pubId, { featured: false }) } catch (e) { err = e }
    expect(err).toBeTruthy() // RLS: nenhuma linha afetada / sem permissão
    const { data } = await ctx.client.from('products').select('id').eq('slug', 'rascunho')
    expect(data).toEqual([])
    const { error } = await ctx.client.from('admin_users').insert({ user_id: '99999999-0000-0000-0000-000000000009' })
    expect(error).toBeTruthy()
  })
})

describe('integração: painel (listas, contagens, edição)', () => {
  beforeAll(() => as(adminClient()))

  it('lista todos os status com categoria e calcula os indicadores com dados reais', async () => {
    const rows = await adminListProducts()
    expect(rows.map((r) => r.slug).sort()).toEqual(['blusa-canelada', 'rascunho'])
    expect(rows.find((r) => r.slug === 'blusa-canelada')?.category?.name).toBe('Tricô')
    expect(await adminDashboardCounts()).toEqual({ total: 2, published: 1, draft: 1, archived: 0, unavailable: 0, featured: 1 })
    await updateProductFlags(pubId, { availability: 'unavailable' })
    expect((await adminDashboardCounts()).unavailable).toBe(1)
    await updateProductFlags(pubId, { availability: 'available' })
  })

  it('edição: troca opções e fotos mantendo o publicado válido; principal é recalculada pelo banco', async () => {
    const before = (await adminGetProduct(pubId))!
    const keepVariant = before.product_variants.find((x) => x.color === 'Rosa' && x.size === 'P')!
    const keepImage = before.product_images.find((i) => i.storage_path.endsWith('geral.webp'))!
    const removedImagePath = before.product_images.find((i) => i.storage_path.endsWith('preto.webp'))!.storage_path
    ctx.removed = []
    const r = await saveProduct(
      { ...base({ category_id: catTrico, promotional_price: null, name: 'Blusa Canelada Premium' }), id: pubId },
      [{ ...v('Rosa', 'P'), id: keepVariant.id, stock_quantity: 5 }, v('Rosa', 'G')],
      [{ id: keepImage.id, storage_path: keepImage.storage_path, alt_text: 'nova alt', color_variant: null, is_main: false },
       { file: file('nova.webp'), alt_text: null, color_variant: 'Rosa', is_main: true }],
      { status: 'published', variantIds: before.product_variants.map((x) => x.id), images: before.product_images.map((i) => ({ id: i.id, storage_path: i.storage_path })) },
    )
    expect(r.status).toBe('published')
    const after = (await adminGetProduct(pubId))!
    expect(after.name).toBe('Blusa Canelada Premium')
    expect(after.promotional_price).toBeNull()
    expect(after.product_variants.map((x) => `${x.color}/${x.size}`).sort()).toEqual(['Rosa/G', 'Rosa/P'])
    expect(after.product_variants.find((x) => x.size === 'P')?.id).toBe(keepVariant.id) // id preservado
    expect(after.product_variants.find((x) => x.size === 'P')?.stock_quantity).toBe(5)
    expect(after.product_images).toHaveLength(2)
    expect(after.main_image_path).toMatch(/nova\.webp$/)
    expect(ctx.removed).toEqual([[removedImagePath]])
  })

  it('categorias: contagem embutida de produtos (o rascunho não tem categoria)', async () => {
    const cats = await adminListCategories()
    expect(cats.find((c) => c.slug === 'trico')?.product_count).toBe(1)
    expect(cats.find((c) => c.slug === 'blusas')?.product_count).toBe(0)
  })

  it('não exclui categoria em uso (mensagem clara) e exclui uma vazia', async () => {
    const cats = await adminListCategories()
    const trico = cats.find((c) => c.slug === 'trico')!
    await expect(deleteCategory(trico)).rejects.toThrow(/ainda tem 1 produto/)
    const nova = await saveCategory({ name: 'Temporária', slug: 'temporaria', description: null, cover_image_path: null, active: true, position: 9 })
    await deleteCategory(nova)
    expect((await adminListCategories()).some((c) => c.slug === 'temporaria')).toBe(false)
  })

  it('desativar a categoria esconde os produtos dela do visitante; reativar traz de volta', async () => {
    const trico = (await adminListCategories()).find((c) => c.slug === 'trico')!
    await saveCategory({ id: trico.id, name: trico.name, slug: trico.slug, description: trico.description, cover_image_path: trico.cover_image_path, active: false, position: trico.position })
    as(anonClient())
    expect(await fetchPublishedProducts()).toHaveLength(0)
    expect(await fetchProductBySlug('blusa-canelada')).toBeNull()
    expect((await fetchActiveCategories()).map((c) => c.slug)).not.toContain('trico')
    as(adminClient())
    await saveCategory({ id: trico.id, name: trico.name, slug: trico.slug, description: trico.description, cover_image_path: trico.cover_image_path, active: true, position: trico.position })
    as(anonClient())
    expect(await fetchPublishedProducts()).toHaveLength(1)
    as(adminClient())
  })

  it('configurações: upsert pelo admin; número fora do padrão é recusado pelo banco', async () => {
    const saved = await saveStoreSettings({ whatsapp_number: '5581999999999', city: 'Toritama - PE', delivery_info: 'Entrega local' })
    expect(saved.whatsapp_number).toBe('5581999999999')
    let err: any
    try { await saveStoreSettings({ whatsapp_number: '81999999999' }) } catch (e) { err = e }
    expect(err?.code).toBe('23514')
    expect(friendlyError(err)).toMatch(/validação do banco/)
    as(anonClient())
    expect((await fetchStoreSettings())?.whatsapp_number).toBe('5581999999999') // visitantes recebem o valor salvo
    as(adminClient())
  })

  it('excluir produto remove imagens e opções (cascata) e apaga os arquivos do Storage', async () => {
    ctx.removed = []
    const before = (await adminGetProduct(pubId))!
    await deleteProduct(pubId)
    expect(await adminGetProduct(pubId)).toBeNull()
    expect(ctx.removed.flat().sort()).toEqual(before.product_images.map((i) => i.storage_path).sort())
    expect(sql(`select count(*) from product_variants where product_id='${pubId}'`)).toBe('0')
    expect(sql(`select count(*) from product_images where product_id='${pubId}'`)).toBe('0')
  })
})

describe('integração: catálogo grande (limite de 1000 linhas por requisição do PostgREST)', () => {
  it('busca TODAS as páginas: 1.250 produtos publicados chegam completos, sem duplicar', async () => {
    sql(`
      insert into products (name, slug, category_id, price, status)
        select 'Massa ' || g, 'massa-' || g, (select id from categories where slug='blusas'), 10 + (g % 90), 'draft' from generate_series(1,1250) g;
      insert into product_variants (product_id, color, size) select id, 'Rosa', 'M' from products where slug like 'massa-%';
      insert into product_images (product_id, storage_path, is_main) select id, 'products/massa/' || slug || '.webp', true from products where slug like 'massa-%';
      update products set status='published' where slug like 'massa-%';
    `)
    as(anonClient())
    const all = await fetchPublishedProducts()
    expect(all).toHaveLength(1250)
    expect(new Set(all.map((p) => p.id)).size).toBe(1250)
    expect(all[0].product_variants.length).toBe(1)
    as(adminClient())
    expect(await adminListProducts()).toHaveLength(1251) // + o rascunho
    expect((await adminDashboardCounts()).published).toBe(1250)
  })
})
