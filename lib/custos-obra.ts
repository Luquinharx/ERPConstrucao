import type { GrupoCustoObra, LinhaCustoObra, Orcamento } from "@/lib/types"
import { round2 } from "@/lib/utils"

/**
 * Custos reais da obra.
 *
 * O orcamento diz quanto se pensava gastar; esta folha diz quanto se gastou.
 * Sao as duas pontas da mesma obra, por isso vivem no mesmo documento: sem
 * elas juntas nao ha forma de saber se a margem prometida ao cliente
 * sobreviveu ao estaleiro.
 *
 * Toda a gente escreve aqui o valor que vem na fatura (com IVA). O custo que
 * conta para a margem e o valor sem IVA, porque o IVA suportado nao e custo da
 * empresa: e entregue ao Estado e depois deduzido. Por isso nao se gravam
 * valores sem IVA - derivam-se sempre, para nao existirem duas verdades.
 */

export interface DefinicaoGrupoCusto {
  id: GrupoCustoObra
  nome: string
  ajuda: string
  /** Unidade que a maior parte das linhas do grupo usa. */
  unidadePadrao: string
  /** Taxa de IVA mais provavel no grupo. */
  taxaPadrao: number
  /** Exemplos mostrados nos campos vazios, para cada bloco se explicar sozinho. */
  exemploDescricao: string
  exemploFornecedor: string
}

/** Os tres blocos da folha de obra, pela ordem em que sao preenchidos. */
export const GRUPOS_CUSTO_OBRA: DefinicaoGrupoCusto[] = [
  {
    id: "materiais",
    nome: "Materiais Obra",
    ajuda: "Compras de material. Uma linha por fatura chega.",
    unidadePadrao: "un",
    taxaPadrao: 23,
    exemploDescricao: "Ex.: Compras 03/08 ou Aspirador de po",
    exemploFornecedor: "Ex.: Leroy Merlin",
  },
  {
    id: "mao_obra",
    nome: "Mao de Obra",
    ajuda: "Horas gastas na obra, proprias ou subcontratadas.",
    unidadePadrao: "h",
    taxaPadrao: 0,
    exemploDescricao: "Ex.: Wilson - pintura",
    exemploFornecedor: "Ex.: interno ou subempreiteiro",
  },
  {
    id: "global",
    nome: "Custos Obra",
    ajuda: "Deslocacao, portagens, refeicoes, vazadouro e o resto que a obra arrastou.",
    unidadePadrao: "vg",
    taxaPadrao: 23,
    exemploDescricao: "Ex.: Portagens, Vazadouro",
    exemploFornecedor: "Ex.: Via Verde",
  },
]

/**
 * Taxas disponiveis. Os nomes sao curtos de proposito: aparecem dentro de uma
 * celula da tabela, e um rotulo comprido empurrava a descricao para fora.
 */
export const TAXAS_IVA_CUSTO = [
  { valor: 23, nome: "23%" },
  { valor: 6, nome: "6%" },
  { valor: 0, nome: "0% isento" },
]

export function getGrupoCusto(id: GrupoCustoObra): DefinicaoGrupoCusto {
  return GRUPOS_CUSTO_OBRA.find((grupo) => grupo.id === id) || GRUPOS_CUSTO_OBRA[0]
}

/** Totais de um conjunto de linhas, nas tres leituras que interessam. */
export interface TotaisCusto {
  /** Custo verdadeiro da empresa. */
  semIVA: number
  /** IVA suportado, dedutivel perante o Estado. */
  iva: number
  /** O que saiu da conta bancaria. */
  comIVA: number
}

const ZERO: TotaisCusto = { semIVA: 0, iva: 0, comIVA: 0 }

/**
 * Decompoe uma linha. O valor escrito ja tem IVA dentro, por isso divide-se
 * (e nao se multiplica) para chegar a base: 1,23 EUR a 23% sao 1,00 de custo
 * e 0,23 de IVA.
 */
export function totaisDaLinha(linha: LinhaCustoObra): TotaisCusto {
  const quantidade = Number.isFinite(linha.quantidade) ? linha.quantidade : 0
  const valorUnitario = Number.isFinite(linha.valorUnitario) ? linha.valorUnitario : 0
  const taxa = Number.isFinite(linha.taxaIVA) ? linha.taxaIVA : 0

  const comIVA = round2(quantidade * valorUnitario)
  const semIVA = round2(comIVA / (1 + taxa / 100))
  return { semIVA, iva: round2(comIVA - semIVA), comIVA }
}

export function somarTotais(linhas: LinhaCustoObra[]): TotaisCusto {
  return linhas.reduce<TotaisCusto>((acumulado, linha) => {
    const totais = totaisDaLinha(linha)
    return {
      semIVA: round2(acumulado.semIVA + totais.semIVA),
      iva: round2(acumulado.iva + totais.iva),
      comIVA: round2(acumulado.comIVA + totais.comIVA),
    }
  }, ZERO)
}

export function linhasDoGrupo(linhas: LinhaCustoObra[], grupo: GrupoCustoObra): LinhaCustoObra[] {
  return linhas.filter((linha) => linha.grupo === grupo)
}

export function totaisPorGrupo(linhas: LinhaCustoObra[]): Record<GrupoCustoObra, TotaisCusto> {
  return {
    materiais: somarTotais(linhasDoGrupo(linhas, "materiais")),
    mao_obra: somarTotais(linhasDoGrupo(linhas, "mao_obra")),
    global: somarTotais(linhasDoGrupo(linhas, "global")),
  }
}

/** Valores da proposta de que a analise precisa, sem depender do ecra. */
export interface ValoresVendidos {
  /** Base tributavel: o que o cliente paga, sem IVA. */
  baseTributavel: number
  /** IVA debitado ao cliente na proposta. */
  ivaCobrado: number
  /** Custo que o orcamento previu (custo dos itens + transporte). */
  custoOrcado: number
}

export interface AnaliseCustoObra extends ValoresVendidos {
  /** Soma dos custos reais, sem IVA. */
  custoReal: number
  /** IVA suportado nas compras da obra. */
  ivaSuportado: number

  /** baseTributavel - custoOrcado: a margem prometida quando se vendeu. */
  margemPrevista: number
  margemPrevistaPercent: number
  /** baseTributavel - custoReal: a margem que de facto ficou. */
  margemReal: number
  margemRealPercent: number

  /** custoReal - custoOrcado. Positivo = gastou-se mais do que o previsto. */
  desvioCusto: number
  desvioCustoPercent: number
  /** margemReal - margemPrevista. Negativo = perdeu-se margem pelo caminho. */
  desvioMargem: number

  /**
   * ivaCobrado - ivaSuportado. Positivo: ha IVA para entregar ao Estado.
   * Negativo: pagou-se mais IVA do que se cobrou, ha credito a recuperar.
   */
  saldoIVA: number

  /** Nao ha custos lancados: a analise ainda nao diz nada de util. */
  semLancamentos: boolean
}

function percentagem(parte: number, total: number): number {
  if (!total) return 0
  return round2((parte / total) * 100)
}

/**
 * Cruza o que se vendeu com o que se gastou.
 *
 * A margem mede-se sobre valores sem IVA dos dois lados - comparar um preco de
 * venda sem IVA com faturas com IVA dava uma obra artificialmente ruinosa.
 */
export function analisarCustoObra(vendidos: ValoresVendidos, linhas: LinhaCustoObra[]): AnaliseCustoObra {
  const reais = somarTotais(linhas)
  const baseTributavel = round2(vendidos.baseTributavel)
  const custoOrcado = round2(vendidos.custoOrcado)

  const margemPrevista = round2(baseTributavel - custoOrcado)
  const margemReal = round2(baseTributavel - reais.semIVA)
  const desvioCusto = round2(reais.semIVA - custoOrcado)

  return {
    baseTributavel,
    ivaCobrado: round2(vendidos.ivaCobrado),
    custoOrcado,
    custoReal: reais.semIVA,
    ivaSuportado: reais.iva,
    margemPrevista,
    margemPrevistaPercent: percentagem(margemPrevista, baseTributavel),
    margemReal,
    margemRealPercent: percentagem(margemReal, baseTributavel),
    desvioCusto,
    desvioCustoPercent: percentagem(desvioCusto, custoOrcado),
    desvioMargem: round2(margemReal - margemPrevista),
    saldoIVA: round2(round2(vendidos.ivaCobrado) - reais.iva),
    semLancamentos: linhas.length === 0,
  }
}

/** Os valores vendidos tal como estao gravados na proposta. */
export function valoresVendidosDoOrcamento(orcamento: Orcamento, custoOrcado: number): ValoresVendidos {
  const valorIVA = round2(orcamento.valorIVA ?? 0)
  return {
    baseTributavel: round2(orcamento.baseTributavel ?? round2(orcamento.valorTotal || 0) - valorIVA),
    ivaCobrado: valorIVA,
    custoOrcado: round2(custoOrcado),
  }
}

export function novaLinhaCusto(grupo: GrupoCustoObra): LinhaCustoObra {
  const definicao = getGrupoCusto(grupo)
  return {
    id: `${grupo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    grupo,
    descricao: "",
    fornecedor: "",
    unidade: definicao.unidadePadrao,
    quantidade: 1,
    valorUnitario: 0,
    taxaIVA: definicao.taxaPadrao,
  }
}

/**
 * Limpa o que vem do ecra antes de gravar: o Firestore rejeita `undefined` e
 * linhas em branco so poluem a folha.
 */
export function prepararParaGravar(linhas: LinhaCustoObra[]): LinhaCustoObra[] {
  return linhas
    .filter(
      (linha) =>
        linha.descricao.trim() !== "" || (linha.fornecedor || "").trim() !== "" || linha.valorUnitario !== 0,
    )
    .map((linha) => {
      const limpa: LinhaCustoObra = {
        id: linha.id,
        grupo: linha.grupo,
        descricao: linha.descricao.trim(),
        unidade: linha.unidade.trim() || getGrupoCusto(linha.grupo).unidadePadrao,
        quantidade: round2(linha.quantidade),
        valorUnitario: round2(linha.valorUnitario),
        taxaIVA: round2(linha.taxaIVA),
      }
      if (linha.fornecedor?.trim()) limpa.fornecedor = linha.fornecedor.trim()
      if (linha.data) limpa.data = linha.data
      if (linha.documento?.trim()) limpa.documento = linha.documento.trim()
      return limpa
    })
}
