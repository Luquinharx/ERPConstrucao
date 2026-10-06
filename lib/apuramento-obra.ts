import { calculateItemTotal, resumoDeValores } from "@/lib/orcamento-calculos"
import type { ItemOrcamento, LancamentoObra, MovimentoEstoque, Orcamento, TipoLancamentoObra } from "@/lib/types"
import { round2 } from "@/lib/utils"

/**
 * Apuramento da obra: o que se vendeu, o que se previu gastar e o que se
 * gastou de facto.
 *
 * Substitui a antiga folha de custos reais, mas sem uma folha a parte: cada
 * custo entra onde nasce.
 * - Material: so pelo estoque. Conta cada saida ligada a obra, ao custo
 *   gravado no movimento (custo medio, ou o custo da compra quando foi uma
 *   compra feita para a obra).
 * - Mao de obra, terceiros, aluguer, transporte e outros: lancados no
 *   apuramento, sem IVA, normalmente quando se vai faturar.
 *
 * Tudo sem IVA dos dois lados: o IVA nao e receita nem custo da empresa.
 */

export const TIPOS_LANCAMENTO: Record<TipoLancamentoObra, { nome: string; exemplo: string; unidade: string }> = {
  mao_obra: { nome: "Mao de obra", exemplo: "Equipa do Patolino - semana 1", unidade: "h" },
  terceiros: { nome: "Servico de terceiros", exemplo: "Subempreitada de pladur", unidade: "vg" },
  aluguer: { nome: "Aluguer de equipamento", exemplo: "Andaime - 2 semanas", unidade: "vg" },
  transporte: { nome: "Transporte", exemplo: "Frete de material", unidade: "vg" },
  outros: { nome: "Outros custos", exemplo: "Vazadouro, licencas...", unidade: "vg" },
}

export function totalLancamento(l: Pick<LancamentoObra, "quantidade" | "valorUnitario">): number {
  return round2((Number(l.quantidade) || 0) * (Number(l.valorUnitario) || 0))
}

/** Custo de um movimento de estoque para a obra: quantidade x custo gravado. */
export function custoMovimento(m: Pick<MovimentoEstoque, "quantidade" | "custoUnitario">): number {
  return round2((Number(m.quantidade) || 0) * (Number(m.custoUnitario) || 0))
}

export interface BlocoApuramento {
  id: string
  nome: string
  /** Valor vendido ao cliente neste bloco (sem margem global). null = nao se aplica. */
  vendido: number | null
  /** Custo previsto no orcamento. null = nao se aplica. */
  previsto: number | null
  /** Custo real. null = os custos reais deste bloco entram noutros blocos. */
  real: number | null
  ajuda?: string
}

export interface Apuramento {
  blocos: BlocoApuramento[]
  /** Base sem IVA: o que a obra rende de facto. */
  venda: number
  margemGlobal: number
  custoPrevisto: number
  custoReal: number
  lucroPrevisto: number
  lucroReal: number
  /** Lucro sobre a venda (%). */
  margemPrevista: number
  margemReal: number
  /** Ha algum custo real lancado? Sem nenhum, o "real" ainda nao diz nada. */
  temReal: boolean
}

function somaItens(itens: ItemOrcamento[], tipo: ItemOrcamento["tipo"]) {
  const lista = itens.filter((i) => i.tipo === tipo)
  return {
    vendido: round2(lista.reduce((s, i) => s + (Number(i.total) || 0), 0)),
    previsto: round2(
      lista.reduce((s, i) => s + calculateItemTotal(i.quantidade, i.custoUnitario ?? i.precoUnitario, i.valorFixo), 0),
    ),
  }
}

const percentagem = (parte: number, todo: number) => (todo > 0 ? round2((parte / todo) * 100) : 0)

/**
 * Junta orcamento, saidas de estoque da obra e lancamentos.
 * Saidas: so as do tipo "saida" contam como consumo de material.
 */
export function apurarObra(
  orcamento: Orcamento,
  movimentos: MovimentoEstoque[],
  lancamentos: LancamentoObra[] = orcamento.lancamentosObra || [],
): Apuramento {
  const itens = orcamento.itens || []
  const valores = resumoDeValores(orcamento)

  const real = (tipo: TipoLancamentoObra) =>
    round2(lancamentos.filter((l) => l.tipo === tipo).reduce((s, l) => s + totalLancamento(l), 0))
  const materialReal = round2(
    movimentos.filter((m) => m.tipo === "saida").reduce((s, m) => s + custoMovimento(m), 0),
  )

  const materiais = somaItens(itens, "material")
  const maoObra = somaItens(itens, "mao_obra")
  const servicos = somaItens(itens, "servico")

  const blocos: BlocoApuramento[] = [
    { id: "materiais", nome: "Materiais", ...materiais, real: materialReal, ajuda: "Real = saidas de estoque para esta obra" },
    { id: "mao_obra", nome: "Mao de obra", ...maoObra, real: real("mao_obra"), ajuda: "Real = custo informado no apuramento" },
    {
      id: "servicos",
      nome: "Servicos (composicao)",
      ...servicos,
      real: null,
      ajuda: "O custo real dos servicos entra pelos materiais, mao de obra e terceiros",
    },
    { id: "terceiros", nome: "Servicos de terceiros", vendido: null, previsto: null, real: real("terceiros") },
    { id: "aluguer", nome: "Aluguer de equipamento", vendido: null, previsto: null, real: real("aluguer") },
    { id: "transporte", nome: "Transporte", vendido: valores.transporte, previsto: valores.transporte, real: real("transporte") },
    { id: "outros", nome: "Outros custos", vendido: null, previsto: null, real: real("outros") },
  ]

  const custoReal = round2(blocos.reduce((s, b) => s + (b.real ?? 0), 0))
  const venda = valores.baseTributavel
  const custoPrevisto = valores.totalCusto
  const lucroPrevisto = round2(venda - custoPrevisto)
  const lucroReal = round2(venda - custoReal)

  return {
    blocos,
    venda,
    margemGlobal: valores.margemValor,
    custoPrevisto,
    custoReal,
    lucroPrevisto,
    lucroReal,
    margemPrevista: percentagem(lucroPrevisto, venda),
    margemReal: percentagem(lucroReal, venda),
    temReal: custoReal > 0,
  }
}

/** A obra pode ser apurada? So depois de o cliente adjudicar. */
export function podeApurar(orcamento: Pick<Orcamento, "status" | "tipoDocumento">): boolean {
  return orcamento.status === "aceite" || orcamento.tipoDocumento === "obra"
}
