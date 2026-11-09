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
import { m, t } from "@/lib/i18n"

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
        <h1 className="text-3xl font-bold">{t("Financeiro")}</h1>
        <p className="mt-2 text-muted-foreground">{t("Contas a receber e a pagar de todas as obras, com os vencimentos.")}</p>
      </div>

      {(
        [
          [
            m("Realizado"),
            "resumo-realizado",
            [
              [m("Recebido"), r.recebido, "text-emerald-700"],
              [m("Pago"), r.pago, "text-rose-700"],
              [m("Saldo realizado"), r.saldoRealizado, r.saldoRealizado < 0 ? "text-rose-700" : ""],
            ],
          ],
          [
            m("Em aberto"),
            "resumo-financeiro",
            [
              [m("A receber"), r.aReceber, ""],
              [m("A pagar"), r.aPagar, "text-rose-700"],
              [m("Vencido"), r.vencido, r.vencido > 0 ? "text-rose-700" : ""],
              [m("Saldo em aberto"), r.saldo, r.saldo < 0 ? "text-rose-700" : ""],
            ],
          ],
        ] as const
      ).map(([grupo, testid, cartoes]) => (
        <div key={grupo} className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t(grupo)}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid={testid}>
            {cartoes.map(([nome, valor, cor]) => (
              <Card key={nome}>
                <CardHeader className="pb-1"><CardDescription>{t(nome)}</CardDescription></CardHeader>
                <CardContent className={`text-2xl font-bold tabular-nums ${cor}`}>{formatCurrency(valor)}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {alertas.length > 0 && (
        <Card className="border-amber-500/50" data-testid="alertas-vencimento">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {t("Vencem nos próximos 5 dias ou já venceram")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {alertas.map((c) => {
              const d = diasAte(c.vencimento)
              return (
                <div key={c.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {c.tipo === "receber" ? t("Receber") : t("Pagar")} · {c.descricao}
                    {c.orcamentoNumero ? ` · ${c.orcamentoNumero}` : ""} · {formatDate(c.vencimento)} (
                    {d < 0 ? t("vencida há {n} d", { n: -d }) : d === 0 ? t("hoje") : t("em {n} d", { n: d })})
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
          <CardTitle className="text-lg">{t("Contas")}</CardTitle>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <SelectTrigger className="w-48 rounded-full" aria-label={t("Filtro")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendentes">{t("Pendentes")}</SelectItem>
              <SelectItem value="receber">{t("A receber")}</SelectItem>
              <SelectItem value="pagar">{t("A pagar")}</SelectItem>
              <SelectItem value="todas">{t("Todas")}</SelectItem>
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
