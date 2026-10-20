"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { CabecalhoObra } from "@/components/obra/cabecalho-obra"
import { SemAcesso } from "@/components/sem-acesso"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { useObra } from "@/hooks/use-obra"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { FirebaseService, apagar, criar, listar } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { custoHoraFuncionario } from "@/lib/produto-calculos"
import type { Funcionario, RelatorioDiario } from "@/lib/types"
import { formatDate, formatNumber2, hojeLocal, round2 } from "@/lib/utils"

const METEOROLOGIA = ["Bom tempo", "Nublado", "Chuva fraca", "Chuva forte", "Vento forte", "Frio intenso", "Calor intenso"]

type Rascunho = Omit<RelatorioDiario, "id" | "createdAt" | "userId" | "estado" | "orcamentoId" | "orcamentoNumero">

/**
 * Diario de obra (RDO): o que se fez, quem esteve e o que correu mal.
 * Ao submeter, a equipa e as horas do dia viram registos no livro de ponto
 * (pendentes de aprovacao): as horas lancam-se uma vez so.
 */
export default function DiarioPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode, carregando } = usePermissoes()
  const { orcamento, aCarregar } = useObra(id)
  const podeLancar = pode("orcamentos.custosObra")

  const [rdos, setRdos] = useState<RelatorioDiario[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [novo, setNovo] = useState<Rascunho | null>(null)
  const [aGravar, setAGravar] = useState(false)

  const carregar = useCallback(async () => {
    if (!id || !user) return
    const [lista, equipa] = await Promise.all([
      listar<RelatorioDiario>("rdos", ["orcamentoId", id]).catch(() => []),
      FirebaseService.getFuncionarios(user.uid).catch(() => [] as Funcionario[]),
    ])
    setRdos(lista.sort((a, b) => b.data.localeCompare(a.data)))
    setFuncionarios(equipa.filter((f) => f.ativo !== false))
  }, [id, user])
  useEffect(() => {
    void carregar()
  }, [carregar])

  if (carregando || aCarregar) return <LoadingSpinner size="lg" />
  if (!pode("orcamentos.ver")) return <SemAcesso area="Diario de obra" />
  if (!orcamento) return <p>Proposta nao encontrada.</p>

  const submeter = async () => {
    if (!user || !novo || !orcamento.id) return
    if (!novo.trabalhos.trim()) return toast({ title: "Descreva os trabalhos do dia", variant: "destructive" })
    if (rdos.some((r) => r.data === novo.data)) return toast({ title: "Ja existe um RDO para esse dia", variant: "destructive" })
    const equipa = novo.equipa.filter((e) => e.funcionarioId && e.horas > 0)
    const numero = numeroCompleto(orcamento, configuracao)
    setAGravar(true)
    try {
      await criar("rdos", {
        ...novo,
        equipa,
        trabalhos: novo.trabalhos.trim(),
        orcamentoId: orcamento.id,
        orcamentoNumero: numero,
        estado: "submetido",
        userId: user.uid,
      })
      // As horas do RDO vao para o livro de ponto, pendentes de aprovacao
      for (const e of equipa) {
        const f = funcionarios.find((x) => x.id === e.funcionarioId)
        await criar("registosHoras", {
          funcionarioId: e.funcionarioId,
          funcionarioNome: e.nome,
          orcamentoId: orcamento.id,
          orcamentoNumero: numero,
          data: novo.data,
          horas: round2(e.horas),
          custoHora: f ? custoHoraFuncionario(f) : 0,
          custoFixoHora: round2(configuracao.custoFixoHora || 0),
          estado: "pendente",
          observacoes: "Do diario de obra",
          userId: user.uid,
        })
      }
      toast({ title: "RDO submetido", description: `${equipa.length} registo(s) de horas enviados para aprovacao.` })
      setNovo(null)
      await carregar()
    } finally {
      setAGravar(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CabecalhoObra orcamento={orcamento} subtitulo="diario de obra" />

      {!novo && podeLancar && (
        <div className="flex justify-end">
          <Button
            className="rounded-full"
            onClick={() => setNovo({ data: hojeLocal(), meteorologia: "Bom tempo", trabalhos: "", equipa: [], ocorrencias: "", bloqueios: "" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo RDO
          </Button>
        </div>
      )}

      {novo && (
        <Card data-testid="novo-rdo">
          <CardHeader>
            <CardTitle className="text-lg">Relatorio diario</CardTitle>
            <CardDescription>A equipa e as horas vao para o livro de ponto ao submeter.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Dia</Label>
                <Input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Meteorologia</Label>
                <Select value={novo.meteorologia} onValueChange={(meteorologia) => setNovo({ ...novo, meteorologia })}>
                  <SelectTrigger aria-label="Meteorologia"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METEOROLOGIA.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Trabalhos executados</Label>
              <Textarea aria-label="Trabalhos executados" rows={3} value={novo.trabalhos} onChange={(e) => setNovo({ ...novo, trabalhos: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Equipa no dia</Label>
              {novo.equipa.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] items-center gap-2" data-testid="linha-equipa">
                  <SeletorComBusca
                    valor={e.funcionarioId}
                    onChange={(funcionarioId) => {
                      const f = funcionarios.find((x) => x.id === funcionarioId)
                      setNovo({ ...novo, equipa: novo.equipa.map((x, j) => (j === i ? { ...x, funcionarioId, nome: f?.nome || "" } : x)) })
                    }}
                    placeholder="Trabalhador"
                    placeholderBusca="Procurar..."
                    vazio="Nenhum."
                    opcoes={funcionarios.map((f) => ({ valor: f.id!, rotulo: f.nome, detalhe: f.funcao }))}
                  />
                  <CampoNumerico
                    tamanho="sm"
                    min={0}
                    max={24}
                    sufixo="h"
                    aria-label="Horas"
                    value={e.horas}
                    onChange={(horas) => setNovo({ ...novo, equipa: novo.equipa.map((x, j) => (j === i ? { ...x, horas } : x)) })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => setNovo({ ...novo, equipa: novo.equipa.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setNovo({ ...novo, equipa: [...novo.equipa, { funcionarioId: "", nome: "", horas: 8 }] })}
              >
                <Plus className="mr-1 h-3 w-3" />
                Trabalhador
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Ocorrencias</Label>
                <Textarea rows={2} value={novo.ocorrencias} onChange={(e) => setNovo({ ...novo, ocorrencias: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Bloqueios (o que impediu avancar)</Label>
                <Textarea rows={2} value={novo.bloqueios} onChange={(e) => setNovo({ ...novo, bloqueios: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNovo(null)}>Cancelar</Button>
              <Button onClick={submeter} disabled={aGravar} className="rounded-full">
                {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submeter RDO
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rdos.length === 0 && !novo && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Ainda sem relatorios diarios.</CardContent></Card>
        )}
        {rdos.map((r) => (
          <Card key={r.id} data-testid="rdo">
            <CardContent className="space-y-2 pt-6 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{formatDate(r.data)} · {r.meteorologia}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.equipa.length} trabalhador(es) · {formatNumber2(r.equipa.reduce((s, e) => s + e.horas, 0))} h</Badge>
                  {podeLancar && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Apagar RDO (as horas ja enviadas ficam no livro de ponto)"
                      onClick={async () => {
                        if (!r.id || !confirm("Apagar este RDO? As horas ja enviadas ficam no livro de ponto.")) return
                        await apagar("rdos", r.id)
                        await carregar()
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap">{r.trabalhos}</p>
              {r.equipa.length > 0 && (
                <p className="text-muted-foreground">{r.equipa.map((e) => `${e.nome} (${formatNumber2(e.horas)} h)`).join(", ")}</p>
              )}
              {r.ocorrencias && <p><span className="font-medium">Ocorrencias:</span> {r.ocorrencias}</p>}
              {r.bloqueios && <p className="text-rose-700"><span className="font-medium">Bloqueios:</span> {r.bloqueios}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
