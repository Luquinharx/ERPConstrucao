import { calculateItemTotal, resumoDeValores } from "@/lib/orcamento-calculos"
import { embalagens } from "@/lib/composicao-catalogo"
import { custoHoras } from "@/lib/obra"
import type {
  FaturaFornecedor,
  ItemOrcamento,
  LancamentoObra,
  Material,
  MovimentoEstoque,
  Orcamento,
  RegistoHoras,
  TipoLancamentoObra,
} from "@/lib/types"
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

type Parte = "materiais" | "mao_obra" | "outros" | "servicos"

/**
 * Vendido e previsto por bloco. Um servico com composicao reparte-se pelos
 * blocos (material, mao de obra, outros) na proporcao do custo, para o real
 * de cada bloco ter com que se comparar. Sem composicao conhecida (servicos
 * antigos) fica num bloco proprio.
 */
function repartirItens(itens: ItemOrcamento[]) {
  const soma: Record<Parte, { vendido: number; previsto: number }> = {
    materiais: { vendido: 0, previsto: 0 },
    mao_obra: { vendido: 0, previsto: 0 },
    outros: { vendido: 0, previsto: 0 },
    servicos: { vendido: 0, previsto: 0 },
  }
  const juntar = (parte: Parte, vendido: number, previsto: number) => {
    soma[parte].vendido += vendido
    soma[parte].previsto += previsto
  }
  for (const i of itens) {
    const vendido = Number(i.total) || 0
    const previsto = calculateItemTotal(i.quantidade, i.custoUnitario ?? i.precoUnitario, i.valorFixo)
    if (i.tipo === "material") juntar("materiais", vendido, previsto)
    else if (i.tipo === "mao_obra") juntar("mao_obra", vendido, previsto)
    else {
      const d = i.decomposicao
      const total = d ? (d.materiais || 0) + (d.mao_obra || 0) + (d.outros || 0) : 0
      if (!d || total <= 0) juntar("servicos", vendido, previsto)
      else
        for (const parte of ["materiais", "mao_obra", "outros"] as const) {
          const peso = (d[parte] || 0) / total
          juntar(parte, vendido * peso, previsto * peso)
        }
    }
  }
  for (const parte of Object.keys(soma) as Parte[]) {
    soma[parte].vendido = round2(soma[parte].vendido)
    soma[parte].previsto = round2(soma[parte].previsto)
  }
  return soma
}

const percentagem = (parte: number, todo: number) => (todo > 0 ? round2((parte / todo) * 100) : 0)

/**
 * Junta orcamento, saidas de estoque da obra e lancamentos.
 * Saidas: so as do tipo "saida" contam como consumo de material.
 */
export interface FontesReais {
  /** Registos do livro de ponto desta obra (so os aprovados contam). */
  horas?: RegistoHoras[]
  /** Faturas de fornecedor desta obra (so as aprovadas contam). */
  faturas?: FaturaFornecedor[]
}

export function apurarObra(
  orcamento: Orcamento,
  movimentos: MovimentoEstoque[],
  lancamentos: LancamentoObra[] = orcamento.lancamentosObra || [],
  fontes: FontesReais = {},
): Apuramento {
  const itens = orcamento.itens || []
  const valores = resumoDeValores(orcamento)

  const faturasAprovadas = (fontes.faturas || []).filter((f) => f.estado === "aprovada")
  // Lancado a mao no apuramento + faturas de fornecedor aprovadas do mesmo tipo
  const real = (tipo: TipoLancamentoObra) =>
    round2(
      lancamentos.filter((l) => l.tipo === tipo).reduce((s, l) => s + totalLancamento(l), 0) +
        faturasAprovadas.filter((f) => f.tipo === tipo).reduce((s, f) => s + (Number(f.valorSemIVA) || 0), 0),
    )
  // Material: o que saiu para a obra, menos o que voltou ao armazem
  const materialReal = round2(
    movimentos.filter((m) => m.tipo === "saida").reduce((s, m) => s + custoMovimento(m), 0) -
      movimentos.filter((m) => m.tipo === "entrada" && m.devolucao).reduce((s, m) => s + custoMovimento(m), 0),
  )
  const ponto = custoHoras(fontes.horas || [])

  const partes = repartirItens(itens)
  const materiais = partes.materiais
  const maoObra = partes.mao_obra
  const servicos = partes.servicos
  const indiretos = orcamento.custosIndiretos
  const indiretosCusto = round2(
    (Number(indiretos?.estaleiro) || 0) + (Number(indiretos?.seguros) || 0) + (Number(indiretos?.licenciamento) || 0),
  )

  const blocos: BlocoApuramento[] = [
    { id: "materiais", nome: "Materiais", ...materiais, real: materialReal, ajuda: "Real = saidas de estoque para esta obra" },
    {
      id: "mao_obra",
      nome: "Mao de obra",
      ...maoObra,
      real: round2(real("mao_obra") + ponto.maoObra),
      ajuda: "Real = horas aprovadas no livro de ponto + lancamentos",
    },
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
    {
      id: "outros",
      nome: "Equipamento e outros custos",
      vendido: partes.outros.vendido || null,
      previsto: partes.outros.previsto || null,
      real: real("outros"),
      ajuda: "Previsto = aluguer, vazadouro, transporte e extras das composicoes",
    },
    {
      id: "indiretos",
      nome: "Custos indiretos (estaleiro, seguros, licencas)",
      vendido: null,
      previsto: indiretosCusto || null,
      real: null,
      ajuda: "Os gastos reais entram como faturas ou lancamentos dos outros blocos",
    },
    {
      id: "estrutura",
      nome: "Estrutura (custo fixo/hora)",
      vendido: null,
      previsto: null,
      real: ponto.estrutura,
      ajuda: "Horas aprovadas x custo fixo/hora da empresa",
    },
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

export interface NecessidadeMaterial {
  materialId: string
  nome: string
  unidade: string
  previsto: number
  /** Ja saiu para a obra (saidas - devolucoes). */
  saido: number
  falta: number
  /** A falta convertida em embalagens de compra, se o produto as tiver. */
  comprar: { quantidade: number; unidade: string } | null
}

/**
 * Material que a obra precisa, pela composicao dos itens, contra o que ja
 * saiu do estoque para ela. E a lista de compras da obra.
 */
export function necessidadesMaterial(
  orcamento: Orcamento,
  movimentos: MovimentoEstoque[],
  materiais: Material[],
): NecessidadeMaterial[] {
  const previsto = new Map<string, { nome: string; unidade: string; quantidade: number }>()
  for (const item of orcamento.itens || []) {
    for (const m of item.materiaisPrevistos || []) {
      const atual = previsto.get(m.materialId) || { nome: m.nome, unidade: m.unidade, quantidade: 0 }
      atual.quantidade = round2(atual.quantidade + m.porUnidade * (Number(item.quantidade) || 0))
      previsto.set(m.materialId, atual)
    }
  }
  return [...previsto.entries()].map(([materialId, p]) => {
    const saido = round2(
      movimentos.filter((m) => m.materialId === materialId && m.tipo === "saida").reduce((s, m) => s + m.quantidade, 0) -
        movimentos.filter((m) => m.materialId === materialId && m.tipo === "entrada" && m.devolucao).reduce((s, m) => s + m.quantidade, 0),
    )
    const falta = round2(Math.max(0, p.quantidade - saido))
    const produto = materiais.find((m) => m.id === materialId)
    return { materialId, nome: produto?.nome || p.nome, unidade: p.unidade, previsto: p.quantidade, saido, falta, comprar: falta > 0 ? embalagens(falta, produto) : null }
  })
}
