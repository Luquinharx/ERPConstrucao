import { calcularIRS } from "./irs-tables"
import { round2 } from "./utils"
import type { Funcionario, ModoTaxa } from "./types"

/**
 * Calculo de custo de mao de obra, separado do ecra.
 *
 * Estes numeros sao o divisor de todos os orcamentos: o custo/hora gravado no
 * funcionario e lido diretamente por cada linha de mao de obra. Estavam presos
 * dentro do componente, o que obrigava qualquer script de manutencao a
 * reescrever a formula - e uma copia que divergisse do ecra faria com que dois
 * sitios do sistema calculassem precos diferentes.
 */

/**
 * Regras de Portugal (continente) em vigor em 2026.
 *
 * Taxa Social Unica: 23,75% a cargo da empresa + 11% a cargo do trabalhador
 * (34,75% no total). O IRS NAO e custo da empresa - e retido ao trabalhador.
 * Subsidio de alimentacao isento ate 10,46 EUR/dia em cartao ou 6,15 EUR/dia
 * em dinheiro; acima disso paga IRS e Seguranca Social dos dois lados.
 */
export const TSU_PATRONAL = 23.75
export const TSU_TRABALHADOR = 11
export const SEGURO_ACIDENTES_CONSTRUCAO = 1.75
export const SUBSIDIO_ALIMENTACAO_ISENTO_CARTAO = 10.46
export const SUBSIDIO_ALIMENTACAO_ISENTO_DINHEIRO = 6.15
/** Subsidios de ferias e Natal: 14 meses de salario diluidos em 12. */
export const MESES_SUBSIDIOS = 2 / 12
/** Nao ha refeicao no mes de ferias: por norma sao 11 meses por ano. */
export const MESES_SUBSIDIO_ALIMENTACAO = 11

/** Como se define a quantidade de horas do mes usada no custo/hora. */
export type BaseHoras = "media" | "maior" | "menor" | "mes"

export const NOMES_MESES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

export function getCurrentMonthInput(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`
}

export function calculateHorasPorSemana(horasPorDia: number, diasPorSemana: number): number {
  return round2((Number(horasPorDia) || 0) * (Number(diasPorSemana) || 0))
}

/**
 * Dias efetivamente trabalhados no mes de referencia.
 *
 * Conta os dias reais do calendario a partir de segunda-feira:
 * 5 dias/semana = seg a sex, 6 = seg a sab, 7 = todos os dias.
 * (Antes usava a media dias_do_mes x dias_semana/7, que inflava as horas.)
 */
export function calculateDiasUteisMes(mesReferencia: string, diasPorSemana: number): number {
  const dias = Math.min(Math.max(Number(diasPorSemana) || 0, 0), 7)
  if (dias === 0) return 0

  const referencia = mesReferencia || getCurrentMonthInput()
  const [yearRaw, monthRaw] = referencia.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!year || !month) return 0

  const daysInMonth = new Date(year, month, 0).getDate()
  let total = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(year, month - 1, day).getDay() // 0 = domingo
    const posicaoNaSemana = weekday === 0 ? 7 : weekday // 1 = segunda ... 7 = domingo
    if (posicaoNaSemana <= dias) total++
  }

  return total
}

/** Dias uteis de cada mes do ano, para se poder comparar as bases. */
export function calculateDiasUteisDoAno(ano: number, diasPorSemana: number): number[] {
  return Array.from({ length: 12 }, (_, i) =>
    calculateDiasUteisMes(`${ano}-${String(i + 1).padStart(2, "0")}`, diasPorSemana),
  )
}

/** Mes do ano com mais dias uteis. */
export function calculateMaiorMesDoAno(ano: number, diasPorSemana: number): { dias: number; mes: number } {
  let melhor = { dias: 0, mes: 1 }
  for (let mes = 1; mes <= 12; mes++) {
    const dias = calculateDiasUteisMes(`${ano}-${String(mes).padStart(2, "0")}`, diasPorSemana)
    if (dias > melhor.dias) melhor = { dias, mes }
  }
  return melhor
}

/**
 * Resolve a base de dias uteis do mes.
 *
 * O custo/hora e o divisor de todos os orcamentos, entao a base tem de ser uma
 * escolha consciente:
 * - media  : media anual, nao subavalia nem sobreavalia nenhum mes
 * - maior  : mes com mais horas, da o menor custo/hora (mais agressivo)
 * - menor  : mes com menos horas, da o maior custo/hora (mais seguro)
 * - mes    : usa exatamente o mes de referencia escolhido
 */
export function resolverBaseDias(
  base: BaseHoras,
  ano: number,
  diasPorSemana: number,
  mesReferencia: string,
): { dias: number; detalhe: string } {
  const doAno = calculateDiasUteisDoAno(ano, diasPorSemana)
  const maiorDias = Math.max(...doAno)
  const menorDias = Math.min(...doAno)

  if (base === "maior") {
    return { dias: maiorDias, detalhe: `${NOMES_MESES[doAno.indexOf(maiorDias)]} de ${ano}` }
  }
  if (base === "menor") {
    return { dias: menorDias, detalhe: `${NOMES_MESES[doAno.indexOf(menorDias)]} de ${ano}` }
  }
  if (base === "mes") {
    return { dias: calculateDiasUteisMes(mesReferencia, diasPorSemana), detalhe: "mes de referencia" }
  }
  const total = doAno.reduce((acc, dias) => acc + dias, 0)
  return { dias: round2(total / 12), detalhe: `${total} dias uteis em ${ano} / 12` }
}

export function calculateHorasPorMes(mesReferencia: string, horasPorDia: number, diasPorSemana: number): number {
  const diasUteis = calculateDiasUteisMes(mesReferencia, diasPorSemana)
  return round2(diasUteis * (Number(horasPorDia) || 0))
}

export function calculatePercentValue(base: number, percentual: number): number {
  return round2((Number(base) || 0) * ((Number(percentual) || 0) / 100))
}

/**
 * Resolve uma taxa que pode ter sido definida por percentagem ou por valor fixo.
 * Devolve sempre os dois lados, para a tela poder mostrar "11% = 132,00 EUR".
 */
export function resolverTaxa(modo: ModoTaxa, percentual: number, valorManual: number, base: number) {
  if (modo === "valor") {
    const valor = round2(valorManual)
    return { valor, percentual: base > 0 ? round2((valor / base) * 100) : 0 }
  }
  return { valor: calculatePercentValue(base, percentual), percentual: round2(percentual) }
}

/** Os campos de que o calculo depende. O ecra passa o formulario; o script, o registo. */
export interface ParametrosFuncionario {
  horasPorDia: number
  diasPorSemana: number
  mesReferencia: string
  baseHoras: BaseHoras
  margemLucro: number
  salarioBase: number
  valorTransporte: number
  incluiSubsidios: boolean
  mesesSubsidioAlimentacao: number
  subsidioDiario: number
  diasSubsidio: number
  percentualSeguranca: number
  percentualSeguroAcidentes: number
  percentualSegurancaLiquido: number
  percentualIRSLiquido: number
  tabelaIRS: string
  dependentes: number
  irsAutomatico: boolean
  modoSeguranca: ModoTaxa
  valorSegurancaManual: number
  modoSeguroAcidentes: ModoTaxa
  valorSeguroAcidentesManual: number
  modoSegurancaLiquido: ModoTaxa
  valorSegurancaLiquidoManual: number
  modoIRSLiquido: ModoTaxa
  valorIRSLiquidoManual: number
}

/**
 * Le um registo gravado e repoe os valores em falta.
 *
 * E aqui que os formatos antigos sao corrigidos: a taxa combinada de 34,75%
 * que alguns registos guardavam como se fosse so a patronal, e o subsidio de
 * alimentacao que era gravado como total mensal em vez de valor por dia.
 */
export function normalizarFuncionario(funcionario: Partial<Funcionario>): ParametrosFuncionario {
  return {
    horasPorDia: funcionario.horasPorDia || 8,
    diasPorSemana: funcionario.diasPorSemana || 5,
    mesReferencia: funcionario.mesReferencia || getCurrentMonthInput(),
    baseHoras: (funcionario.baseHoras as BaseHoras) ?? "media",
    margemLucro: funcionario.margemLucro || 0,
    salarioBase: funcionario.salarioBase || 0,
    valorTransporte: funcionario.valorTransporte || 0,
    incluiSubsidios: funcionario.incluiSubsidios ?? true,
    mesesSubsidioAlimentacao: funcionario.mesesSubsidioAlimentacao ?? MESES_SUBSIDIO_ALIMENTACAO,
    // Registos antigos guardavam so o total mensal: converte-se para valor/dia
    subsidioDiario: round2(
      funcionario.subsidioDiario ??
        (funcionario.valorBeneficios ? funcionario.valorBeneficios / (funcionario.diasSubsidio || 22) : 0),
    ),
    diasSubsidio: funcionario.diasSubsidio ?? 22,
    // Registos antigos guardavam a taxa combinada (34,75%) ou zero: repoe-se a taxa legal
    percentualSeguranca: funcionario.percentualSeguranca
      ? round2(Math.min(funcionario.percentualSeguranca, TSU_PATRONAL))
      : TSU_PATRONAL,
    percentualSeguroAcidentes: funcionario.percentualSeguroAcidentes ?? SEGURO_ACIDENTES_CONSTRUCAO,
    percentualSegurancaLiquido: funcionario.percentualSegurancaLiquido ?? TSU_TRABALHADOR,
    percentualIRSLiquido: funcionario.percentualIRSLiquido ?? funcionario.percentualIRS ?? 0,
    tabelaIRS: funcionario.tabelaIRS ?? "I",
    dependentes: funcionario.dependentes ?? 0,
    irsAutomatico: funcionario.irsAutomatico ?? true,
    modoSeguranca: funcionario.modoSeguranca ?? "percentual",
    valorSegurancaManual: round2(funcionario.valorSeguranca ?? 0),
    modoSeguroAcidentes: funcionario.modoSeguroAcidentes ?? "percentual",
    valorSeguroAcidentesManual: round2(funcionario.valorSeguroAcidentes ?? 0),
    modoSegurancaLiquido: funcionario.modoSegurancaLiquido ?? "percentual",
    valorSegurancaLiquidoManual: round2(funcionario.valorSegurancaLiquido ?? 0),
    modoIRSLiquido: funcionario.modoIRSLiquido ?? "percentual",
    valorIRSLiquidoManual: round2(funcionario.valorIRSLiquido ?? 0),
  }
}

export interface CalculoFuncionario {
  anoReferencia: number
  diasDoMesEscolhido: number
  baseDias: { dias: number; detalhe: string }
  diasUteisMes: number
  horasPorMes: number
  valorBeneficiosCalculado: number
  valorSubsidiosMensal: number
  baseEncargos: number
  seguranca: { valor: number; percentual: number }
  seguroAcidentes: { valor: number; percentual: number }
  totalEncargos: number
  beneficiosMensalMedio: number
  salarioTotal: number
  custoHoraCalculado: number
  valorDeVendaCalculado: number
  percentualSobreSalario: number
  limiteSubsidioMes: number
  beneficiosAcimaDoLimite: number
  segurancaLiquido: { valor: number; percentual: number }
  irsCalculado: ReturnType<typeof calcularIRS>
  irsLiquido: { valor: number; percentual: number }
  totalEncargosLiquido: number
  taxaEfetivaDesconto: number
  totalIliquido: number
  salarioBaseLiquido: number
  valoresIsentos: number
  salarioTotalLiquido: number
  custoHoraLiquido: number
  valorVendaHoraLiquido: number
}

export function calcularFuncionario(p: ParametrosFuncionario): CalculoFuncionario {
  // O mes escolhido serve para indicar o ano e para comparacao; a base do custo vem de baseHoras
  const anoReferencia = Number(p.mesReferencia?.split("-")[0]) || new Date().getFullYear()
  const diasDoMesEscolhido = calculateDiasUteisMes(p.mesReferencia, p.diasPorSemana)
  const baseDias = resolverBaseDias(p.baseHoras, anoReferencia, p.diasPorSemana, p.mesReferencia)
  const diasUteisMes = baseDias.dias
  const horasPorMes = round2(diasUteisMes * (Number(p.horasPorDia) || 0))

  // Subsidio de alimentacao: valor diario x dias, para acompanhar o calendario
  const valorBeneficiosCalculado = round2(
    (Number(p.subsidioDiario) || 0) * (Number(p.diasSubsidio) || 0),
  )

  // === ENCARGOS: custo real da empresa ===
  // Subsidios de ferias e Natal diluidos no mes (14 meses de salario em 12)
  const valorSubsidiosMensal = p.incluiSubsidios ? round2(p.salarioBase * MESES_SUBSIDIOS) : 0
  // A TSU patronal e o seguro incidem sobre o salario e sobre os subsidios
  const baseEncargos = round2(p.salarioBase + valorSubsidiosMensal)
  const seguranca = resolverTaxa(p.modoSeguranca, p.percentualSeguranca, p.valorSegurancaManual, baseEncargos)
  const seguroAcidentes = resolverTaxa(
    p.modoSeguroAcidentes,
    p.percentualSeguroAcidentes,
    p.valorSeguroAcidentesManual,
    baseEncargos,
  )
  // O IRS nao entra: e retido ao trabalhador, nao e custo da empresa
  const totalEncargos = round2(seguranca.valor + seguroAcidentes.valor)
  /**
   * O subsidio de alimentacao paga-se por dia trabalhado, entao nao ha refeicao
   * no mes de ferias: por norma sao 11 meses por ano. Para o custo mensal medio
   * dilui-se pelos 12 meses do ano.
   */
  const beneficiosMensalMedio = p.incluiSubsidios
    ? round2((valorBeneficiosCalculado * Number(p.mesesSubsidioAlimentacao || 12)) / 12)
    : round2(valorBeneficiosCalculado)
  const salarioTotal = round2(
    p.salarioBase + valorSubsidiosMensal + beneficiosMensalMedio + p.valorTransporte + totalEncargos,
  )
  const custoHoraCalculado = horasPorMes > 0 ? round2(salarioTotal / horasPorMes) : 0
  const valorDeVendaCalculado = round2(custoHoraCalculado * (1 + Number(p.margemLucro || 0) / 100))
  /**
   * Custo total sobre a remuneracao bruta (salario + subsidios de ferias e Natal).
   * A referencia de mercado em Portugal aponta 130% a 145% - e sobre a bruta que
   * essa referencia e medida, nao sobre o salario base isolado.
   */
  const percentualSobreSalario = baseEncargos > 0 ? round2((salarioTotal / baseEncargos) * 100) : 0

  // Limite de isencao do subsidio de alimentacao, para alertar excesso
  const limiteSubsidioMes = round2(SUBSIDIO_ALIMENTACAO_ISENTO_CARTAO * diasUteisMes)
  const beneficiosAcimaDoLimite = round2(Math.max(0, valorBeneficiosCalculado - limiteSubsidioMes))

  // === ENCARGO LIQUIDO: o que o trabalhador recebe ===
  // Descontos do lado do trabalhador (TSU 11% + IRS), apenas sobre o salario base.
  // Subsidio de alimentacao e transporte sao isentos ate ao limite legal.
  const segurancaLiquido = resolverTaxa(
    p.modoSegurancaLiquido,
    p.percentualSegurancaLiquido,
    p.valorSegurancaLiquidoManual,
    p.salarioBase,
  )
  // IRS pela tabela oficial de retencao; o utilizador pode sobrepor a mao
  const irsCalculado = calcularIRS(p.salarioBase, p.tabelaIRS, p.dependentes)
  const irsLiquido = p.irsAutomatico
    ? { valor: irsCalculado.valor, percentual: irsCalculado.taxaEfetiva }
    : resolverTaxa(p.modoIRSLiquido, p.percentualIRSLiquido, p.valorIRSLiquidoManual, p.salarioBase)

  const totalEncargosLiquido = round2(segurancaLiquido.valor + irsLiquido.valor)
  /** Peso total dos descontos sobre o salario base. */
  const taxaEfetivaDesconto = p.salarioBase > 0 ? round2((totalEncargosLiquido / p.salarioBase) * 100) : 0
  /** Total iliquido: o que entra antes dos descontos. */
  const totalIliquido = round2(p.salarioBase + valorBeneficiosCalculado + p.valorTransporte)
  /** Salario base ja com os descontos, antes de somar os valores isentos. */
  const salarioBaseLiquido = round2(p.salarioBase - totalEncargosLiquido)
  const valoresIsentos = round2(valorBeneficiosCalculado + p.valorTransporte)
  const salarioTotalLiquido = round2(salarioBaseLiquido + valoresIsentos)
  const custoHoraLiquido = horasPorMes > 0 ? round2(salarioTotalLiquido / horasPorMes) : 0
  const valorVendaHoraLiquido = round2(custoHoraLiquido * (1 + Number(p.margemLucro || 0) / 100))

  return {
    anoReferencia,
    diasDoMesEscolhido,
    baseDias,
    diasUteisMes,
    horasPorMes,
    valorBeneficiosCalculado,
    valorSubsidiosMensal,
    baseEncargos,
    seguranca,
    seguroAcidentes,
    totalEncargos,
    beneficiosMensalMedio,
    salarioTotal,
    custoHoraCalculado,
    valorDeVendaCalculado,
    percentualSobreSalario,
    limiteSubsidioMes,
    beneficiosAcimaDoLimite,
    segurancaLiquido,
    irsCalculado,
    irsLiquido,
    totalEncargosLiquido,
    taxaEfetivaDesconto,
    totalIliquido,
    salarioBaseLiquido,
    valoresIsentos,
    salarioTotalLiquido,
    custoHoraLiquido,
    valorVendaHoraLiquido,
  }
}
