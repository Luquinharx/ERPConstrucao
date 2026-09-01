import type { ConfiguracaoEmpresa, Orcamento, TipoDocumentoProposta } from "./types"

/**
 * Tipos de documento e a sua numeracao.
 *
 * Cada tipo tem contagem propria dentro do ano: os concursos vao em CO26/0001,
 * CO26/0002..., as obras em O26/0001, O26/0002... Um concurso adjudicado passa
 * a obra ficando com o MESMO numero (CO26/0007 -> O26/0007), para se ver de
 * imediato de que proposta veio. O contador de obras so entra em jogo quando se
 * abre uma obra de raiz ou quando o numero de origem ja esta ocupado.
 */
export interface TipoDocumento {
  id: TipoDocumentoProposta
  nome: string
  descricao: string
  /** Prefixo usado quando a empresa nao configurou nenhum. */
  prefixoPadrao: string
  /** Classes de cor do distintivo. */
  cor: string
}

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  {
    id: "concurso",
    nome: "Concurso",
    descricao: "Proposta em disputa. Ainda nao ha trabalho adjudicado.",
    prefixoPadrao: "CO",
    cor: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40",
  },
  {
    id: "obra",
    nome: "Obra",
    descricao: "Trabalho adjudicado. A contabilidade ja pode faturar.",
    prefixoPadrao: "O",
    cor: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40",
  },
]

/** Propostas antigas nao tem o campo: valem como concurso. */
export function tipoDoDocumento(orcamento?: Pick<Orcamento, "tipoDocumento">): TipoDocumentoProposta {
  return orcamento?.tipoDocumento === "obra" ? "obra" : "concurso"
}

export function getTipoDocumento(tipo?: TipoDocumentoProposta): TipoDocumento {
  return TIPOS_DOCUMENTO.find((item) => item.id === tipo) || TIPOS_DOCUMENTO[0]
}

/** Prefixo configurado para o tipo, com recurso ao valor por omissao. */
export function prefixoDoTipo(config: Partial<ConfiguracaoEmpresa> | null | undefined, tipo: TipoDocumentoProposta) {
  const configurado = tipo === "obra" ? config?.prefixoObra : config?.prefixoOrcamento
  return (configurado ?? getTipoDocumento(tipo).prefixoPadrao) || ""
}

/** Numero como aparece nos documentos e nas listas: CO26/0001. */
export function numeroCompleto(
  orcamento: Pick<Orcamento, "numero" | "tipoDocumento">,
  config?: Partial<ConfiguracaoEmpresa> | null,
): string {
  return `${prefixoDoTipo(config, tipoDoDocumento(orcamento))}${orcamento.numero || ""}${config?.sufixoOrcamento || ""}`
}

/** Parte sequencial de um numero no formato "26/0001". Devolve 0 se nao for esse formato. */
function sequencial(numero: string, ano: string): number {
  if (!numero.startsWith(`${ano}/`)) return 0
  return Number(numero.split("/")[1]) || 0
}

/**
 * Proximo numero livre do ano para um tipo.
 *
 * Olha para o maior ja atribuido em vez de contar documentos, para nao repetir
 * numeros quando se apaga uma proposta.
 */
export function proximoNumero(
  orcamentos: Pick<Orcamento, "numero" | "tipoDocumento">[],
  tipo: TipoDocumentoProposta,
  ano: number = new Date().getFullYear(),
): string {
  const aa = String(ano).slice(-2)
  const usados = orcamentos
    .filter((item) => tipoDoDocumento(item) === tipo)
    .map((item) => sequencial(item.numero || "", aa))

  const proximo = (usados.length ? Math.max(...usados) : 0) + 1
  return `${aa}/${String(proximo).padStart(4, "0")}`
}

/** Ja existe outro documento deste tipo com este numero? */
export function numeroOcupado(
  orcamentos: Pick<Orcamento, "id" | "numero" | "tipoDocumento">[],
  tipo: TipoDocumentoProposta,
  numero: string,
  ignorarId?: string,
): boolean {
  return orcamentos.some(
    (item) => item.id !== ignorarId && tipoDoDocumento(item) === tipo && (item.numero || "") === numero,
  )
}

/**
 * Numero que a proposta leva ao passar a obra.
 *
 * Mantem o numero de origem sempre que possivel; se esse ja estiver ocupado por
 * outra obra, avanca para o proximo livre e quem chamou avisa o utilizador.
 */
export function numeroAoPassarAObra(
  orcamentos: Pick<Orcamento, "id" | "numero" | "tipoDocumento">[],
  orcamento: Pick<Orcamento, "id" | "numero" | "tipoDocumento">,
): { numero: string; manteve: boolean } {
  const atual = orcamento.numero || ""
  if (atual && !numeroOcupado(orcamentos, "obra", atual, orcamento.id)) {
    return { numero: atual, manteve: true }
  }
  return { numero: proximoNumero(orcamentos, "obra"), manteve: false }
}

/**
 * Numero com que a proposta fica gravada.
 *
 * O que estiver escrito manda. Campo vazio quer dizer "numera automaticamente",
 * TAMBEM ao editar: antes, ao editar, o numero antigo voltava sempre, por isso
 * limpar o campo nao servia de nada e ficava-se preso a numeros de formatos
 * antigos como "2026-002".
 */
export function numeroParaGravar(
  escrito: string | undefined,
  orcamentos: Pick<Orcamento, "numero" | "tipoDocumento">[],
  tipo: TipoDocumentoProposta,
  ano?: number,
): string {
  return (escrito || "").trim() || proximoNumero(orcamentos, tipo, ano)
}
