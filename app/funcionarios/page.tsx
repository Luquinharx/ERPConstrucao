"use client"

import type React from "react"
import { Fragment, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CampoNumerico } from "@/components/ui/campo-numerico"
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
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import type { Funcionario, ModoTaxa } from "@/lib/types"
import { FirebaseService, getFuncoes } from "@/lib/firebase-service"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { formatCurrency, matchesSearch, round2, toFixed2 } from "@/lib/utils"
import { localeIntl, m, t } from "@/lib/i18n"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { TABELAS_IRS, getTabelaIRS } from "@/lib/irs-tables"
import {
  MESES_SUBSIDIOS,
  MESES_SUBSIDIO_ALIMENTACAO,
  SEGURO_ACIDENTES_CONSTRUCAO,
  SUBSIDIO_ALIMENTACAO_ISENTO_CARTAO,
  SUBSIDIO_ALIMENTACAO_ISENTO_DINHEIRO,
  TSU_PATRONAL,
  TSU_TRABALHADOR,
  calcularFuncionario,
  calculateDiasUteisMes,
  calculateDiasUteisDoAno,
  calculateHorasPorMes,
  calculateHorasPorSemana,
  calculateMaiorMesDoAno,
  calculatePercentValue,
  getCurrentMonthInput,
  normalizarFuncionario,
  resolverBaseDias,
  resolverTaxa,
  type BaseHoras,
} from "@/lib/calculo-funcionario"

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

/** Texto com dias, no singular ou no plural. */
function textoDias(n: number | string): string {
  return Number(n) === 1 ? t("{n} dia", { n }) : t("{n} dias", { n })
}

/**
 * Troca os {marcadores} que t() deixou por preencher por elementos React
 * (ex.: um valor em negrito no meio da frase traduzida).
 */
function comDestaques(texto: string, destaques: Record<string, React.ReactNode>): React.ReactNode {
  return texto
    .split(/\{(\w+)\}/g)
    .map((parte, i) => (i % 2 === 1 ? <Fragment key={i}>{destaques[parte] ?? `{${parte}}`}</Fragment> : parte))
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
        <CampoNumerico
          id={id}
          min={0}
          sufixo="%"
          value={percentual}
          onChange={(valor) => onChange({ percentual: valor })}
          className="rounded-full"
        />
      ) : (
        <CampoNumerico
          id={id}
          min={0}
          sufixo="EUR"
          value={valorManual}
          onChange={(valor) => onChange({ valorManual: valor })}
          className="rounded-full"
        />
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {toFixed2(resolvido.percentual)}% = {formatCurrency(resolvido.valor)}
        </span>
        {base > 0 && <> {t("sobre {valor}", { valor: formatCurrency(base) })}</>}
        {ajuda && <> · {ajuda}</>}
      </p>
    </div>
  )
}

/** Funcoes de sempre, para quem ainda nao cadastrou as suas em Funcoes. */
const FUNCOES_BASE = [
  m("Pintor"),
  m("Pintor Sénior"),
  m("Auxiliar de Pintor"),
  m("Preparador de Superfícies"),
  m("Supervisor"),
  m("Encarregado"),
  m("Gestor de Projetos"),
  m("Gerência"),
  m("Diretor"),
  m("Administrativo"),
]

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pessoais")
  const { user } = useAuth()
  const { pode } = usePermissoes()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const [formData, setFormData] = useState<FuncionarioFormState>(getDefaultFormData())

  const horasPorSemana = calculateHorasPorSemana(formData.horasPorDia, formData.diasPorSemana)
  /**
   * Os numeros derivados vem todos de lib/calculo-funcionario.
   *
   * O ecra e o script de manutencao chamam a mesma funcao, entao nao ha forma
   * de os dois divergirem no custo/hora que alimenta os orcamentos.
   */
  const {
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
  } = calcularFuncionario(formData)

  const valorSeguranca = seguranca.valor
  const valorSeguroAcidentes = seguroAcidentes.valor
  const valorSegurancaLiquido = segurancaLiquido.valor
  const valorIRSLiquido = irsLiquido.valor

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

  /**
   * Funcoes para o campo Funcao: as cadastradas (que dao o preco ao cliente)
   * mais as de sempre. A ligacao funcionario -> funcao e pelo nome, por isso
   * escolher daqui evita um "Pintor " com espaco a mais que nao casava.
   */
  const [funcoesCadastradas, setFuncoesCadastradas] = useState<string[]>([])
  useEffect(() => {
    if (!user) return
    getFuncoes()
      .then((lista) => setFuncoesCadastradas(lista.filter((f) => f.ativo !== false).map((f) => f.nome)))
      .catch(() => setFuncoesCadastradas([]))
  }, [user])
  const opcoesFuncao = Array.from(
    new Set([
      ...funcoesCadastradas,
      // Sugestões no idioma de quem usa: o nome escolhido é o que fica gravado
      ...FUNCOES_BASE.map((nome) => t(nome)),
      // Cargos criados a mao noutros funcionarios ficam disponiveis para todos
      ...funcionarios.map((f) => (f.funcao || "").trim()).filter(Boolean),
      ...(formData.funcao ? [formData.funcao] : []),
    ]),
  ).sort((a, b) => a.localeCompare(b, localeIntl()))
  const [novaFuncao, setNovaFuncao] = useState("")

  const loadFuncionarios = async () => {
    if (!user) return

    try {
      setPageLoading(true)
      const funcionariosData = await FirebaseService.getFuncionarios(user.uid)
      setFuncionarios(funcionariosData)
    } catch (error) {
      console.error("Erro ao carregar funcionarios:", error)
      toast({
        title: t("Erro ao carregar funcionários"),
        description: t("Não foi possível carregar a lista de funcionários."),
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
          title: t("Funcionário atualizado"),
          description: t("Os dados do funcionário foram atualizados com sucesso."),
        })
      } else {
        await FirebaseService.addFuncionario(funcionarioToSave, user.uid)
        toast({
          title: t("Funcionário registado"),
          description: t("O funcionário foi registado com sucesso."),
        })
      }

      resetForm()
      setIsDialogOpen(false)
      await loadFuncionarios()
    } catch (error) {
      console.error("Erro ao salvar funcionario:", error)
      toast({
        title: t("Erro ao guardar funcionário"),
        description: t("Não foi possível guardar os dados do funcionário."),
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
    if (!confirm(t("Tem a certeza de que pretende eliminar este funcionário?"))) return

    try {
      await FirebaseService.deleteFuncionario(id)
      toast({
        title: t("Funcionário eliminado"),
        description: t("O funcionário foi eliminado com sucesso."),
      })
      await loadFuncionarios()
    } catch (error) {
      console.error("Erro ao excluir funcionario:", error)
      toast({
        title: t("Erro ao eliminar funcionário"),
        description: t("Não foi possível eliminar o funcionário."),
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
          <h1 className="text-3xl font-bold">{t("Funcionários")}</h1>
          <p className="text-muted-foreground mt-2">{t("Gerir a equipa, os encargos e o custo real da mão de obra")}</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!pode("funcionarios.gerir")} onClick={resetForm} className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                {t("Novo funcionário")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFuncionario ? t("Editar funcionário") : t("Novo funcionário")}</DialogTitle>
                <DialogDescription>
                  {editingFuncionario ? t("Atualize os dados do funcionário.") : t("Adicione um novo funcionário à equipa.")}
                </DialogDescription>
              </DialogHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="pessoais">{t("Dados pessoais")}</TabsTrigger>
                  <TabsTrigger value="empresa">{t("Empresa")}</TabsTrigger>
                  <TabsTrigger value="valores">{t("Horário e valores")}</TabsTrigger>
                  <TabsTrigger value="encargos">{t("Encargos")}</TabsTrigger>
                  <TabsTrigger value="encargosLiquidos">{t("Encargo líquido")}</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit}>
                  <TabsContent value="pessoais" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">{t("Nome completo *")}</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          placeholder={t("Nome completo do funcionário")}
                          required
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("Email *")}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder={t("email@exemplo.com")}
                          required
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telefone">{t("Telefone *")}</Label>
                        <Input
                          id="telefone"
                          value={formData.telefone}
                          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                          placeholder={t("+351 xxx xxx xxx")}
                          required
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dataNascimento">{t("Data de nascimento *")}</Label>
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
                      <Label htmlFor="morada">{t("Morada")}</Label>
                      <Input
                        id="morada"
                        value={formData.morada}
                        onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                        placeholder={t("Rua, número, andar")}
                        className="rounded-full"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cidade">{t("Cidade")}</Label>
                        <Input
                          id="cidade"
                          value={formData.cidade}
                          onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                          placeholder={t("Cidade")}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codigoPostal">{t("Código postal")}</Label>
                        <Input
                          id="codigoPostal"
                          value={formData.codigoPostal}
                          onChange={(e) => setFormData({ ...formData, codigoPostal: e.target.value })}
                          placeholder={t("XXXX-XXX")}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nif">{t("NIF")}</Label>
                        <Input
                          id="nif"
                          value={formData.nif}
                          onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                          placeholder={t("NIF")}
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="foto">{t("URL da foto (opcional)")}</Label>
                      <Input
                        id="foto"
                        value={formData.foto}
                        onChange={(e) => setFormData({ ...formData, foto: e.target.value })}
                        placeholder={t("https://exemplo.com/foto.jpg")}
                        className="rounded-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observacoes">{t("Observações pessoais")}</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder={t("Observações sobre o funcionário...")}
                        rows={3}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="empresa" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="funcao">{t("Função *")}</Label>
                        <Select
                          // Remonta com a lista nova: um cargo acabado de criar aparece logo escolhido
                          key={opcoesFuncao.join("|")}
                          value={formData.funcao}
                          // O select nativo escondido limpa o valor se ele ainda nao estiver na lista
                          onValueChange={(value) => value && setFormData((atual) => ({ ...atual, funcao: value }))}
                        >
                          <SelectTrigger className="rounded-full">
                            <SelectValue placeholder={t("Selecione a função")} />
                          </SelectTrigger>
                          <SelectContent>
                            {opcoesFuncao.map((nome) => (
                              <SelectItem key={nome} value={nome}>
                                {nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Input
                            placeholder={t("Novo cargo (ex.: Diretor)")}
                            value={novaFuncao}
                            onChange={(e) => setNovaFuncao(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && novaFuncao.trim()) {
                                e.preventDefault()
                                setFormData({ ...formData, funcao: novaFuncao.trim() })
                                setNovaFuncao("")
                              }
                            }}
                            className="rounded-full h-8 text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full h-8"
                            disabled={!novaFuncao.trim()}
                            onClick={() => {
                              setFormData({ ...formData, funcao: novaFuncao.trim() })
                              setNovaFuncao("")
                            }}
                          >
                            {t("Criar")}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dataAdmissao">{t("Data de admissão")}</Label>
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
                        <Label htmlFor="numeroFuncionario">{t("Número do funcionário")}</Label>
                        <Input
                          id="numeroFuncionario"
                          value={formData.numeroFuncionario}
                          onChange={(e) => setFormData({ ...formData, numeroFuncionario: e.target.value })}
                          placeholder={t("Ex.: FUNC001")}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="departamento">{t("Departamento")}</Label>
                        <Select
                          value={formData.departamento}
                          onValueChange={(value) => setFormData({ ...formData, departamento: value })}
                        >
                          <SelectTrigger className="rounded-full">
                            <SelectValue placeholder={t("Selecione o departamento")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Operacional">{t("Operacional")}</SelectItem>
                            <SelectItem value="Administrativo">{t("Administrativo")}</SelectItem>
                            <SelectItem value="Comercial">{t("Comercial")}</SelectItem>
                            <SelectItem value="Financeiro">{t("Financeiro")}</SelectItem>
                            <SelectItem value="Recursos Humanos">{t("Recursos Humanos")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ativo">{t("Estado")}</Label>
                      <Select
                        value={formData.ativo.toString()}
                        onValueChange={(value) => setFormData({ ...formData, ativo: value === "true" })}
                      >
                        <SelectTrigger className="rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">{t("Ativo")}</SelectItem>
                          <SelectItem value="false">{t("Inativo")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="valores" className="space-y-4 mt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="horasPorDia">{t("Horas por dia *")}</Label>
                        <CampoNumerico
                          id="horasPorDia"
                          min={1}
                          max={24}
                          sufixo="h"
                          value={formData.horasPorDia}
                          onChange={(horasPorDia) => setFormData({ ...formData, horasPorDia })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="diasPorSemana">{t("Dias por semana *")}</Label>
                        <CampoNumerico
                          id="diasPorSemana"
                          decimais={0}
                          min={1}
                          max={7}
                          value={formData.diasPorSemana}
                          onChange={(diasPorSemana) => setFormData({ ...formData, diasPorSemana })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mesReferencia">{t("Mês para o cálculo")}</Label>
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
                        <Label>{t("Horas por semana (calculado)")}</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="text-lg font-semibold">{t("{n} h/semana", { n: toFixed2(horasPorSemana) })}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("Dias úteis no mês (calculado)")}</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="text-lg font-semibold">{textoDias(diasUteisMes)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("Horas por mês (calculado)")}</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="text-lg font-semibold">{t("{n} h/mês", { n: toFixed2(horasPorMes) })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baseHoras">{t("Base de horas para o custo/hora")}</Label>
                      <Select
                        value={formData.baseHoras}
                        onValueChange={(value) => setFormData({ ...formData, baseHoras: value as BaseHoras })}
                      >
                        <SelectTrigger className="rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="media">{t("Média anual - equilibrada")}</SelectItem>
                          <SelectItem value="maior">{t("Maior mês do ano - menor custo/hora")}</SelectItem>
                          <SelectItem value="menor">{t("Menor mês do ano - maior custo/hora")}</SelectItem>
                          <SelectItem value="mes">{t("Mês de referência escolhido")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {comDestaques(
                          t(
                            "Base atual: {dias} ({detalhe}) x {horas}h = {total}. O mês escolhido acima tem {diasMes} dias úteis.",
                            { detalhe: baseDias.detalhe, horas: toFixed2(formData.horasPorDia), diasMes: diasDoMesEscolhido },
                          ),
                          {
                            dias: <span className="font-medium text-foreground">{textoDias(toFixed2(diasUteisMes))}</span>,
                            total: (
                              <span className="font-medium text-foreground">
                                {t("{n} h/mês", { n: toFixed2(horasPorMes) })}
                              </span>
                            ),
                          },
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "Quanto mais horas no divisor, menor o custo/hora. A média anual não subavalia nem sobreavalia nenhum mês; o maior mês dá o valor mais agressivo e o menor mês o mais seguro.",
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="margemLucro">{t("Margem de lucro (%)")}</Label>
                        <CampoNumerico
                          id="margemLucro"
                          sufixo="%"
                          value={formData.margemLucro}
                          onChange={(margemLucro) => setFormData({ ...formData, margemLucro })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custoHora">{t("Valor de venda por hora (EUR) *")}</Label>
                        <div className="p-3 bg-muted rounded-lg w-full flex items-center h-10 border mt-1">
                          <span className="text-sm">{toFixed2(valorDeVendaCalculado)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="salarioBase">{t("Salário base (EUR) *")}</Label>
                        <CampoNumerico
                          id="salarioBase"
                          min={0}
                          sufixo="EUR"
                          value={formData.salarioBase}
                          onChange={(salarioBase) => setFormData({ ...formData, salarioBase })}
                          className="rounded-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="subsidioDiario">{t("Subsídio de alimentação por dia (EUR)")}</Label>
                        <div className="flex gap-2">
                          <CampoNumerico
                            id="subsidioDiario"
                            min={0}
                            sufixo="EUR"
                            value={formData.subsidioDiario}
                            onChange={(subsidioDiario) => setFormData({ ...formData, subsidioDiario })}
                            className="rounded-full"
                          />
                          <CampoNumerico
                            min={0}
                            max={31}
                            value={formData.diasSubsidio}
                            onChange={(diasSubsidio) => setFormData({ ...formData, diasSubsidio })}
                            decimais={0}
                            title={t("Dias considerados")}
                            className="w-24 shrink-0 rounded-full"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {toFixed2(formData.subsidioDiario)} EUR x {textoDias(formData.diasSubsidio)} ={" "}
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
                                {t("usar {n} dias (base)", { n: diasUteisMes })}
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="valorTransporte">{t("Valores isentos de IRS (EUR)")}</Label>
                        <CampoNumerico
                          id="valorTransporte"
                          min={0}
                          sufixo="EUR"
                          value={formData.valorTransporte}
                          onChange={(valorTransporte) => setFormData({ ...formData, valorTransporte })}
                          className="rounded-full"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="encargos" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      {comDestaques(
                        t(
                          "Custo real da empresa. O IRS {naoEntra}: é retido ao trabalhador e não é custo da entidade patronal (aparece no separador Encargo líquido).",
                        ),
                        { naoEntra: <strong>{t("não entra aqui")}</strong> },
                      )}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <CampoTaxa
                        id="percentualSeguranca"
                        label={t("Segurança Social patronal")}
                        base={baseEncargos}
                        modo={formData.modoSeguranca}
                        percentual={formData.percentualSeguranca}
                        valorManual={formData.valorSegurancaManual}
                        resolvido={seguranca}
                        ajuda={t("taxa legal 2026: {taxa}%", { taxa: toFixed2(TSU_PATRONAL) })}
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
                        label={t("Seguro de acidentes de trabalho")}
                        base={baseEncargos}
                        modo={formData.modoSeguroAcidentes}
                        percentual={formData.percentualSeguroAcidentes}
                        valorManual={formData.valorSeguroAcidentesManual}
                        resolvido={seguroAcidentes}
                        ajuda={t("obrigatório; na construção ronda 1% a 5%")}
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
                        {t("Diluir subsídios de férias e de Natal no custo mensal")}
                        <span className="block text-xs text-muted-foreground">
                          {t(
                            "Em Portugal pagam-se 14 meses de salário por ano. Diluir os 2 meses extra ({valor}/mês) evita subavaliar o custo/hora.",
                            { valor: formatCurrency(valorSubsidiosMensal) },
                          )}
                        </span>
                      </span>
                    </label>

                    {formData.incluiSubsidios && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="mesesSubsidioAlimentacao">{t("Meses de subsídio de alimentação por ano")}</Label>
                          <CampoNumerico
                            id="mesesSubsidioAlimentacao"
                            decimais={0}
                            min={0}
                            max={12}
                            value={formData.mesesSubsidioAlimentacao}
                            onChange={(mesesSubsidioAlimentacao) =>
                              setFormData({ ...formData, mesesSubsidioAlimentacao })
                            }
                            className="rounded-full"
                          />
                          <p className="text-xs text-muted-foreground">
                            {t(
                              "Paga-se por dia trabalhado, por isso no mês de férias não há refeição: por norma {meses} meses. Média mensal: {valor}",
                              { meses: MESES_SUBSIDIO_ALIMENTACAO, valor: formatCurrency(beneficiosMensalMedio) },
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {beneficiosAcimaDoLimite > 0 && (
                      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
                        {t(
                          "O subsídio de alimentação está {excesso} acima do limite isento ({limite}/dia em cartão x {dias} = {total}). O excedente paga IRS e Segurança Social dos dois lados.",
                          {
                            excesso: formatCurrency(beneficiosAcimaDoLimite),
                            limite: formatCurrency(SUBSIDIO_ALIMENTACAO_ISENTO_CARTAO),
                            dias: textoDias(diasUteisMes),
                            total: formatCurrency(limiteSubsidioMes),
                          },
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">{t("Memória de cálculo")}</div>
                      <div className="flex justify-between text-sm">
                        <span>{t("Salário base")}</span>
                        <span className="font-medium">{formatCurrency(formData.salarioBase)}</span>
                      </div>
                      {formData.incluiSubsidios && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground pl-4">{t("Subsídios de férias + Natal (2/12)")}</span>
                          <span>+ {formatCurrency(valorSubsidiosMensal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span>{t("Base de incidência")}</span>
                        <span className="font-medium">{formatCurrency(baseEncargos)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground pl-4">
                          {t("Segurança Social patronal ({taxa}%)", { taxa: toFixed2(seguranca.percentual) })}
                        </span>
                        <span>+ {formatCurrency(valorSeguranca)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground pl-4">
                          {t("Seguro de acidentes ({taxa}%)", { taxa: toFixed2(seguroAcidentes.percentual) })}
                        </span>
                        <span>+ {formatCurrency(valorSeguroAcidentes)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground pl-4">
                          {formData.incluiSubsidios
                            ? t("Subsídio de alimentação ({meses} meses/ano diluídos)", {
                                meses: formData.mesesSubsidioAlimentacao,
                              })
                            : t("Subsídio de alimentação (isento até ao limite)")}
                        </span>
                        <span>+ {formatCurrency(beneficiosMensalMedio)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground pl-4">{t("Valores isentos de IRS")}</span>
                        <span>+ {formatCurrency(formData.valorTransporte)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">{t("Total de encargos da empresa")}</span>
                        <span className="font-semibold">{formatCurrency(totalEncargos)}</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-primary/10 p-4">
                      <div className="text-sm text-muted-foreground">{t("Custo total mensal da empresa")}</div>
                      <div className="text-2xl font-bold text-primary">{formatCurrency(salarioTotal)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {percentualSobreSalario > 0 && (
                          <>
                            {percentualSobreSalario >= 128 && percentualSobreSalario <= 148
                              ? t("{pct}% da remuneração bruta - dentro da referência de mercado em PT (130% a 145%)", {
                                  pct: toFixed2(percentualSobreSalario),
                                })
                              : t(
                                  "{pct}% da remuneração bruta - fora da referência habitual em PT (130% a 145%), convém rever os campos",
                                  { pct: toFixed2(percentualSobreSalario) },
                                )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("Custo/hora automático (real)")}</span>
                        <span className="font-semibold">{formatCurrency(custoHoraCalculado)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">{t("Valor de venda/hora")}</span>
                        <span className="font-semibold">{formatCurrency(valorDeVendaCalculado)}</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="encargosLiquidos" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "Simulação do recibo de vencimento: o que o trabalhador recebe e quanto lhe é descontado. Os descontos incidem apenas sobre o salário base. Cada taxa pode ser lançada em percentagem ou diretamente em euros.",
                      )}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <CampoTaxa
                        id="percentualSegurancaLiquido"
                        label={t("Segurança Social do trabalhador")}
                        base={formData.salarioBase}
                        modo={formData.modoSegurancaLiquido}
                        percentual={formData.percentualSegurancaLiquido}
                        valorManual={formData.valorSegurancaLiquidoManual}
                        resolvido={segurancaLiquido}
                        ajuda={t("taxa legal 2026: {taxa}%", { taxa: toFixed2(TSU_TRABALHADOR) })}
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
                          <Label>{t("IRS retido na fonte")}</Label>
                          <div className="flex rounded-full border p-0.5">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, irsAutomatico: true })}
                              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                                formData.irsAutomatico ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {t("Automático")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, irsAutomatico: false })}
                              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                                !formData.irsAutomatico ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {t("Manual")}
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
                                    {t(tabela.nome)} - {t(tabela.descricao)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {getTabelaIRS(formData.tabelaIRS).aceitaDependentes && (
                              <div className="flex items-center gap-2">
                                <Label htmlFor="dependentes" className="text-xs text-muted-foreground">
                                  {t("Dependentes")}
                                </Label>
                                <CampoNumerico
                                  id="dependentes"
                                  decimais={0}
                                  tamanho="sm"
                                  min={0}
                                  value={formData.dependentes}
                                  onChange={(dependentes) => setFormData({ ...formData, dependentes })}
                                  className="w-24 shrink-0 rounded-full"
                                />
                                <span className="text-xs text-muted-foreground">
                                  {t("- {valor} cada", {
                                    valor: formatCurrency(getTabelaIRS(formData.tabelaIRS).parcelaDependente),
                                  })}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <CampoNumerico
                            min={0}
                            sufixo="EUR"
                            value={formData.valorIRSLiquidoManual}
                            onChange={(valorIRSLiquidoManual) =>
                              setFormData({ ...formData, modoIRSLiquido: "valor", valorIRSLiquidoManual })
                            }
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
                                ? t("isento (até 920 EUR/mês)")
                                : t("escalão até {ate} EUR, taxa marginal {taxa}%", {
                                    ate: irsCalculado.escalaoAte ?? "-",
                                    taxa: toFixed2(irsCalculado.taxaMarginal),
                                  })}
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(
                            "Tabelas oficiais de 2026 (Despacho 233-A/2026). Fórmula: remuneração x taxa - parcela a abater - parcela por dependente.",
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Recibo de vencimento */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="bg-muted px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
                        {t("Recibo de vencimento (simulação)")}
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase">{t("Vencimentos")}</div>
                        <div className="flex justify-between text-sm">
                          <span>{t("Vencimento base")}</span>
                          <span className="font-medium">{formatCurrency(formData.salarioBase)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("Subsídio de alimentação (isento)")}</span>
                          <span>+ {formatCurrency(valorBeneficiosCalculado)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("Valores isentos de IRS")}</span>
                          <span>+ {formatCurrency(formData.valorTransporte)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2 font-medium">
                          <span>{t("Total ilíquido")}</span>
                          <span>{formatCurrency(totalIliquido)}</span>
                        </div>
                      </div>

                      <div className="border-t p-4 space-y-2 bg-destructive/5">
                        <div className="text-xs font-medium text-muted-foreground uppercase">
                          {t("Descontos do trabalhador")}
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("Segurança Social ({taxa}% do salário base)", { taxa: toFixed2(segurancaLiquido.percentual) })}
                          </span>
                          <span className="text-destructive">- {formatCurrency(valorSegurancaLiquido)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("IRS ({taxa}% do salário base)", { taxa: toFixed2(irsLiquido.percentual) })}
                          </span>
                          <span className="text-destructive">- {formatCurrency(valorIRSLiquido)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2 font-medium">
                          <span>{t("Total descontado")}</span>
                          <span className="text-destructive">- {formatCurrency(totalEncargosLiquido)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t("Peso dos descontos sobre o salário base")}</span>
                          <span>{toFixed2(taxaEfetivaDesconto)}%</span>
                        </div>
                      </div>

                      <div className="border-t bg-secondary p-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-sm text-muted-foreground">{t("Líquido a receber")}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t("{salario} - {descontos} + {isentos} isentos", {
                                salario: formatCurrency(formData.salarioBase),
                                descontos: formatCurrency(totalEncargosLiquido),
                                isentos: formatCurrency(valoresIsentos),
                              })}
                            </div>
                          </div>
                          <div className="text-2xl font-bold">{formatCurrency(salarioTotalLiquido)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-4 space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase">{t("Salário base")}</div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("Bruto")}</span>
                          <span>{formatCurrency(formData.salarioBase)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("Líquido (após descontos)")}</span>
                          <span className="font-semibold">{formatCurrency(salarioBaseLiquido)}</span>
                        </div>
                      </div>

                      <div className="rounded-lg border p-4 space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase">{t("Por hora")}</div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("Líquido/hora")}</span>
                          <span>{formatCurrency(custoHoraLiquido)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("Custo/hora para a empresa")}</span>
                          <span className="font-semibold">{formatCurrency(custoHoraCalculado)}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <div className="flex justify-end space-x-2 pt-6 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      {t("Cancelar")}
                    </Button>
                    <Button type="submit" disabled={loading} className="rounded-full">
                      {loading ? t("A guardar...") : editingFuncionario ? t("Atualizar") : t("Registar")}
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
        placeholder={t("Pesquisar por nome, email, função, departamento...")}
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
                    <Badge variant={funcionario.ativo ? "default" : "secondary"}>{funcionario.ativo ? t("Ativo") : t("Inativo")}</Badge>
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
                      <span>
                        {funcionario.idade === 1
                          ? t("{n} ano", { n: funcionario.idade })
                          : t("{n} anos", { n: funcionario.idade })}
                      </span>
                    </div>
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {t("Horário:")}
                        </span>
                        <span className="font-medium">
                          {t("{horas}h/dia, {dias}d/sem", { horas: funcionario.horasPorDia, dias: funcionario.diasPorSemana })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t("Horas semanais:")}</span>
                        <span className="font-medium">{toFixed2(horasSemana)}h</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t("Horas mensais:")}</span>
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
                          {t("Venda/hora:")}
                        </span>
                        <span className="font-medium">{formatCurrency(funcionario.custoHora)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {t("Custo real/hora:")}
                        </span>
                        <span className="font-medium">{formatCurrency(custoRealHora)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{t("Salário total:")}</span>
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
            <h3 className="text-lg font-medium mb-2">{t("Nenhum funcionário encontrado")}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {t('Nenhum resultado para "{termo}". Ajuste a pesquisa para ver a lista completa.', { termo: searchTerm })}
            </p>
            <Button onClick={clearSearch} variant="outline" className="rounded-full">
              {t("Limpar pesquisa")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("Nenhum funcionário registado")}</h3>
            <p className="text-muted-foreground text-center mb-4">{t("Comece por adicionar funcionários à sua equipa.")}</p>
            <Button onClick={() => setIsDialogOpen(true)} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              {t("Adicionar o primeiro funcionário")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
