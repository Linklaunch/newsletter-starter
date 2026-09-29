/**
 * Database driver selector.
 *
 * Production and any real deployment use `@vercel/postgres` exactly as before.
 * Setting USE_LOCAL_PGLITE=true swaps in the local PGlite shim so the app can be
 * run on a machine with no PostgreSQL server and no Docker. The shim is loaded
 * lazily, so production never pulls PGlite in.
 */
import {sql as vercelSql} from '@vercel/postgres'

type SqlFn = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<{rows: Record<string, unknown>[]; rowCount: number}>

type SqlApi = SqlFn & {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{rows: Record<string, unknown>[]; rowCount: number}>
}

const useLocal = process.env.USE_LOCAL_PGLITE === 'true'

async function local(): Promise<SqlApi> {
  const {localSql} = await import('./db-local')
  return localSql as unknown as SqlApi
}

const tagged: SqlFn = async (strings, ...values) => {
  if (!useLocal) return (vercelSql as unknown as SqlFn)(strings, ...values)
  return (await local())(strings, ...values)
}

export const sql: SqlApi = Object.assign(tagged, {
  query: async (text: string, params: unknown[] = []) => {
    if (!useLocal) {
      return (
        vercelSql as unknown as {
          query: (t: string, p: unknown[]) => Promise<{rows: Record<string, unknown>[]; rowCount: number}>
        }
      ).query(text, params)
    }
    return (await local()).query(text, params)
  },
})
