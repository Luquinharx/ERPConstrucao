"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"

import { CabecalhoObra } from "@/components/obra/cabecalho-obra"
import { TabelaContas } from "@/components/obra/tabela-contas"
import { SemAcesso } from "@/components/sem-acesso"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { useObra } from "@/hooks/use-obra"
import { usePermissoes } from "@/hooks/use-permissoes"
import { listar } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { resumoContas } from "@/lib/obra"
import type { Conta } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

/** Contas a receber e a pagar desta obra. */
export default function PagamentosObraPage() {
  const { id } = useParams<{ id: string }>()
  const { configuracao } = useConfiguracao()
  const { pode, carregando } = usePermissoes()
  const { orcamento, aCarregar } = useObra(id)
  const [contas, setContas] = useState<Conta[]>([])

  const carregar = useCallback(async () => {
    if (id) setContas(await listar<Conta>("contas", ["orcamentoId", id]).catch(() => []))
  }, [id])
  useEffect(() => {
    void carregar()
  }, [carregar])

  if (carregando || aCarregar) return <LoadingSpinner size="lg" />
  if (!pode("orcamentos.verCusto")) return <SemAcesso area="Pagamentos" requisito="a permissao de ver custos e margem" />
  if (!orcamento) return <p>Proposta nao encontrada.</p>
  const r = resumoContas(contas)

  return (
    <div className="space-y-6 animate-fade-in">
      <CabecalhoObra orcamento={orcamento} subtitulo="pagamentos" />
      <div className="grid gap-4 sm:grid-cols-4" data-testid="resumo-pagamentos">
        {(
          [
            ["Adjudicado", orcamento.adjudicacao?.valor ?? null],
            ["Recebido", r.recebido],
            ["Por receber", r.aReceber],
            ["Vencido", r.vencido],
          ] as const
        ).map(([nome, valor]) => (
          <Card key={nome}>
            <CardHeader className="pb-1"><CardDescription>{nome}</CardDescription></CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">{valor === null ? "-" : formatCurrency(valor)}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <TabelaContas
            contas={contas}
            podeGerir={pode("orcamentos.custosObra") || pode("orcamentos.aprovar")}
            onAlterado={carregar}
            obra={{ id: orcamento.id!, numero: numeroCompleto(orcamento, configuracao), cliente: orcamento.cliente.nome }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
