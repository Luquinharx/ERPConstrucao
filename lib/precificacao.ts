import type {
  ConfiguracaoEmpresa,
  ContextoFiscal,
  DecomposicaoCusto,
  DimensoesAmbiente,
  Especialidade,
  TipoMedicao,
} from "@/lib/types"
import { m, t } from "@/lib/i18n"
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
  { id: "civil", nome: m("Construção civil"), margem: 15 },
  { id: "aguas", nome: m("Águas"), margem: 25 },
  { id: "gas", nome: m("Gás"), margem: 25 },
  { id: "eletricidade", nome: m("Eletricidade"), margem: 25 },
  { id: "avac", nome: m("AVAC"), margem: 25 },
  { id: "scie", nome: m("SCIE"), margem: 25 },
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

/**
 * Fator sobre o custo: 1 + estrutura + margem da especialidade + margem
 * adicional da proposta (coeficiente de seguranca; negativa e um desconto).
 */
export function fatorEspecialidade(
  id: string | undefined,
  config?: Partial<ConfiguracaoEmpresa> | null,
  adicional = 0,
): number {
  return Math.max(0, 1 + (estruturaDe(config) + (Number(especialidade(id, config).margem) || 0) + (Number(adicional) || 0)) / 100)
}

export function precoPorEspecialidade(
  custo: number,
  id: string | undefined,
  config?: Partial<ConfiguracaoEmpresa> | null,
  adicional = 0,
): number {
  return round2((Number(custo) || 0) * fatorEspecialidade(id, config, adicional))
}

/** Margem sobre a venda (%), a leitura que interessa ao cliente: lucro / preco. */
export function margemSobreVenda(custo: number, venda: number): number {
  return venda > 0 ? round2(((venda - custo) / venda) * 100) : 0
}

// ------------------------------------------------------------ Medicoes

export const MEDICOES: Record<TipoMedicao, { nome: string; unidade: string }> = {
  pavimento: { nome: m("Pavimento"), unidade: "m2" },
  teto: { nome: m("Teto"), unidade: "m2" },
  paredes: { nome: m("Paredes (sem aberturas)"), unidade: "m2" },
  perimetro: { nome: m("Perímetro (rodapé, sancas)"), unidade: "ml" },
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
  continente: { nome: m("Continente"), normal: 23, intermedia: 13, reduzida: 6 },
  madeira: { nome: m("Madeira"), normal: 22, intermedia: 12, reduzida: 5 },
  acores: { nome: m("Açores"), normal: 16, intermedia: 9, reduzida: 4 },
}

export const TIPOS_OBRA: Record<NonNullable<ContextoFiscal["tipoObra"]>, string> = {
  construcao_nova: m("Construção nova"),
  reabilitacao_aru: m("Reabilitação urbana em ARU"),
  remodelacao_habitacao: m("Remodelação / reparação de habitação"),
  manutencao: m("Manutenção"),
  obra_publica: m("Obra pública"),
}

export const TIPOS_CLIENTE: Record<NonNullable<ContextoFiscal["tipoCliente"]>, string> = {
  particular: m("Particular"),
  empresa: m("Empresa"),
  construtor: m("Construtor (sujeito passivo do setor)"),
  publica: m("Entidade pública"),
}

export const TIPOS_OPERACAO: Record<NonNullable<ContextoFiscal["tipoOperacao"]>, string> = {
  empreitada: m("Empreitada"),
  subempreitada: m("Subempreitada"),
  servicos: m("Serviços"),
  materiais: m("Só materiais"),
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
      regime: t("Autoliquidação"),
      fundamento: t("IVA devido pelo adquirente - art. 2.º, n.º 1, al. j) do CIVA (serviços de construção civil a sujeito passivo)."),
    }
  }
  if (c.tipoObra === "reabilitacao_aru" && c.tipoOperacao === "empreitada") {
    return {
      taxa: regiao.reduzida,
      regime: t("IVA reduzido"),
      fundamento: t("Empreitada de reabilitação urbana em ARU - verba 2.23 da Lista I anexa ao CIVA."),
    }
  }
  if (c.tipoObra === "remodelacao_habitacao" && c.tipoOperacao === "empreitada") {
    const acima = pesoMateriais !== undefined && pesoMateriais > 0.2
    return {
      taxa: acima ? regiao.normal : regiao.reduzida,
      regime: acima ? t("IVA normal") : t("IVA reduzido"),
      fundamento: t("Empreitada de beneficiação/remodelação de imóvel de habitação - verba 2.27 da Lista I anexa ao CIVA."),
      aviso: acima
        ? t("Os materiais pesam {percentagem}% (> 20%): a verba 2.27 não se aplica à parte dos materiais. Confirme com o contabilista.", {
            percentagem: Math.round(pesoMateriais! * 100),
          })
        : t("Só vale se os materiais não passarem de 20% do valor global da empreitada."),
    }
  }
  return {
    taxa: regiao.normal,
    regime: t("IVA normal"),
    fundamento: t("Taxa normal ({regiao}) - art. 18.º do CIVA.", { regiao: t(regiao.nome) }),
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
