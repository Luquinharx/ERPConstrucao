"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, TrendingUp, Download, FileText, Users, Package } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { FirebaseService } from "@/lib/firebase-service"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "@/hooks/use-toast"

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    receitaTotal: 0,
    totalOrcamentos: 0,
    orcamentosAprovados: 0,
    orcamentosPendentes: 0,
    novosClientes: 0,
    taxaConversao: 0,
    receitaMedia: 0,
    clientesAtivos: 0,
    funcionariosAtivos: 0,
    materiaisCadastrados: 0,
    servicosCadastrados: 0,
  })
  const [periodo, setPeriodo] = useState("mes")
  const [atividades, setAtividades] = useState([])
  const [servicosPopulares, setServicosPopulares] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadRelatorios()
    }
  }, [user, periodo])

  const loadRelatorios = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Carregar todos os dados
      const [orcamentos, clientes, funcionarios, materiais, servicos] = await Promise.all([
        FirebaseService.getOrcamentos(user.uid),
        FirebaseService.getClientes(user.uid),
        FirebaseService.getFuncionarios(user.uid),
        FirebaseService.getMateriais(user.uid),
        FirebaseService.getServicos(user.uid),
      ])

      // Filtrar por período
      const agora = new Date()
      const dataInicio = new Date()

      switch (periodo) {
        case "semana":
          dataInicio.setDate(agora.getDate() - 7)
          break
        case "mes":
          dataInicio.setMonth(agora.getMonth() - 1)
          break
        case "trimestre":
          dataInicio.setMonth(agora.getMonth() - 3)
          break
        case "ano":
          dataInicio.setFullYear(agora.getFullYear() - 1)
          break
      }

      // Filtrar orçamentos por período
      const orcamentosPeriodo = orcamentos.filter((o) => new Date(o.dataOrcamento) >= dataInicio)

      // Filtrar clientes por período
      const clientesPeriodo = clientes.filter((c) => new Date(c.createdAt) >= dataInicio)

      // Calcular estatísticas
      const orcamentosAprovados = orcamentosPeriodo.filter((o) => o.status === "aprovado")
      const orcamentosPendentes = orcamentosPeriodo.filter((o) => o.status === "rascunho" || o.status === "enviado")
      const receitaTotal = orcamentosAprovados.reduce((sum, o) => sum + (o.valorTotal || 0), 0)
      const taxaConversao =
        orcamentosPeriodo.length > 0 ? (orcamentosAprovados.length / orcamentosPeriodo.length) * 100 : 0
      const receitaMedia = orcamentosAprovados.length > 0 ? receitaTotal / orcamentosAprovados.length : 0

      // Contar tipos de serviço mais populares
      const tiposServico = {}
      orcamentosPeriodo.forEach((o) => {
        if (o.tipoTrabalho) {
          tiposServico[o.tipoTrabalho] = (tiposServico[o.tipoTrabalho] || 0) + 1
        }
      })

      const servicosPopularesArray = Object.entries(tiposServico)
        .map(([tipo, count]) => ({
          tipo,
          count: count as number,
          percentual: ((count as number) / orcamentosPeriodo.length) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)

      // Gerar atividades recentes
      const atividadesRecentes = []

      // Adicionar orçamentos aprovados recentes
      orcamentosAprovados
        .sort((a, b) => new Date(b.dataOrcamento).getTime() - new Date(a.dataOrcamento).getTime())
        .slice(0, 3)
        .forEach((o) => {
          atividadesRecentes.push({
            tipo: "orcamento_aprovado",
            titulo: `Orçamento #${o.numero} aprovado`,
            descricao: `Cliente: ${o.cliente.nome}`,
            valor: o.valorTotal,
            data: o.dataOrcamento,
            icon: "FileText",
            color: "green",
          })
        })

      // Adicionar novos clientes
      clientesPeriodo
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2)
        .forEach((c) => {
          atividadesRecentes.push({
            tipo: "novo_cliente",
            titulo: "Novo cliente cadastrado",
            descricao: c.nome,
            data: c.createdAt,
            icon: "Users",
            color: "blue",
          })
        })

      // Ordenar atividades por data
      atividadesRecentes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

      setStats({
        receitaTotal,
        totalOrcamentos: orcamentosPeriodo.length,
        orcamentosAprovados: orcamentosAprovados.length,
        orcamentosPendentes: orcamentosPendentes.length,
        novosClientes: clientesPeriodo.length,
        taxaConversao: Math.round(taxaConversao),
        receitaMedia,
        clientesAtivos: clientes.length,
        funcionariosAtivos: funcionarios.filter((f) => f.ativo).length,
        materiaisCadastrados: materiais.length,
        servicosCadastrados: servicos.length,
      })

      setAtividades(atividadesRecentes.slice(0, 5))
      setServicosPopulares(servicosPopularesArray)

      console.log("Relatórios carregados:", {
        stats,
        atividades: atividadesRecentes.length,
        servicos: servicosPopularesArray.length,
      })
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error)
      toast({
        title: "Erro ao carregar relatórios",
        description: "Não foi possível carregar os dados dos relatórios.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getPeriodoLabel = () => {
    switch (periodo) {
      case "semana":
        return "Esta Semana"
      case "mes":
        return "Este Mês"
      case "trimestre":
        return "Este Trimestre"
      case "ano":
        return "Este Ano"
      default:
        return "Este Mês"
    }
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "FileText":
        return FileText
      case "Users":
        return Users
      case "Package":
        return Package
      default:
        return FileText
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-2">Análises e estatísticas do negócio - {getPeriodoLabel()}</p>
        </div>
        <div className="flex space-x-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="trimestre">Este Trimestre</SelectItem>
              <SelectItem value="ano">Este Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-full bg-transparent">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats.receitaTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{stats.orcamentosAprovados} orçamentos aprovados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamentos</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrcamentos}</div>
            <p className="text-xs text-muted-foreground">
              {stats.orcamentosAprovados} aprovados, {stats.orcamentosPendentes} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Clientes</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.novosClientes}</div>
            <p className="text-xs text-muted-foreground">{stats.clientesAtivos} clientes ativos no total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <BarChart3 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taxaConversao}%</div>
            <p className="text-xs text-muted-foreground">Receita média: €{stats.receitaMedia.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resumo do Sistema</CardTitle>
            <CardDescription>Dados gerais cadastrados no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Funcionários Ativos</span>
                <span className="font-medium">{stats.funcionariosAtivos}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Materiais Cadastrados</span>
                <span className="font-medium">{stats.materiaisCadastrados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Serviços Cadastrados</span>
                <span className="font-medium">{stats.servicosCadastrados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total de Clientes</span>
                <span className="font-medium">{stats.clientesAtivos}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tipos de Serviço Populares</CardTitle>
            <CardDescription>Serviços mais solicitados no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {servicosPopulares.length > 0 ? (
                servicosPopulares.map((servico, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{servico.tipo}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 h-2 bg-muted rounded-full">
                        <div className="h-2 bg-primary rounded-full" style={{ width: `${servico.percentual}%` }}></div>
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">{servico.count}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum serviço encontrado no período selecionado
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>Últimas transações e atividades do período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {atividades.length > 0 ? (
              atividades.map((atividade: any, index) => {
                const IconComponent = getIconComponent(atividade.icon)
                return (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 bg-${atividade.color}-100 dark:bg-${atividade.color}-900 rounded-full flex items-center justify-center`}
                      >
                        <IconComponent
                          className={`h-4 w-4 text-${atividade.color}-600 dark:text-${atividade.color}-400`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{atividade.titulo}</p>
                        <p className="text-sm text-muted-foreground">{atividade.descricao}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {atividade.valor && <p className="font-medium">€{atividade.valor.toFixed(2)}</p>}
                      <p className="text-sm text-muted-foreground">
                        {new Date(atividade.data).toLocaleDateString("pt-PT")}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma atividade encontrada no período selecionado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
