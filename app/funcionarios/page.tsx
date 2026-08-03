"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import type { Funcionario } from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { formatCurrency, matchesSearch, round2, toFixed2 } from "@/lib/utils"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"

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
  percentualSegurancaLiquido: number
  percentualIRSLiquido: number
  ativo: boolean
}

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
    percentualSeguranca: 0,
    percentualIRS: 0,
    percentualSegurancaLiquido: 0,
    percentualIRSLiquido: 0,
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

function calculateHorasPorMes(mesReferencia: string, horasPorDia: number, diasPorSemana: number): number {
  const diasUteis = calculateDiasUteisMes(mesReferencia, diasPorSemana)
  return round2(diasUteis * (Number(horasPorDia) || 0))
}

function calculatePercentValue(base: number, percentual: number): number {
  return round2((Number(base) || 0) * ((Number(percentual) || 0) / 100))
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

  const diasUteisMes = calculateDiasUteisMes(formData.mesReferencia, formData.diasPorSemana)
  const horasPorSemana = calculateHorasPorSemana(formData.horasPorDia, formData.diasPorSemana)
  const horasPorMes = calculateHorasPorMes(formData.mesReferencia, formData.horasPorDia, formData.diasPorSemana)

  // Encargos (custo da empresa): somam ao salario
  const valorSeguranca = calculatePercentValue(formData.salarioBase, formData.percentualSeguranca)
  const valorIRS = calculatePercentValue(formData.salarioBase, formData.percentualIRS)
  const totalEncargos = round2(valorSeguranca + valorIRS)
  const salarioTotal = round2(
    formData.salarioBase + formData.valorBeneficios + formData.valorTransporte + totalEncargos,
  )
  const custoHoraCalculado = horasPorMes > 0 ? round2(salarioTotal / horasPorMes) : 0
  const valorDeVendaCalculado = round2(custoHoraCalculado * (1 + Number(formData.margemLucro || 0) / 100))

  // Encargos liquidos (percentuais independentes): descontam do salario
  const valorSegurancaLiquido = calculatePercentValue(formData.salarioBase, formData.percentualSegurancaLiquido)
  const valorIRSLiquido = calculatePercentValue(formData.salarioBase, formData.percentualIRSLiquido)
  const totalEncargosLiquido = round2(valorSegurancaLiquido + valorIRSLiquido)
  const salarioTotalLiquido = round2(
    formData.salarioBase + formData.valorBeneficios + formData.valorTransporte - totalEncargosLiquido,
  )
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
        valorBeneficios: round2(formData.valorBeneficios),
        valorTransporte: round2(formData.valorTransporte),
        percentualSeguranca: round2(formData.percentualSeguranca),
        valorSeguranca,
        percentualIRS: round2(formData.percentualIRS),
        valorIRS,
        totalEncargos,
        salarioTotal,
        percentualSegurancaLiquido: round2(formData.percentualSegurancaLiquido),
        valorSegurancaLiquido,
        percentualIRSLiquido: round2(formData.percentualIRSLiquido),
        valorIRSLiquido,
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
      percentualSeguranca: funcionario.percentualSeguranca || 0,
      percentualIRS: funcionario.percentualIRS || 0,
      percentualSegurancaLiquido: funcionario.percentualSegurancaLiquido ?? funcionario.percentualSeguranca ?? 0,
      percentualIRSLiquido: funcionario.percentualIRSLiquido ?? funcionario.percentualIRS ?? 0,
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
                    <p className="text-xs text-muted-foreground">
                      Horas/mes = dias uteis reais do mes de referencia x horas por dia ({diasUteisMes} x{" "}
                      {toFixed2(formData.horasPorDia)} = {toFixed2(horasPorMes)}h). Os dias uteis seguem o calendario
                      real, contando a partir de segunda-feira conforme os dias por semana definidos.
                    </p>

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
                        <Label htmlFor="valorBeneficios">Valor Beneficios (EUR)</Label>
                        <Input
                          id="valorBeneficios"
                          type="number"
                          step="0.01"
                          value={formData.valorBeneficios}
                          onChange={(e) => setFormData({ ...formData, valorBeneficios: Number(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="rounded-full"
                        />
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="percentualSeguranca">Seguranca (%) sobre salario base</Label>
                        <Input
                          id="percentualSeguranca"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.percentualSeguranca}
                          onChange={(e) => setFormData({ ...formData, percentualSeguranca: Number(e.target.value) || 0 })}
                          className="rounded-full"
                        />
                        <p className="text-sm text-muted-foreground">Valor calculado: {formatCurrency(valorSeguranca)}</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="percentualIRS">IRS (%) sobre salario base</Label>
                        <Input
                          id="percentualIRS"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.percentualIRS}
                          onChange={(e) => setFormData({ ...formData, percentualIRS: Number(e.target.value) || 0 })}
                          className="rounded-full"
                        />
                        <p className="text-sm text-muted-foreground">Valor calculado: {formatCurrency(valorIRS)}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total de encargos</span>
                        <span className="font-semibold">{formatCurrency(totalEncargos)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Custo/hora automatico (real)</span>
                        <span className="font-semibold">{formatCurrency(custoHoraCalculado)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">Valor de venda/hora</span>
                        <span className="font-semibold">{formatCurrency(valorDeVendaCalculado)}</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-primary/10 p-4">
                      <div className="text-sm text-muted-foreground">Salario total com encargos</div>
                      <div className="text-2xl font-bold text-primary">{formatCurrency(salarioTotal)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Base + Beneficios + Transporte + Seguranca + IRS
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="encargosLiquidos" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Mesma estrutura da aba Encargos, com percentuais proprios. Aqui os encargos sao{" "}
                      <strong>descontados</strong> do salario, mostrando o valor liquido e o custo/hora liquido.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="percentualSegurancaLiquido">Seguranca (%) sobre salario base</Label>
                        <Input
                          id="percentualSegurancaLiquido"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.percentualSegurancaLiquido}
                          onChange={(e) =>
                            setFormData({ ...formData, percentualSegurancaLiquido: Number(e.target.value) || 0 })
                          }
                          className="rounded-full"
                        />
                        <p className="text-sm text-muted-foreground">
                          Valor calculado: {formatCurrency(valorSegurancaLiquido)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="percentualIRSLiquido">IRS (%) sobre salario base</Label>
                        <Input
                          id="percentualIRSLiquido"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.percentualIRSLiquido}
                          onChange={(e) =>
                            setFormData({ ...formData, percentualIRSLiquido: Number(e.target.value) || 0 })
                          }
                          className="rounded-full"
                        />
                        <p className="text-sm text-muted-foreground">
                          Valor calculado: {formatCurrency(valorIRSLiquido)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total de encargos descontados</span>
                        <span className="font-semibold">- {formatCurrency(totalEncargosLiquido)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Custo/hora liquido</span>
                        <span className="font-semibold">{formatCurrency(custoHoraLiquido)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">Valor de venda/hora (liquido + margem)</span>
                        <span className="font-semibold">{formatCurrency(valorVendaHoraLiquido)}</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-secondary p-4">
                      <div className="text-sm text-muted-foreground">Salario liquido</div>
                      <div className="text-2xl font-bold">{formatCurrency(salarioTotalLiquido)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Base + Beneficios + Transporte - Seguranca - IRS
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
