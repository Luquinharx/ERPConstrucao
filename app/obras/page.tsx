"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Building2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { apurarObra, podeApurar } from "@/lib/apuramento-obra"
import { FirebaseService, getMovimentosEstoque, listar } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { percentMedido, resumoContas } from "@/lib/obra"
import { getFase } from "@/lib/orcamento-fases"
import type { AutoMedicao, Conta, FaturaFornecedor, MovimentoEstoque, Orcamento, RegistoHoras } from "@/lib/types"
import { formatCurrency, formatNumber2, matchesSearch } from "@/lib/utils"

/**
 * Obras em curso: tudo o que foi adjudicado, com o andamento financeiro e o
 * lucro real ao lado do previsto. Cada cartao abre as abas da obra.
 */
export default function ObrasPage() {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode } = usePermissoes()
  const verCusto = pode("orcamentos.verCusto")
  const [dados, setDados] = useState<{
    obras: Orcamento[]
    contas: Conta[]
    autos: AutoMedicao[]
    horas: RegistoHoras[]
    faturas: FaturaFornecedor[]
    movimentos: MovimentoEstoque[]
  } | null>(null)
  const [busca, setBusca] = useState("")

  const carregar = useCallback(async () => {
    if (!user) return
    const vazio = <T,>() => [] as T[]
    const [orcs, contas, autos, horas, faturas, movimentos] = await Promise.all([
      FirebaseService.getOrcamentos(user.uid),
      verCusto ? listar<Conta>("contas").catch(vazio<Conta>) : vazio<Conta>(),
      listar<AutoMedicao>("autosMedicao").catch(vazio<AutoMedicao>),
      verCusto ? listar<RegistoHoras>("registosHoras").catch(vazio<RegistoHoras>) : vazio<RegistoHoras>(),
      verCusto ? listar<FaturaFornecedor>("faturasFornecedor").catch(vazio<FaturaFornecedor>) : vazio<FaturaFornecedor>(),
      getMovimentosEstoque().catch(vazio<MovimentoEstoque>),
    ])
    setDados({ obras: orcs.filter((o) => podeApurar(o) && o.status !== "cancelado"), contas, autos, horas, faturas, movimentos })
  }, [user, verCusto])
  useEffect(() => {
    void carregar()
  }, [carregar])

  const linhas = useMemo(() => {
    if (!dados) return []
    return dados.obras.map((o) => {
      const de = <T extends { orcamentoId?: string }>(l: T[]) => l.filter((x) => x.orcamentoId === o.id)
      const ap = apurarObra(o, de(dados.movimentos), o.lancamentosObra || [], { horas: de(dados.horas), faturas: de(dados.faturas) })
      const r = resumoContas(de(dados.contas).filter((c) => c.tipo === "receber"))
      return {
        o,
        numero: numeroCompleto(o, configuracao),
        ap,
        recebido: r.recebido,
        medido: percentMedido(o, de(dados.autos).filter((a) => a.estado === "aprovado")),
      }
    })
  }, [dados, configuracao])

  if (!dados) return <LoadingSpinner size="lg" />
  const visiveis = linhas.filter((l) => !busca.trim() || matchesSearch(busca, [l.numero, l.o.cliente.nome, l.o.localidade]))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Obras</h1>
        <p className="mt-2 text-muted-foreground">Propostas adjudicadas: andamento, pagamentos e lucro real contra o previsto.</p>
      </div>
      <Input placeholder="Procurar obra ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md" />

      {visiveis.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Ainda sem obras</p>
            <p className="text-sm text-muted-foreground">Uma proposta passa a obra quando e adjudicada (Orcamentos &gt; mudar fase &gt; Aceite).</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="lista-obras">
          {visiveis.map(({ o, numero, ap, recebido, medido }) => (
            <Card key={o.id} data-testid="cartao-obra">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{numero}</CardTitle>
                    <CardDescription>{o.cliente.nome}</CardDescription>
                  </div>
                  <Badge variant="outline" className={getFase(o.status).cor}>{getFase(o.status).nome}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Medido</span>
                    <span>{formatNumber2(medido)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, medido)}%` }} />
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Adjudicado</dt>
                  <dd className="text-right tabular-nums">{formatCurrency(o.adjudicacao?.valor ?? o.valorTotal)}</dd>
                  {verCusto && (
                    <>
                      <dt className="text-muted-foreground">Recebido</dt>
                      <dd className="text-right tabular-nums">{formatCurrency(recebido)}</dd>
                      <dt className="text-muted-foreground">Lucro previsto</dt>
                      <dd className="text-right tabular-nums">{formatCurrency(ap.lucroPrevisto)}</dd>
                      <dt className="text-muted-foreground">Lucro real</dt>
                      <dd className={`text-right tabular-nums font-medium ${ap.temReal && ap.lucroReal < ap.lucroPrevisto ? "text-rose-700" : ""}`}>
                        {ap.temReal ? formatCurrency(ap.lucroReal) : "-"}
                      </dd>
                    </>
                  )}
                </dl>
                <div className="flex flex-wrap gap-2 border-t pt-3 text-xs">
                  {[
                    ["apuramento", "Apuramento"],
                    ["autos", "Autos"],
                    ["diario", "Diario"],
                    ["pagamentos", "Pagamentos"],
                    ["garantia", "Garantia"],
                    ["portal", "Portal"],
                  ].map(([rota, nome]) => (
                    <Link key={rota} href={`/orcamentos/${o.id}/${rota}`} className="rounded-full border px-2.5 py-1 hover:bg-muted">
                      {nome}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
