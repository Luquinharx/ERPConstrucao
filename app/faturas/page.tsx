"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Plus, Trash2, X } from "lucide-react"

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
      return toast({ title: "Indique fornecedor, numero e valor", variant: "destructive" })
    const obra = obras.find((o) => o.id === nova.orcamentoId)
    await criar("faturasFornecedor", {
      ...nova,
      fornecedor: nova.fornecedor.trim(),
      numero: nova.numero.trim(),
      descricao: nova.descricao.trim(),
      valorSemIVA: round2(nova.valorSemIVA),
      orcamentoId: obra?.id || "",
      orcamentoNumero: obra ? numeroCompleto(obra, configuracao) : "",
      estado: "pendente",
      userId: user.uid,
    })
    toast({ title: "Fatura registada", description: "Fica pendente ate ser aprovada." })
    setNova(null)
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
        descricao: `Fatura ${f.numero}${f.descricao ? ` - ${f.descricao}` : ""}`,
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
    toast({ title: "Fatura aprovada", description: `Conta a pagar de ${formatCurrency(comIVA)} criada.` })
    await carregar()
  }

  if (aCarregar) return <LoadingSpinner size="lg" />
  const pendentes = faturas.filter((f) => f.estado === "pendente").length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Faturas de fornecedor</h1>
          <p className="mt-2 text-muted-foreground">
            Subempreitadas, aluguer, transporte e outros custos. Aprovadas, entram no custo da obra e nas contas a pagar.
          </p>
        </div>
        {podeLancar && (
          <Button onClick={() => setNova(vazia())} className="rounded-full">
            <Plus className="mr-2 h-4 w-4" />
            Registar fatura
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Faturas</CardTitle>
          <CardDescription>{pendentes} por aprovar. O material compra-se pelo estoque (entrada ou compra para a obra).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="tabela-faturas">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor / fatura</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Sem IVA</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sem faturas.</TableCell></TableRow>
              ) : (
                faturas.map((f) => (
                  <TableRow key={f.id} data-testid="linha-fatura">
                    <TableCell className="whitespace-nowrap">{formatDate(f.data)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{f.fornecedor}</div>
                      <div className="text-xs text-muted-foreground">{f.numero}{f.descricao ? ` · ${f.descricao}` : ""}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{f.orcamentoNumero || "-"}</TableCell>
                    <TableCell className="text-sm">{TIPOS_LANCAMENTO[f.tipo].nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(f.valorSemIVA)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={f.estado === "aprovada" ? "border-emerald-500/40 text-emerald-700" : f.estado === "rejeitada" ? "border-rose-500/40 text-rose-700" : ""}
                      >
                        {f.estado === "aprovada" ? "Aprovada" : f.estado === "rejeitada" ? "Rejeitada" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {f.estado === "pendente" && podeAprovar && (
                        <>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => aprovar(f)}>
                            <Check className="mr-1 h-3 w-3" />
                            Aprovar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Rejeitar"
                            onClick={async () => {
                              await atualizar("faturasFornecedor", f.id!, { estado: "rejeitada" })
                              await carregar()
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {f.estado !== "aprovada" && podeLancar && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Apagar"
                          onClick={async () => {
                            if (!confirm("Apagar esta fatura?")) return
                            await apagar("faturasFornecedor", f.id!)
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

      <Dialog open={!!nova} onOpenChange={(a) => !a && setNova(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Registar fatura de fornecedor</DialogTitle>
            <DialogDescription>Valores sem IVA. A taxa de IVA serve para a conta a pagar.</DialogDescription>
          </DialogHeader>
          {nova && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fornecedor</Label>
                  <Input aria-label="Fornecedor" value={nova.fornecedor} onChange={(e) => setNova({ ...nova, fornecedor: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>N.o da fatura</Label>
                  <Input aria-label="Numero da fatura" value={nova.numero} onChange={(e) => setNova({ ...nova, numero: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Obra</Label>
                <SeletorComBusca
                  valor={nova.orcamentoId || ""}
                  onChange={(orcamentoId) => setNova({ ...nova, orcamentoId })}
                  placeholder="Escolha a obra"
                  placeholderBusca="Procurar obra..."
                  vazio="Nenhuma obra."
                  opcoes={obras.map((o) => ({ valor: o.id!, rotulo: numeroCompleto(o, configuracao), detalhe: o.cliente.nome }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo de custo</Label>
                  <Select value={nova.tipo} onValueChange={(tipo) => setNova({ ...nova, tipo: tipo as TipoLancamentoObra })}>
                    <SelectTrigger aria-label="Tipo de custo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPOS_LANCAMENTO) as TipoLancamentoObra[]).map((t) => (
                        <SelectItem key={t} value={t}>{TIPOS_LANCAMENTO[t].nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Descricao</Label>
                  <Input aria-label="Descricao" value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label>Valor s/ IVA</Label>
                  <CampoNumerico min={0} aria-label="Valor sem IVA" value={nova.valorSemIVA} onChange={(valorSemIVA) => setNova({ ...nova, valorSemIVA })} />
                </div>
                <div className="space-y-1">
                  <Label>IVA</Label>
                  <CampoNumerico min={0} max={100} sufixo="%" aria-label="IVA" value={nova.taxaIVA} onChange={(taxaIVA) => setNova({ ...nova, taxaIVA })} />
                </div>
                <div className="space-y-1">
                  <Label>Data</Label>
                  <Input type="date" value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Vencimento</Label>
                  <Input type="date" value={nova.vencimento} onChange={(e) => setNova({ ...nova, vencimento: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNova(null)}>Cancelar</Button>
                <Button onClick={gravar} className="rounded-full">Registar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
