export class ConfigError extends Error {
  readonly code = 'config'
  constructor() {
    super('O Supabase ainda não está configurado neste ambiente.')
  }
}

interface ErrorLike {
  message?: string
  code?: string
  status?: number
  details?: string
}

/** Converte erros técnicos (Supabase, rede, validação) em mensagens úteis para a pessoa. */
export function friendlyError(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (error instanceof ConfigError) {
    return 'O Supabase ainda não está configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja docs/SETUP.md).'
  }
  const e = (error ?? {}) as ErrorLike
  const msg = e.message ?? ''

  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  }
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Este e-mail ainda não foi confirmado no Supabase.'
  if (/rate limit|too many requests/i.test(msg) || e.status === 429) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  }
  if (/jwt expired|invalid jwt|refresh token/i.test(msg)) return 'Sua sessão expirou. Entre novamente.'

  switch (e.code) {
    case '23505':
      return 'Já existe um registro com este valor. Verifique o endereço (slug) e o código do produto, que não podem se repetir.'
    case '23503':
      return 'Este item ainda está em uso por outros registros e não pode ser removido.'
    case '23514':
      return 'Algum valor não passou na validação do banco de dados. Confira preços, WhatsApp e tamanhos de texto.'
    case '42501':
      return 'Você não tem permissão para esta ação. Entre com uma conta de administrador.'
    case 'P0001':
      return msg || fallback
    case 'NO_ROWS':
    case 'PGRST116':
      return 'Nada foi alterado: você não tem permissão para esta ação ou o item não existe mais. Entre novamente como administrador e tente de novo.'
    case 'PGRST301':
      return 'Sua sessão expirou. Entre novamente.'
  }
  if (/row-level security|permission denied/i.test(msg)) {
    return 'Você não tem permissão para esta ação. Entre com uma conta de administrador.'
  }
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) {
    return 'O arquivo é maior que o limite permitido (5 MB).'
  }
  if (/mime type .* is not supported/i.test(msg)) return 'Tipo de arquivo não permitido. Use JPG, PNG ou WebP.'
  return fallback
}
