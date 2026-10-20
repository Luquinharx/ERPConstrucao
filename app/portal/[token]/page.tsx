"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

import { lerUm } from "@/lib/firebase-service"
import type { PortalCliente } from "@/lib/types"
import { formatCurrency, formatDate, formatNumber2 } from "@/lib/utils"

/**
 * Pagina publica do portal do cliente. Nao pede conta: quem tem o link ve a
 * fotografia publicada da sua obra, e so isso.
 */
export default function PortalPublicoPage() {
  const { token } = useParams<{ token: string }>()
  const [portal, setPortal] = useState<PortalCliente | null | undefined>(undefined)

  useEffect(() => {
    if (!token) return
    lerUm<PortalCliente>("portal", token)
      .then(setPortal)
      .catch(() => setPortal(null))
  }, [token])

  if (portal === undefined) return <div className="p-10 text-center text-muted-foreground">A carregar...</div>
  if (!portal || !portal.ativo) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-xl font-semibold">Link indisponivel</h1>
        <p className="mt-2 text-muted-foreground">Este link foi desativado ou nao existe. Contacte a empresa.</p>
      </div>
    )
  }
  const r = portal.resumo

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <p className="text-sm text-muted-foreground">Acompanhamento da obra</p>
          <h1 className="text-2xl font-bold">Obra {portal.obraNumero}</h1>
          <p className="text-muted-foreground">{portal.clienteNome}</p>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Executado e medido</span>
            <span className="font-medium" data-testid="portal-medido">{formatNumber2(r.medidoPercent)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, r.medidoPercent)}%` }} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Valor da obra", r.valorAdjudicado],
              ["Ja pago", r.recebido],
              ["Por pagar", r.porReceber],
            ] as const
          ).map(([nome, valor]) => (
            <div key={nome} className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">{nome}</div>
              <div className="text-xl font-bold tabular-nums">{formatCurrency(valor)}</div>
            </div>
          ))}
        </div>

        {r.proximasParcelas.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Proximos pagamentos</h2>
            {r.proximasParcelas.map((p, i) => (
              <div key={i} className="flex justify-between rounded-lg border p-3 text-sm">
                <span>{p.descricao} · {formatDate(p.vencimento)}</span>
                <span className="tabular-nums font-medium">{formatCurrency(p.valor)}</span>
              </div>
            ))}
          </section>
        )}

        {r.autos.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Autos de medicao</h2>
            {r.autos.map((a) => (
              <div key={a.numero} className="flex justify-between rounded-lg border p-3 text-sm">
                <span>Auto n.o {a.numero} · {formatDate(a.data)}</span>
                <span className="tabular-nums">{formatCurrency(a.valor)} + IVA</span>
              </div>
            ))}
          </section>
        )}

        {r.diario.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Diario de obra</h2>
            {r.diario.map((d, i) => (
              <div key={i} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{formatDate(d.data)}</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{d.trabalhos}</p>
              </div>
            ))}
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Atualizado em {formatDate(portal.atualizadoEm)}.
        </p>
      </div>
    </div>
  )
}
