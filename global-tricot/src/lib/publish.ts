export interface PublishCheckInput {
  name: string
  price: number | null
  promotionalPrice: number | null
  categoryId: string | null
  imageCount: number
  variantCount: number
  trackStock: boolean
  /** Existe alguma opção sem quantidade informada. */
  stockMissing: boolean
}

/** Erros que impedem salvar, em qualquer status (inclusive rascunho). */
export function getBlockingErrors(input: Pick<PublishCheckInput, 'name' | 'price' | 'promotionalPrice'>): string[] {
  const errors: string[] = []
  if (!input.name.trim()) errors.push('Informe o nome do produto.')
  if (input.price != null && input.promotionalPrice != null && input.promotionalPrice >= input.price) {
    errors.push('O preço promocional precisa ser menor que o preço normal.')
  }
  return errors
}

/** O que falta para o produto poder ser publicado (vazio = pronto). */
export function getPublishIssues(input: PublishCheckInput): string[] {
  const issues: string[] = []
  if (!input.name.trim()) issues.push('Informe o nome do produto.')
  if (input.price == null || input.price <= 0) issues.push('Informe um preço válido, maior que zero.')
  if (!input.categoryId) issues.push('Escolha uma categoria.')
  if (input.imageCount < 1) issues.push('Envie pelo menos uma imagem.')
  if (input.variantCount < 1) issues.push('Cadastre pelo menos uma opção de compra (cor, tamanho ou peça única).')
  if (input.trackStock && input.stockMissing) issues.push('Com controle de estoque ligado, informe a quantidade de cada opção.')
  return issues
}
