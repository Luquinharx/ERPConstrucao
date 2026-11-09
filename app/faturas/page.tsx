"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { TIPOS_LANCAMENTO, podeApurar } from "@/lib/apuramento-obra"
import { FirebaseService, apagar, aprovarComConta, atualizar, criar, listar } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { somarDias } from "@/lib/obra"
import type { FaturaFornecedor, Orcamento, TipoLancamentoObra } from "@/lib/types"
import { formatCurrency, formatDate, hojeLocal, round2 } from "@/lib/utils"
import { t } from "@/lib/i18n"

type Rascunho = Omit<FaturaFornecedor, "id" | "createdAt" | "userId" | "estado" | "orcamentoNumero">

const vazia = (): Rascunho => ({
  fornecedor: "",
  numero: "",
  data: hojeLocal(),
  vencimento: somarDias(hojeLocal(), 30),
  orcamentoId: "",
  tipo: "terceiros",
  descricao: "",
  valorSemIVA: 0,
  taxaIVA: 23,
})

/**
 * Faturas de fornecedor (subempreitadas, aluguer, transporte...). Entram
 * pendentes; aprovadas, passam a custo real da obra e a conta a pagar.
 * O material comprado nao vem por aqui: entra pelo estoque.
 */
export default function FaturasPage() {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode } = usePermissoes()
  const podeLancar = pode("orcamentos.custosObra")
  const podeAprovar = pode("orcamentos.aprovar")

  const [faturas, setFaturas] = useState<FaturaFornecedor[]>([])
  const [obras, setObras] = useState<Orcamento[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [nova, setNova] = useState<Rascunho | null>(null)
  /** Fatura a editar (null = registo novo). */
  const [emEdicao, setEmEdicao] = useState<FaturaFornecedor | null>(null)
  const fechar = () => {
    setNova(null)
    setEmEdicao(null)
  }
  const editar = (f: FaturaFornecedor) => {
    setEmEdicao(f)
    setNova({
      fornecedor: f.fornecedor,
      numero: f.numero,
      data: f.data,
      vencimento: f.vencimento,
      orcamentoId: f.orcamentoId || "",
      tipo: f.tipo,
      descricao: f.descricao || "",
      valorSemIVA: f.valorSemIVA,
      taxaIVA: f.taxaIVA,
    })
  }
  const podeMexer = (f: FaturaFornecedor) => (f.estado === "aprovada" ? podeAprovar && podeLancar : podeLancar)

  /** Apaga a fatura e, se ja aprovada, a conta a pagar que ela criou. */
  const excluir = async (f: FaturaFornecedor) => {
    if (!f.id) return
    const aviso =
      f.estado === "aprovada"
        ? t("Eliminar esta fatura? A conta a pagar ligada também é eliminada e o custo sai da obra.")
        : t("Eliminar esta fatura?")
    if (!confirm(aviso)) return
    try {
      if (f.contaId) await apagar("contas", f.contaId)
      await apagar("faturasFornecedor", f.id)
      toast({ title: t("Fatura eliminada") })
    } catch (e) {
      toast({ title: t("Não foi possível eliminar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
    await carregar()
  }

  const carregar = useCallback(async () => {
    if (!user) return
    try {
      const [lista, orcs] = await Promise.all([listar<FaturaFornecedor>("faturasFornecedor"), FirebaseService.getOrcamentos(user.uid)])
      setFaturas(lista.sort((a, b) => b.data.localeCompare(a.data)))
      setObras(orcs.filter((o) => podeApurar(o) && o.status !== "cancelado"))
    } finally {
      setACarregar(false)
    }
  }, [user])
  useEffect(() => {
    void carregar()
  }, [carregar])

  const gravar = async () => {
    if (!user || !nova) return
    if (!nova.fornecedor.trim() || !nova.numero.trim() || nova.valorSemIVA <= 0)
      return toast({ title: t("Indique o fornecedor, o número e o valor"), variant: "destructive" })
    const obra = obras.find((o) => o.id === nova.orcamentoId)
    const dados = {
      ...nova,
      fornecedor: nova.fornecedor.trim(),
      numero: nova.numero.trim(),
      descricao: nova.descricao.trim(),
      valorSemIVA: round2(nova.valorSemIVA),
      orcamentoId: obra?.id || nova.orcamentoId || "",
      orcamentoNumero: obra ? numeroCompleto(obra, configuracao) : emEdicao?.orcamentoNumero || "",
    }
    try {
      if (emEdicao?.id) {
        await atualizar("faturasFornecedor", emEdicao.id, dados)
        // Aprovada: a conta a pagar acompanha a fatura (o estado pago mantem-se)
        if (emEdicao.estado === "aprovada" && emEdicao.contaId) {
          await atualizar("contas", emEdicao.contaId, {
            descricao: t("Fatura {numero}", { numero: dados.numero }) + (dados.descricao ? ` - ${dados.descricao}` : ""),
            valor: round2(dados.valorSemIVA * (1 + dados.taxaIVA / 100)),
            vencimento: dados.vencimento,
            entidade: dados.fornecedor,
            orcamentoId: dados.orcamentoId,
            orcamentoNumero: dados.orcamentoNumero,
          })
        }
        toast({ title: t("Fatura atualizada") })
      } else {
        await criar("faturasFornecedor", { ...dados, estado: "pendente", userId: user.uid })
        toast({ title: t("Fatura registada"), description: t("Fica pendente até ser aprovada.") })
      }
    } catch (e) {
      return toast({ title: t("Não foi possível guardar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
    fechar()
    await carregar()
  }

  const aprovar = async (f: FaturaFornecedor) => {
    if (!user || !f.id) return
    const comIVA = round2(f.valorSemIVA * (1 + f.taxaIVA / 100))
    await aprovarComConta(
      "faturasFornecedor",
      f.id,
      { estado: "aprovada", aprovadoPor: user.email || "" },
      {
        tipo: "pagar",
        descricao: t("Fatura {numero}", { numero: f.numero }) + (f.descricao ? ` - ${f.descricao}` : ""),
        valor: comIVA,
        vencimento: f.vencimento,
        estado: "pendente",
        entidade: f.fornecedor,
        orcamentoId: f.orcamentoId || "",
        orcamentoNumero: f.orcamentoNumero || "",
        origem: "fatura",
        userId: user.uid,
      },
    )
    toast({ title: t("Fatura aprovada"), description: t("Conta a pagar de {valor} criada.", { valor: formatCurrency(comIVA) }) })
    await carregar()
  }

  if (aCarregar) return <LoadingSpinner size="lg" />
  const pendentes = faturas.filter((f) => f.estado === "pendente").length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("Faturas de fornecedor")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("Subempreitadas, aluguer, transporte e outros custos. Aprovadas, entram no custo da obra e nas contas a pagar.")}
          </p>
        </div>
        {podeLancar && (
          <Button onClick={() => setNova(vazia())} className="rounded-full">
            <Plus className="mr-2 h-4 w-4" />
            {t("Registar fatura")}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("Faturas")}</CardTitle>
          <CardDescription>
            {t("{n} por aprovar. O material compra-se pelo stock (entrada ou compra para a obra).", { n: pendentes })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="tabela-faturas">
            <TableHeader>
              <TableRow>
                <TableHead>{t("Data")}</TableHead>
                <TableHead>{t("Fornecedor / fatura")}</TableHead>
                <TableHead>{t("Obra")}</TableHead>
                <TableHead>{t("Tipo")}</TableHead>
                <TableHead className="text-right">{t("Sem IVA")}</TableHead>
                <TableHead>{t("Estado")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t("Sem faturas.")}</TableCell></TableRow>
              ) : (
                faturas.map((f) => (
                  <TableRow key={f.id} data-testid="linha-fatura">
                    <TableCell className="whitespace-nowrap">{formatDate(f.data)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{f.fornecedor}</div>
                      <div className="text-xs text-muted-foreground">{f.numero}{f.descricao ? ` · ${f.descricao}` : ""}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{f.orcamentoNumero || "-"}</TableCell>
                    <TableCell className="text-sm">{t(TIPOS_LANCAMENTO[f.tipo].nome)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(f.valorSemIVA)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={f.estado === "aprovada" ? "border-emerald-500/40 text-emerald-700" : f.estado === "rejeitada" ? "border-rose-500/40 text-rose-700" : ""}
                      >
                        {f.estado === "aprovada" ? t("Aprovada") : f.estado === "rejeitada" ? t("Rejeitada") : t("Pendente")}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {f.estado === "pendente" && podeAprovar && (
                        <>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => aprovar(f)}>
                            <Check className="mr-1 h-3 w-3" />
                            {t("Aprovar")}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t("Rejeitar")}
                            onClick={async () => {
                              await atualizar("faturasFornecedor", f.id!, { estado: "rejeitada" })
                              await carregar()
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {podeMexer(f) && (
                        <>
                          <Button size="icon" variant="ghost" title={t("Editar")} aria-label={t("Editar fatura")} onClick={() => editar(f)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title={t("Eliminar")} aria-label={t("Eliminar fatura")} onClick={() => excluir(f)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!nova} onOpenChange={(a) => !a && fechar()}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{emEdicao ? t("Editar fatura de fornecedor") : t("Registar fatura de fornecedor")}</DialogTitle>
            <DialogDescription>
              {t("Valores sem IVA. A taxa de IVA serve para a conta a pagar.")}
              {emEdicao?.estado === "aprovada"
                ? " " + t("Esta fatura já está aprovada: a conta a pagar é atualizada em conjunto.")
                : ""}
            </DialogDescription>
          </DialogHeader>
          {nova && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("Fornecedor")}</Label>
                  <Input aria-label={t("Fornecedor")} value={nova.fornecedor} onChange={(e) => setNova({ ...nova, fornecedor: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>{t("N.º da fatura")}</Label>
                  <Input aria-label={t("Número da fatura")} value={nova.numero} onChange={(e) => setNova({ ...nova, numero: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t("Obra")}</Label>
                <SeletorComBusca
                  valor={nova.orcamentoId || ""}
                  onChange={(orcamentoId) => setNova({ ...nova, orcamentoId })}
                  placeholder={t("Escolha a obra")}
                  placeholderBusca={t("Procurar obra...")}
                  vazio={t("Nenhuma obra.")}
                  opcoes={obras.map((o) => ({ valor: o.id!, rotulo: numeroCompleto(o, configuracao), detalhe: o.cliente.nome }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("Tipo de custo")}</Label>
                  <Select value={nova.tipo} onValueChange={(tipo) => setNova({ ...nova, tipo: tipo as TipoLancamentoObra })}>
                    <SelectTrigger aria-label={t("Tipo de custo")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPOS_LANCAMENTO) as TipoLancamentoObra[]).map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>{t(TIPOS_LANCAMENTO[tipo].nome)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("Descrição")}</Label>
                  <Input aria-label={t("Descrição")} value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label>{t("Valor s/ IVA")}</Label>
                  <CampoNumerico min={0} aria-label={t("Valor sem IVA")} value={nova.valorSemIVA} onChange={(valorSemIVA) => setNova({ ...nova, valorSemIVA })} />
                </div>
                <div className="space-y-1">
                  <Label>{t("IVA")}</Label>
                  <CampoNumerico min={0} max={100} sufixo="%" aria-label={t("IVA")} value={nova.taxaIVA} onChange={(taxaIVA) => setNova({ ...nova, taxaIVA })} />
                </div>
                <div className="space-y-1">
                  <Label>{t("Data")}</Label>
                  <Input type="date" value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>{t("Vencimento")}</Label>
                  <Input type="date" value={nova.vencimento} onChange={(e) => setNova({ ...nova, vencimento: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={fechar}>{t("Cancelar")}</Button>
                <Button onClick={gravar} className="rounded-full">{emEdicao ? t("Guardar") : t("Registar")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
