"use client"

import { useState, useEffect } from "react"
import { AlertasDashboard } from "@/components/obra/alertas-dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  FileText,
  CheckCircle,
  TrendingUp,
  Euro,
  Calendar,
  Plus,
  BarChart3,
  Settings,
  User,
  Briefcase,
  Package,
  Calculator,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "@/hooks/use-toast"
import { FirebaseService, type DashboardStats } from "@/lib/firebase-service"
import { formatCurrency } from "@/lib/utils"
import { t } from "@/lib/i18n"
import Link from "next/link"

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrcamentos: 0,
    orcamentosAprovados: 0,
    receitaTotal: 0,
    clientesAtivos: 0,
    taxaConversao: 0,
    recebido: 0,
  })
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadDashboardStats()
    }
  }, [user])

  const loadDashboardStats = async () => {
    if (!user) return

    try {
      setLoading(true)
      const dashboardStats = await FirebaseService.getDashboardStats(user.uid)
      setStats(dashboardStats)
    } catch (error) {
      console.error("❌ Erro ao carregar estatísticas:", error)
      toast({
        title: t("Erro ao carregar estatísticas"),
        description: t("Não foi possível carregar as estatísticas do painel."),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
        <p className="ml-4 text-muted-foreground">{t("A carregar o painel...")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t("Painel")}</h1>
          <p className="text-muted-foreground mt-2">{t("Visão geral do seu negócio")}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadDashboardStats} className="rounded-full bg-transparent">
            <BarChart3 className="h-4 w-4 mr-2" />
            {t("Atualizar")}
          </Button>
          <Link href="/orcamentos">
            <Button className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              {t("Novo orçamento")}
            </Button>
          </Link>
        </div>
      </div>

      <AlertasDashboard />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="animate-slide-in" style={{ animationDelay: "0ms" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Total de orçamentos")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrcamentos}</div>
            <p className="text-xs text-muted-foreground">{t("Orçamentos criados")}</p>
          </CardContent>
        </Card>

        <Card className="animate-slide-in" style={{ animationDelay: "100ms" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Orçamentos aprovados")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.orcamentosAprovados}</div>
            <p className="text-xs text-muted-foreground">{t("Adjudicados pelo cliente")}</p>
          </CardContent>
        </Card>

        <Card className="animate-slide-in" style={{ animationDelay: "200ms" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Receita total")}</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.receitaTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {(() => {
                const [antes, depois] = t("Valor adjudicado · recebido {valor}").split("{valor}")
                return (
                  <>
                    {antes}
                    <span className="font-medium text-foreground">{formatCurrency(stats.recebido)}</span>
                    {depois}
                  </>
                )
              })()}
            </p>
          </CardContent>
        </Card>

        <Card className="animate-slide-in" style={{ animationDelay: "300ms" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("Clientes ativos")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientesAtivos}</div>
            <p className="text-xs text-muted-foreground">{t("Clientes registados")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Taxa de Conversão */}
      <Card className="animate-slide-in" style={{ animationDelay: "400ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("Taxa de conversão")}
          </CardTitle>
          <CardDescription>{t("Propostas adjudicadas sobre as que já foram entregues ao cliente")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Progress value={stats.taxaConversao} className="h-2" />
            </div>
            <div className="text-2xl font-bold">{stats.taxaConversao}%</div>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>
              {stats.orcamentosAprovados === 1
                ? t("{n} aprovado", { n: stats.orcamentosAprovados })
                : t("{n} aprovados", { n: stats.orcamentosAprovados })}
            </span>
            <span>{t("{n} no total", { n: stats.totalOrcamentos })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer"
          style={{ animationDelay: "500ms" }}
        >
          <Link href="/clientes">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                {t("Gerir clientes")}
              </CardTitle>
              <CardDescription>{t("Adicionar e gerir informações dos clientes")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">
                {stats.clientesAtivos === 1
                  ? t("{n} cliente", { n: stats.clientesAtivos })
                  : t("{n} clientes", { n: stats.clientesAtivos })}
              </Badge>
            </CardContent>
          </Link>
        </Card>

        <Card
          className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer"
          style={{ animationDelay: "600ms" }}
        >
          <Link href="/funcionarios">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                {t("Equipa")}
              </CardTitle>
              <CardDescription>{t("Gerir funcionários e custos de mão de obra")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{t("Funcionários")}</Badge>
            </CardContent>
          </Link>
        </Card>

        <Card
          className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer"
          style={{ animationDelay: "700ms" }}
        >
          <Link href="/materiais">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                {t("Materiais")}
              </CardTitle>
              <CardDescription>{t("Controlar o stock e os preços dos materiais")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{t("Inventário")}</Badge>
            </CardContent>
          </Link>
        </Card>

        <Card
          className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer"
          style={{ animationDelay: "800ms" }}
        >
          <Link href="/servicos">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5" />
                {t("Serviços")}
              </CardTitle>
              <CardDescription>{t("Definir serviços e preços")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{t("Catálogo")}</Badge>
            </CardContent>
          </Link>
        </Card>

        <Card
          className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer"
          style={{ animationDelay: "900ms" }}
        >
          <Link href="/orcamentos">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5" />
                {t("Orçamentos")}
              </CardTitle>
              <CardDescription>{t("Criar e gerir orçamentos para clientes")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">
                {stats.totalOrcamentos === 1
                  ? t("{n} orçamento", { n: stats.totalOrcamentos })
                  : t("{n} orçamentos", { n: stats.totalOrcamentos })}
              </Badge>
            </CardContent>
          </Link>
        </Card>

        <Card
          className="animate-slide-in hover:shadow-md transition-shadow cursor-pointer"
          style={{ animationDelay: "1000ms" }}
        >
          <Link href="/relatorios">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5" />
                {t("Relatórios")}
              </CardTitle>
              <CardDescription>{t("Análises e relatórios do negócio")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{t("Análises")}</Badge>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Resumo do Mês */}
      <Card className="animate-slide-in" style={{ animationDelay: "1100ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("Resumo do mês")}
          </CardTitle>
          <CardDescription>{t("Atividade recente do sistema")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalOrcamentos}</div>
              <p className="text-sm text-muted-foreground">{t("Orçamentos criados")}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.orcamentosAprovados}</div>
              <p className="text-sm text-muted-foreground">{t("Projetos aprovados")}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{formatCurrency(stats.receitaTotal)}</div>
              <p className="text-sm text-muted-foreground">{t("Receita gerada")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status do Sistema */}
      <Card className="animate-slide-in" style={{ animationDelay: "1200ms" }}>
        <CardHeader>
          <CardTitle>{t("Estado do sistema")}</CardTitle>
          <CardDescription>{t("Informações sobre o funcionamento do sistema")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">{t("Sistema online")}</span>
            </div>
            <Badge variant="outline">{t("Versão {versao}", { versao: "1.0" })}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
