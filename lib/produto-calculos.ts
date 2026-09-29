import type {
  FuncaoMaoObra,
  Funcionario,
  GrupoImpostos,
  ImpostoProduto,
  Material,
  RegraImposto,
  TipoMovimentoEstoque,
} from "@/lib/types"
import { round2 } from "@/lib/utils"

/**
 * Contas do cadastro de produtos e funcoes.
 *
 * Custo real, preco de venda e margem sao a mesma conta vista de tres lados;
 * vivem aqui para o cadastro, o estoque e o orcamento nunca discordarem.
 *
 * Impostos seguem a logica do Sankhya, simplificada:
 * - o produto escolhe um GRUPO de impostos, definido uma vez;
 * - imposto de compra nao recuperavel entra no custo; o recuperavel (ex.: IVA
 *   dedutivel) so gera credito;
 * - impostos de venda formam o preco por markup divisor:
 *   preco = custo x (1 + margem) / (1 - %impostos de venda).
 *   Assim a margem e o lucro que sobra DEPOIS de pagar os impostos da venda.
 * O IVA cobrado ao cliente continua a ser somado por fora, no orcamento.
 */

export type ProdutoParaImpostos = Pick<
  Material,
  "grupoImpostosId" | "temImpostos" | "impostos" | "precoCompra" | "outrosCustos"
>

export interface ResumoImpostos {
  grupo?: GrupoImpostos
  /** Impostos de compra que entram no custo, em euros por unidade. */
  compraNoCusto: number
  /** Impostos de compra recuperaveis (credito), em euros por unidade. */
  credito: number
  /** Soma das percentagens de impostos de venda. */
  percentualVenda: number
}

/** Valor de uma regra de compra por unidade, sobre o preco de compra. */
export function valorRegra(regra: RegraImposto, precoCompra: number): number {
  return round2(((Number(precoCompra) || 0) * (Number(regra.percentual) || 0)) / 100)
}

function valorImpostoAntigo(imposto: ImpostoProduto, precoCompra: number): number {
  const valor = Number(imposto.valor) || 0
  return imposto.modo === "valor" ? round2(valor) : round2(((Number(precoCompra) || 0) * valor) / 100)
}

/**
 * O que os impostos do produto significam em euros e em percentagem.
 * Produtos sem grupo mas com impostos no formato antigo continuam a contar
 * esses impostos no custo, ate alguem lhes escolher um grupo.
 */
export function resumoImpostos(produto: ProdutoParaImpostos, grupos: GrupoImpostos[] = []): ResumoImpostos {
  const compra = Number(produto.precoCompra) || 0
  const grupo = produto.grupoImpostosId ? grupos.find((g) => g.id === produto.grupoImpostosId) : undefined

  if (!grupo) {
    const antigos = produto.temImpostos ? produto.impostos || [] : []
    return {
      compraNoCusto: round2(antigos.reduce((soma, imp) => soma + valorImpostoAntigo(imp, compra), 0)),
      credito: 0,
      percentualVenda: 0,
    }
  }

  let compraNoCusto = 0
  let credito = 0
  let percentualVenda = 0
  for (const regra of grupo.regras) {
    if (regra.incidencia === "venda") percentualVenda += Number(regra.percentual) || 0
    else if (regra.recuperavel) credito += valorRegra(regra, compra)
    else compraNoCusto += valorRegra(regra, compra)
  }
  return { grupo, compraNoCusto: round2(compraNoCusto), credito: round2(credito), percentualVenda: round2(percentualVenda) }
}

/** Custo real por unidade: compra + impostos de compra nao recuperaveis + outros custos. */
export function custoRealProduto(produto: ProdutoParaImpostos, grupos: GrupoImpostos[] = []): number {
  return round2(
    (Number(produto.precoCompra) || 0) +
      resumoImpostos(produto, grupos).compraNoCusto +
      (Number(produto.outrosCustos) || 0),
  )
}

/** Divisor do markup: o que sobra do preco depois dos impostos de venda. */
function divisorVenda(percentualVenda = 0): number {
  return 1 - (Number(percentualVenda) || 0) / 100
}

/** Preco que deixa `margem`% de lucro sobre o custo depois dos impostos de venda. */
export function precoPorMargem(custo: number, margem: number, percentualVenda = 0): number {
  const divisor = divisorVenda(percentualVenda)
  if (divisor <= 0) return 0
  return round2(((Number(custo) || 0) * (1 + (Number(margem) || 0) / 100)) / divisor)
}

/** Margem (%) sobre o custo que um preco deixa, ja sem os impostos de venda. */
export function margemPorPreco(custo: number, preco: number, percentualVenda = 0): number {
  const c = Number(custo) || 0
  if (c <= 0) return 0
  const liquido = (Number(preco) || 0) * divisorVenda(percentualVenda)
  return round2(((liquido - c) / c) * 100)
}

/**
 * Custo real de um produto gravado. Produtos antigos so tinham `precoUnitario`
 * (que ja era o custo); nesse caso e esse o valor.
 */
export function custoDoProduto(produto: Material, grupos: GrupoImpostos[] = []): number {
  if (produto.precoCompra === undefined) return round2(produto.precoUnitario || 0)
  return custoRealProduto(produto, grupos)
}

/** Preco de venda de um produto gravado. Sem preco definido, vende-se ao custo. */
export function vendaDoProduto(produto: Material, grupos: GrupoImpostos[] = []): number {
  if (produto.precoVenda !== undefined && produto.precoVenda > 0) return round2(produto.precoVenda)
  return custoDoProduto(produto, grupos)
}

/**
 * Custo do produto num orcamento: custo real + os impostos que a venda vai
 * pagar ao preco de tabela. Sem isto o lucro previsto ignorava os impostos
 * de venda e parecia maior do que e.
 */
export function custoOrcamentoProduto(produto: Material, grupos: GrupoImpostos[] = []): number {
  const { percentualVenda } = resumoImpostos(produto, grupos)
  return round2(custoDoProduto(produto, grupos) + (vendaDoProduto(produto, grupos) * percentualVenda) / 100)
}

export function estoqueBaixo(produto: Material): boolean {
  if (!produto.controlaEstoque) return false
  const minimo = Number(produto.estoqueMinimo) || 0
  return (Number(produto.estoqueAtual) || 0) <= minimo && minimo > 0
}

/**
 * Custo medio ponderado depois de uma entrada. Com saldo negativo ou zero o
 * medio antigo ja nao representa nada, e a entrada passa a ser o medio.
 */
export function custoMedioAposEntrada(
  saldoAnterior: number,
  medioAnterior: number,
  quantidade: number,
  custoUnitario: number,
): number {
  const saldo = Number(saldoAnterior) || 0
  const qtd = Number(quantidade) || 0
  if (saldo <= 0 || !medioAnterior) return round2(custoUnitario)
  const total = saldo + qtd
  if (total <= 0) return round2(custoUnitario)
  return round2((saldo * medioAnterior + qtd * custoUnitario) / total)
}

/** Saldo depois de um movimento. No ajuste a quantidade e a propria contagem. */
export function saldoAposMovimento(saldoAnterior: number, tipo: TipoMovimentoEstoque, quantidade: number): number {
  const saldo = Number(saldoAnterior) || 0
  const qtd = Number(quantidade) || 0
  if (tipo === "entrada") return round2(saldo + qtd)
  if (tipo === "saida") return round2(saldo - qtd)
  return round2(qtd)
}

export const TIPOS_MOVIMENTO: Record<TipoMovimentoEstoque, { nome: string; cor: string }> = {
  entrada: { nome: "Entrada", cor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
  saida: { nome: "Saida", cor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40" },
  ajuste: { nome: "Ajuste", cor: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40" },
}

// ------------------------------------------------------------ Mao de obra

function mesmoNome(a?: string, b?: string): boolean {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase()
}

/** Custo real por hora de um funcionario (sem a margem dele). */
export function custoHoraFuncionario(funcionario: Funcionario): number {
  return round2(funcionario.custoHoraCalculado ?? funcionario.custoHora ?? 0)
}

/**
 * Funcionarios ativos de uma funcao. A ligacao e pelo nome da funcao gravado
 * no funcionario, para nao ser preciso migrar os registos que ja existem.
 */
export function funcionariosDaFuncao(funcao: Pick<FuncaoMaoObra, "nome">, funcionarios: Funcionario[]): Funcionario[] {
  return funcionarios.filter((f) => f.ativo !== false && mesmoNome(f.funcao, funcao.nome))
}

/** Custo medio por hora da funcao: media dos funcionarios ativos que a exercem. */
export function custoMedioFuncao(funcao: Pick<FuncaoMaoObra, "nome">, funcionarios: Funcionario[]): number {
  const lista = funcionariosDaFuncao(funcao, funcionarios)
  if (lista.length === 0) return 0
  return round2(lista.reduce((soma, f) => soma + custoHoraFuncionario(f), 0) / lista.length)
}

export function funcaoDoFuncionario(funcionario: Funcionario, funcoes: FuncaoMaoObra[]): FuncaoMaoObra | undefined {
  return funcoes.find((funcao) => mesmoNome(funcao.nome, funcionario.funcao))
}

export function descricaoClienteFuncao(funcao: FuncaoMaoObra): string {
  return funcao.descricaoCliente?.trim() || `Mao de obra - ${funcao.nome}`
}
