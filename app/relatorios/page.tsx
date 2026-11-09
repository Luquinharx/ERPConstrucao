"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, TrendingUp, Download, FileText, Users, Package } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { FirebaseService } from "@/lib/firebase-service"
import { estaAdjudicada, foiEntregue, normalizarFase } from "@/lib/orcamento-fases"
import { listar } from "@/lib/firebase-service"
import type { Conta } from "@/lib/types"
import { formatCurrency, round2 } from "@/lib/utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "@/hooks/use-toast"
import { localeIntl, t } from "@/lib/i18n"

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
    recebido: 0,
    pago: 0,
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
      const [orcamentos, clientes, funcionarios, materiais, servicos, contas] = await Promise.all([
        FirebaseService.getOrcamentos(user.uid),
        FirebaseService.getClientes(user.uid),
        FirebaseService.getFuncionarios(user.uid),
        FirebaseService.getMateriais(user.uid),
        FirebaseService.getServicos(user.uid),
        listar<Conta>("contas").catch(() => [] as Conta[]),
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
      // Aprovado = adjudicado pelo cliente
      const orcamentosAprovados = orcamentosPeriodo.filter(estaAdjudicada)
      const orcamentosPendentes = orcamentosPeriodo.filter((o) =>
        ["rascunho", "em_revisao", "em_negociacao"].includes(normalizarFase(o.status)),
      )
      const receitaTotal = orcamentosAprovados.reduce((sum, o) => sum + (o.valorTotal || 0), 0)
      const entregues = orcamentosPeriodo.filter(foiEntregue).length
      const taxaConversao = entregues > 0 ? (orcamentosAprovados.length / entregues) * 100 : 0
      // Dinheiro que entrou e saiu no periodo, pela data do pagamento
      const inicioISO = `${dataInicio.getFullYear()}-${String(dataInicio.getMonth() + 1).padStart(2, "0")}-${String(dataInicio.getDate()).padStart(2, "0")}`
      const pagasNoPeriodo = contas.filter((c) => c.estado === "pago" && (c.dataPagamento || c.vencimento) >= inicioISO)
      const somaContas = (tipo: Conta["tipo"]) =>
        round2(pagasNoPeriodo.filter((c) => c.tipo === tipo).reduce((s, c) => s + (Number(c.valor) || 0), 0))
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
            titulo: t("Orçamento n.º {numero} adjudicado", { numero: o.numero }),
            descricao: t("Cliente: {nome}", { nome: o.cliente.nome }),
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
            titulo: t("Novo cliente registado"),
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
        recebido: somaContas("receber"),
        pago: somaContas("pagar"),
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
        title: t("Erro ao carregar relatórios"),
        description: t("Não foi possível carregar os dados dos relatórios."),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getPeriodoLabel = () => {
    switch (periodo) {
      case "semana":
        return t("Esta semana")
      case "mes":
        return t("Este mês")
      case "trimestre":
        return t("Este trimestre")
      case "ano":
        return t("Este ano")
      default:
        return t("Este mês")
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
          <h1 className="text-3xl font-bold">{t("Relatórios")}</h1>
          <p className="text-muted-foreground mt-2">{t("Análises e estatísticas do negócio - {periodo}", { periodo: getPeriodoLabel() })}</p>
        </div>
        <div className="flex space-x-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px] rounded-full">
              <SelectValue placeholder={t("Período")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">{t("Esta semana")}</SelectItem>
              <SelectItem value="mes">{t("Este mês")}</SelectItem>
              <SelectItem value="trimestre">{t("Este trimestre")}</SelectItem>
              <SelectItem value="ano">{t("Este ano")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-full bg-transparent">
            <Download className="h-4 w-4 mr-2" />
            {t("Exportar")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Recebido")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{formatCurrency(stats.recebido)}</div>
            <p className="text-xs text-muted-foreground">
              {t("Pago {pago} · saldo {saldo}", {
                pago: formatCurrency(stats.pago),
                saldo: formatCurrency(round2(stats.recebido - stats.pago)),
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Receita Total")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.receitaTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.orcamentosAprovados === 1
                ? t("{n} orçamento adjudicado", { n: stats.orcamentosAprovados })
                : t("{n} orçamentos adjudicados", { n: stats.orcamentosAprovados })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Orçamentos")}</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrcamentos}</div>
            <p className="text-xs text-muted-foreground">
              {t("{aprovados} aprovados, {pendentes} pendentes", {
                aprovados: stats.orcamentosAprovados,
                pendentes: stats.orcamentosPendentes,
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Novos Clientes")}</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.novosClientes}</div>
            <p className="text-xs text-muted-foreground">{t("{n} clientes ativos no total", { n: stats.clientesAtivos })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Taxa de Conversão")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taxaConversao}%</div>
            <p className="text-xs text-muted-foreground">{t("Receita média: {valor}", { valor: formatCurrency(stats.receitaMedia) })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("Resumo do Sistema")}</CardTitle>
            <CardDescription>{t("Dados gerais registados no sistema")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("Funcionários Ativos")}</span>
                <span className="font-medium">{stats.funcionariosAtivos}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("Materiais Registados")}</span>
                <span className="font-medium">{stats.materiaisCadastrados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("Serviços Registados")}</span>
                <span className="font-medium">{stats.servicosCadastrados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("Total de Clientes")}</span>
                <span className="font-medium">{stats.clientesAtivos}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Tipos de Serviço Populares")}</CardTitle>
            <CardDescription>{t("Serviços mais pedidos no período")}</CardDescription>
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
                  {t("Nenhum serviço encontrado no período selecionado")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Atividade Recente")}</CardTitle>
          <CardDescription>{t("Últimas transações e atividades do período")}</CardDescription>
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
                        className={`w-8 h-8 shrink-0 bg-${atividade.color}-100 dark:bg-${atividade.color}-900 rounded-full flex items-center justify-center`}
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
                      {atividade.valor && <p className="font-medium">{formatCurrency(atividade.valor)}</p>}
                      <p className="text-sm text-muted-foreground">
                        {new Date(atividade.data).toLocaleDateString(localeIntl())}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t("Nenhuma atividade encontrada no período selecionado")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
