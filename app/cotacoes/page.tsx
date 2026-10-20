"use client"

import { useCallback, useEffect, useState } from "react"
import { Award, Plus, Trash2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { apagar, atualizar, criar, listar } from "@/lib/firebase-service"
import { maisBarato, totalFornecedor } from "@/lib/cotacoes"
import type { Cotacao } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

const uid = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`

/**
 * Cotacoes: o mesmo pedido a varios fornecedores, as respostas lado a lado.
 * O "Mapa comparativo" que a folha fazia a mao.
 */
export default function CotacoesPage() {
  const { user } = useAuth()
  const { pode } = usePermissoes()
  const podeGerir = pode("materiais.gerir")
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [aberta, setAberta] = useState<Cotacao | null>(null)
  const [aCarregar, setACarregar] = useState(true)

  const carregar = useCallback(async () => {
    try {
      setCotacoes((await listar<Cotacao>("cotacoes")).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
    } finally {
      setACarregar(false)
    }
  }, [])
  useEffect(() => {
    void carregar()
  }, [carregar])

  const nova = async () => {
    if (!user) return
    const dados = {
      titulo: "Nova cotacao",
      itens: [{ id: uid(), descricao: "", unidade: "un", quantidade: 1 }],
      fornecedores: [{ id: uid(), nome: "", precos: {} }],
      estado: "aberta",
      userId: user.uid,
    }
    const id = await criar("cotacoes", dados)
    await carregar()
    setAberta({ ...(dados as Omit<Cotacao, "id" | "createdAt">), id, createdAt: new Date() })
  }

  const gravar = async (c: Cotacao) => {
    if (!c.id) return
    const { id, createdAt, ...resto } = c
    await atualizar("cotacoes", id, resto as Record<string, unknown>)
    toast({ title: "Cotacao gravada" })
    await carregar()
  }

  if (aCarregar) return <LoadingSpinner size="lg" />

  if (aberta) {
    const c = aberta
    const barato = maisBarato(c)
    const set = (p: Partial<Cotacao>) => setAberta({ ...c, ...p })
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input value={c.titulo} onChange={(e) => set({ titulo: e.target.value })} className="max-w-md text-lg font-semibold" aria-label="Titulo da cotacao" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAberta(null)}>Voltar</Button>
            {podeGerir && <Button onClick={() => gravar(c)} className="rounded-full">Gravar</Button>}
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mapa comparativo</CardTitle>
            <CardDescription>Preco unitario sem IVA de cada fornecedor. O mais barato (com resposta a tudo) fica destacado.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table data-testid="mapa-comparativo">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Item</TableHead>
                  <TableHead className="w-24">Qtd.</TableHead>
                  {c.fornecedores.map((f) => (
                    <TableHead key={f.id} className={`min-w-40 ${f.id === barato ? "bg-emerald-500/10" : ""}`}>
                      <div className="flex items-center gap-1">
                        <Input
                          value={f.nome}
                          placeholder="Fornecedor"
                          aria-label="Nome do fornecedor"
                          className="h-8"
                          onChange={(e) => set({ fornecedores: c.fornecedores.map((x) => (x.id === f.id ? { ...x, nome: e.target.value } : x)) })}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set({ fornecedores: c.fornecedores.filter((x) => x.id !== f.id) })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead>
                    <Button size="sm" variant="outline" onClick={() => set({ fornecedores: [...c.fornecedores, { id: uid(), nome: "", precos: {} }] })}>
                      <Plus className="mr-1 h-3 w-3" />
                      Fornecedor
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.itens.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          value={i.descricao}
                          placeholder="Material ou servico"
                          aria-label="Item"
                          className="h-8"
                          onChange={(e) => set({ itens: c.itens.map((x) => (x.id === i.id ? { ...x, descricao: e.target.value } : x)) })}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => set({ itens: c.itens.filter((x) => x.id !== i.id) })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CampoNumerico tamanho="sm" min={0} aria-label="Quantidade" value={i.quantidade} onChange={(quantidade) => set({ itens: c.itens.map((x) => (x.id === i.id ? { ...x, quantidade } : x)) })} />
                    </TableCell>
                    {c.fornecedores.map((f) => (
                      <TableCell key={f.id} className={f.id === barato ? "bg-emerald-500/10" : ""}>
                        <CampoNumerico
                          tamanho="sm"
                          min={0}
                          sufixo="EUR"
                          aria-label={`Preco ${f.nome || "fornecedor"} ${i.descricao}`}
                          value={f.precos[i.id] || 0}
                          onChange={(preco) => set({ fornecedores: c.fornecedores.map((x) => (x.id === f.id ? { ...x, precos: { ...x.precos, [i.id]: preco } } : x)) })}
                        />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>
                    <Button size="sm" variant="outline" onClick={() => set({ itens: [...c.itens, { id: uid(), descricao: "", unidade: "un", quantidade: 1 }] })}>
                      <Plus className="mr-1 h-3 w-3" />
                      Item
                    </Button>
                  </TableCell>
                  {c.fornecedores.map((f) => (
                    <TableCell key={f.id} className={f.id === barato ? "bg-emerald-500/10" : ""}>
                      <div className="font-semibold tabular-nums" data-testid="total-fornecedor">{formatCurrency(totalFornecedor(c, f.id))}</div>
                      {podeGerir && (
                        <Button
                          size="sm"
                          variant={c.adjudicadoA === f.id ? "default" : "outline"}
                          className="mt-1 h-7 rounded-full text-xs"
                          onClick={() => set({ adjudicadoA: f.id, estado: "adjudicada" })}
                        >
                          <Award className="mr-1 h-3 w-3" />
                          {c.adjudicadoA === f.id ? "Adjudicado" : "Adjudicar"}
                        </Button>
                      )}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Cotacoes</h1>
          <p className="mt-2 text-muted-foreground">Pede-se o mesmo a varios fornecedores e comparam-se as respostas.</p>
        </div>
        {podeGerir && (
          <Button onClick={nova} className="rounded-full">
            <Plus className="mr-2 h-4 w-4" />
            Nova cotacao
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cotacoes.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">Sem cotacoes.</CardContent></Card>}
        {cotacoes.map((c) => {
          const vencedor = c.fornecedores.find((f) => f.id === c.adjudicadoA)
          return (
            <Card key={c.id} className="cursor-pointer hover:border-primary" onClick={() => setAberta(c)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{c.titulo}</CardTitle>
                  <Badge variant="outline">{c.estado === "adjudicada" ? "Adjudicada" : "Aberta"}</Badge>
                </div>
                <CardDescription>{c.itens.length} item(s) · {c.fornecedores.length} fornecedor(es)</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <span>{vencedor ? `${vencedor.nome}: ${formatCurrency(totalFornecedor(c, vencedor.id))}` : "Por decidir"}</span>
                {podeGerir && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (!c.id || !confirm("Apagar esta cotacao?")) return
                      await apagar("cotacoes", c.id)
                      await carregar()
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
