/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ProductInput } from './adminProducts'

interface Call { table: string; op: string; payload?: any; filters: [string, string, unknown][] }
const h = vi.hoisted(() => ({
  calls: [] as any[],
  handler: (_c: any): { data?: unknown; error?: unknown } => ({}),
  uploads: [] as string[],
  removed: [] as string[][],
}))

vi.mock('../lib/supabase', () => ({
  requireSupabase: () => ({
    from: (table: string) => {
      const call: Call = { table, op: 'select', filters: [] }
      const b: any = {
        insert: (p: unknown) => { call.op = 'insert'; call.payload = p; return b },
        update: (p: unknown) => { call.op = 'update'; call.payload = p; return b },
        delete: () => { call.op = 'delete'; return b },
        select: () => b,
        eq: (c: string, v: unknown) => { call.filters.push(['eq', c, v]); return b },
        in: (c: string, v: unknown) => { call.filters.push(['in', c, v]); return b },
        then: (res: any, rej: any) => {
          h.calls.push(call)
          const r = h.handler(call)
          const rows = r.data ?? (call.op === 'update' || call.op === 'delete' ? [{ id: 'row' }] : null)
          return Promise.resolve({ data: rows, error: r.error ?? null }).then(res, rej)
        },
      }
      return b
    },
  }),
}))
vi.mock('./storage', () => ({
  uploadImage: async (_s: string, _o: string, f: File) => { const p = `products/x/${f.name}`; h.uploads.push(p); return p },
  removeImages: async (paths: string[]) => { h.removed.push(paths) },
}))

import { saveProduct, SaveStageError } from './adminProducts'

const input = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: 'Blusa', slug: 'blusa', code: null, description: null, category_id: 'c1', price: 90, promotional_price: null,
  availability: 'available', track_stock: false, featured: false, status: 'published', ...over,
})
const variant = (over: object = {}) => ({ color: 'Rosa', color_hex: null, size: 'P', sku: null, stock_quantity: null, available: true, ...over })
const ops = () => h.calls.map((c: Call) => `${c.op}:${c.table}`)

beforeEach(() => {
  h.calls = []; h.uploads = []; h.removed = []
  h.handler = (c) => (c.table === 'product_images' && c.op === 'insert' ? { data: (c.payload as any[]).map((p, i) => ({ id: `img-${i}`, storage_path: p.storage_path })) } : {})
})

describe('saveProduct', () => {
  it('produto novo: entra como rascunho, grava opções e imagens e só então publica', async () => {
    const file = new File([new Uint8Array(10)], 'a.webp', { type: 'image/webp' })
    const r = await saveProduct(input(), [variant()], [{ file, alt_text: null, color_variant: null, is_main: false }])
    expect(r.status).toBe('published')
    const o = ops()
    expect(o[0]).toBe('insert:products')
    expect(h.calls[0].payload.status).toBe('draft') // nunca nasce publicado
    expect(o.indexOf('insert:product_variants')).toBeLessThan(o.indexOf('insert:product_images'))
    const last = h.calls[h.calls.length - 1]
    expect(last).toMatchObject({ table: 'products', op: 'update', payload: { status: 'published' } })
    // uma imagem única vira a principal mesmo sem marcação
    const mainUpdate = h.calls.filter((c: Call) => c.table === 'product_images' && c.op === 'update' && c.payload.is_main === true)
    expect(mainUpdate).toHaveLength(1)
  })

  it('banco recusa a publicação: produto fica como rascunho e a mensagem volta para a tela', async () => {
    const base = h.handler
    h.handler = (c) => (c.table === 'products' && c.op === 'update' && c.payload.status === 'published'
      ? { error: { code: 'P0001', message: 'Não é possível publicar: falta ao menos uma imagem.' } } : base(c))
    const r = await saveProduct(input(), [variant()], [])
    expect(r.status).toBe('draft')
    expect(r.publishError).toMatch(/falta ao menos uma imagem/)
  })

  it('falha ao salvar imagens apaga os arquivos recém-enviados e informa a etapa', async () => {
    const base = h.handler
    h.handler = (c) => (c.table === 'product_images' && c.op === 'insert' ? { error: { code: '42501', message: 'row-level security' } } : base(c))
    const file = new File([new Uint8Array(10)], 'nova.webp', { type: 'image/webp' })
    await expect(saveProduct(input({ status: 'draft' }), [variant()], [{ file, alt_text: null, color_variant: null, is_main: true }]))
      .rejects.toMatchObject({ stage: 'imagens' })
    expect(h.removed).toEqual([['products/x/nova.webp']])
    await expect(saveProduct(input({ status: 'draft' }), [variant()], [{ file, alt_text: null, color_variant: null, is_main: true }])).rejects.toBeInstanceOf(SaveStageError)
  })

  it('editar produto já publicado: não rebaixa o status e só remove as opções/imagens antigas depois de criar as novas', async () => {
    await saveProduct(
      input({ id: 'p1' }),
      [variant({ id: 'v-keep' }), variant({ size: 'M' })],
      [{ id: 'i-keep', storage_path: 'products/p1/keep.webp', alt_text: null, color_variant: null, is_main: true },
       { file: new File([new Uint8Array(5)], 'n.webp', { type: 'image/webp' }), alt_text: null, color_variant: null, is_main: false }],
      { status: 'published', variantIds: ['v-keep', 'v-old'], images: [{ id: 'i-keep', storage_path: 'products/p1/keep.webp' }, { id: 'i-old', storage_path: 'products/p1/old.webp' }] },
    )
    const first = h.calls[0]
    expect(first).toMatchObject({ table: 'products', op: 'update', payload: { status: 'published' } })
    const idx = (table: string, op: string) => h.calls.findIndex((c: Call) => c.table === table && c.op === op)
    const lastIdx = (table: string, op: string) => h.calls.map((c: Call) => `${c.op}:${c.table}`).lastIndexOf(`${op}:${table}`)
    expect(idx('product_variants', 'insert')).toBeLessThan(idx('product_variants', 'delete'))
    expect(idx('product_images', 'insert')).toBeLessThan(lastIdx('product_images', 'delete'))
    expect(h.calls.find((c: Call) => c.table === 'product_variants' && c.op === 'delete')?.filters).toEqual([['in', 'id', ['v-old']]])
    expect(h.calls.find((c: Call) => c.table === 'product_images' && c.op === 'delete')?.filters).toEqual([['in', 'id', ['i-old']]])
    expect(h.removed).toEqual([['products/p1/old.webp']]) // arquivo antigo some do Storage
    // não houve segunda atualização de status (já estava publicado)
    expect(h.calls.filter((c: Call) => c.table === 'products' && c.payload?.status === 'published')).toHaveLength(1)
  })

  it('erro ao salvar o produto aborta antes de mexer em opções e imagens', async () => {
    h.handler = (c) => (c.table === 'products' ? { error: { code: '23505', message: 'duplicate key' } } : {})
    await expect(saveProduct(input(), [variant()], [])).rejects.toMatchObject({ stage: 'produto' })
    expect(ops()).toEqual(['insert:products'])
  })
})
