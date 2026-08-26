import type { StatusOrcamento } from "./types"

/**
 * Fases de orcamentacao (pre-venda).
 *
 * Cada fase define o que se pode fazer com a proposta. O bloqueio de edicao
 * a partir de "Emitido" e o que garante que um documento ja entregue ao cliente
 * nao muda por baixo: para alterar, cria-se uma revisao.
 */
export interface FaseOrcamento {
  id: StatusOrcamento
  nome: string
  descricao: string
  /** A proposta pode ser editada nesta fase? */
  editavel: boolean
  /** Fases para onde se pode avancar a partir desta. */
  seguintes: StatusOrcamento[]
  /** Classes de cor do distintivo. */
  cor: string
}

export const FASES_ORCAMENTO: FaseOrcamento[] = [
  {
    id: "rascunho",
    nome: "Rascunho",
    descricao: "Em elaboracao. Medicoes, precos e custos ainda a ser montados.",
    editavel: true,
    seguintes: ["em_revisao", "cancelado"],
    cor: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40",
  },
  {
    id: "em_revisao",
    nome: "Em Revisao",
    descricao: "Concluida pelo orcamentista, aguarda validacao de margens e viabilidade.",
    editavel: false,
    seguintes: ["rascunho", "emitido", "cancelado"],
    cor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  },
  {
    id: "emitido",
    nome: "Emitido",
    descricao: "Entregue formalmente ao cliente. O documento fica congelado.",
    editavel: false,
    seguintes: ["em_negociacao", "cancelado"],
    cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  },
  {
    id: "em_negociacao",
    nome: "Em Negociacao",
    descricao: "O cliente esta a renegociar valores, prazos ou medicoes.",
    editavel: false,
    seguintes: ["emitido", "cancelado"],
    cor: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40",
  },
  {
    id: "cancelado",
    nome: "Cancelado",
    descricao: "O cliente recusou a proposta ou o concurso foi anulado.",
    editavel: false,
    seguintes: ["rascunho"],
    cor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
  },
]

/**
 * Converte os estados antigos para as fases novas.
 * "enviado" e "aprovado" passam ambos a Emitido; "rejeitado" a Cancelado.
 */
export function normalizarFase(estado?: string): StatusOrcamento {
  switch (estado) {
    case "enviado":
    case "aprovado":
      return "emitido"
    case "rejeitado":
      return "cancelado"
    case "em_revisao":
    case "emitido":
    case "em_negociacao":
    case "cancelado":
      return estado
    default:
      return "rascunho"
  }
}

export function getFase(estado?: string): FaseOrcamento {
  const id = normalizarFase(estado)
  return FASES_ORCAMENTO.find((fase) => fase.id === id) || FASES_ORCAMENTO[0]
}

/** Uma proposta so se edita nas fases que o permitem. */
export function podeEditar(estado?: string): boolean {
  return getFase(estado).editavel
}

/** As revisoes so fazem sentido depois de o documento ter sido emitido. */
export function podeCriarRevisao(estado?: string): boolean {
  const id = normalizarFase(estado)
  return id === "emitido" || id === "em_negociacao"
}

/** Cancelar exige registar o motivo, para analise posterior. */
export function exigeMotivo(estado: StatusOrcamento): boolean {
  return estado === "cancelado"
}

/**
 * Nome da versao a partir do numero de revisao.
 * 0 = versao base (1.0), 1 = Rev. A, 2 = Rev. B, ...
 */
export function nomeDaVersao(revisao = 0): string {
  if (!revisao) return "1.0"
  const letra = String.fromCharCode(64 + revisao) // 1 -> A
  return `Rev. ${letra}`
}
