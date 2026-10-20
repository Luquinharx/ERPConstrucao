import { custoDoProduto, custoHoraFuncionario, custoMedioFuncao } from "@/lib/produto-calculos"
import { calcularTotalLinha, migrarComposicaoLegada } from "@/lib/service-composition"
import type {
  DecomposicaoCusto,
  FuncaoMaoObra,
  Funcionario,
  GrupoImpostos,
  Material,
  MaterialPrevisto,
  Servico,
  ServicoComposicaoItem,
} from "@/lib/types"
import { round2 } from "@/lib/utils"

/**
 * Composicao alimentada pelo catalogo.
 *
 * Na folha de obra cada linha da composicao tinha o preco escrito a mao
 * (15 EUR/h, 125 EUR o material). Aqui cada linha ligada ao catalogo vai buscar
 * o custo de HOJE: muda o preco da tinta em Produtos e todas as composicoes
 * que a usam acompanham. Linhas sem ligacao ficam com o valor escrito.
 */

export interface Catalogo {
  materiais: Material[]
  funcionarios: Funcionario[]
  funcoes: FuncaoMaoObra[]
  grupos?: GrupoImpostos[]
}

/** Custo atual de uma linha pelo catalogo, ou o valor escrito se nao estiver ligada. */
export function precoLinhaCatalogo(linha: ServicoComposicaoItem, catalogo: Catalogo): number {
  if (linha.materialId) {
    const m = catalogo.materiais.find((x) => x.id === linha.materialId)
    if (m) return custoDoProduto(m, catalogo.grupos)
  }
  if (linha.funcionarioId) {
    const f = catalogo.funcionarios.find((x) => x.id === linha.funcionarioId)
    if (f) return custoHoraFuncionario(f)
  }
  if (linha.funcaoId) {
    const f = catalogo.funcoes.find((x) => x.id === linha.funcaoId)
    const medio = f ? custoMedioFuncao(f, catalogo.funcionarios) : 0
    if (medio > 0) return medio
  }
  return round2(Number(linha.precoUnitario) || 0)
}

export function recalcularComposicao(composicao: ServicoComposicaoItem[], catalogo: Catalogo): ServicoComposicaoItem[] {
  return composicao.map((linha) => {
    const precoUnitario = precoLinhaCatalogo(linha, catalogo)
    const nova = { ...linha, precoUnitario }
    return { ...nova, total: calcularTotalLinha(nova) }
  })
}

export interface CustoServico {
  /** Custo direto por unidade do servico. */
  custoUnitario: number
  decomposicao?: DecomposicaoCusto
  materiaisPrevistos: MaterialPrevisto[]
  /** Linhas cujo preco mudou desde que o servico foi gravado. */
  linhasAtualizadas: number
}

/** Custo por unidade de um servico com os precos atuais do catalogo. */
export function custoServicoAtual(servico: Servico, catalogo: Catalogo): CustoServico {
  if (!servico.composicao?.length) {
    // Formato antigo, sem composicao: so ha o preco gravado
    const { composicao, quantidadeReferencia } = migrarComposicaoLegada(servico)
    if (!composicao.length) return { custoUnitario: round2(servico.preco || 0), materiaisPrevistos: [], linhasAtualizadas: 0 }
    return calcular(composicao, quantidadeReferencia, catalogo)
  }
  return calcular(servico.composicao, Number(servico.quantidadeReferencia) || 1, catalogo)
}

function calcular(composicao: ServicoComposicaoItem[], referencia: number, catalogo: Catalogo): CustoServico {
  const atual = recalcularComposicao(composicao, catalogo)
  const linhasAtualizadas = atual.filter((l, i) => round2(l.precoUnitario) !== round2(composicao[i].precoUnitario)).length
  const soma = (grupos: string[]) =>
    round2(atual.filter((l) => grupos.includes(l.grupo)).reduce((s, l) => s + calcularTotalLinha(l), 0) / referencia)
  const mao_obra = soma(["mao_obra"])
  const materiais = soma(["materiais"])
  const outros = soma(["aluguel", "vazadouro", "transporte", "extras"])
  const materiaisPrevistos: MaterialPrevisto[] = atual
    .filter((l) => l.grupo === "materiais" && l.materialId && (Number(l.quantidadePontual) || 0) > 0)
    .map((l) => ({
      materialId: l.materialId!,
      nome: l.nome,
      unidade: l.unidade,
      porUnidade: round2(((Number(l.quantidadePadrao) || 0) * (Number(l.quantidadePontual) || 0)) / referencia),
    }))
  return {
    custoUnitario: round2(mao_obra + materiais + outros),
    decomposicao: { mao_obra, materiais, outros },
    materiaisPrevistos,
    linhasAtualizadas,
  }
}

/** Embalagens a comprar para uma quantidade tecnica (32,67 m2, rolo de 90 m2 -> 1 rolo). */
export function embalagens(quantidade: number, produto?: Pick<Material, "qtdPorEmbalagem" | "unidadeCompra">) {
  const porEmb = Number(produto?.qtdPorEmbalagem) || 0
  if (porEmb <= 0) return null
  return { quantidade: Math.ceil(round2(quantidade) / porEmb), unidade: produto?.unidadeCompra || "emb." }
}
