import type { PoolClient } from "pg"

import {
  MARCA_DATA,
  MARCA_HORA_SERVIDOR,
  ehData,
  type ConsultaFio,
  type DocFio,
  type EscritaFio,
} from "@/lib/db/protocolo"
import { consultar, emTransacao } from "./pg"
import { permite, type Operacao } from "./regras"

type Dados = Record<string, any>

export class ErroRegra extends Error {
  constructor(
    public code: "permission-denied" | "not-found" | "aborted" | "invalid-argument",
    message: string,
  ) {
    super(message)
  }
}

const NOME_VALIDO = /^[A-Za-z0-9_-]{1,80}$/
const ID_VALIDO = /^[^/\s]{1,200}$/

function validarNome(colecao: string, id?: string) {
  if (!NOME_VALIDO.test(colecao)) throw new ErroRegra("invalid-argument", "Colecao invalida.")
  if (id !== undefined && !ID_VALIDO.test(id)) throw new ErroRegra("invalid-argument", "Id invalido.")
}

// ------------------------------------------------------------ Quem pede

export interface Pedinte {
  uid: string | null
  perfil: Dados | null
}

export async function pedinteDe(uid: string | null): Promise<Pedinte> {
  if (!uid) return { uid: null, perfil: null }
  const [linha] = await consultar<{ dados: Dados }>(
    "SELECT dados FROM documentos WHERE colecao = 'utilizadores' AND id = $1",
    [uid],
  )
  return { uid, perfil: linha?.dados || null }
}

function verificar(p: Pedinte, op: Operacao, colecao: string, id: string, antes: Dados | null, depois: Dados | null) {
  if (!permite({ op, colecao, id, antes, depois, uid: p.uid, perfil: p.perfil })) {
    throw new ErroRegra("permission-denied", "Missing or insufficient permissions.")
  }
}

// ------------------------------------------------------------ Leitura

export async function lerDocumento(p: Pedinte, colecao: string, id: string): Promise<DocFio | null> {
  validarNome(colecao, id)
  const [linha] = await consultar<{ dados: Dados; versao: number }>(
    "SELECT dados, versao FROM documentos WHERE colecao = $1 AND id = $2",
    [colecao, id],
  )
  verificar(p, "get", colecao, id, linha?.dados || null, null)
  return linha ? { id, dados: linha.dados, versao: linha.versao } : null
}

/** Valor comparavel: datas pelo texto ISO, o resto como esta. */
function comparavel(v: unknown): unknown {
  return ehData(v) ? v[MARCA_DATA] : v
}

function comparar(a: unknown, b: unknown): number {
  const x = comparavel(a)
  const y = comparavel(b)
  if (x === y) return 0
  if (x === undefined || x === null) return -1
  if (y === undefined || y === null) return 1
  if (typeof x === "number" && typeof y === "number") return x - y
  if (typeof x === "boolean" && typeof y === "boolean") return Number(x) - Number(y)
  return String(x) < String(y) ? -1 : 1
}

function lerCampo(dados: Dados, campo: string): unknown {
  return campo.split(".").reduce<any>((v, k) => (v == null ? undefined : v[k]), dados)
}

function passaFiltro(dados: Dados, [campo, op, valor]: ConsultaFio["filtros"][number]): boolean {
  const v = lerCampo(dados, campo)
  const igual = (a: unknown, b: unknown) => JSON.stringify(comparavel(a)) === JSON.stringify(comparavel(b))
  switch (op) {
    case "==":
      return igual(v, valor)
    case "!=":
      return v !== undefined && !igual(v, valor)
    case "<":
      return v !== undefined && v !== null && comparar(v, valor) < 0
    case "<=":
      return v !== undefined && v !== null && comparar(v, valor) <= 0
    case ">":
      return v !== undefined && v !== null && comparar(v, valor) > 0
    case ">=":
      return v !== undefined && v !== null && comparar(v, valor) >= 0
    case "in":
      return Array.isArray(valor) && valor.some((x) => igual(v, x))
    case "not-in":
      return Array.isArray(valor) && v !== undefined && !valor.some((x) => igual(v, x))
    case "array-contains":
      return Array.isArray(v) && v.some((x) => igual(x, valor))
    case "array-contains-any":
      return Array.isArray(v) && Array.isArray(valor) && v.some((x) => valor.some((y) => igual(x, y)))
    default:
      throw new ErroRegra("invalid-argument", `Operador ${op} nao suportado.`)
  }
}

/**
 * Consulta uma colecao. Os filtros de igualdade vao ao PostgreSQL (indice
 * GIN); o resto - permissoes por documento, ordem, cursor e limite - faz-se
 * aqui, pela mesma ordem que o Firestore.
 */
async function documentosDaConsulta(p: Pedinte, c: ConsultaFio): Promise<DocFio[]> {
  validarNome(c.colecao)
  const igualdades: Dados = {}
  for (const [campo, op, valor] of c.filtros) {
    if (op === "==" && !campo.includes(".") && valor !== null && typeof valor !== "object") igualdades[campo] = valor
  }
  // Como no Firestore, a consulta inteira so passa se a regra aceitar qualquer
  // documento que ela possa devolver: testa-se um documento so com os filtros
  // de igualdade (ex.: o trabalhador pede where("uid", "==", o seu uid)).
  // Depois, por seguranca, cada documento volta a ser verificado.
  if (!permite({ op: "list", colecao: c.colecao, id: "", antes: igualdades, depois: null, uid: p.uid, perfil: p.perfil })) {
    throw new ErroRegra("permission-denied", "Missing or insufficient permissions.")
  }
  const linhas = await consultar<{ id: string; dados: Dados; versao: number }>(
    "SELECT id, dados, versao FROM documentos WHERE colecao = $1 AND dados @> $2::jsonb",
    [c.colecao, JSON.stringify(igualdades)],
  )

  let docs = linhas
    .filter((l) => c.filtros.every((f) => passaFiltro(l.dados, f)))
    // Como no Firestore, ordenar por um campo deixa de fora quem nao o tem
    .filter((l) => c.ordem.every(([campo]) => lerCampo(l.dados, campo) !== undefined))
    .filter((l) => permite({ op: "list", colecao: c.colecao, id: l.id, antes: l.dados, depois: null, uid: p.uid, perfil: p.perfil }))

  const chave = (l: { id: string; dados: Dados }) => [...c.ordem.map(([campo]) => lerCampo(l.dados, campo)), l.id]
  const direcoes = [...c.ordem.map(([, d]) => d), "asc" as const]
  const cmp = (a: unknown[], b: unknown[]) => {
    for (let i = 0; i < direcoes.length; i++) {
      const r = comparar(a[i], b[i])
      if (r !== 0) return direcoes[i] === "desc" ? -r : r
    }
    return 0
  }
  docs.sort((a, b) => cmp(chave(a), chave(b)))
  if (c.depois) {
    const cursor = c.depois
    docs = docs.filter((l) => cmp(chave(l), cursor) > 0)
  }
  if (c.limite !== undefined) docs = docs.slice(0, Math.max(0, c.limite))
  return docs.map((l) => ({ id: l.id, dados: l.dados, versao: l.versao }))
}

export async function consultarColecao(p: Pedinte, c: ConsultaFio): Promise<DocFio[]> {
  return documentosDaConsulta(p, c)
}

export async function contarColecao(p: Pedinte, c: ConsultaFio): Promise<number> {
  return (await documentosDaConsulta(p, { ...c, limite: undefined, depois: undefined })).length
}

// ------------------------------------------------------------ Escrita

/** Troca o pedido de hora do servidor pela hora de agora. */
function resolverHoras(valor: unknown, agora: string): unknown {
  if (Array.isArray(valor)) return valor.map((v) => resolverHoras(v, agora))
  if (valor && typeof valor === "object") {
    const o = valor as Dados
    if (o[MARCA_HORA_SERVIDOR] === "ts" && Object.keys(o).length === 1) return { [MARCA_DATA]: agora }
    const saida: Dados = {}
    for (const [k, v] of Object.entries(o)) saida[k] = resolverHoras(v, agora)
    return saida
  }
  return valor
}

const ehObjeto = (v: unknown): v is Dados => !!v && typeof v === "object" && !Array.isArray(v) && !ehData(v)

/** set com merge: junta mapas dentro de mapas, como o Firestore. */
function juntar(base: Dados, novo: Dados): Dados {
  const saida: Dados = { ...base }
  for (const [k, v] of Object.entries(novo)) {
    saida[k] = ehObjeto(v) && ehObjeto(saida[k]) ? juntar(saida[k], v) : v
  }
  return saida
}

/** update: substitui os campos de topo; "a.b" mexe so no campo dentro do mapa. */
function atualizarCampos(base: Dados, novo: Dados): Dados {
  const saida: Dados = structuredClone(base)
  for (const [k, v] of Object.entries(novo)) {
    const partes = k.split(".")
    let alvo = saida
    for (const parte of partes.slice(0, -1)) {
      if (!ehObjeto(alvo[parte])) alvo[parte] = {}
      alvo = alvo[parte]
    }
    alvo[partes[partes.length - 1]] = v
  }
  return saida
}

async function lerParaEscrita(c: PoolClient, colecao: string, id: string) {
  const r = await c.query("SELECT dados, versao FROM documentos WHERE colecao = $1 AND id = $2 FOR UPDATE", [colecao, id])
  return r.rows[0] as { dados: Dados; versao: number } | undefined
}

/**
 * Grava um lote: tudo ou nada. Cada escrita e verificada contra as regras com
 * o documento antes e depois, como no Firestore.
 */
export async function gravarLote(p: Pedinte, escritas: EscritaFio[]): Promise<void> {
  if (!Array.isArray(escritas) || escritas.length === 0) return
  if (escritas.length > 500) throw new ErroRegra("invalid-argument", "Lote com mais de 500 escritas.")
  const agora = new Date().toISOString()

  await emTransacao(async (c) => {
    // Estado de cada documento dentro do lote (varias escritas no mesmo documento)
    const estado = new Map<string, { dados: Dados | null; versao: number; mudou: boolean }>()

    for (const e of escritas) {
      validarNome(e.colecao, e.id)
      const chave = `${e.colecao}/${e.id}`
      if (!estado.has(chave)) {
        const linha = await lerParaEscrita(c, e.colecao, e.id)
        estado.set(chave, { dados: linha?.dados || null, versao: linha?.versao || 0, mudou: false })
      }
      const atual = estado.get(chave)!
      if (e.versao !== undefined && !atual.mudou && e.versao !== atual.versao) {
        throw new ErroRegra("aborted", "O documento mudou entretanto. Tente de novo.")
      }
      if (e.tipo === "check") continue

      const antes = atual.dados
      let depois: Dados | null
      let dados = resolverHoras(e.dados || {}, agora) as Dados

      // Picagem feita na app: a hora e sempre a do servidor (antes a regra
      // exigia hora == request.time; aqui o servidor poe-na ele proprio)
      if (e.colecao === "picagens" && e.tipo === "set" && dados.origem === "app") {
        dados = { ...dados, hora: { [MARCA_DATA]: agora }, createdAt: { [MARCA_DATA]: agora } }
      }

      if (e.tipo === "delete") depois = null
      else if (e.tipo === "update") {
        if (!antes) throw new ErroRegra("not-found", `No document to update: ${chave}`)
        depois = atualizarCampos(antes, dados)
      } else depois = e.merge && antes ? juntar(antes, dados) : dados

      const op: Operacao = e.tipo === "delete" ? "delete" : antes ? "update" : "create"
      if (op === "delete" && !antes) {
        // Apagar o que nao existe: no Firestore nao e erro, mas a regra conta
        verificar(p, "delete", e.colecao, e.id, null, null)
        continue
      }
      verificar(p, op, e.colecao, e.id, antes, depois)
      atual.dados = depois
      atual.mudou = true
    }

    for (const [chave, s] of estado) {
      if (!s.mudou) continue
      const i = chave.indexOf("/")
      const colecao = chave.slice(0, i)
      const id = chave.slice(i + 1)
      if (s.dados === null) {
        await c.query("DELETE FROM documentos WHERE colecao = $1 AND id = $2", [colecao, id])
      } else {
        await c.query(
          `INSERT INTO documentos (colecao, id, dados) VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (colecao, id) DO UPDATE
             SET dados = EXCLUDED.dados, versao = documentos.versao + 1, atualizado_em = now()`,
          [colecao, id, JSON.stringify(s.dados)],
        )
      }
    }
  })
}
