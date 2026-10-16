/**
 * Com RLS, um UPDATE/DELETE sem permissão NÃO dá erro: apenas afeta 0 linhas.
 * Por isso toda escrita pede as linhas de volta (.select) e confirma que algo mudou,
 * para nunca mostrar "sucesso" quando nada foi gravado.
 */
export class NoRowsError extends Error {
  readonly code = 'NO_ROWS'
  constructor(what = 'a alteração') {
    super(`Nenhuma linha afetada em ${what}.`)
  }
}

export function assertAffected(result: { data: unknown[] | null; error: unknown }, what?: string): void {
  if (result.error) throw result.error
  if (!result.data || result.data.length === 0) throw new NoRowsError(what)
}
