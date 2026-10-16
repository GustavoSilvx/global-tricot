import type { VariantInput } from '../services/adminProducts'

export interface ColorOption {
  name: string
  hex: string
}

export interface MatrixCell {
  key: string
  color: string | null
  hex: string | null
  size: string | null
}

export interface RowData {
  id?: string
  available: boolean
  stock: string
  sku: string
}

export const variantKey = (color: string | null, size: string | null): string =>
  `${(color ?? '').trim().toLowerCase()}|${(size ?? '').trim().toLowerCase()}`

/** Todas as combinações cor x tamanho. Sem cores e sem tamanhos = uma única peça. */
export function buildMatrix(colors: ColorOption[], sizes: string[]): MatrixCell[] {
  const cs: (ColorOption | null)[] = colors.length ? colors : [null]
  const ss: (string | null)[] = sizes.length ? sizes : [null]
  const cells: MatrixCell[] = []
  for (const c of cs) {
    for (const s of ss) {
      cells.push({ key: variantKey(c?.name ?? null, s), color: c?.name ?? null, hex: c?.hex || null, size: s })
    }
  }
  return cells
}

export const defaultRow = (): RowData => ({ available: true, stock: '', sku: '' })

/** Converte a matriz + dados de cada linha nas variantes que serão gravadas. */
export function matrixToInputs(matrix: MatrixCell[], data: Record<string, RowData>): VariantInput[] {
  return matrix.map((cell) => {
    const row = data[cell.key] ?? defaultRow()
    const stock = row.stock.trim() === '' ? null : Number.parseInt(row.stock, 10)
    return {
      id: row.id,
      color: cell.color,
      color_hex: cell.hex && /^#[0-9a-fA-F]{6}$/.test(cell.hex) ? cell.hex : null,
      size: cell.size,
      sku: row.sku.trim() || null,
      stock_quantity: stock != null && Number.isFinite(stock) ? stock : null,
      available: row.available,
    }
  })
}

/** Alguma opção ativa está sem quantidade (relevante quando o estoque é controlado). */
export function hasMissingStock(matrix: MatrixCell[], data: Record<string, RowData>): boolean {
  return matrix.some((cell) => (data[cell.key]?.stock ?? '').trim() === '')
}

export function hasInvalidStock(matrix: MatrixCell[], data: Record<string, RowData>): boolean {
  return matrix.some((cell) => {
    const s = (data[cell.key]?.stock ?? '').trim()
    return s !== '' && !/^\d+$/.test(s)
  })
}
