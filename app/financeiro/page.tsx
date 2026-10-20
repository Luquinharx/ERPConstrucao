"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"

import { TabelaContas } from "@/components/obra/tabela-contas"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePermissoes } from "@/hooks/use-permissoes"
import { listar } from "@/lib/firebase-service"
import { contasEmAlerta, diasAte, resumoContas } from "@/lib/obra"
import type { Conta } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"

/**
 * Financeiro: contas a receber (adjudicacoes, autos) e a pagar (faturas de
 * fornecedor aprovadas), com alertas de vencimento.
 */
export default function FinanceiroPage() {
  const { pode } = usePermissoes()
  const [contas, setContas] = useState<Conta[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [filtro, setFiltro] = useState<"todas" | "receber" | "pagar" | "pendentes">("pendentes")

  const carregar = useCallback(async () => {
    try {
      setContas(await listar<Conta>("contas"))
    } finally {
      setACarregar(false)
    }
  }, [])
  useEffect(() => {
    void carregar()
  }, [carregar])

  const r = resumoContas(contas)
  const alertas = contasEmAlerta(contas)
  const visiveis = useMemo(
    () =>
      contas.filter((c) =>
        filtro === "todas" ? true : filtro === "pendentes" ? c.estado === "pendente" : c.tipo === filtro,
      ),
    [contas, filtro],
  )

  if (aCarregar) return <LoadingSpinner size="lg" />

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Financeiro</h1>
        <p className="mt-2 text-muted-foreground">Contas a receber e a pagar de todas as obras, com os vencimentos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="resumo-financeiro">
        {(
          [
            ["A receber", r.aReceber, ""],
            ["A pagar", r.aPagar, "text-rose-700"],
            ["Vencido", r.vencido, r.vencido > 0 ? "text-rose-700" : ""],
            ["Saldo em aberto", r.saldo, r.saldo < 0 ? "text-rose-700" : ""],
          ] as const
        ).map(([nome, valor, cor]) => (
          <Card key={nome}>
            <CardHeader className="pb-1"><CardDescription>{nome}</CardDescription></CardHeader>
            <CardContent className={`text-2xl font-bold tabular-nums ${cor}`}>{formatCurrency(valor)}</CardContent>
          </Card>
        ))}
      </div>

      {alertas.length > 0 && (
        <Card className="border-amber-500/50" data-testid="alertas-vencimento">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Vencem nos proximos 5 dias ou ja venceram
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {alertas.map((c) => {
              const d = diasAte(c.vencimento)
              return (
                <div key={c.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {c.tipo === "receber" ? "Receber" : "Pagar"} · {c.descricao}
                    {c.orcamentoNumero ? ` · ${c.orcamentoNumero}` : ""} · {formatDate(c.vencimento)} (
                    {d < 0 ? `vencida ha ${-d} d` : d === 0 ? "hoje" : `em ${d} d`})
                  </span>
                  <span className="tabular-nums font-medium">{formatCurrency(c.valor)}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-lg">Contas</CardTitle>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <SelectTrigger className="w-48 rounded-full" aria-label="Filtro"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="receber">A receber</SelectItem>
              <SelectItem value="pagar">A pagar</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <TabelaContas
            contas={visiveis}
            podeGerir={pode("orcamentos.custosObra") || pode("orcamentos.aprovar")}
            onAlterado={carregar}
            mostrarObra
          />
        </CardContent>
      </Card>
    </div>
  )
}
