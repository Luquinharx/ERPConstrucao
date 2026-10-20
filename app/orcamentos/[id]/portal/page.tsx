"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Copy, ExternalLink, Loader2 } from "lucide-react"

import { CabecalhoObra } from "@/components/obra/cabecalho-obra"
import { SemAcesso } from "@/components/sem-acesso"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { useObra } from "@/hooks/use-obra"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { definir, listar } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { percentMedido, resumoContas } from "@/lib/obra"
import { resumoDeValores } from "@/lib/orcamento-calculos"
import type { AutoMedicao, Conta, PortalCliente, RelatorioDiario } from "@/lib/types"
import { formatDate } from "@/lib/utils"

function novoToken(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Portal do cliente: um link privado com o andamento da obra. Publica-se uma
 * fotografia (valores, pagamentos, autos, diario) - nunca custos nem margens.
 * Atualizar volta a tirar a fotografia; desativar corta o acesso.
 */
export default function PortalObraPage() {
  const { id } = useParams<{ id: string }>()
  const { configuracao } = useConfiguracao()
  const { pode, carregando } = usePermissoes()
  const { orcamento, aCarregar } = useObra(id)
  const podePublicar = pode("orcamentos.editar") || pode("orcamentos.aprovar")
  const [portal, setPortal] = useState<PortalCliente | null>(null)
  const [aPublicar, setAPublicar] = useState(false)

  const carregar = useCallback(async () => {
    if (!id) return
    const lista = await listar<PortalCliente>("portal", ["orcamentoId", id]).catch(() => [])
    setPortal(lista[0] || null)
  }, [id])
  useEffect(() => {
    void carregar()
  }, [carregar])

  if (carregando || aCarregar) return <LoadingSpinner size="lg" />
  if (!pode("orcamentos.ver")) return <SemAcesso area="Portal do cliente" />
  if (!orcamento) return <p>Proposta nao encontrada.</p>

  const link = portal && typeof window !== "undefined" ? `${window.location.origin}/portal/${portal.id}` : ""

  const publicar = async (ativo = true) => {
    if (!orcamento.id) return
    setAPublicar(true)
    try {
      const [contas, autos, rdos] = await Promise.all([
        listar<Conta>("contas", ["orcamentoId", orcamento.id]),
        listar<AutoMedicao>("autosMedicao", ["orcamentoId", orcamento.id]),
        listar<RelatorioDiario>("rdos", ["orcamentoId", orcamento.id]),
      ])
      const receber = contas.filter((c) => c.tipo === "receber")
      const r = resumoContas(receber)
      const aprovados = autos.filter((a) => a.estado === "aprovado").sort((a, b) => a.numero - b.numero)
      const token = portal?.id || novoToken()
      await definir("portal", token, {
        orcamentoId: orcamento.id,
        clienteNome: orcamento.cliente.nome,
        obraNumero: numeroCompleto(orcamento, configuracao),
        resumo: {
          valorAdjudicado: orcamento.adjudicacao?.valor ?? resumoDeValores(orcamento).totalVenda,
          recebido: r.recebido,
          porReceber: r.aReceber,
          medidoPercent: percentMedido(orcamento, aprovados),
          proximasParcelas: receber
            .filter((c) => c.estado === "pendente")
            .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
            .map((c) => ({ descricao: c.descricao, valor: c.valor, vencimento: c.vencimento })),
          autos: aprovados.map((a) => ({ numero: a.numero, data: a.data, valor: a.valor })),
          diario: rdos
            .sort((a, b) => b.data.localeCompare(a.data))
            .slice(0, 15)
            .map((d) => ({ data: d.data, trabalhos: d.trabalhos })),
        },
        atualizadoEm: new Date().toISOString(),
        ativo,
      })
      toast({ title: ativo ? "Portal atualizado" : "Portal desativado" })
      await carregar()
    } catch (erro) {
      console.error(erro)
      toast({ title: "Nao foi possivel publicar", variant: "destructive" })
    } finally {
      setAPublicar(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CabecalhoObra orcamento={orcamento} subtitulo="portal do cliente" />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Link para o cliente</CardTitle>
          <CardDescription>
            O cliente ve o valor adjudicado, o que pagou e falta pagar, os autos aprovados e o diario de obra. Custos e
            margens nunca saem daqui. O que ele ve e a ultima publicacao: atualize quando houver novidades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {portal ? (
            <>
              <div className="flex gap-2">
                <Input readOnly value={link} aria-label="Link do portal" data-testid="link-portal" />
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link).catch(() => {})
                    toast({ title: "Link copiado" })
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" asChild>
                  <a href={link} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {portal.ativo ? "Ativo" : "Desativado"} · ultima atualizacao{" "}
                {formatDate(portal.atualizadoEm)} {new Date(portal.atualizadoEm).toLocaleTimeString("pt-PT")}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda nao publicado.</p>
          )}
          {podePublicar && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => publicar(true)} disabled={aPublicar} className="rounded-full">
                {aPublicar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {portal ? "Atualizar portal" : "Publicar portal"}
              </Button>
              {portal?.ativo && (
                <Button variant="outline" onClick={() => publicar(false)} disabled={aPublicar} className="rounded-full">
                  Desativar link
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
