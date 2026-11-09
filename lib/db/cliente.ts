"use client"

/**
 * Acesso a base de dados a partir do browser.
 *
 * Imita as funcoes do Firestore que a aplicacao usava (collection, doc, query,
 * getDocs, setDoc, writeBatch, runTransaction...), para os servicos nao terem
 * de ser reescritos. Por baixo, cada chamada vai a /api/bd, onde o servidor
 * confirma a sessao e as permissoes (lib/server/regras.ts) e grava no
 * PostgreSQL.
 */
import {
  MARCA_HORA_SERVIDOR,
  Timestamp,
  codificar,
  descodificar,
  type ConsultaFio,
  type DocFio,
  type EscritaFio,
  type MarcaHoraServidor,
  type OperadorFiltro,
  type PedidoBD,
} from "./protocolo"

export { Timestamp }

export const db = { tipo: "bd" as const }
export type BaseDados = typeof db

export class ErroBD extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = "FirebaseError"
  }
}

// ------------------------------------------------------------ Referencias

export interface CollectionReference {
  tipo: "colecao"
  id: string
  path: string
}

export interface DocumentReference {
  tipo: "documento"
  id: string
  colecao: string
  path: string
}

export interface Query {
  tipo: "consulta"
  colecao: string
  filtros: ConsultaFio["filtros"]
  ordem: ConsultaFio["ordem"]
  limite?: number
  depois?: DocumentSnapshot | unknown[]
}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

/** Id aleatorio de 20 letras, como os do Firestore. */
function novoId(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => LETRAS[b % LETRAS.length]).join("")
}

export function collection(_db: BaseDados, nome: string): CollectionReference {
  return { tipo: "colecao", id: nome, path: nome }
}

export function doc(origem: BaseDados | CollectionReference, colecaoOuId?: string, id?: string): DocumentReference {
  if ((origem as CollectionReference).tipo === "colecao") {
    const col = origem as CollectionReference
    const docId = colecaoOuId || novoId()
    return { tipo: "documento", id: docId, colecao: col.id, path: `${col.id}/${docId}` }
  }
  if (!colecaoOuId || !id) throw new ErroBD("invalid-argument", "doc() precisa da colecao e do id.")
  return { tipo: "documento", id, colecao: colecaoOuId, path: `${colecaoOuId}/${id}` }
}

// ------------------------------------------------------------ Consultas

type Restricao =
  | { tipo: "where"; campo: string; op: OperadorFiltro; valor: unknown }
  | { tipo: "orderBy"; campo: string; direcao: "asc" | "desc" }
  | { tipo: "limit"; n: number }
  | { tipo: "startAfter"; valores: unknown[] }

export function where(campo: string, op: OperadorFiltro, valor: unknown): Restricao {
  return { tipo: "where", campo, op, valor }
}

export function orderBy(campo: string, direcao: "asc" | "desc" = "asc"): Restricao {
  return { tipo: "orderBy", campo, direcao }
}

export function limit(n: number): Restricao {
  return { tipo: "limit", n }
}

export function startAfter(...valores: unknown[]): Restricao {
  return { tipo: "startAfter", valores }
}

export function query(origem: CollectionReference | Query, ...restricoes: Restricao[]): Query {
  const base: Query =
    origem.tipo === "consulta"
      ? { ...origem, filtros: [...origem.filtros], ordem: [...origem.ordem] }
      : { tipo: "consulta", colecao: origem.id, filtros: [], ordem: [] }
  for (const r of restricoes) {
    if (r.tipo === "where") base.filtros.push([r.campo, r.op, codificar(r.valor)])
    else if (r.tipo === "orderBy") base.ordem.push([r.campo, r.direcao])
    else if (r.tipo === "limit") base.limite = r.n
    else if (r.tipo === "startAfter") {
      base.depois = r.valores.length === 1 && r.valores[0] instanceof DocumentSnapshot ? r.valores[0] : r.valores
    }
  }
  return base
}

function paraFio(q: CollectionReference | Query): ConsultaFio {
  const c = q.tipo === "colecao" ? query(q) : q
  let depois: unknown[] | undefined
  if (c.depois instanceof DocumentSnapshot) {
    const dados = c.depois.dadosBrutos()
    depois = [...c.ordem.map(([campo]) => dados[campo] ?? null), c.depois.id]
  } else if (Array.isArray(c.depois)) {
    depois = c.depois.map(codificar)
  }
  return { colecao: c.colecao, filtros: c.filtros, ordem: c.ordem, limite: c.limite, depois }
}

// ------------------------------------------------------------ Resultados

export class DocumentSnapshot {
  constructor(
    public readonly ref: DocumentReference,
    private readonly bruto: Record<string, unknown> | null,
    public readonly versao: number,
  ) {}

  get id(): string {
    return this.ref.id
  }

  exists(): boolean {
    return this.bruto !== null
  }

  data(): any {
    return this.bruto ? descodificar(this.bruto) : undefined
  }

  get(campo: string): any {
    return this.data()?.[campo]
  }

  /** Dados como chegaram (datas ainda em {"$ts"}), para o cursor da paginacao. */
  dadosBrutos(): Record<string, unknown> {
    return this.bruto || {}
  }
}

export type QueryDocumentSnapshot = DocumentSnapshot

export class QuerySnapshot {
  constructor(public readonly docs: DocumentSnapshot[]) {}

  get size(): number {
    return this.docs.length
  }

  get empty(): boolean {
    return this.docs.length === 0
  }

  forEach(fn: (d: DocumentSnapshot) => void): void {
    this.docs.forEach(fn)
  }
}

// ------------------------------------------------------------ Pedidos

async function pedir<T>(pedido: PedidoBD): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch("/api/bd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(pedido),
    })
  } catch {
    throw new ErroBD("unavailable", "Sem ligacao ao servidor. Verifique a Internet e tente de novo.")
  }
  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    const erro = corpo?.erro || {}
    throw new ErroBD(erro.code || "internal", erro.message || `Erro ${resposta.status} no servidor.`)
  }
  return corpo as T
}

function snapshotDe(colecao: string, d: DocFio): DocumentSnapshot {
  return new DocumentSnapshot(doc(db, colecao, d.id), d.dados, d.versao)
}

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  const r = await pedir<{ doc: DocFio | null }>({ op: "get", colecao: ref.colecao, id: ref.id })
  return new DocumentSnapshot(ref, r.doc ? r.doc.dados : null, r.doc?.versao || 0)
}

export async function getDocs(q: CollectionReference | Query): Promise<QuerySnapshot> {
  const consulta = paraFio(q)
  const r = await pedir<{ docs: DocFio[] }>({ op: "query", consulta })
  return new QuerySnapshot(r.docs.map((d) => snapshotDe(consulta.colecao, d)))
}

export async function getCountFromServer(q: CollectionReference | Query): Promise<{ data: () => { count: number } }> {
  const r = await pedir<{ count: number }>({ op: "count", consulta: paraFio(q) })
  return { data: () => ({ count: r.count }) }
}

// ------------------------------------------------------------ Escritas

export function serverTimestamp(): MarcaHoraServidor {
  return { [MARCA_HORA_SERVIDOR]: "ts" }
}

function escrita(
  tipo: EscritaFio["tipo"],
  ref: DocumentReference,
  dados?: Record<string, unknown>,
  merge?: boolean,
): EscritaFio {
  return {
    tipo,
    colecao: ref.colecao,
    id: ref.id,
    ...(dados ? { dados: codificar(dados) as Record<string, unknown> } : {}),
    ...(merge ? { merge: true } : {}),
  }
}

async function gravar(escritas: EscritaFio[]): Promise<void> {
  if (escritas.length === 0) return
  await pedir({ op: "commit", escritas })
}

export async function setDoc(ref: DocumentReference, dados: Record<string, unknown>, opcoes?: { merge?: boolean }) {
  await gravar([escrita("set", ref, dados, opcoes?.merge)])
}

export async function addDoc(col: CollectionReference, dados: Record<string, unknown>): Promise<DocumentReference> {
  const ref = doc(col)
  await gravar([escrita("set", ref, dados)])
  return ref
}

export async function updateDoc(ref: DocumentReference, dados: Record<string, unknown>) {
  await gravar([escrita("update", ref, dados)])
}

export async function deleteDoc(ref: DocumentReference) {
  await gravar([escrita("delete", ref)])
}

export interface WriteBatch {
  set(ref: DocumentReference, dados: Record<string, unknown>, opcoes?: { merge?: boolean }): WriteBatch
  update(ref: DocumentReference, dados: Record<string, unknown>): WriteBatch
  delete(ref: DocumentReference): WriteBatch
  commit(): Promise<void>
}

/** Lote: grava tudo ou nada (uma transacao no PostgreSQL). */
export function writeBatch(_db: BaseDados): WriteBatch {
  const escritas: EscritaFio[] = []
  const lote: WriteBatch = {
    set(ref, dados, opcoes) {
      escritas.push(escrita("set", ref, dados, opcoes?.merge))
      return lote
    },
    update(ref, dados) {
      escritas.push(escrita("update", ref, dados))
      return lote
    },
    delete(ref) {
      escritas.push(escrita("delete", ref))
      return lote
    },
    commit: () => gravar(escritas),
  }
  return lote
}

export interface Transaction {
  get(ref: DocumentReference): Promise<DocumentSnapshot>
  set(ref: DocumentReference, dados: Record<string, unknown>, opcoes?: { merge?: boolean }): Transaction
  update(ref: DocumentReference, dados: Record<string, unknown>): Transaction
  delete(ref: DocumentReference): Transaction
}

/**
 * Transacao otimista: as escritas levam a versao de cada documento lido. Se
 * alguem o mudou entretanto, o servidor recusa ("aborted") e a funcao corre
 * outra vez com os dados novos - tal como no Firestore.
 */
export async function runTransaction<T>(_db: BaseDados, fn: (t: Transaction) => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    const lidos = new Map<string, number>()
    const escritas: EscritaFio[] = []
    const t: Transaction = {
      async get(ref) {
        const snap = await getDoc(ref)
        lidos.set(ref.path, snap.versao)
        return snap
      },
      set(ref, dados, opcoes) {
        escritas.push(escrita("set", ref, dados, opcoes?.merge))
        return t
      },
      update(ref, dados) {
        escritas.push(escrita("update", ref, dados))
        return t
      },
      delete(ref) {
        escritas.push(escrita("delete", ref))
        return t
      },
    }
    const resultado = await fn(t)
    // Documentos lidos e nao escritos tambem entram, para confirmar que nao mudaram
    const comVersao = escritas.map((e) => {
      const chave = `${e.colecao}/${e.id}`
      return lidos.has(chave) ? { ...e, versao: lidos.get(chave) } : e
    })
    for (const [chave, versao] of lidos) {
      if (!escritas.some((e) => `${e.colecao}/${e.id}` === chave)) {
        const [colecao, id] = chave.split("/")
        comVersao.unshift({ tipo: "check", colecao, id, versao })
      }
    }
    try {
      await gravar(comVersao)
      return resultado
    } catch (e) {
      if ((e as ErroBD).code === "aborted" && tentativa < 5) continue
      throw e
    }
  }
}

// ------------------------------------------------------------ Tempo real

/**
 * Atualizacoes "ao vivo": volta a ler a cada 10 s (e quando a janela ganha o
 * foco) e so avisa quando os dados mudaram.
 */
export function onSnapshot(
  q: CollectionReference | Query,
  seguinte: (snap: QuerySnapshot) => void,
  erro?: (e: Error) => void,
): () => void {
  let ativo = true
  let anterior = ""
  const ler = async () => {
    try {
      const snap = await getDocs(q)
      const assinatura = JSON.stringify(snap.docs.map((d) => [d.id, d.versao]))
      if (ativo && assinatura !== anterior) {
        anterior = assinatura
        seguinte(snap)
      }
    } catch (e) {
      if (ativo) erro?.(e as Error)
    }
  }
  void ler()
  const intervalo = setInterval(ler, 10_000)
  const aoFocar = () => void ler()
  window.addEventListener("focus", aoFocar)
  return () => {
    ativo = false
    clearInterval(intervalo)
    window.removeEventListener("focus", aoFocar)
  }
}
