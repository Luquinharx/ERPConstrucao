"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { FirebaseService, listar } from "@/lib/firebase-service"
import { contasEmAlerta } from "@/lib/obra"
import { estoqueBaixo } from "@/lib/produto-calculos"
import type { Conta, FaturaFornecedor, RegistoHoras } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

interface Alerta {
  texto: string
  href: string
}

/**
 * O que pede atencao hoje: contas a vencer, aprovacoes pendentes e estoque
 * abaixo do minimo. Cada linha leva ao sitio onde se resolve.
 */
export function AlertasDashboard() {
  const { user } = useAuth()
  const { pode } = usePermissoes()
  const [alertas, setAlertas] = useState<Alerta[] | null>(null)

  useEffect(() => {
    if (!user) return
    const lista: Alerta[] = []
    const tarefas: Promise<void>[] = []
    if (pode("orcamentos.verCusto")) {
      tarefas.push(
        listar<Conta>("contas").then((contas) => {
          for (const c of contasEmAlerta(contas)) {
            lista.push({
              texto: `${c.tipo === "receber" ? "Receber" : "Pagar"} ${formatCurrency(c.valor)} · ${c.descricao}${c.orcamentoNumero ? ` (${c.orcamentoNumero})` : ""} · vence ${c.vencimento.split("-").reverse().join("/")}`,
              href: c.orcamentoId ? `/orcamentos/${c.orcamentoId}/pagamentos` : "/financeiro",
            })
          }
        }),
      )
    }
    if (pode("orcamentos.aprovar")) {
      tarefas.push(
        listar<RegistoHoras>("registosHoras").then((r) => {
          const n = r.filter((x) => x.estado === "pendente").length
          if (n) lista.push({ texto: `${n} registo(s) de horas por aprovar`, href: "/horas" })
        }),
        listar<FaturaFornecedor>("faturasFornecedor").then((f) => {
          const n = f.filter((x) => x.estado === "pendente").length
          if (n) lista.push({ texto: `${n} fatura(s) de fornecedor por aprovar`, href: "/faturas" })
        }),
      )
    }
    if (pode("materiais.ver")) {
      tarefas.push(
        FirebaseService.getMateriais(user.uid).then((m) => {
          const n = m.filter(estoqueBaixo).length
          if (n) lista.push({ texto: `${n} produto(s) abaixo do estoque minimo`, href: "/estoque" })
        }),
      )
    }
    Promise.allSettled(tarefas).then(() => setAlertas([...lista]))
  }, [user, pode])

  if (!alertas || alertas.length === 0) return null
  return (
    <Card className="border-amber-500/50" data-testid="alertas-dashboard">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Precisa de atencao
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {alertas.map((a, i) => (
          <Link key={i} href={a.href} className="block rounded px-2 py-1 hover:bg-muted">
            {a.texto}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
