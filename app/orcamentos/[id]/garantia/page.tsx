"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Check, Plus } from "lucide-react"

import { CabecalhoObra } from "@/components/obra/cabecalho-obra"
import { SemAcesso } from "@/components/sem-acesso"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { useObra } from "@/hooks/use-obra"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { atualizar, criar, listar } from "@/lib/firebase-service"
import { ESTADOS_GARANTIA, estadoGarantia, fimGarantia } from "@/lib/garantias"
import { numeroCompleto } from "@/lib/numeracao"
import type { Garantia } from "@/lib/types"
import { formatDate, hojeLocal } from "@/lib/utils"

/** Pos-obra: a ficha da obra entregue, o prazo de garantia e as ocorrencias. */
export default function GarantiaPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode, carregando } = usePermissoes()
  const { orcamento, aCarregar } = useObra(id)
  const podeGerir = pode("orcamentos.custosObra") || pode("orcamentos.editar")

  const [ficha, setFicha] = useState<Garantia | null>(null)
  const [nova, setNova] = useState({ dataEntrega: hojeLocal(), anos: 5 })
  const [ocorrencia, setOcorrencia] = useState("")

  const carregar = useCallback(async () => {
    if (!id) return
    const lista = await listar<Garantia>("garantias", ["orcamentoId", id]).catch(() => [])
    setFicha(lista[0] || null)
  }, [id])
  useEffect(() => {
    void carregar()
  }, [carregar])

  if (carregando || aCarregar) return <LoadingSpinner size="lg" />
  if (!pode("orcamentos.ver")) return <SemAcesso area="Garantia" />
  if (!orcamento) return <p>Proposta nao encontrada.</p>

  const criarFicha = async () => {
    if (!user || !orcamento.id) return
    await criar("garantias", {
      orcamentoId: orcamento.id,
      orcamentoNumero: numeroCompleto(orcamento, configuracao),
      clienteNome: orcamento.cliente.nome,
      dataEntrega: nova.dataEntrega,
      anos: nova.anos,
      ocorrencias: [],
      userId: user.uid,
    })
    toast({ title: "Obra entregue", description: "Ficha de garantia criada." })
    await carregar()
  }

  const gravarOcorrencias = async (ocorrencias: Garantia["ocorrencias"]) => {
    if (!ficha?.id) return
    await atualizar("garantias", ficha.id, { ocorrencias })
    await carregar()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CabecalhoObra orcamento={orcamento} subtitulo="garantia" />

      {!ficha ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entregar a obra</CardTitle>
            <CardDescription>
              Cria a ficha de garantia. Em empreitadas de imoveis o prazo legal habitual e de 5 anos (art. 1225.o do
              Codigo Civil); ajuste se o contrato disser outra coisa.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Data de entrega</Label>
              <Input type="date" value={nova.dataEntrega} onChange={(e) => setNova({ ...nova, dataEntrega: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Anos de garantia</Label>
              <CampoNumerico decimais={0} min={0} aria-label="Anos de garantia" value={nova.anos} onChange={(anos) => setNova({ ...nova, anos })} className="w-28" />
            </div>
            {podeGerir && <Button onClick={criarFicha} className="rounded-full">Criar ficha de garantia</Button>}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3" data-testid="ficha-garantia">
            <Card>
              <CardHeader className="pb-1"><CardDescription>Entregue em</CardDescription></CardHeader>
              <CardContent className="text-xl font-bold">{formatDate(ficha.dataEntrega)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardDescription>Garantia ate</CardDescription></CardHeader>
              <CardContent className="text-xl font-bold">{formatDate(fimGarantia(ficha))}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardDescription>Estado</CardDescription></CardHeader>
              <CardContent>
                <Badge variant="outline" className={ESTADOS_GARANTIA[estadoGarantia(ficha)].cor}>
                  {ESTADOS_GARANTIA[estadoGarantia(ficha)].nome}
                </Badge>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ocorrencias pos-entrega</CardTitle>
              <CardDescription>Reclamacoes do cliente durante a garantia.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {podeGerir && (
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!ocorrencia.trim()) return
                    await gravarOcorrencias([
                      ...ficha.ocorrencias,
                      { id: `oc-${Date.now()}`, data: hojeLocal(), descricao: ocorrencia.trim(), resolvida: false },
                    ])
                    setOcorrencia("")
                  }}
                >
                  <Input placeholder="Ex.: fissura no teto da sala" value={ocorrencia} onChange={(e) => setOcorrencia(e.target.value)} aria-label="Nova ocorrencia" />
                  <Button type="submit" variant="outline">
                    <Plus className="mr-1 h-4 w-4" />
                    Registar
                  </Button>
                </form>
              )}
              {ficha.ocorrencias.length === 0 && <p className="text-sm text-muted-foreground">Sem ocorrencias.</p>}
              {ficha.ocorrencias.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                  <span className={o.resolvida ? "text-muted-foreground line-through" : ""}>
                    {formatDate(o.data)} · {o.descricao}
                  </span>
                  {podeGerir && !o.resolvida && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => gravarOcorrencias(ficha.ocorrencias.map((x) => (x.id === o.id ? { ...x, resolvida: true } : x)))}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Resolvida
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
