import type {
  ConfiguracaoEmpresa,
  ContextoFiscal,
  DecomposicaoCusto,
  DimensoesAmbiente,
  Especialidade,
  TipoMedicao,
} from "@/lib/types"
import { round2 } from "@/lib/utils"

/**
 * Precificacao no formato da folha de obra (MQT).
 *
 * preco = custo direto x (1 + estrutura% + margem da especialidade%)
 *
 * - Custo direto: o que a composicao/catalogo diz que o item custa.
 * - Estrutura ("FI Estrutura"): custos fixos da empresa, iguais para tudo.
 * - Margem da especialidade: construcao civil, aguas, gas, eletricidade,
 *   AVAC, SCIE... cada uma com a sua margem, como as colunas da folha.
 *
 * Na folha: FI 1,15 e Const. civil 1,15 => preco = custo x 1,30.
 */

export const ESPECIALIDADES_PADRAO: Especialidade[] = [
  { id: "civil", nome: "Construcao civil", margem: 15 },
  { id: "aguas", nome: "Aguas", margem: 25 },
  { id: "gas", nome: "Gas", margem: 25 },
  { id: "eletricidade", nome: "Eletricidade", margem: 25 },
  { id: "avac", nome: "AVAC", margem: 25 },
  { id: "scie", nome: "SCIE", margem: 25 },
]

export const ESTRUTURA_PADRAO = 15

export function especialidadesDe(config?: Partial<ConfiguracaoEmpresa> | null): Especialidade[] {
  return config?.especialidades?.length ? config.especialidades : ESPECIALIDADES_PADRAO
}

export function estruturaDe(config?: Partial<ConfiguracaoEmpresa> | null): number {
  return config?.estruturaPercent ?? ESTRUTURA_PADRAO
}

export function especialidade(id: string | undefined, config?: Partial<ConfiguracaoEmpresa> | null): Especialidade {
  const lista = especialidadesDe(config)
  return lista.find((e) => e.id === id) || lista[0]
}

/** Fator sobre o custo: 1 + estrutura + margem da especialidade. */
export function fatorEspecialidade(id: string | undefined, config?: Partial<ConfiguracaoEmpresa> | null): number {
  return 1 + (estruturaDe(config) + (Number(especialidade(id, config).margem) || 0)) / 100
}

export function precoPorEspecialidade(
  custo: number,
  id: string | undefined,
  config?: Partial<ConfiguracaoEmpresa> | null,
): number {
  return round2((Number(custo) || 0) * fatorEspecialidade(id, config))
}

/** Margem sobre a venda (%), a leitura que interessa ao cliente: lucro / preco. */
export function margemSobreVenda(custo: number, venda: number): number {
  return venda > 0 ? round2(((venda - custo) / venda) * 100) : 0
}

// ------------------------------------------------------------ Medicoes

export const MEDICOES: Record<TipoMedicao, { nome: string; unidade: string }> = {
  pavimento: { nome: "Pavimento", unidade: "m2" },
  teto: { nome: "Teto", unidade: "m2" },
  paredes: { nome: "Paredes (sem aberturas)", unidade: "m2" },
  perimetro: { nome: "Perimetro (rodape, sancas)", unidade: "ml" },
}

/** Quantidades de um comodo a partir das dimensoes, como o "Quadro de areas" da folha. */
export function medirAmbiente(d?: DimensoesAmbiente | null): Record<TipoMedicao, number> {
  const c = Number(d?.comprimento) || 0
  const l = Number(d?.largura) || 0
  const a = Number(d?.altura) || 0
  const aberturas = Number(d?.aberturas) || 0
  const perimetro = round2(2 * (c + l))
  return {
    pavimento: round2(c * l),
    teto: round2(c * l),
    paredes: round2(Math.max(0, perimetro * a - aberturas)),
    perimetro,
  }
}

export function temDimensoes(d?: DimensoesAmbiente | null): boolean {
  return !!d && (Number(d.comprimento) || 0) > 0 && (Number(d.largura) || 0) > 0
}

// ------------------------------------------------------------ IVA

/** Taxas de IVA por regiao fiscal: normal, intermedia, reduzida. */
export const TAXAS_REGIAO: Record<ContextoFiscal["regiao"], { nome: string; normal: number; intermedia: number; reduzida: number }> = {
  continente: { nome: "Continente", normal: 23, intermedia: 13, reduzida: 6 },
  madeira: { nome: "Madeira", normal: 22, intermedia: 12, reduzida: 5 },
  acores: { nome: "Acores", normal: 16, intermedia: 9, reduzida: 4 },
}

export const TIPOS_OBRA: Record<NonNullable<ContextoFiscal["tipoObra"]>, string> = {
  construcao_nova: "Construcao nova",
  reabilitacao_aru: "Reabilitacao urbana em ARU",
  remodelacao_habitacao: "Remodelacao / reparacao de habitacao",
  manutencao: "Manutencao",
  obra_publica: "Obra publica",
}

export const TIPOS_CLIENTE: Record<NonNullable<ContextoFiscal["tipoCliente"]>, string> = {
  particular: "Particular",
  empresa: "Empresa",
  construtor: "Construtor (sujeito passivo do setor)",
  publica: "Entidade publica",
}

export const TIPOS_OPERACAO: Record<NonNullable<ContextoFiscal["tipoOperacao"]>, string> = {
  empreitada: "Empreitada",
  subempreitada: "Subempreitada",
  servicos: "Servicos",
  materiais: "So materiais",
}

export interface SugestaoIVA {
  taxa: number
  regime: string
  fundamento: string
  /** Condicao a confirmar (ex.: peso dos materiais na verba 2.27). */
  aviso?: string
}

/**
 * Taxa de IVA sugerida pelo contexto da obra. E uma ajuda, nao um parecer:
 * o utilizador confirma e pode sempre escrever outra taxa.
 *
 * @param pesoMateriais fracao do custo que e material (0-1), para a verba 2.27
 */
export function sugerirIVA(contexto: Partial<ContextoFiscal> | undefined, pesoMateriais?: number): SugestaoIVA {
  const regiao = TAXAS_REGIAO[contexto?.regiao || "continente"]
  const c = contexto || {}

  const servicoConstrucao = c.tipoOperacao !== "materiais"
  if (c.tipoOperacao === "subempreitada" || (c.tipoCliente === "construtor" && servicoConstrucao)) {
    return {
      taxa: 0,
      regime: "Autoliquidacao",
      fundamento: "IVA devido pelo adquirente - art. 2.o, n.o 1, al. j) do CIVA (servicos de construcao civil a sujeito passivo).",
    }
  }
  if (c.tipoObra === "reabilitacao_aru" && c.tipoOperacao === "empreitada") {
    return {
      taxa: regiao.reduzida,
      regime: "IVA reduzido",
      fundamento: "Empreitada de reabilitacao urbana em ARU - verba 2.23 da Lista I anexa ao CIVA.",
    }
  }
  if (c.tipoObra === "remodelacao_habitacao" && c.tipoOperacao === "empreitada") {
    const acima = pesoMateriais !== undefined && pesoMateriais > 0.2
    return {
      taxa: acima ? regiao.normal : regiao.reduzida,
      regime: acima ? "IVA normal" : "IVA reduzido",
      fundamento: "Empreitada de beneficiacao/remodelacao de imovel de habitacao - verba 2.27 da Lista I anexa ao CIVA.",
      aviso: acima
        ? `Os materiais pesam ${Math.round(pesoMateriais! * 100)}% (> 20%): a verba 2.27 nao se aplica a parte dos materiais. Confirme com o contabilista.`
        : "So vale se os materiais nao passarem de 20% do valor global da empreitada.",
    }
  }
  return {
    taxa: regiao.normal,
    regime: "IVA normal",
    fundamento: `Taxa normal (${regiao.nome}) - art. 18.o do CIVA.`,
  }
}

/** Fracao de material numa decomposicao de custo (0-1), ou undefined sem dados. */
export function pesoMateriaisDe(decomposicoes: Array<{ d?: DecomposicaoCusto; quantidade: number }>): number | undefined {
  let mat = 0
  let total = 0
  for (const { d, quantidade } of decomposicoes) {
    if (!d) continue
    const q = Number(quantidade) || 0
    mat += (d.materiais || 0) * q
    total += ((d.materiais || 0) + (d.mao_obra || 0) + (d.outros || 0)) * q
  }
  return total > 0 ? mat / total : undefined
}
