import { round2 } from "./utils"

/**
 * Tabelas de retencao na fonte de IRS - Continente, 2026.
 *
 * Fonte: Despacho n.o 233-A/2026, de 6 de janeiro (Secretaria de Estado dos
 * Assuntos Fiscais), ficheiro oficial "Tabelas_RF_Continente_2026.xlsx" do
 * Portal das Financas, folha "Categoria A".
 *
 * Formula: (Remuneracao mensal x Taxa) - Parcela a abater
 *          - (Parcela adicional a abater x n.o de dependentes)
 *
 * Nos dois primeiros escaloes de algumas tabelas a parcela a abater e ela
 * propria uma formula que depende da remuneracao.
 */

interface EscalaoIRS {
  /** Limite superior da remuneracao mensal; null no ultimo escalao. */
  ate: number | null
  /** Taxa marginal. */
  taxa: number
  /** Parcela a abater fixa, em euros. */
  parcela?: number
  /**
   * Parcela a abater calculada: taxa x fator x (limite - remuneracao).
   * Usada nos escaloes em que o despacho define uma formula.
   */
  formula?: { fator: number; limite: number }
}

export interface TabelaIRS {
  id: string
  nome: string
  descricao: string
  /** Abatimento por cada dependente, em euros. */
  parcelaDependente: number
  /** Esta tabela aceita dependentes? */
  aceitaDependentes: boolean
  escaloes: EscalaoIRS[]
}

/** Escaloes partilhados pelas tabelas I e II (mudam so no valor por dependente). */
const ESCALOES_I_II: EscalaoIRS[] = [
  { ate: 920, taxa: 0 },
  { ate: 1042, taxa: 0.125, formula: { fator: 2.6, limite: 1273.85 } },
  { ate: 1108, taxa: 0.157, formula: { fator: 1.35, limite: 1554.83 } },
  { ate: 1154, taxa: 0.157, parcela: 94.71 },
  { ate: 1212, taxa: 0.212, parcela: 158.18 },
  { ate: 1819, taxa: 0.241, parcela: 193.33 },
  { ate: 2119, taxa: 0.311, parcela: 320.66 },
  { ate: 2499, taxa: 0.349, parcela: 401.19 },
  { ate: 3305, taxa: 0.3836, parcela: 487.66 },
  { ate: 5547, taxa: 0.3969, parcela: 531.62 },
  { ate: 20221, taxa: 0.4495, parcela: 823.4 },
  { ate: null, taxa: 0.4717, parcela: 1272.31 },
]

export const TABELAS_IRS: TabelaIRS[] = [
  {
    id: "I",
    nome: "Tabela I",
    descricao: "Nao casado sem dependentes ou casado 2 titulares",
    parcelaDependente: 21.43,
    aceitaDependentes: true,
    escaloes: ESCALOES_I_II,
  },
  {
    id: "II",
    nome: "Tabela II",
    descricao: "Nao casado com um ou mais dependentes",
    parcelaDependente: 34.29,
    aceitaDependentes: true,
    escaloes: ESCALOES_I_II,
  },
  {
    id: "III",
    nome: "Tabela III",
    descricao: "Casado, unico titular",
    parcelaDependente: 42.86,
    aceitaDependentes: true,
    escaloes: [
      { ate: 991, taxa: 0 },
      { ate: 1042, taxa: 0.125, formula: { fator: 2.6, limite: 1372.15 } },
      { ate: 1108, taxa: 0.125, formula: { fator: 1.35, limite: 1677.85 } },
      { ate: 1119, taxa: 0.125, parcela: 96.17 },
      { ate: 1432, taxa: 0.1272, parcela: 98.64 },
      { ate: 1962, taxa: 0.157, parcela: 141.32 },
      { ate: 2240, taxa: 0.1938, parcela: 213.53 },
      { ate: 2773, taxa: 0.2277, parcela: 289.47 },
      { ate: 3389, taxa: 0.257, parcela: 370.72 },
      { ate: 5965, taxa: 0.2881, parcela: 476.12 },
      { ate: 20265, taxa: 0.3843, parcela: 1049.96 },
      { ate: null, taxa: 0.4717, parcela: 2821.13 },
    ],
  },
  {
    id: "IV",
    nome: "Tabela IV",
    descricao: "Nao casado ou casado dois titulares sem dependentes - pessoa com deficiencia",
    parcelaDependente: 0,
    aceitaDependentes: false,
    escaloes: [
      { ate: 1694, taxa: 0 },
      { ate: 2063, taxa: 0.212, parcela: 359.13 },
      { ate: 2492, taxa: 0.311, parcela: 563.37 },
      { ate: 4487, taxa: 0.349, parcela: 658.07 },
      { ate: 4753, taxa: 0.3836, parcela: 813.33 },
      { ate: 6687, taxa: 0.3969, parcela: 876.55 },
      { ate: 20468, taxa: 0.4495, parcela: 1228.29 },
      { ate: null, taxa: 0.4717, parcela: 1682.68 },
    ],
  },
  {
    id: "V",
    nome: "Tabela V",
    descricao: "Nao casado com um ou mais dependentes - pessoa com deficiencia",
    parcelaDependente: 42.86,
    aceitaDependentes: true,
    escaloes: [
      { ate: 1938, taxa: 0 },
      { ate: 2063, taxa: 0.2132, parcela: 413.19 },
      { ate: 2854, taxa: 0.311, parcela: 614.96 },
      { ate: 4504, taxa: 0.349, parcela: 723.42 },
      { ate: 6826, taxa: 0.3836, parcela: 879.26 },
      { ate: 7048, taxa: 0.3969, parcela: 970.05 },
      { ate: 20468, taxa: 0.4495, parcela: 1340.78 },
      { ate: null, taxa: 0.4717, parcela: 1795.17 },
    ],
  },
  {
    id: "VI",
    nome: "Tabela VI",
    descricao: "Casado dois titulares com um ou mais dependentes - pessoa com deficiencia",
    parcelaDependente: 21.43,
    aceitaDependentes: true,
    escaloes: [
      { ate: 1668, taxa: 0 },
      { ate: 2068, taxa: 0.2049, parcela: 341.78 },
      { ate: 2497, taxa: 0.241, parcela: 416.44 },
      { ate: 3107, taxa: 0.311, parcela: 591.23 },
      { ate: 4504, taxa: 0.349, parcela: 709.3 },
      { ate: 6826, taxa: 0.3836, parcela: 865.14 },
      { ate: 7048, taxa: 0.3969, parcela: 955.93 },
      { ate: 20468, taxa: 0.4495, parcela: 1326.66 },
      { ate: null, taxa: 0.4717, parcela: 1781.05 },
    ],
  },
  {
    id: "VII",
    nome: "Tabela VII",
    descricao: "Casado, unico titular - pessoa com deficiencia",
    parcelaDependente: 42.86,
    aceitaDependentes: true,
    escaloes: [
      { ate: 2325, taxa: 0 },
      { ate: 3494, taxa: 0.2277, parcela: 529.41 },
      { ate: 3761, taxa: 0.257, parcela: 631.79 },
      { ate: 6687, taxa: 0.2881, parcela: 748.76 },
      { ate: 20468, taxa: 0.4244, parcela: 1660.2 },
      { ate: null, taxa: 0.4717, parcela: 2628.34 },
    ],
  },
]

export function getTabelaIRS(id: string): TabelaIRS {
  return TABELAS_IRS.find((tabela) => tabela.id === id) || TABELAS_IRS[0]
}

/**
 * Calcula a retencao de IRS na fonte para uma remuneracao mensal.
 * Devolve o valor retido e a taxa efetiva, para a tela mostrar os dois.
 */
export function calcularIRS(remuneracao: number, tabelaId: string, dependentes = 0) {
  const bruto = Number(remuneracao) || 0
  const tabela = getTabelaIRS(tabelaId)

  const escalao =
    tabela.escaloes.find((item) => item.ate !== null && bruto <= item.ate) ||
    tabela.escaloes[tabela.escaloes.length - 1]

  if (escalao.taxa === 0) {
    return { valor: 0, taxaEfetiva: 0, taxaMarginal: 0, escalaoAte: escalao.ate, isento: true }
  }

  const parcela = escalao.formula
    ? escalao.taxa * escalao.formula.fator * Math.max(0, escalao.formula.limite - bruto)
    : escalao.parcela || 0

  const abateDependentes = tabela.aceitaDependentes ? tabela.parcelaDependente * (Number(dependentes) || 0) : 0
  const valor = round2(Math.max(0, bruto * escalao.taxa - parcela - abateDependentes))

  return {
    valor,
    taxaEfetiva: bruto > 0 ? round2((valor / bruto) * 100) : 0,
    taxaMarginal: round2(escalao.taxa * 100),
    escalaoAte: escalao.ate,
    isento: false,
  }
}
