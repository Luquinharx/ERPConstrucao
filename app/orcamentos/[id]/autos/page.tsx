"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Check, Loader2, Plus, Trash2 } from "lucide-react"

import { CabecalhoObra } from "@/components/obra/cabecalho-obra"
import { SemAcesso } from "@/components/sem-acesso"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { useObra } from "@/hooks/use-obra"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { apagar, aprovarComConta, criar, listar } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { linhasNovoAuto, percentMedido, somarDias, valorAuto, valorLinhaAuto } from "@/lib/obra"
import { resumoDeValores } from "@/lib/orcamento-calculos"
import type { AutoMedicao, LinhaAuto } from "@/lib/types"
import { formatCurrency, formatDate, formatNumber2, hojeLocal, round2 } from "@/lib/utils"
import { t } from "@/lib/i18n"

/**
 * Autos de medicao: cada um certifica o que se executou no periodo, a preco
 * contratual sem IVA. Aprovado, vira conta a receber (com IVA).
 */
export default function AutosPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode, carregando } = usePermissoes()
  const { orcamento, aCarregar } = useObra(id)
  const podeLancar = pode("orcamentos.custosObra")
  const podeAprovar = pode("orcamentos.aprovar")

  const [autos, setAutos] = useState<AutoMedicao[]>([])
  const [rascunho, setRascunho] = useState<{ data: string; linhas: LinhaAuto[]; observacoes: string } | null>(null)
  const [aGravar, setAGravar] = useState(false)

  const carregar = useCallback(async () => {
    if (!id) return
    const lista = await listar<AutoMedicao>("autosMedicao", ["orcamentoId", id]).catch(() => [])
    setAutos(lista.sort((a, b) => a.numero - b.numero))
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const aprovados = autos.filter((a) => a.estado === "aprovado")
  const base = orcamento ? resumoDeValores(orcamento).baseTributavel : 0
  const medido = round2(aprovados.reduce((s, a) => s + a.valor, 0))
  const valorRascunho = useMemo(() => (rascunho ? valorAuto(rascunho.linhas) : 0), [rascunho])

  if (carregando || aCarregar) return <LoadingSpinner size="lg" />
  if (!pode("orcamentos.ver")) return <SemAcesso area={t("Autos de medição")} />
  if (!orcamento) return <p>{t("Proposta não encontrada.")}</p>

  const novo = () =>
    // Os anteriores contam todos, mesmo em rascunho: nao se mede duas vezes o mesmo
    setRascunho({ data: hojeLocal(), linhas: linhasNovoAuto(orcamento, autos), observacoes: "" })

  const alterarLinha = (itemId: string, quantidade: number) =>
    setRascunho((r) => r && { ...r, linhas: r.linhas.map((l) => (l.itemId === itemId ? { ...l, quantidade } : l)) })

  /** Mede de uma vez o que falta de cada item (ultimo auto). */
  const medirRestante = () =>
    setRascunho((r) => r && { ...r, linhas: r.linhas.map((l) => ({ ...l, quantidade: round2(Math.max(0, l.quantidadeContratual - l.quantidadeAnterior)) })) })

  const gravar = async () => {
    if (!user || !rascunho || !orcamento.id) return
    const linhas = rascunho.linhas.filter((l) => l.quantidade > 0)
    if (linhas.length === 0) return toast({ title: t("Meça pelo menos um item"), variant: "destructive" })
    const excede = linhas.find((l) => l.quantidade + l.quantidadeAnterior > l.quantidadeContratual + 0.001)
    if (excede) return toast({ title: t("“{nome}” passa da quantidade contratual", { nome: excede.nome }), description: t("Trabalhos a mais pedem uma revisão da proposta."), variant: "destructive" })
    setAGravar(true)
    try {
      await criar("autosMedicao", {
        orcamentoId: orcamento.id,
        orcamentoNumero: numeroCompleto(orcamento, configuracao),
        numero: (autos.reduce((m, a) => Math.max(m, a.numero), 0) || 0) + 1,
        data: rascunho.data,
        linhas,
        valor: valorAuto(linhas),
        taxaIVA: orcamento.taxaIVA ?? 0,
        estado: "rascunho",
        observacoes: rascunho.observacoes.trim(),
        userId: user.uid,
      })
      toast({ title: t("Auto guardado em rascunho") })
      setRascunho(null)
      await carregar()
    } catch {
      toast({ title: t("Não foi possível guardar o auto"), variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }

  const aprovar = async (auto: AutoMedicao) => {
    if (!user || !auto.id) return
    const comIVA = round2(auto.valor * (1 + (auto.taxaIVA || 0) / 100))
    if (!confirm(t("Aprovar o auto n.º {numero}? Cria uma conta a receber de {valor} (com IVA).", { numero: auto.numero, valor: formatCurrency(comIVA) }))) return
    try {
      await aprovarComConta(
        "autosMedicao",
        auto.id,
        { estado: "aprovado" },
        {
          tipo: "receber",
          descricao: t("Auto de medição n.º {numero}", { numero: auto.numero }),
          valor: comIVA,
          vencimento: somarDias(auto.data, 30),
          estado: "pendente",
          orcamentoId: auto.orcamentoId,
          orcamentoNumero: auto.orcamentoNumero,
          entidade: orcamento.cliente.nome,
          origem: "auto",
          userId: user.uid,
        },
      )
      toast({ title: t("Auto n.º {numero} aprovado", { numero: auto.numero }), description: t("Conta a receber criada, vence a 30 dias.") })
      await carregar()
    } catch {
      toast({ title: t("Não foi possível aprovar"), variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CabecalhoObra orcamento={orcamento} subtitulo={t("autos de medição")} />

      <div className="grid gap-4 sm:grid-cols-3" data-testid="resumo-autos">
        <Card>
          <CardHeader className="pb-1"><CardDescription>{t("Valor contratual (sem IVA)")}</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(base)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardDescription>{t("Medido e aprovado")}</CardDescription></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums" data-testid="medido">{formatCurrency(medido)}</div>
            <p className="text-sm text-muted-foreground">{t("{percent}% da obra", { percent: formatNumber2(percentMedido(orcamento, aprovados)) })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardDescription>{t("Saldo por medir")}</CardDescription></CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(round2(base - medido))}</CardContent>
        </Card>
      </div>

      {!rascunho && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-lg">{t("Autos da obra")}</CardTitle>
              <CardDescription>{t("Aprovar um auto cria a conta a receber com o IVA da proposta.")}</CardDescription>
            </div>
            {podeLancar && (
              <Button onClick={novo} className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                {t("Novo auto")}
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("N.º")}</TableHead>
                  <TableHead>{t("Data")}</TableHead>
                  <TableHead className="text-right">{t("Valor s/ IVA")}</TableHead>
                  <TableHead>{t("Estado")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {autos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {t("Ainda não há autos nesta obra.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  autos.map((a) => (
                    <TableRow key={a.id} data-testid="linha-auto">
                      <TableCell className="font-medium">{a.numero}</TableCell>
                      <TableCell>{formatDate(a.data)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(a.valor)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={a.estado === "aprovado" ? "border-emerald-500/40 text-emerald-700" : ""}>
                          {a.estado === "aprovado" ? t("Aprovado") : t("Rascunho")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {a.estado === "rascunho" && podeAprovar && (
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => aprovar(a)}>
                            <Check className="mr-1 h-3 w-3" />
                            {t("Aprovar")}
                          </Button>
                        )}
                        {a.estado === "rascunho" && podeLancar && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("Eliminar rascunho")}
                            onClick={async () => {
                              if (!a.id || !confirm(t("Eliminar este auto em rascunho?"))) return
                              await apagar("autosMedicao", a.id)
                              await carregar()
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {rascunho && (
        <Card data-testid="novo-auto">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-lg">{t("Novo auto de medição")}</CardTitle>
              <CardDescription>{t("Indique o executado neste período. Preços contratuais, sem IVA.")}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={rascunho.data} onChange={(e) => setRascunho({ ...rascunho, data: e.target.value })} className="w-40" />
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={medirRestante}>
                {t("Medir o que falta")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-0 sm:p-6 sm:pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Item")}</TableHead>
                  <TableHead className="text-right">{t("Contratual")}</TableHead>
                  <TableHead className="text-right">{t("Já medido")}</TableHead>
                  <TableHead className="text-right w-40">{t("Este auto")}</TableHead>
                  <TableHead className="text-right">{t("Preço unit.")}</TableHead>
                  <TableHead className="text-right">{t("Valor")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rascunho.linhas.map((l) => (
                  <TableRow key={l.itemId}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber2(l.quantidadeContratual)} {l.unidade}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber2(l.quantidadeAnterior)}</TableCell>
                    <TableCell className="text-right">
                      <CampoNumerico tamanho="sm" min={0} aria-label={t("Medir {nome}", { nome: l.nome })} value={l.quantidade} onChange={(q) => alterarLinha(l.itemId, q)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(l.precoUnitario)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(valorLinhaAuto(l))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>{t("Valor do auto (sem IVA)")}</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="valor-auto">{formatCurrency(valorRascunho)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <div className="flex justify-end gap-2 px-4 pb-4 sm:px-0 sm:pb-0">
              <Button variant="outline" onClick={() => setRascunho(null)}>{t("Cancelar")}</Button>
              <Button onClick={gravar} disabled={aGravar} className="rounded-full">
                {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Guardar auto")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
