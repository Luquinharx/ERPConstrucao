"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Edit,
  Trash2,
  User,
  RefreshCw,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  Euro,
  Shield,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import type { Funcionario, ModoTaxa } from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { formatCurrency, matchesSearch, round2, toFixed2 } from "@/lib/utils"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { TABELAS_IRS, calcularIRS, getTabelaIRS } from "@/lib/irs-tables"

interface FuncionarioFormState {
  nome: string
  email: string
  telefone: string
  dataNascimento: string
  morada: string
  cidade: string
  codigoPostal: string
  nif: string
  foto: string
  observacoes: string
  funcao: string
  dataAdmissao: string
  numeroFuncionario: string
  departamento: string
  horasPorDia: number
  diasPorSemana: number
  mesReferencia: string
  margemLucro: number
  custoHora: number
  salarioBase: number
  valorBeneficios: number
  valorTransporte: number
  percentualSeguranca: number
  percentualIRS: number
  percentualSeguroAcidentes: number
  incluiSubsidios: boolean
  mesesSubsidioAlimentacao: number
  /** Subsidio de alimentacao: valor por dia x dias, calculado automaticamente. */
  subsidioDiario: number
  diasSubsidio: number
  /** IRS: tabela de retencao, dependentes e se o valor e calculado ou manual. */
  tabelaIRS: string
  dependentes: number
  irsAutomatico: boolean
  /** Base de horas usada no custo/hora. */
  baseHoras: BaseHoras
  percentualSegurancaLiquido: number
  percentualIRSLiquido: number
  // Cada encargo pode ser lancado por percentagem ou por valor fixo
  modoSeguranca: ModoTaxa
  valorSegurancaManual: number
  modoSeguroAcidentes: ModoTaxa
  valorSeguroAcidentesManual: number
  modoSegurancaLiquido: ModoTaxa
  valorSegurancaLiquidoManual: number
  modoIRSLiquido: ModoTaxa
  valorIRSLiquidoManual: number
  ativo: boolean
}

/**
 * Regras de Portugal (continente) em vigor em 2026.
 *
 * Taxa Social Unica: 23,75% a cargo da empresa + 11% a cargo do trabalhador
 * (34,75% no total). O IRS NAO e custo da empresa - e retido ao trabalhador.
 * Subsidio de alimentacao isento ate 10,46 EUR/dia em cartao ou 6,15 EUR/dia
 * em dinheiro; acima disso paga IRS e Seguranca Social dos dois lados.
 */
const TSU_PATRONAL = 23.75
const TSU_TRABALHADOR = 11
const SEGURO_ACIDENTES_CONSTRUCAO = 1.75
const SUBSIDIO_ALIMENTACAO_ISENTO_CARTAO = 10.46
const SUBSIDIO_ALIMENTACAO_ISENTO_DINHEIRO = 6.15
/** Ferias + Natal: 14 meses de salario diluidos em 12. */
const MESES_SUBSIDIOS = 2 / 12
/** O subsidio de alimentacao paga-se por dia trabalhado: 11 meses por ano. */
const MESES_SUBSIDIO_ALIMENTACAO = 11

function getCurrentMonthInput(): string {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  return `${now.getFullYear()}-${month}`
}

function getDefaultFormData(): FuncionarioFormState {
  return {
    nome: "",
    email: "",
    telefone: "",
    dataNascimento: "",
    morada: "",
    cidade: "",
    codigoPostal: "",
    nif: "",
    foto: "",
    observacoes: "",
    funcao: "",
    dataAdmissao: "",
    numeroFuncionario: "",
    departamento: "",
    horasPorDia: 8,
    diasPorSemana: 5,
    mesReferencia: getCurrentMonthInput(),
    margemLucro: 0,
    custoHora: 0,
    salarioBase: 0,
    valorBeneficios: 0,
    valorTransporte: 0,
    percentualSeguranca: TSU_PATRONAL,
    percentualIRS: 0,
    percentualSeguroAcidentes: SEGURO_ACIDENTES_CONSTRUCAO,
    incluiSubsidios: true,
    mesesSubsidioAlimentacao: MESES_SUBSIDIO_ALIMENTACAO,
    subsidioDiario: 0,
    diasSubsidio: 22,
    tabelaIRS: "I",
    dependentes: 0,
    irsAutomatico: true,
    baseHoras: "media",
    percentualSegurancaLiquido: TSU_TRABALHADOR,
    percentualIRSLiquido: 0,
    modoSeguranca: "percentual",
    valorSegurancaManual: 0,
    modoSeguroAcidentes: "percentual",
    valorSeguroAcidentesManual: 0,
    modoSegurancaLiquido: "percentual",
    valorSegurancaLiquidoManual: 0,
    modoIRSLiquido: "percentual",
    valorIRSLiquidoManual: 0,
    ativo: true,
  }
}

function calculateAge(birthDate: string): number {
  if (!birthDate) return 0
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function calculateHorasPorSemana(horasPorDia: number, diasPorSemana: number): number {
  return round2((Number(horasPorDia) || 0) * (Number(diasPorSemana) || 0))
}

/**
 * Dias efetivamente trabalhados no mes de referencia.
 *
 * Conta os dias reais do calendario a partir de segunda-feira:
 * 5 dias/semana = seg a sex, 6 = seg a sab, 7 = todos os dias.
 * (Antes usava a media dias_do_mes x dias_semana/7, que inflava as horas.)
 */
function calculateDiasUteisMes(mesReferencia: string, diasPorSemana: number): number {
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


/**
 * Mes do ano com mais dias uteis.
 *
 * O custo/hora e a base dos orcamentos, entao nao pode oscilar de mes para mes
 * (fevereiro tem 20 dias uteis, dezembro 22: o custo/hora variava de 12,05 para
 * 10,90). Fixando o maior mes do ano, o valor fica estavel e conservador -
 * assume o mes com mais horas, logo o menor custo por hora.
 */
function calculateMaiorMesDoAno(ano: number, diasPorSemana: number): { dias: number; mes: number } {
  let melhor = { dias: 0, mes: 1 }
  for (let mes = 1; mes <= 12; mes++) {
    const dias = calculateDiasUteisMes(`${ano}-${String(mes).padStart(2, "0")}`, diasPorSemana)
    if (dias > melhor.dias) melhor = { dias, mes }
  }
  return melhor
}

const NOMES_MESES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


/** Como se define a quantidade de horas do mes usada no custo/hora. */
export type BaseHoras = "media" | "maior" | "menor" | "mes"

/**
 * Dias uteis de cada mes do ano, para se poder comparar as bases.
 */
function calculateDiasUteisDoAno(ano: number, diasPorSemana: number): number[] {
  return Array.from({ length: 12 }, (_, i) =>
    calculateDiasUteisMes(`${ano}-${String(i + 1).padStart(2, "0")}`, diasPorSemana),
  )
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
function resolverBaseDias(
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

function calculateHorasPorMes(mesReferencia: string, horasPorDia: number, diasPorSemana: number): number {
  const diasUteis = calculateDiasUteisMes(mesReferencia, diasPorSemana)
  return round2(diasUteis * (Number(horasPorDia) || 0))
}

function calculatePercentValue(base: number, percentual: number): number {
  return round2((Number(base) || 0) * ((Number(percentual) || 0) / 100))
}

/**
 * Resolve uma taxa que pode ter sido definida por percentagem ou por valor fixo.
 * Devolve sempre os dois lados, para a tela poder mostrar "11% = 132,00 EUR".
 */
function resolverTaxa(modo: ModoTaxa, percentual: number, valorManual: number, base: number) {
  if (modo === "valor") {
    const valor = round2(valorManual)
    return { valor, percentual: base > 0 ? round2((valor / base) * 100) : 0 }
  }
  return { valor: calculatePercentValue(base, percentual), percentual: round2(percentual) }
}

interface CampoTaxaProps {
  id: string
  label: string
  base: number
  modo: ModoTaxa
  percentual: number
  valorManual: number
  /** Valor e percentagem ja resolvidos, para o texto de apoio. */
  resolvido: { valor: number; percentual: number }
  ajuda?: React.ReactNode
  onChange: (campos: { modo?: ModoTaxa; percentual?: number; valorManual?: number }) => void
}

/** Campo de encargo que aceita percentagem ou valor fixo em euros. */
function CampoTaxa({ id, label, base, modo, percentual, valorManual, resolvido, ajuda, onChange }: CampoTaxaProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex rounded-full border p-0.5">
          <button
            type="button"
            onClick={() => onChange({ modo: "percentual" })}
            className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
              modo === "percentual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => onChange({ modo: "valor" })}
            className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
              modo === "valor" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            EUR
          </button>
        </div>
      </div>

      {modo === "percentual" ? (
        <Input
          id={id}
          type="number"
          step="0.01"
          min="0"
          value={percentual}
          onChange={(e) => onChange({ percentual: Number(e.target.value) || 0 })}
          className="rounded-full"
          placeholder="0,00 %"
        />
      ) : (
        <Input
          id={id}
          type="number"
          step="0.01"
          min="0"
          value={valorManual}
          onChange={(e) => onChange({ valorManual: Number(e.target.value) || 0 })}
          className="rounded-full"
          placeholder="0,00 EUR"
        />
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {toFixed2(resolvido.percentual)}% = {formatCurrency(resolvido.valor)}
        </span>
        {base > 0 && <> sobre {formatCurrency(base)}</>}
        {ajuda && <> · {ajuda}</>}
      </p>
    </div>
  )
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pessoais")
  const { user } = useAuth()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const [formData, setFormData] = useState<FuncionarioFormState>(getDefaultFormData())

  const horasPorSemana = calculateHorasPorSemana(formData.horasPorDia, formData.diasPorSemana)
  // O mes escolhido serve para indicar o ano e para comparacao; a base do custo e o maior mes
  const anoReferencia = Number(formData.mesReferencia?.split("-")[0]) || new Date().getFullYear()
  const diasDoMesEscolhido = calculateDiasUteisMes(formData.mesReferencia, formData.diasPorSemana)
  const baseDias = resolverBaseDias(
    formData.baseHoras,
    anoReferencia,
    formData.diasPorSemana,
    formData.mesReferencia,
  )
  const diasUteisMes = baseDias.dias
  const horasPorMes = round2(diasUteisMes * (Number(formData.horasPorDia) || 0))

  // Subsidio de alimentacao: valor diario x dias, para acompanhar o calendario
  const valorBeneficiosCalculado = round2(
    (Number(formData.subsidioDiario) || 0) * (Number(formData.diasSubsidio) || 0),
  )

  // === ENCARGOS: custo real da empresa ===
  // Subsidios de ferias e Natal diluidos no mes (14 meses de salario em 12)
  const valorSubsidiosMensal = formData.incluiSubsidios ? round2(formData.salarioBase * MESES_SUBSIDIOS) : 0
  // A TSU patronal e o seguro incidem sobre o salario e sobre os subsidios
  const baseEncargos = round2(formData.salarioBase + valorSubsidiosMensal)
  const seguranca = resolverTaxa(
    formData.modoSeguranca,
    formData.percentualSeguranca,
    formData.valorSegurancaManual,
    baseEncargos,
  )
  const seguroAcidentes = resolverTaxa(
    formData.modoSeguroAcidentes,
    formData.percentualSeguroAcidentes,
    formData.valorSeguroAcidentesManual,
    baseEncargos,
  )
  const valorSeguranca = seguranca.valor
  const valorSeguroAcidentes = seguroAcidentes.valor
  // O IRS nao entra: e retido ao trabalhador, nao e custo da empresa
  const totalEncargos = round2(valorSeguranca + valorSeguroAcidentes)
  /**
   * O subsidio de alimentacao paga-se por dia trabalhado, entao nao ha refeicao
   * no mes de ferias: por norma sao 11 meses por ano. Para o custo mensal medio
   * dilui-se pelos 12 meses do ano.
   */
  const beneficiosMensalMedio = formData.incluiSubsidios
    ? round2((valorBeneficiosCalculado * Number(formData.mesesSubsidioAlimentacao || 12)) / 12)
    : round2(valorBeneficiosCalculado)
  const salarioTotal = round2(
    formData.salarioBase +
      valorSubsidiosMensal +
      beneficiosMensalMedio +
      formData.valorTransporte +
      totalEncargos,
  )
  const custoHoraCalculado = horasPorMes > 0 ? round2(salarioTotal / horasPorMes) : 0
  const valorDeVendaCalculado = round2(custoHoraCalculado * (1 + Number(formData.margemLucro || 0) / 100))
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
    formData.modoSegurancaLiquido,
    formData.percentualSegurancaLiquido,
    formData.valorSegurancaLiquidoManual,
    formData.salarioBase,
  )
  // IRS pela tabela oficial de retencao; o utilizador pode sobrepor a mao
  const irsCalculado = calcularIRS(formData.salarioBase, formData.tabelaIRS, formData.dependentes)
  const irsLiquido = formData.irsAutomatico
    ? { valor: irsCalculado.valor, percentual: irsCalculado.taxaEfetiva }
    : resolverTaxa(
        formData.modoIRSLiquido,
        formData.percentualIRSLiquido,
        formData.valorIRSLiquidoManual,
        formData.salarioBase,
      )
  const valorSegurancaLiquido = segurancaLiquido.valor
  const valorIRSLiquido = irsLiquido.valor
  const totalEncargosLiquido = round2(valorSegurancaLiquido + valorIRSLiquido)
  /** Peso total dos descontos sobre o salario base. */
  const taxaEfetivaDesconto =
    formData.salarioBase > 0 ? round2((totalEncargosLiquido / formData.salarioBase) * 100) : 0
  /** Total ilíquido: o que entra antes dos descontos. */
  const totalIliquido = round2(formData.salarioBase + valorBeneficiosCalculado + formData.valorTransporte)
  /** Salario base ja com os descontos, antes de somar os valores isentos. */
  const salarioBaseLiquido = round2(formData.salarioBase - totalEncargosLiquido)
  const valoresIsentos = round2(valorBeneficiosCalculado + formData.valorTransporte)
  const salarioTotalLiquido = round2(salarioBaseLiquido + valoresIsentos)
  const custoHoraLiquido = horasPorMes > 0 ? round2(salarioTotalLiquido / horasPorMes) : 0
  const valorVendaHoraLiquido = round2(custoHoraLiquido * (1 + Number(formData.margemLucro || 0) / 100))

  const filteredFuncionarios = funcionarios.filter((funcionario) =>
    matchesSearch(searchTerm, [
      funcionario.nome,
      funcionario.email,
      funcionario.telefone,
      funcionario.funcao,
      funcionario.departamento,
      funcionario.numeroFuncionario,
      funcionario.cidade,
    ]),
  )

  useEffect(() => {
    if (user) {
      loadFuncionarios()
    }
  }, [user])

  const loadFuncionarios = async () => {
    if (!user) return

    try {
      setPageLoading(true)
      const funcionariosData = await FirebaseService.getFuncionarios(user.uid)
      setFuncionarios(funcionariosData)
    } catch (error) {
      console.error("Erro ao carregar funcionarios:", error)
      toast({
        title: "Erro ao carregar funcionarios",
        description: "Nao foi possivel carregar a lista de funcionarios.",
        variant: "destructive",
      })
    } finally {
      setPageLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      const idade = calculateAge(formData.dataNascimento)

      const funcionarioToSave: Omit<Funcionario, "id" | "createdAt" | "updatedAt"> = {
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        telefone: formData.telefone.trim(),
        dataNascimento: formData.dataNascimento,
        idade,
        morada: formData.morada.trim(),
        cidade: formData.cidade.trim(),
        codigoPostal: formData.codigoPostal.trim(),
        nif: formData.nif.trim(),
        foto: formData.foto.trim(),
        observacoes: formData.observacoes.trim(),
        funcao: formData.funcao,
        dataAdmissao: formData.dataAdmissao,
        numeroFuncionario: formData.numeroFuncionario.trim(),
        departamento: formData.departamento,
        horasPorDia: Number(formData.horasPorDia) || 0,
        diasPorSemana: Number(formData.diasPorSemana) || 0,
        horasPorSemana,
        horasPorMes,
        diasUteisMes,
        mesReferencia: formData.mesReferencia,
        margemLucro: Number(formData.margemLucro) || 0,
        custoHora: valorDeVendaCalculado,
        custoHoraCalculado,
        salarioBase: round2(formData.salarioBase),
        valorBeneficios: round2(valorBeneficiosCalculado),
        valorTransporte: round2(formData.valorTransporte),
        // Grava a percentagem efetiva, mesmo quando foi lancado por valor fixo
        percentualSeguranca: seguranca.percentual,
        valorSeguranca,
        modoSeguranca: formData.modoSeguranca,
        percentualIRS: round2(formData.percentualIRS),
        valorIRS: 0,
        percentualSeguroAcidentes: seguroAcidentes.percentual,
        valorSeguroAcidentes,
        modoSeguroAcidentes: formData.modoSeguroAcidentes,
        incluiSubsidios: formData.incluiSubsidios,
        mesesSubsidioAlimentacao: Number(formData.mesesSubsidioAlimentacao) || 12,
        subsidioDiario: round2(formData.subsidioDiario),
        diasSubsidio: Number(formData.diasSubsidio) || 0,
        tabelaIRS: formData.tabelaIRS,
        dependentes: Number(formData.dependentes) || 0,
        irsAutomatico: formData.irsAutomatico,
        baseHoras: formData.baseHoras,
        diasUteisBase: diasUteisMes,
        beneficiosMensalMedio,
        valorSubsidiosMensal,
        totalEncargos,
        salarioTotal,
        percentualSegurancaLiquido: segurancaLiquido.percentual,
        valorSegurancaLiquido,
        modoSegurancaLiquido: formData.modoSegurancaLiquido,
        percentualIRSLiquido: irsLiquido.percentual,
        valorIRSLiquido,
        modoIRSLiquido: formData.modoIRSLiquido,
        totalEncargosLiquido,
        salarioTotalLiquido,
        custoHoraLiquido,
        valorVendaHoraLiquido,
        ativo: formData.ativo,
        userId: user.uid,
      }

      if (editingFuncionario) {
        await FirebaseService.updateFuncionario(editingFuncionario.id!, funcionarioToSave)
        toast({
          title: "Funcionario atualizado",
          description: "Os dados do funcionario foram atualizados com sucesso.",
        })
      } else {
        await FirebaseService.addFuncionario(funcionarioToSave, user.uid)
        toast({
          title: "Funcionario cadastrado",
          description: "O funcionario foi cadastrado com sucesso.",
        })
      }

      resetForm()
      setIsDialogOpen(false)
      await loadFuncionarios()
    } catch (error) {
      console.error("Erro ao salvar funcionario:", error)
      toast({
        title: "Erro ao salvar funcionario",
        description: "Nao foi possivel salvar os dados do funcionario.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (funcionario: Funcionario) => {
    setEditingFuncionario(funcionario)
    setFormData({
      nome: funcionario.nome,
      email: funcionario.email,
      telefone: funcionario.telefone,
      dataNascimento: funcionario.dataNascimento,
      morada: funcionario.morada || "",
      cidade: funcionario.cidade || "",
      codigoPostal: funcionario.codigoPostal || "",
      nif: funcionario.nif || "",
      foto: funcionario.foto || "",
      observacoes: funcionario.observacoes || "",
      funcao: funcionario.funcao,
      dataAdmissao: funcionario.dataAdmissao || "",
      numeroFuncionario: funcionario.numeroFuncionario || "",
      departamento: funcionario.departamento || "",
      horasPorDia: funcionario.horasPorDia || 8,
      diasPorSemana: funcionario.diasPorSemana || 5,
      mesReferencia: funcionario.mesReferencia || getCurrentMonthInput(),
      margemLucro: funcionario.margemLucro || 0,
      custoHora: funcionario.custoHora || 0,
      salarioBase: funcionario.salarioBase || 0,
      valorBeneficios: funcionario.valorBeneficios || 0,
      valorTransporte: funcionario.valorTransporte || 0,
      // Registos antigos guardavam a taxa combinada (34,75%) ou zero: repoe-se a taxa legal
      percentualSeguranca: funcionario.percentualSeguranca
        ? round2(Math.min(funcionario.percentualSeguranca, TSU_PATRONAL))
        : TSU_PATRONAL,
      percentualIRS: funcionario.percentualIRS || 0,
      percentualSeguroAcidentes: funcionario.percentualSeguroAcidentes ?? SEGURO_ACIDENTES_CONSTRUCAO,
      incluiSubsidios: funcionario.incluiSubsidios ?? true,
      mesesSubsidioAlimentacao: funcionario.mesesSubsidioAlimentacao ?? MESES_SUBSIDIO_ALIMENTACAO,
      // Registos antigos guardavam so o total mensal: converte-se para valor/dia
      subsidioDiario: round2(
        funcionario.subsidioDiario ??
          (funcionario.valorBeneficios ? funcionario.valorBeneficios / (funcionario.diasSubsidio || 22) : 0),
      ),
      diasSubsidio: funcionario.diasSubsidio ?? 22,
      tabelaIRS: funcionario.tabelaIRS ?? "I",
      dependentes: funcionario.dependentes ?? 0,
      irsAutomatico: funcionario.irsAutomatico ?? true,
      baseHoras: (funcionario.baseHoras as BaseHoras) ?? "media",
      percentualSegurancaLiquido: funcionario.percentualSegurancaLiquido ?? TSU_TRABALHADOR,
      percentualIRSLiquido: funcionario.percentualIRSLiquido ?? funcionario.percentualIRS ?? 0,
      modoSeguranca: funcionario.modoSeguranca ?? "percentual",
      valorSegurancaManual: round2(funcionario.valorSeguranca ?? 0),
      modoSeguroAcidentes: funcionario.modoSeguroAcidentes ?? "percentual",
      valorSeguroAcidentesManual: round2(funcionario.valorSeguroAcidentes ?? 0),
      modoSegurancaLiquido: funcionario.modoSegurancaLiquido ?? "percentual",
      valorSegurancaLiquidoManual: round2(funcionario.valorSegurancaLiquido ?? 0),
      modoIRSLiquido: funcionario.modoIRSLiquido ?? "percentual",
      valorIRSLiquidoManual: round2(funcionario.valorIRSLiquido ?? 0),
      ativo: funcionario.ativo,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este funcionario?")) return

    try {
      await FirebaseService.deleteFuncionario(id)
      toast({
        title: "Funcionario excluido",
        description: "O funcionario foi excluido com sucesso.",
      })
      await loadFuncionarios()
    } catch (error) {
      console.error("Erro ao excluir funcionario:", error)
      toast({
        title: "Erro ao excluir funcionario",
        description: "Nao foi possivel excluir o funcionario.",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData(getDefaultFormData())
    setEditingFuncionario(null)
    setActiveTab("pessoais")
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Funcionarios</h1>
          <p className="text-muted-foreground mt-2">Gerir equipe, encargos e custo real de mao de obra</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadFuncionarios} className="rounded-full bg-transparent">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Novo Funcionario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFuncionario ? "Editar Funcionario" : "Novo Funcionario"}</DialogTitle>
                <DialogDescription>
                  {editingFuncionario ? "Atualize os dados do funcionario." : "Adicione um novo funcionario a equipe."}
                </DialogDescription>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="pessoais">Dados Pessoais</TabsTrigger>
                  <TabsTrigger value="empresa">Empresa</TabsTrigger>
                  <TabsTrigger value="valores">Horario e Valores</TabsTrigger>
                  <TabsTrigger value="encargos">Encargos</TabsTrigger>
                  <TabsTrigger value="encargosLiquidos">Encargo Liquido</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit}>
                  <TabsContent value="pessoais" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome Completo *</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          placeholder="Nome completo do funcionario"
                          required
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="email@exemplo.com"
                          required
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telefone">Telefone *</Label>
                        <Input
                          id="telefone"
                          value={formData.telefone}
                          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                          placeholder="+351 xxx xxx xxx"
                          required
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                        <Input
                          id="dataNascimento"
                          type="date"
                          value={formData.dataNascimento}
                          onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                          required
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="morada">Morada</Label>
                      <Input
                        id="morada"
                        value={formData.morada}
                        onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                        placeholder="Rua, numero, andar"
                        className="rounded-full"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cidade">Cidade</Label>
                        <Input
                          id="cidade"
                          value={formData.cidade}
                          onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                          placeholder="Cidade"
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codigoPostal">Codigo Postal</Label>
                        <Input
                          id="codigoPostal"
                          value={formData.codigoPostal}
                          onChange={(e) => setFormData({ ...formData, codigoPostal: e.target.value })}
                          placeholder="XXXX-XXX"
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nif">NIF</Label>
                        <Input
                          id="nif"
                          value={formData.nif}
                          onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                          placeholder="NIF"
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="foto">URL da Foto (Opcional)</Label>
                      <Input
                        id="foto"
                        value={formData.foto}
                        onChange={(e) => setFormData({ ...formData, foto: e.target.value })}
                        placeholder="https://exemplo.com/foto.jpg"
                        className="rounded-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observacoes">Observacoes Pessoais</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder="Observacoes sobre o funcionario..."
                        rows={3}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="empresa" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="funcao">Funcao *</Label>
                        <Select value={formData.funcao} onValueChange={(value) => setFormData({ ...formData, funcao: value })}>
                          <SelectTrigger className="rounded-full">
                            <SelectValue placeholder="Selecione a funcao" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pintor">Pintor</SelectItem>
                            <SelectItem value="Pintor Senior">Pintor Senior</SelectItem>
                            <SelectItem value="Auxiliar de Pintor">Auxiliar de Pintor</SelectItem>
                            <SelectItem value="Preparador de Superficie">Preparador de Superficie</SelectItem>
                            <SelectItem value="Supervisor">Supervisor</SelectItem>
                            <SelectItem value="Encarregado">Encarregado</SelectItem>
                            <SelectItem value="Gerente de Projetos">Gerente de Projetos</SelectItem>
                            <SelectItem value="Administrativo">Administrativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dataAdmissao">Data de Admissao</Label>
                        <Input
                          id="dataAdmissao"
                          type="date"
                          value={formData.dataAdmissao}
                          onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="numeroFuncionario">Numero do Funcionario</Label>
                        <Input
                          id="numeroFuncionario"
                          value={formData.numeroFuncionario}
                          onChange={(e) => setFormData({ ...formData, numeroFuncionario: e.target.value })}
                          placeholder="Ex: FUNC001"
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="departamento">Departamento</Label>
                        <Select
                          value={formData.departamento}
                          onValueChange={(value) => setFormData({ ...formData, departamento: value })}
                        >
                          <SelectTrigger className="rounded-full">
                            <SelectValue placeholder="Selecione o departamento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Operacional">Operacional</SelectItem>
                            <SelectItem value="Administrativo">Administrativo</SelectItem>
                            <SelectItem value="Comercial">Comercial</SelectItem>
                            <SelectItem value="Financeiro">Financeiro</SelectItem>
                            <SelectItem value="Recursos Humanos">Recursos Humanos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ativo">Status</Label>
                      <Select
                        value={formData.ativo.toString()}
                        onValueChange={(value) => setFormData({ ...formData, ativo: value === "true" })}
                      >
                        <SelectTrigger className="rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Ativo</SelectItem>
                          <SelectItem value="false">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="valores" className="space-y-4 mt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="horasPorDia">Horas por Dia *</Label>
                        <Input
                          id="horasPorDia"
                          type="number"
                          min="1"
                          max="24"
                          value={formData.horasPorDia}
                          onChange={(e) => setFormData({ ...formData, horasPorDia: Number(e.target.value) || 8 })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="diasPorSemana">Dias por Semana *</Label>
                        <Input
                          id="diasPorSemana"
                          type="number"
                          min="1"
                          max="7"
                          value={formData.diasPorSemana}
                          onChange={(e) => setFormData({ ...formData, diasPorSemana: Number(e.target.value) || 5 })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mesReferencia">Mes para calculo</Label>
                        <Input
                          id="mesReferencia"
                          type="month"
                          value={formData.mesReferencia}
                          onChange={(e) => setFormData({ ...formData, mesReferencia: e.target.value })}
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Horas por Semana (calculado)</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="text-lg font-semibold">{toFixed2(horasPorSemana)} h/semana</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Dias uteis no mes (calculado)</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="text-lg font-semibold">{diasUteisMes} dias</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Horas por Mes (calculado)</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="text-lg font-semibold">{toFixed2(horasPorMes)} h/mes</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baseHoras">Base de horas para o custo/hora</Label>
                      <Select
                        value={formData.baseHoras}
                        onValueChange={(value) => setFormData({ ...formData, baseHoras: value as BaseHoras })}
                      >
                        <SelectTrigger className="rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="media">Media anual - equilibrada</SelectItem>
                          <SelectItem value="maior">Maior mes do ano - menor custo/hora</SelectItem>
                          <SelectItem value="menor">Menor mes do ano - maior custo/hora</SelectItem>
                          <SelectItem value="mes">Mes de referencia escolhido</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Base atual: <span className="font-medium text-foreground">{toFixed2(diasUteisMes)} dias</span>{" "}
                        ({baseDias.detalhe}) x {toFixed2(formData.horasPorDia)}h ={" "}
                        <span className="font-medium text-foreground">{toFixed2(horasPorMes)}h/mes</span>. O mes
                        escolhido acima tem {diasDoMesEscolhido} dias uteis.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Quanto mais horas no divisor, menor o custo/hora. A media anual nao subavalia nem sobreavalia
                        nenhum mes; o maior mes da o valor mais agressivo e o menor mes o mais seguro.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="margemLucro">Margem de Lucro (%)</Label>
                        <Input
                          id="margemLucro"
                          type="number"
                          step="0.01"
                          value={formData.margemLucro}
                          onChange={(e) => setFormData({ ...formData, margemLucro: Number(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custoHora">Valor de Venda por Hora (EUR) *</Label>
                        <div className="p-3 bg-muted rounded-lg w-full flex items-center h-10 border mt-1">
                          <span className="text-sm">{toFixed2(valorDeVendaCalculado)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="salarioBase">Salario Base (EUR) *</Label>
                        <Input
                          id="salarioBase"
                          type="number"
                          step="0.01"
                          value={formData.salarioBase}
                          onChange={(e) => setFormData({ ...formData, salarioBase: Number(e.target.value) || 0 })}
                          placeholder="0.00"
                          required
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="subsidioDiario">Subsidio de alimentacao por dia (EUR)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="subsidioDiario"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.subsidioDiario}
                            onChange={(e) =>
                              setFormData({ ...formData, subsidioDiario: round2(Number(e.target.value) || 0) })
                            }
                            placeholder="7,50"
                            className="rounded-full"
                          />
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="31"
                            value={formData.diasSubsidio}
                            onChange={(e) =>
                              setFormData({ ...formData, diasSubsidio: Number(e.target.value) || 0 })
                            }
                            title="Dias considerados"
                            className="w-20 rounded-full"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {toFixed2(formData.subsidioDiario)} EUR x {formData.diasSubsidio} dias ={" "}
                          <span className="font-medium text-foreground">
                            {formatCurrency(valorBeneficiosCalculado)}
                          </span>
                          {formData.diasSubsidio !== diasUteisMes && (
                            <>
                              {" "}
                              &middot;{" "}
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, diasSubsidio: diasUteisMes })}
                                className="underline hover:text-foreground"
                              >
                                usar {diasUteisMes} dias (base)
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="valorTransporte">Valor Transporte (EUR)</Label>
                        <Input
                          id="valorTransporte"
                          type="number"
                          step="0.01"
                          value={formData.valorTransporte}
                          onChange={(e) => setFormData({ ...formData, valorTransporte: Number(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="rounded-full"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="encargos" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Custo real da empresa. O IRS <strong>nao entra aqui</strong>: e retido ao trabalhador e nao e
                      custo da entidade patronal (aparece na aba Encargo Liquido).
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <CampoTaxa
                        id="percentualSeguranca"
                        label="Seguranca Social patronal"
                        base={baseEncargos}
                        modo={formData.modoSeguranca}
                        percentual={formData.percentualSeguranca}
                        valorManual={formData.valorSegurancaManual}
                        resolvido={seguranca}
                        ajuda={<>taxa legal 2026: {toFixed2(TSU_PATRONAL)}%</>}
                        onChange={(campos) =>
                          setFormData({
                            ...formData,
                            modoSeguranca: campos.modo ?? formData.modoSeguranca,
                            percentualSeguranca: campos.percentual ?? formData.percentualSeguranca,
                            valorSegurancaManual: campos.valorManual ?? formData.valorSegurancaManual,
                          })
                        }
                      />

                      <CampoTaxa
                        id="percentualSeguroAcidentes"
                        label="Seguro de acidentes de trabalho"
                        base={baseEncargos}
                        modo={formData.modoSeguroAcidentes}
                        percentual={formData.percentualSeguroAcidentes}
                        valorManual={formData.valorSeguroAcidentesManual}
                        resolvido={seguroAcidentes}
                        ajuda={<>obrigatorio; construcao ronda 1% a 5%</>}
                        onChange={(campos) =>
                          setFormData({
                            ...formData,
                            modoSeguroAcidentes: campos.modo ?? formData.modoSeguroAcidentes,
                            percentualSeguroAcidentes: campos.percentual ?? formData.percentualSeguroAcidentes,
                            valorSeguroAcidentesManual:
                              campos.valorManual ?? formData.valorSeguroAcidentesManual,
                          })
                        }
                      />
                    </div>

                    <label className="flex items-start gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={formData.incluiSubsidios}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, incluiSubsidios: checked === true })
                        }
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        Diluir subsidios de ferias e Natal no custo mensal
                        <span className="block text-xs text-muted-foreground">
                          Em Portugal paga-se 14 meses de salario por ano. Diluir os 2 meses extra ({formatCurrency(
                            valorSubsidiosMensal,
                          )}
                          /mes) evita subavaliar o custo/hora.
                        </span>
                      </span>
                    </label>

                    {formData.incluiSubsidios && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="mesesSubsidioAlimentacao">Meses de subsidio de alimentacao por ano</Label>
                          <Input
                            id="mesesSubsidioAlimentacao"
                            type="number"
                            step="1"
                            min="0"
                            max="12"
                            value={formData.mesesSubsidioAlimentacao}
                            onChange={(e) =>
                              setFormData({ ...formData, mesesSubsidioAlimentacao: Number(e.target.value) || 0 })
                            }
                            className="rounded-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            Paga-se por dia trabalhado, entao no mes de ferias nao ha refeicao: por norma{" "}
                            {MESES_SUBSIDIO_ALIMENTACAO} meses. Media mensal: {formatCurrency(beneficiosMensalMedio)}
                          </p>
                        </div>
                      </div>
                    )}

                    {beneficiosAcimaDoLimite > 0 && (
                      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
                        O subsidio de alimentacao esta {formatCurrency(beneficiosAcimaDoLimite)} acima do limite isento
                        ({formatCurrency(SUBSIDIO_ALIMENTACAO_ISENTO_CARTAO)}/dia em cartao x {diasUteisMes} dias ={" "}
                        {formatCurrency(limiteSubsidioMes)}). O excedente paga IRS e Seguranca Social dos dois lados.
                      </div>
                    )}

                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">Memoria de calculo</div>
                      <div className="flex justify-between text-sm">
                        <span>Salario base</span>
                        <span className="font-medium">{formatCurrency(formData.salarioBase)}</span>
                      </div>
                      {formData.incluiSubsidios && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground pl-4">Subsidios ferias + Natal (2/12)</span>
                          <span>+ {formatCurrency(valorSubsidiosMensal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span>Base de incidencia</span>
                        <span className="font-medium">{formatCurrency(baseEncargos)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground pl-4">
                          Seguranca Social patronal ({toFixed2(seguranca.percentual)}%)
                        </span>
                        <span>+ {formatCurrency(valorSeguranca)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground pl-4">
                          Seguro de acidentes ({toFixed2(seguroAcidentes.percentual)}%)
                        </span>
                        <span>+ {formatCurrency(valorSeguroAcidentes)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground pl-4">
                          Subsidio alimentacao{" "}
                          {formData.incluiSubsidios
                            ? `(${formData.mesesSubsidioAlimentacao} meses/ano diluidos)`
                            : "(isento ate ao limite)"}
                        </span>
                        <span>+ {formatCurrency(beneficiosMensalMedio)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground pl-4">Transporte (isento)</span>
                        <span>+ {formatCurrency(formData.valorTransporte)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">Total de encargos da empresa</span>
                        <span className="font-semibold">{formatCurrency(totalEncargos)}</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-primary/10 p-4">
                      <div className="text-sm text-muted-foreground">Custo total mensal da empresa</div>
                      <div className="text-2xl font-bold text-primary">{formatCurrency(salarioTotal)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {percentualSobreSalario > 0 && (
                          <>
                            {toFixed2(percentualSobreSalario)}% da remuneracao bruta
                            {percentualSobreSalario >= 128 && percentualSobreSalario <= 148
                              ? " - dentro da referencia de mercado em PT (130% a 145%)"
                              : " - fora da referencia habitual em PT (130% a 145%), vale rever os campos"}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Custo/hora automatico (real)</span>
                        <span className="font-semibold">{formatCurrency(custoHoraCalculado)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">Valor de venda/hora</span>
                        <span className="font-semibold">{formatCurrency(valorDeVendaCalculado)}</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="encargosLiquidos" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Simulacao do recibo de vencimento: o que o trabalhador recebe e quanto lhe e descontado. Os
                      descontos incidem apenas sobre o salario base. Cada taxa pode ser lancada em percentagem ou
                      diretamente em euros.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <CampoTaxa
                        id="percentualSegurancaLiquido"
                        label="Seguranca Social do trabalhador"
                        base={formData.salarioBase}
                        modo={formData.modoSegurancaLiquido}
                        percentual={formData.percentualSegurancaLiquido}
                        valorManual={formData.valorSegurancaLiquidoManual}
                        resolvido={segurancaLiquido}
                        ajuda={<>taxa legal 2026: {toFixed2(TSU_TRABALHADOR)}%</>}
                        onChange={(campos) =>
                          setFormData({
                            ...formData,
                            modoSegurancaLiquido: campos.modo ?? formData.modoSegurancaLiquido,
                            percentualSegurancaLiquido:
                              campos.percentual ?? formData.percentualSegurancaLiquido,
                            valorSegurancaLiquidoManual:
                              campos.valorManual ?? formData.valorSegurancaLiquidoManual,
                          })
                        }
                      />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label>IRS retido na fonte</Label>
                          <div className="flex rounded-full border p-0.5">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, irsAutomatico: true })}
                              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                                formData.irsAutomatico ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                              }`}
                            >
                              Automatico
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, irsAutomatico: false })}
                              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                                !formData.irsAutomatico ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                              }`}
                            >
                              Manual
                            </button>
                          </div>
                        </div>

                        {formData.irsAutomatico ? (
                          <>
                            <Select
                              value={formData.tabelaIRS}
                              onValueChange={(value) => setFormData({ ...formData, tabelaIRS: value })}
                            >
                              <SelectTrigger className="rounded-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TABELAS_IRS.map((tabela) => (
                                  <SelectItem key={tabela.id} value={tabela.id}>
                                    {tabela.nome} - {tabela.descricao}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {getTabelaIRS(formData.tabelaIRS).aceitaDependentes && (
                              <div className="flex items-center gap-2">
                                <Label htmlFor="dependentes" className="text-xs text-muted-foreground">
                                  Dependentes
                                </Label>
                                <Input
                                  id="dependentes"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={formData.dependentes}
                                  onChange={(e) =>
                                    setFormData({ ...formData, dependentes: Number(e.target.value) || 0 })
                                  }
                                  className="h-8 w-20 rounded-full"
                                />
                                <span className="text-xs text-muted-foreground">
                                  - {formatCurrency(getTabelaIRS(formData.tabelaIRS).parcelaDependente)} cada
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.valorIRSLiquidoManual}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                modoIRSLiquido: "valor",
                                valorIRSLiquidoManual: round2(Number(e.target.value) || 0),
                              })
                            }
                            placeholder="0,00 EUR"
                            className="rounded-full"
                          />
                        )}

                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {toFixed2(irsLiquido.percentual)}% = {formatCurrency(irsLiquido.valor)}
                          </span>
                          {formData.irsAutomatico && (
                            <>
                              {" "}
                              &middot;{" "}
                              {irsCalculado.isento
                                ? "isento (ate 920 EUR/mes)"
                                : `escalao ate ${irsCalculado.escalaoAte ?? "-"} EUR, taxa marginal ${toFixed2(
                                    irsCalculado.taxaMarginal,
                                  )}%`}
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tabelas oficiais de 2026 (Despacho 233-A/2026). Formula: remuneracao x taxa - parcela a
                          abater - parcela por dependente.
                        </p>
                      </div>
                    </div>

                    {/* Recibo de vencimento */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="bg-muted px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
                        Recibo de vencimento (simulacao)
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase">Vencimentos</div>
                        <div className="flex justify-between text-sm">
                          <span>Vencimento base</span>
                          <span className="font-medium">{formatCurrency(formData.salarioBase)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subsidio de alimentacao (isento)</span>
                          <span>+ {formatCurrency(valorBeneficiosCalculado)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Transporte (isento)</span>
                          <span>+ {formatCurrency(formData.valorTransporte)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2 font-medium">
                          <span>Total iliquido</span>
                          <span>{formatCurrency(totalIliquido)}</span>
                        </div>
                      </div>

                      <div className="border-t p-4 space-y-2 bg-destructive/5">
                        <div className="text-xs font-medium text-muted-foreground uppercase">
                          Descontos do trabalhador
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Seguranca Social ({toFixed2(segurancaLiquido.percentual)}% do salario base)
                          </span>
                          <span className="text-destructive">- {formatCurrency(valorSegurancaLiquido)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            IRS ({toFixed2(irsLiquido.percentual)}% do salario base)
                          </span>
                          <span className="text-destructive">- {formatCurrency(valorIRSLiquido)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2 font-medium">
                          <span>Total descontado</span>
                          <span className="text-destructive">- {formatCurrency(totalEncargosLiquido)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Peso dos descontos sobre o salario base</span>
                          <span>{toFixed2(taxaEfetivaDesconto)}%</span>
                        </div>
                      </div>

                      <div className="border-t bg-secondary p-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-sm text-muted-foreground">Liquido a receber</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatCurrency(formData.salarioBase)} - {formatCurrency(totalEncargosLiquido)} +{" "}
                              {formatCurrency(valoresIsentos)} isentos
                            </div>
                          </div>
                          <div className="text-2xl font-bold">{formatCurrency(salarioTotalLiquido)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-4 space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase">Salario base</div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Bruto</span>
                          <span>{formatCurrency(formData.salarioBase)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Liquido (apos descontos)</span>
                          <span className="font-semibold">{formatCurrency(salarioBaseLiquido)}</span>
                        </div>
                      </div>

                      <div className="rounded-lg border p-4 space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase">Por hora</div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Liquido/hora</span>
                          <span>{formatCurrency(custoHoraLiquido)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Custo/hora para a empresa</span>
                          <span className="font-semibold">{formatCurrency(custoHoraCalculado)}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <div className="flex justify-end space-x-2 pt-6 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="rounded-full">
                      {loading ? "A guardar..." : editingFuncionario ? "Atualizar" : "Cadastrar"}
                    </Button>
                  </div>
                </form>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearSearch}
        placeholder="Pesquisar por nome, email, funcao, departamento..."
        resultCount={filteredFuncionarios.length}
        totalCount={funcionarios.length}
      />

      {filteredFuncionarios.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredFuncionarios.map((funcionario, index) => {
            const horasSemana = funcionario.horasPorSemana ?? calculateHorasPorSemana(funcionario.horasPorDia, funcionario.diasPorSemana)
            const custoRealHora = funcionario.custoHoraCalculado ?? funcionario.custoHora

            return (
              <Card key={funcionario.id} className="animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={funcionario.foto || "/placeholder.svg"} alt={funcionario.nome} />
                      <AvatarFallback>
                        {funcionario.nome
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{funcionario.nome}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {funcionario.funcao}
                      </CardDescription>
                    </div>
                    <Badge variant={funcionario.ativo ? "default" : "secondary"}>{funcionario.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{funcionario.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{funcionario.telefone}</span>
                    </div>
                    {funcionario.morada && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{funcionario.morada}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{funcionario.idade} anos</span>
                    </div>
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Horario:
                        </span>
                        <span className="font-medium">
                          {funcionario.horasPorDia}h/dia, {funcionario.diasPorSemana}d/sem
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Horas semanais:</span>
                        <span className="font-medium">{toFixed2(horasSemana)}h</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Horas mensais:</span>
                        <span className="font-medium">
                          {toFixed2(
                            funcionario.horasPorMes ??
                              calculateHorasPorMes(
                                funcionario.mesReferencia || "",
                                funcionario.horasPorDia,
                                funcionario.diasPorSemana,
                              ),
                          )}
                          h
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          Venda/hora:
                        </span>
                        <span className="font-medium">{formatCurrency(funcionario.custoHora)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Custo real/hora:
                        </span>
                        <span className="font-medium">{formatCurrency(custoRealHora)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Salario Total:</span>
                        <span className="font-medium text-primary">{formatCurrency(funcionario.salarioTotal)}</span>
                      </div>
                    </div>
                    {funcionario.observacoes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground line-clamp-2">{funcionario.observacoes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(funcionario)} className="rounded-full">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(funcionario.id!)}
                      className="rounded-full text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : funcionarios.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum funcionario encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Nenhum resultado para &quot;{searchTerm}&quot;. Ajuste a pesquisa para ver a lista completa.
            </p>
            <Button onClick={clearSearch} variant="outline" className="rounded-full">
              Limpar pesquisa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum funcionario cadastrado</h3>
            <p className="text-muted-foreground text-center mb-4">Comece por adicionar funcionarios a sua equipe.</p>
            <Button onClick={() => setIsDialogOpen(true)} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Funcionario
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
