/**
 * LOCAL DEVELOPMENT ONLY - do not commit, do not deploy.
 *
 * `@vercel/postgres` speaks Neon's WebSocket protocol and cannot talk to a plain
 * local PostgreSQL server. This shim provides the same small surface that
 * `journalist/runs-log.ts` uses - a tagged template plus `.query()` - backed by
 * PGlite, which is PostgreSQL compiled to WebAssembly and runs in-process with
 * no server to install.
 *
 * Activated only when USE_LOCAL_PGLITE=true. Production keeps @vercel/postgres.
 */
import type {PGlite} from '@electric-sql/pglite'

export interface QueryResultLike {
  rows: Record<string, unknown>[]
  rowCount: number
  fields: unknown[]
  command: string
}

const DEFAULT_DATA_DIR = 'C:/tmp/careersignal-pglite'

// Next.js dev reloads modules; keep one database across reloads.
const globalStore = globalThis as unknown as {__pglite?: Promise<PGlite>}

async function getDb(): Promise<PGlite> {
  if (!globalStore.__pglite) {
    globalStore.__pglite = (async () => {
      const {PGlite: Ctor} = await import('@electric-sql/pglite')
      const dataDir = process.env.PGLITE_DATA_DIR ?? DEFAULT_DATA_DIR
      return new Ctor(dataDir)
    })()
  }
  return globalStore.__pglite
}

function toResult(raw: {
  rows: unknown[]
  fields?: unknown[]
  affectedRows?: number
}): QueryResultLike {
  const rows = (raw.rows ?? []) as Record<string, unknown>[]
  return {
    rows,
    rowCount: raw.affectedRows ?? rows.length,
    fields: raw.fields ?? [],
    command: '',
  }
}

/** Run a parameterised statement, mirroring `sql.query(text, params)`. */
export async function query(
  text: string,
  params: unknown[] = []
): Promise<QueryResultLike> {
  const db = await getDb()
  return toResult(await db.query(text, params))
}

/**
 * Tagged template mirroring `sql\`SELECT ... ${value}\``.
 * Interpolated values become $1, $2, ... so they stay parameterised.
 */
function tagged(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResultLike> {
  let text = ''
  strings.forEach((chunk, i) => {
    text += chunk
    if (i < values.length) text += `$${i + 1}`
  })
  return query(text, values)
}

export const localSql = Object.assign(tagged, {query})
