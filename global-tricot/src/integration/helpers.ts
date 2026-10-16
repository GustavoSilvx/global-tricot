import { createHmac } from 'node:crypto'
import { execSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const URL_ = process.env.IT_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SECRET = process.env.IT_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long'
export const ADMIN_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
export const USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002'

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
export function sign(payload: Record<string, unknown>): string {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ exp: 4102444800, ...payload })
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

const anonKey = sign({ role: 'anon' })
function client(bearer: string): SupabaseClient {
  return createClient(URL_, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  })
}
export const anonClient = () => client(anonKey)
export const userClient = () => client(sign({ role: 'authenticated', sub: USER_ID }))
export const adminClient = () => client(sign({ role: 'authenticated', sub: ADMIN_ID }))

/** Executa SQL como superusuário no banco de teste (só para preparar dados em massa). */
export function sql(query: string): string {
  const db = process.env.IT_DB ?? 'gt_int'
  return execSync(`su postgres -c 'psql -q -t -A -d ${db}' `, { input: query, encoding: 'utf8' }).trim()
}
