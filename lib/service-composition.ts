import type { Servico, ServicoComposicaoItem, ServicoGrupoComposicao } from "./types"
import { round2 } from "./utils"

/**
 * Grupos da composicao de preco, no mesmo formato das folhas de calculo usadas
 * em obra (Lista de composicao de preco).
 */
export const GRUPOS_COMPOSICAO: Array<{
  id: ServicoGrupoComposicao
  nome: string
  descricao: string
  /** Classes de cor para o cabecalho do grupo. */
  cor: string
}> = [
  {
    id: "mao_obra",
    nome: "Mao de obra",
    descricao: "Horas de oficial, ajudante e restante equipa (custo real/hora; a margem entra no orcamento)",
    cor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  {
    id: "materiais",
    nome: "Materiais",
    descricao: "Material consumido na execucao",
    cor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  {
    id: "aluguel",
    nome: "Aluguel",
    descricao: "Equipamento alugado (martelo, andaime, plataforma)",
    cor: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  {
    id: "vazadouro",
    nome: "Vazadouro",
    descricao: "Descarga de entulho e transporte de lixo",
    cor: "bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30",
  },
  {
    id: "transporte",
    nome: "Transporte",
    descricao: "Deslocacao de equipa e material ate a obra",
    cor: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  },
  {
    id: "extras",
    nome: "Extras - Diversos",
    descricao: "Acessorios e custos avulsos",
    cor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
]

export function getGrupoComposicao(id: ServicoGrupoComposicao) {
  return GRUPOS_COMPOSICAO.find((grupo) => grupo.id === id) || GRUPOS_COMPOSICAO[GRUPOS_COMPOSICAO.length - 1]
}

/**
 * Total de uma linha: quantidade padrao x quantidade pontual x valor unitario.
 * Pontual em 0 desliga a linha sem a apagar (igual a folha de calculo).
 */
export function calcularTotalLinha(linha: Pick<
  ServicoComposicaoItem,
  "quantidadePadrao" | "quantidadePontual" | "precoUnitario"
>): number {
  const padrao = Number(linha.quantidadePadrao) || 0
  const pontual = Number(linha.quantidadePontual) || 0
  const unitario = Number(linha.precoUnitario) || 0
  return round2(padrao * pontual * unitario)
}

/** Soma por grupo e total geral da composicao. */
export function calcularTotaisComposicao(composicao: ServicoComposicaoItem[]) {
  const porGrupo = {} as Record<ServicoGrupoComposicao, number>
  for (const grupo of GRUPOS_COMPOSICAO) porGrupo[grupo.id] = 0

  for (const linha of composicao) {
    const grupo = linha.grupo || "extras"
    porGrupo[grupo] = round2((porGrupo[grupo] || 0) + calcularTotalLinha(linha))
  }

  const total = round2(Object.values(porGrupo).reduce((acc, valor) => acc + valor, 0))
  return { porGrupo, total }
}

/**
 * Preco por unidade: total da composicao dividido pela quantidade de referencia
 * para a qual ela foi montada (ex.: 119,33 EUR para 10 m2 = 11,93 EUR/m2).
 */
export function calcularPrecoUnitario(total: number, quantidadeReferencia: number): number {
  const referencia = Number(quantidadeReferencia) || 0
  if (referencia <= 0) return 0
  return round2(total / referencia)
}

/**
 * Converte servicos gravados no formato antigo (consumiveis + itens + valor
 * fixo + transporte avulso) para a composicao com grupos.
 *
 * A quantidade de referencia entra como 1 para o preco unitario continuar
 * exatamente igual ao que ja estava gravado - a partir dai o utilizador ajusta.
 */
export function migrarComposicaoLegada(servico: Servico): {
  composicao: ServicoComposicaoItem[]
  quantidadeReferencia: number
} {
  if (servico.composicao?.length) {
    return {
      composicao: servico.composicao,
      quantidadeReferencia: Number(servico.quantidadeReferencia) || 1,
    }
  }

  const converter = (
    itens: ServicoComposicaoItem[] | undefined,
    grupo: ServicoGrupoComposicao,
  ): ServicoComposicaoItem[] =>
    (itens || []).map((item) => ({
      ...item,
      grupo,
      quantidadePadrao: Number(item.quantidadePadrao ?? item.quantidade ?? 0),
      quantidadePontual: Number(item.quantidadePontual ?? 1),
      precoUnitario: Number(item.precoUnitario) || 0,
      total: round2(Number(item.quantidadePadrao ?? item.quantidade ?? 0) * (Number(item.precoUnitario) || 0)),
    }))

  const composicao = [
    ...converter(servico.listaConsumiveis, "materiais"),
    // Itens/equipamentos do modelo antigo eram sobretudo aluguer e acessorios
    ...converter(servico.listaItens, "aluguel"),
  ]

  const transporte = Number(servico.transporte || 0)
  if (transporte > 0) {
    composicao.push({
      id: `transporte-legado-${servico.id || "novo"}`,
      grupo: "transporte",
      materialId: "",
      nome: "Transporte",
      unidade: "vg",
      quantidadePadrao: 1,
      quantidadePontual: 1,
      precoUnitario: round2(transporte),
      total: round2(transporte),
    })
  }

  return { composicao, quantidadeReferencia: 1 }
}
