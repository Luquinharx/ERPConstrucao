import { Pool, type PoolClient } from "pg"

/**
 * Ligacao ao PostgreSQL (na VM Oracle, so em 127.0.0.1).
 *
 * Em desenvolvimento a mesma variavel aponta para o tunel SSH (localhost:5433).
 * O pool fica guardado no globalThis para o recarregamento a quente do Next nao
 * abrir ligacoes novas a cada alteracao.
 */
const globalPg = globalThis as unknown as { __erpPool?: Pool; __erpEsquema?: Promise<void> }

export function pool(): Pool {
  if (!globalPg.__erpPool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("DATABASE_URL nao definido.")
    globalPg.__erpPool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 })
  }
  return globalPg.__erpPool
}

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS documentos (
  colecao       text        NOT NULL,
  id            text        NOT NULL,
  dados         jsonb       NOT NULL,
  versao        integer     NOT NULL DEFAULT 1,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (colecao, id)
);
CREATE INDEX IF NOT EXISTS documentos_dados_idx ON documentos USING gin (dados jsonb_path_ops);

CREATE TABLE IF NOT EXISTS contas (
  uid           text        PRIMARY KEY,
  email         text        NOT NULL,
  nome          text,
  hash          text,
  -- conta trazida do Firebase: a palavra-passe confirma-se la no primeiro login
  firebase      boolean     NOT NULL DEFAULT false,
  desativada    boolean     NOT NULL DEFAULT false,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contas_email_idx ON contas (lower(email));

CREATE TABLE IF NOT EXISTS sessoes (
  id         text        PRIMARY KEY,
  uid        text        NOT NULL REFERENCES contas(uid) ON DELETE CASCADE,
  criada_em  timestamptz NOT NULL DEFAULT now(),
  expira_em  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessoes_uid_idx ON sessoes (uid);

CREATE TABLE IF NOT EXISTS tokens_recuperacao (
  id         text        PRIMARY KEY,
  uid        text        NOT NULL REFERENCES contas(uid) ON DELETE CASCADE,
  expira_em  timestamptz NOT NULL,
  usado      boolean     NOT NULL DEFAULT false
);
`

/** Cria as tabelas na primeira utilizacao (pode correr de novo, nao duplica). */
export function garantirEsquema(): Promise<void> {
  if (!globalPg.__erpEsquema) {
    globalPg.__erpEsquema = pool()
      .query(ESQUEMA)
      .then(() => undefined)
      .catch((e) => {
        globalPg.__erpEsquema = undefined
        throw e
      })
  }
  return globalPg.__erpEsquema
}

export async function consultar<T = any>(sql: string, valores: unknown[] = []): Promise<T[]> {
  await garantirEsquema()
  const r = await pool().query(sql, valores)
  return r.rows as T[]
}

/** Corre fn numa transacao; desfaz tudo se der erro. */
export async function emTransacao<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await garantirEsquema()
  const c = await pool().connect()
  try {
    await c.query("BEGIN")
    const r = await fn(c)
    await c.query("COMMIT")
    return r
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined)
    throw e
  } finally {
    c.release()
  }
}
