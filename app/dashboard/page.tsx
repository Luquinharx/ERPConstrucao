"use client"

import { useState, useEffect } from "react"
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
import Link from "next/link"

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrcamentos: 0,
    orcamentosAprovados: 0,
    receitaTotal: 0,
    clientesAtivos: 0,
    taxaConversao: 0,
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
        title: "Erro ao carregar estatísticas",
        description: "Não foi possível carregar as estatísticas do dashboard.",
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
        <p className="ml-4 text-muted-foreground">Carregando dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Visão geral do seu negócio de pintura</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadDashboardStats} className="rounded-full bg-transparent">
            <BarChart3 className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Link href="/orcamentos">
            <Button className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="animate-slide-in" style={{ animationDelay: "0ms" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Orçamentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrcamentos}</div>
            <p className="text-xs text-muted-foreground">Orçamentos criados</p>
          </CardContent>
        </Card>

        <Card className="animate-slide-in" style={{ animationDelay: "100ms" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamentos Aprovados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.orcamentosAprovados}</div>
            <p className="text-xs text-muted-foreground">Projetos confirmados</p>
          </CardContent>
        </Card>

        <Card className="animate-slide-in" style={{ animationDelay: "200ms" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.receitaTotal)}</div>
            <p className="text-xs text-muted-foreground">Valor dos projetos aprovados</p>
          </CardContent>
        </Card>

        <Card className="animate-slide-in" style={{ animationDelay: "300ms" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientesAtivos}</div>
            <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Taxa de Conversão */}
      <Card className="animate-slide-in" style={{ animationDelay: "400ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taxa de Conversão
          </CardTitle>
          <CardDescription>Percentual de orçamentos que foram aprovados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Progress value={stats.taxaConversao} className="h-2" />
            </div>
            <div className="text-2xl font-bold">{stats.taxaConversao}%</div>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>{stats.orcamentosAprovados} aprovados</span>
            <span>{stats.totalOrcamentos} total</span>
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
                Gerir Clientes
              </CardTitle>
              <CardDescription>Adicionar e gerir informações dos clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{stats.clientesAtivos} clientes</Badge>
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
                Equipe
              </CardTitle>
              <CardDescription>Gerir funcionários e custos de mão de obra</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Funcionários</Badge>
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
                Materiais
              </CardTitle>
              <CardDescription>Controlar estoque e preços de materiais</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Inventário</Badge>
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
                Serviços
              </CardTitle>
              <CardDescription>Definir serviços e preços de pintura</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Catálogo</Badge>
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
                Orçamentos
              </CardTitle>
              <CardDescription>Criar e gerir orçamentos para clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{stats.totalOrcamentos} orçamentos</Badge>
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
                Relatórios
              </CardTitle>
              <CardDescription>Análises e relatórios do negócio</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Analytics</Badge>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Resumo do Mês */}
      <Card className="animate-slide-in" style={{ animationDelay: "1100ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Resumo do Mês
          </CardTitle>
          <CardDescription>Atividade recente do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalOrcamentos}</div>
              <p className="text-sm text-muted-foreground">Orçamentos Criados</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.orcamentosAprovados}</div>
              <p className="text-sm text-muted-foreground">Projetos Aprovados</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{formatCurrency(stats.receitaTotal)}</div>
              <p className="text-sm text-muted-foreground">Receita Gerada</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status do Sistema */}
      <Card className="animate-slide-in" style={{ animationDelay: "1200ms" }}>
        <CardHeader>
          <CardTitle>Status do Sistema</CardTitle>
          <CardDescription>Informações sobre o funcionamento do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Sistema Online</span>
            </div>
            <Badge variant="outline">Versão 1.0</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
