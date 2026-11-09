/**
 * Copia os dados do Firestore para o PostgreSQL.
 *
 *   npx tsx scripts/migrar-firebase-pg.ts exportar <conta.json> <saida.json>
 *   npx tsx scripts/migrar-firebase-pg.ts importar <saida.json> [--limpar]   (usa DATABASE_URL)
 *
 * exportar: entra no Firebase com uma conta de administrador ({ email, senha })
 *   e le todas as colecoes. Datas passam a {"$ts": "..."}, o formato da base nova.
 * importar: grava os documentos (mesmos ids) e cria uma conta de login por
 *   cada perfil em utilizadores, marcada "firebase": no primeiro login a
 *   palavra-passe confirma-se no Firebase e fica guardada no servidor novo.
 *   Pode correr de novo: atualiza o que mudou, nao duplica.
 */
import { readFileSync, writeFileSync } from "fs"
import path from "path"

const COLECOES = [
  "utilizadores",
  "clientes",
  "funcionarios",
  "materiais",
  "movimentosEstoque",
  "funcoes",
  "material-categories",
  "categorias",
  "servicos",
  "orcamentos",
  "contas",
  "autosMedicao",
  "registosHoras",
  "faturasFornecedor",
  "rdos",
  "garantias",
  "cotacoes",
  "portal",
  "termos_servico",
  "configuracoes",
  "acessosPonto",
  "pontoConfig",
  "obrasPonto",
  "picagens",
  "pedidosPonto",
]

function lerEnvLocal() {
  try {
    for (const linha of readFileSync(path.resolve(".env.local"), "utf8").split(/\r?\n/)) {
      const m = linha.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {
    // sem .env.local: usa o ambiente
  }
}

async function exportar(contaJson: string, saida: string) {
  const { initializeApp } = await import("firebase/app")
  const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth")
  const { getFirestore, collection, getDocs, Timestamp, GeoPoint, DocumentReference } = await import("firebase/firestore")

  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  })
  const conta = JSON.parse(readFileSync(path.resolve(contaJson), "utf8"))
  await signInWithEmailAndPassword(getAuth(app), conta.email, conta.senha)
  const fs = getFirestore(app)

  const converter = (v: unknown): unknown => {
    if (v === null || v === undefined) return v ?? null
    if (v instanceof Timestamp) return { $ts: v.toDate().toISOString() }
    if (v instanceof GeoPoint) return { latitude: v.latitude, longitude: v.longitude }
    if (v instanceof DocumentReference) return v.path
    if (Array.isArray(v)) return v.map(converter)
    if (typeof v === "object") return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, converter(x)]))
    return v
  }

  const dados: Record<string, Array<{ id: string; dados: unknown }>> = {}
  for (const nome of COLECOES) {
    try {
      const snap = await getDocs(collection(fs, nome))
      dados[nome] = snap.docs.map((d) => ({ id: d.id, dados: converter(d.data()) }))
      console.log(`${nome.padEnd(22)} ${String(dados[nome].length).padStart(5)}`)
    } catch (e) {
      console.error(`${nome.padEnd(22)} ERRO: ${(e as Error).message}`)
      process.exitCode = 1
    }
  }
  writeFileSync(path.resolve(saida), JSON.stringify(dados))
  console.log(`\nExportado para ${saida}`)
  process.exit(process.exitCode || 0)
}

async function importar(entrada: string, limpar: boolean) {
  const { Pool } = await import("pg")
  const dados: Record<string, Array<{ id: string; dados: Record<string, any> }>> = JSON.parse(
    readFileSync(path.resolve(entrada), "utf8"),
  )
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  // Garante as tabelas (o mesmo esquema que o servidor cria)
  const { garantirEsquema } = await import("../lib/server/pg")
  await garantirEsquema()

  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    if (limpar) {
      // Copia final: o que foi apagado no Firebase tambem desaparece aqui.
      // As contas de login e as sessoes ficam (palavras-passe ja migradas).
      const r = await c.query("DELETE FROM documentos WHERE colecao = ANY($1)", [Object.keys(dados)])
      console.log(`Documentos antigos removidos: ${r.rowCount}\n`)
    }
    for (const [colecao, docs] of Object.entries(dados)) {
      for (const d of docs) {
        await c.query(
          `INSERT INTO documentos (colecao, id, dados) VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (colecao, id) DO UPDATE
             SET dados = EXCLUDED.dados, versao = documentos.versao + 1, atualizado_em = now()
             WHERE documentos.dados IS DISTINCT FROM EXCLUDED.dados`,
          [colecao, d.id, JSON.stringify(d.dados)],
        )
      }
      const [{ n }] = (await c.query("SELECT count(*)::int AS n FROM documentos WHERE colecao = $1", [colecao])).rows
      console.log(`${colecao.padEnd(22)} firebase ${String(docs.length).padStart(5)}   postgres ${String(n).padStart(5)}`)
    }

    // Uma conta de login por perfil (a palavra-passe vem do Firebase no 1.o login)
    let contas = 0
    for (const u of dados.utilizadores || []) {
      if (!u.dados.email) continue
      const r = await c.query(
        `INSERT INTO contas (uid, email, nome, firebase) VALUES ($1, $2, $3, true)
         ON CONFLICT DO NOTHING`,
        [u.id, String(u.dados.email).trim(), u.dados.nome || null],
      )
      contas += r.rowCount || 0
    }
    await c.query("COMMIT")
    console.log(`\nContas de login criadas: ${contas}`)
  } catch (e) {
    await c.query("ROLLBACK")
    throw e
  } finally {
    c.release()
    await pool.end()
  }
  process.exit(0)
}

lerEnvLocal()
const [acao, a, b] = process.argv.slice(2)
if (acao === "exportar" && a && b) exportar(a, b)
else if (acao === "importar" && a) importar(a, process.argv.includes("--limpar"))
else {
  console.error("Uso:\n  exportar <conta.json> <saida.json>\n  importar <saida.json> [--limpar]")
  process.exit(1)
}
