import { calculateItemTotal, resumoDeValores } from "@/lib/orcamento-calculos"
import type { AutoMedicao, Conta, LinhaAuto, Orcamento, RegistoHoras } from "@/lib/types"
import { hojeLocal, round2 } from "@/lib/utils"

/**
 * Regras da obra depois da adjudicacao: parcelas, autos de medicao, contas.
 * Tudo sem IVA salvo onde se diz o contrario (contas sao com IVA: e o que se
 * recebe e paga de facto).
 */

export interface ParcelaPlano {
  descricao: string
  /** Percentagem do valor remanescente. */
  percent: number
  /** ISO yyyy-mm-dd. */
  vencimento: string
}

/** Soma dias a uma data ISO, sem passar por UTC. */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number)
  const data = new Date(a, m - 1, d + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`
}

/** Plano como o da folha: 50% na adjudicacao e 50% no fim. */
export function planoPadrao(dataAdjudicacao: string): ParcelaPlano[] {
  return [
    { descricao: "1.a fatura - adjudicacao", percent: 50, vencimento: dataAdjudicacao },
    { descricao: "2.a fatura - conclusao", percent: 50, vencimento: somarDias(dataAdjudicacao, 30) },
  ]
}

/**
 * Contas a receber de uma adjudicacao: o sinal (ja recebido) e as parcelas
 * sobre o remanescente. A ultima parcela absorve o arredondamento, para a
 * soma bater certo ao centimo com o valor adjudicado.
 */
export function contasDaAdjudicacao(
  base: Pick<Conta, "orcamentoId" | "orcamentoNumero" | "entidade" | "userId">,
  valor: number,
  sinal: number,
  dataAdjudicacao: string,
  parcelas: ParcelaPlano[],
): Array<Omit<Conta, "id" | "createdAt">> {
  const contas: Array<Omit<Conta, "id" | "createdAt">> = []
  const comum = { ...base, tipo: "receber" as const, origem: "adjudicacao" as const }
  if (sinal > 0) {
    contas.push({ ...comum, descricao: "Sinal", valor: round2(sinal), vencimento: dataAdjudicacao, estado: "pago", dataPagamento: dataAdjudicacao })
  }
  const remanescente = round2(valor - sinal)
  let acumulado = 0
  parcelas.forEach((p, i) => {
    const ultima = i === parcelas.length - 1
    const valorParcela = ultima ? round2(remanescente - acumulado) : round2((remanescente * p.percent) / 100)
    acumulado = round2(acumulado + valorParcela)
    contas.push({ ...comum, descricao: p.descricao, valor: valorParcela, vencimento: p.vencimento, estado: "pendente" })
  })
  return contas
}

/**
 * Fator que leva o preco de lista dos itens ao preco contratual: dilui a
 * margem global, os custos indiretos e o transporte, como no PDF de venda.
 * Assim um auto que mede 100% de tudo vale exatamente a base sem IVA.
 */
export function fatorContratual(orcamento: Orcamento): number {
  const { subtotal, baseTributavel } = resumoDeValores(orcamento)
  return subtotal > 0 ? baseTributavel / subtotal : 1
}

/** Quanto de cada item ja foi medido nos autos dados. */
export function medidoPorItem(autos: AutoMedicao[]): Record<string, number> {
  const medido: Record<string, number> = {}
  for (const auto of autos) for (const l of auto.linhas) medido[l.itemId] = round2((medido[l.itemId] || 0) + (Number(l.quantidade) || 0))
  return medido
}

/** Linhas de um auto novo: cada item com o contratual e o ja medido. */
export function linhasNovoAuto(orcamento: Orcamento, autosAnteriores: AutoMedicao[]): LinhaAuto[] {
  const fator = fatorContratual(orcamento)
  const medido = medidoPorItem(autosAnteriores)
  return (orcamento.itens || []).map((item) => {
    const quantidadeContratual = item.valorFixo ? 1 : Number(item.quantidade) || 0
    const totalItem = calculateItemTotal(item.quantidade, item.precoUnitario, item.valorFixo)
    return {
      itemId: item.id,
      nome: item.nome || item.descricao,
      unidade: item.valorFixo ? "vg" : item.unidade,
      quantidadeContratual,
      precoUnitario: quantidadeContratual > 0 ? round2((totalItem * fator) / quantidadeContratual) : 0,
      totalContratual: round2(totalItem * fator),
      quantidadeAnterior: medido[item.id] || 0,
      quantidade: 0,
    }
  })
}

/** Valor de uma linha: fracao medida do total contratual (sem o erro do unitario arredondado). */
export function valorLinhaAuto(l: LinhaAuto): number {
  const q = Number(l.quantidade) || 0
  if (l.totalContratual !== undefined && l.quantidadeContratual > 0) return round2((l.totalContratual * q) / l.quantidadeContratual)
  return round2(q * (Number(l.precoUnitario) || 0))
}

export function valorAuto(linhas: LinhaAuto[]): number {
  return round2(linhas.reduce((s, l) => s + valorLinhaAuto(l), 0))
}

/** Percentagem medida da obra (sobre a base sem IVA). */
export function percentMedido(orcamento: Orcamento, autosAprovados: AutoMedicao[]): number {
  const base = resumoDeValores(orcamento).baseTributavel
  const medido = autosAprovados.reduce((s, a) => s + a.valor, 0)
  return base > 0 ? round2((medido / base) * 100) : 0
}

export interface ResumoContas {
  aReceber: number
  recebido: number
  aPagar: number
  pago: number
  vencido: number
  /** A receber menos a pagar, em aberto. */
  saldo: number
}

export function resumoContas(contas: Conta[], hoje = hojeLocal()): ResumoContas {
  const soma = (f: (c: Conta) => boolean) => round2(contas.filter(f).reduce((s, c) => s + (Number(c.valor) || 0), 0))
  const aReceber = soma((c) => c.tipo === "receber" && c.estado === "pendente")
  const aPagar = soma((c) => c.tipo === "pagar" && c.estado === "pendente")
  return {
    aReceber,
    recebido: soma((c) => c.tipo === "receber" && c.estado === "pago"),
    aPagar,
    pago: soma((c) => c.tipo === "pagar" && c.estado === "pago"),
    vencido: soma((c) => c.estado === "pendente" && c.vencimento < hoje),
    saldo: round2(aReceber - aPagar),
  }
}

/** Dias ate ao vencimento (negativo = vencida). */
export function diasAte(vencimento: string, hoje = hojeLocal()): number {
  const [a1, m1, d1] = hoje.split("-").map(Number)
  const [a2, m2, d2] = vencimento.split("-").map(Number)
  return Math.round((new Date(a2, m2 - 1, d2).getTime() - new Date(a1, m1 - 1, d1).getTime()) / 86400000)
}

/** Contas pendentes que vencem nos proximos N dias ou ja venceram: os alertas. */
export function contasEmAlerta(contas: Conta[], dias = 5, hoje = hojeLocal()): Conta[] {
  return contas
    .filter((c) => c.estado === "pendente" && diasAte(c.vencimento, hoje) <= dias)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
}

/** Custo de mao de obra das horas aprovadas: horas x (custo/hora + custo fixo/hora). */
export function custoHoras(registos: RegistoHoras[]) {
  const aprovados = registos.filter((r) => r.estado === "aprovado")
  return {
    horas: round2(aprovados.reduce((s, r) => s + (Number(r.horas) || 0), 0)),
    maoObra: round2(aprovados.reduce((s, r) => s + (Number(r.horas) || 0) * (Number(r.custoHora) || 0), 0)),
    estrutura: round2(aprovados.reduce((s, r) => s + (Number(r.horas) || 0) * (Number(r.custoFixoHora) || 0), 0)),
  }
}
