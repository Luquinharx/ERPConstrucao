import type { ItemOrcamento, Orcamento, Servico } from "@/lib/types"
import { round2 } from "@/lib/utils"

/**
 * Contas e convencoes de apresentacao de um orcamento.
 *
 * Vivem fora dos ecras porque a lista, o editor e o documento impresso fazem
 * todos as mesmas contas: se cada um as fizesse por si, mais tarde ou mais
 * cedo discordavam num cent.
 */

/** Documento gerado: venda (cliente) ou custo (interno). */
export type TipoDocumento = "venda" | "custo"

/** Taxas de IVA em Portugal (continente). */
export const TAXAS_IVA = [
  { valor: 23, label: "23% - Taxa normal" },
  { valor: 13, label: "13% - Taxa intermedia" },
  { valor: 6, label: "6% - Taxa reduzida (ex.: obras em habitacao)" },
  { valor: 0, label: "0% - Isento / autoliquidacao" },
]

/** Item sem comodo definido cai neste grupo. */
export const SEM_AMBIENTE = "Sem comodo"

export function toDateInput(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Total do item. Itens marcados como valor fixo nao multiplicam pela
 * quantidade/area (ex.: andaime, deslocacao, montagem).
 */
export function calculateItemTotal(quantidade: number, precoUnitario: number, valorFixo?: boolean): number {
  if (valorFixo) return round2(precoUnitario)
  return round2((Number(quantidade) || 0) * (Number(precoUnitario) || 0))
}

/**
 * Agrupa os itens por comodo, respeitando a ordem definida no orcamento.
 * Devolve tambem o subtotal de cada grupo, como no formato usado em obra
 * (1 Sala, 1.1, 1.2 ... com o total da divisao no cabecalho).
 */
export function agruparPorAmbiente(itens: ItemOrcamento[], ambientes: string[] = []) {
  const grupos = new Map<string, ItemOrcamento[]>()

  for (const nome of ambientes) grupos.set(nome, [])
  for (const item of itens) {
    const chave = item.ambiente?.trim() || SEM_AMBIENTE
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(item)
  }

  return Array.from(grupos.entries())
    .filter(([, lista]) => lista.length > 0)
    .map(([nome, lista]) => ({
      nome,
      itens: lista,
      subtotal: round2(lista.reduce((acc, item) => acc + (Number(item.total) || 0), 0)),
    }))
}

export function calculateSubtotal(itens: ItemOrcamento[]): number {
  return round2(itens.reduce((sum, item) => sum + (Number(item.total) || 0), 0))
}

export function calculateSubtotalCusto(itens: ItemOrcamento[]): number {
  return round2(
    itens.reduce((sum, item) => {
      const custo = item.custoUnitario ?? item.precoUnitario
      return sum + calculateItemTotal(item.quantidade, custo, item.valorFixo)
    }, 0),
  )
}

/**
 * Base tributavel: subtotal + margem + transporte. E sobre este valor que
 * incide o IVA, e e este o valor comparado com o custo para apurar o lucro
 * (o IVA nao e receita, e cobrado para o Estado).
 */
export function calculateBaseTributavel(subtotal: number, margemLucro: number, transporte = 0): number {
  return round2(subtotal * (1 + (Number(margemLucro) || 0) / 100) + (Number(transporte) || 0))
}

export function calculateIVA(baseTributavel: number, taxaIVA = 0): number {
  return round2(baseTributavel * ((Number(taxaIVA) || 0) / 100))
}

/** Total final que o cliente paga: base tributavel + IVA. */
export function calculateTotal(subtotal: number, margemLucro: number, transporte = 0, taxaIVA = 0): number {
  const base = calculateBaseTributavel(subtotal, margemLucro, transporte)
  return round2(base + calculateIVA(base, taxaIVA))
}

/** Total de custo: custo real dos itens + transporte, sem margem. */
export function calculateTotalCusto(subtotalCusto: number, transporte = 0): number {
  return round2(subtotalCusto + (Number(transporte) || 0))
}

/**
 * Preco unitario do servico. Na composicao por quantidade de referencia tudo
 * (incluindo transporte e aluguer) ja esta diluido no preco por unidade, entao
 * basta multiplicar pela quantidade do orcamento.
 *
 * Servicos ainda no formato antigo tinham o transporte somado ao preco: nesse
 * caso ele e retirado, para nao ser cobrado duas vezes com a linha de transporte
 * do orcamento.
 */
export function getServicoPrecos(servico: Servico) {
  const temComposicao = Boolean(servico.composicao)
  if (temComposicao) {
    return { precoVariavel: round2(servico.preco ?? 0), precoFixo: 0, transporte: 0 }
  }

  const transporte = round2(servico.transporte ?? 0)
  const temSplit = servico.precoVariavel !== undefined || servico.precoFixo !== undefined

  return {
    precoVariavel: temSplit ? round2(servico.precoVariavel ?? 0) : round2(Number(servico.preco ?? 0) - transporte),
    precoFixo: temSplit ? round2(servico.precoFixo ?? 0) : 0,
    transporte,
  }
}

/**
 * Cor de cada comodo, atribuida pela ordem em que aparece.
 * Serve para distinguir as seccoes de relance, sobretudo no tema escuro.
 * A lista repete-se se houver mais comodos do que cores.
 */
const CORES_AMBIENTE = [
  { cabecalho: "bg-sky-500/15 text-sky-700 dark:text-sky-300", barra: "border-l-sky-500" },
  { cabecalho: "bg-violet-500/15 text-violet-700 dark:text-violet-300", barra: "border-l-violet-500" },
  { cabecalho: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", barra: "border-l-emerald-500" },
  { cabecalho: "bg-amber-500/15 text-amber-700 dark:text-amber-300", barra: "border-l-amber-500" },
  { cabecalho: "bg-rose-500/15 text-rose-700 dark:text-rose-300", barra: "border-l-rose-500" },
  { cabecalho: "bg-teal-500/15 text-teal-700 dark:text-teal-300", barra: "border-l-teal-500" },
]

export function getCorAmbiente(indice: number) {
  return CORES_AMBIENTE[indice % CORES_AMBIENTE.length]
}

/** Cor de fundo e borda por tipo de item, para distinguir a olho na lista. */
export function getItemEstilo(tipo: ItemOrcamento["tipo"]) {
  switch (tipo) {
    case "mao_obra":
      return {
        card: "border-l-4 border-l-blue-500 bg-blue-500/10",
        badge: "bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/40",
        label: "Mao de obra",
      }
    case "material":
      return {
        card: "border-l-4 border-l-amber-500 bg-amber-500/10",
        badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
        label: "Material",
      }
    default:
      return {
        card: "border-l-4 border-l-emerald-500 bg-emerald-500/10",
        badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
        label: "Servico",
      }
  }
}

/** Descricao impressa no PDF: no de venda o nome do funcionario nunca aparece. */
export function getItemDescricaoDocumento(item: ItemOrcamento, tipo: TipoDocumento): string {
  if (tipo === "custo") return item.nome || item.descricao
  if (item.tipo === "mao_obra") return item.descricaoCliente || "Mao de obra"
  return item.nome || item.descricao
}

export function escapeHtml(input?: string): string {
  if (!input) return ""
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>")
}

/**
 * Decomposicao do valor de uma proposta: custo, margem, base e IVA.
 *
 * Vive num sitio so porque e usada no cartao da lista E no documento impresso;
 * se cada um fizesse as suas contas, mais tarde ou mais cedo discordavam.
 * Propostas antigas nao guardavam base tributavel nem IVA: nesse caso o total
 * ja e a propria base.
 */
export function resumoDeValores(orcamento: Orcamento) {
  const itens = orcamento.itens || []
  const subtotal = round2(orcamento.subtotal || 0)
  const subtotalCusto = round2(orcamento.subtotalCusto ?? calculateSubtotalCusto(itens))
  const transporte = round2(orcamento.transporte || 0)
  const margem = round2(orcamento.margemLucro || 0)
  const margemValor = round2((subtotal * margem) / 100)
  const totalVenda = round2(orcamento.valorTotal || 0)
  const taxaIVA = round2(orcamento.taxaIVA ?? 0)
  const valorIVA = round2(orcamento.valorIVA ?? 0)
  const baseTributavel = round2(orcamento.baseTributavel ?? totalVenda - valorIVA)
  const totalCusto = round2(orcamento.valorTotalCusto ?? calculateTotalCusto(subtotalCusto, transporte))

  return {
    subtotal,
    subtotalCusto,
    transporte,
    margem,
    margemValor,
    totalVenda,
    taxaIVA,
    valorIVA,
    baseTributavel,
    totalCusto,
  }
}
