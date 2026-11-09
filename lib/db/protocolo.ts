/**
 * Formato partilhado entre o browser e o servidor da base de dados.
 *
 * Os documentos ficam no PostgreSQL em JSONB, com o mesmo formato que tinham no
 * Firestore. As datas guardam-se como {"$ts": "<ISO em UTC>"}: o texto ISO
 * ordena-se bem e o browser volta a ler um Timestamp com toDate(), como antes.
 */

export const MARCA_DATA = "$ts"
/** Pede a hora do servidor (serverTimestamp): o relogio do telemovel nao conta. */
export const MARCA_HORA_SERVIDOR = "$srv"

export class Timestamp {
  constructor(private readonly ms: number) {}

  static now(): Timestamp {
    return new Timestamp(Date.now())
  }

  static fromDate(data: Date): Timestamp {
    return new Timestamp(data.getTime())
  }

  static fromMillis(ms: number): Timestamp {
    return new Timestamp(ms)
  }

  toDate(): Date {
    return new Date(this.ms)
  }

  toMillis(): number {
    return this.ms
  }

  get seconds(): number {
    return Math.floor(this.ms / 1000)
  }

  get nanoseconds(): number {
    return (this.ms % 1000) * 1e6
  }

  isEqual(outro: Timestamp): boolean {
    return outro instanceof Timestamp && outro.ms === this.ms
  }

  toJSON() {
    return { [MARCA_DATA]: new Date(this.ms).toISOString() }
  }
}

export interface MarcaHoraServidor {
  [MARCA_HORA_SERVIDOR]: "ts"
}

/** Converte para JSON: Timestamp e Date passam a {"$ts"}; undefined desaparece. */
export function codificar(valor: unknown): unknown {
  if (valor === undefined) return undefined
  if (valor === null) return null
  if (valor instanceof Timestamp) return valor.toJSON()
  if (valor instanceof Date) return { [MARCA_DATA]: valor.toISOString() }
  if (Array.isArray(valor)) return valor.map((v) => (v === undefined ? null : codificar(v)))
  if (typeof valor === "object") {
    const saida: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === undefined) continue
      saida[k] = codificar(v)
    }
    return saida
  }
  if (typeof valor === "number" && !Number.isFinite(valor)) return null
  return valor
}

export function ehData(valor: unknown): valor is { [MARCA_DATA]: string } {
  return (
    !!valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    typeof (valor as Record<string, unknown>)[MARCA_DATA] === "string" &&
    Object.keys(valor as object).length === 1
  )
}

/** Volta a ler o JSON: {"$ts"} passa a Timestamp. */
export function descodificar(valor: unknown): any {
  if (valor === null || typeof valor !== "object") return valor
  if (Array.isArray(valor)) return valor.map(descodificar)
  if (ehData(valor)) return Timestamp.fromDate(new Date(valor[MARCA_DATA]))
  const saida: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) saida[k] = descodificar(v)
  return saida
}

// ------------------------------------------------------------ Pedidos ao servidor

export type OperadorFiltro = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in" | "array-contains" | "array-contains-any"

export interface ConsultaFio {
  colecao: string
  filtros: Array<[string, OperadorFiltro, unknown]>
  ordem: Array<[string, "asc" | "desc"]>
  limite?: number
  /** Valores dos campos de ordem (e o id no fim) do ultimo documento ja lido. */
  depois?: unknown[]
}

export interface EscritaFio {
  /** check: so confirma a versao de um documento lido na transacao, sem gravar. */
  tipo: "set" | "update" | "delete" | "check"
  colecao: string
  id: string
  dados?: Record<string, unknown>
  merge?: boolean
  /** Para transacoes: a versao lida (0 = o documento nao existia). */
  versao?: number
}

export type PedidoBD =
  | { op: "get"; colecao: string; id: string }
  | { op: "query"; consulta: ConsultaFio }
  | { op: "count"; consulta: ConsultaFio }
  | { op: "commit"; escritas: EscritaFio[] }

export interface DocFio {
  id: string
  dados: Record<string, unknown>
  versao: number
}

export interface ErroFio {
  code: string
  message: string
}
