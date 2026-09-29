"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, X } from "lucide-react"

import { MovimentoDialog } from "@/components/estoque/movimento-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { useSearchQuery } from "@/hooks/use-search-query"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { toast } from "@/hooks/use-toast"
import { FirebaseService, getMovimentosEstoque } from "@/lib/firebase-service"
import { TIPOS_MOVIMENTO, custoDoProduto, estoqueBaixo } from "@/lib/produto-calculos"
import type { Material, MovimentoEstoque, TipoMovimentoEstoque } from "@/lib/types"
import { formatCurrency, formatDate, formatNumber2, matchesSearch, round2 } from "@/lib/utils"

/**
 * Estoque: o saldo de cada produto e o historico que o explica.
 *
 * So entram aqui os produtos com "Controlar estoque" ligado no cadastro.
 */
export default function EstoquePage() {
  const { user } = useAuth()
  const { pode } = usePermissoes()
  const podeMovimentar = pode("materiais.gerir")
  const { configuracao } = useConfiguracao()
  const grupos = configuracao.gruposImpostos || []

  const [produtos, setProdutos] = useState<Material[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [aba, setAba] = useState("saldos")
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoMovimentoEstoque>("todos")
  const [dialogo, setDialogo] = useState<{ produtoId?: string; tipo: TipoMovimentoEstoque } | null>(null)
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const carregar = useCallback(async () => {
    if (!user) return
    try {
      const [materiais, lista] = await Promise.all([FirebaseService.getMateriais(user.uid), getMovimentosEstoque()])
      setProdutos(materiais.filter((m) => m.controlaEstoque).sort((a, b) => a.nome.localeCompare(b.nome)))
      setMovimentos(lista)
    } catch (error) {
      console.error("Erro ao carregar estoque:", error)
      toast({ title: "Erro ao carregar estoque", variant: "destructive" })
    } finally {
      setACarregar(false)
    }
  }, [user])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const produtosFiltrados = useMemo(
    () => produtos.filter((p) => !searchTerm.trim() || matchesSearch(searchTerm, [p.codigo, p.nome, p.fornecedor])),
    [produtos, searchTerm],
  )

  const movimentosFiltrados = useMemo(
    () =>
      movimentos.filter(
        (m) =>
          (filtroTipo === "todos" || m.tipo === filtroTipo) &&
          (!searchTerm.trim() ||
            matchesSearch(searchTerm, [m.materialNome, m.documento, m.fornecedor, m.orcamentoNumero, m.observacoes])),
      ),
    [movimentos, filtroTipo, searchTerm],
  )

  const valorEmEstoque = round2(
    produtos.reduce(
      (soma, p) => soma + (Number(p.estoqueAtual) || 0) * (Number(p.custoMedio) || custoDoProduto(p, grupos)),
      0,
    ),
  )
  const emBaixo = produtos.filter(estoqueBaixo).length

  if (aCarregar) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Estoque</h1>
          <p className="text-muted-foreground mt-2">Entradas, saidas e saldo de cada produto</p>
        </div>
        {podeMovimentar && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialogo({ tipo: "entrada" })} className="rounded-full">
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Entrada
            </Button>
            <Button variant="outline" onClick={() => setDialogo({ tipo: "saida" })} className="rounded-full">
              <ArrowUpFromLine className="h-4 w-4 mr-2" />
              Saida
            </Button>
            <Button variant="outline" onClick={() => setDialogo({ tipo: "ajuste" })} className="rounded-full">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Ajuste
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produtos controlados</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{produtos.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor em estoque (custo medio)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(valorEmEstoque)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Abaixo do minimo</CardTitle>
          </CardHeader>
          <CardContent className={`text-2xl font-bold ${emBaixo > 0 ? "text-rose-600" : ""}`}>{emBaixo}</CardContent>
        </Card>
      </div>

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearSearch}
        placeholder="Buscar produto, documento, obra..."
        resultCount={aba === "saldos" ? produtosFiltrados.length : movimentosFiltrados.length}
        totalCount={aba === "saldos" ? produtos.length : movimentos.length}
      >
        {aba === "movimentos" && (
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saidas</SelectItem>
              <SelectItem value="ajuste">Ajustes</SelectItem>
            </SelectContent>
          </Select>
        )}
        {searchTerm.trim() && (
          <Button variant="ghost" onClick={clearSearch} className="rounded-full text-muted-foreground">
            <X className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        )}
      </ListToolbar>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
          <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="saldos" className="pt-4">
          {produtos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum produto com controlo de estoque</h3>
                <p className="text-muted-foreground">
                  Em Produtos, ligue &quot;Controlar estoque deste produto&quot; nos que quer acompanhar.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Minimo</TableHead>
                    <TableHead className="text-right">Custo medio</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {podeMovimentar && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosFiltrados.map((p) => {
                    const saldo = Number(p.estoqueAtual) || 0
                    const medio = Number(p.custoMedio) || custoDoProduto(p, grupos)
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">
                            {p.codigo && <span className="text-muted-foreground mr-1">{p.codigo}</span>}
                            {p.nome}
                          </div>
                          {estoqueBaixo(p) && (
                            <Badge variant="outline" className="border-rose-500/40 text-rose-600 text-[10px] mt-1">
                              Estoque baixo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber2(saldo)} {p.unidade}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatNumber2(p.estoqueMinimo || 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(medio)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(round2(saldo * medio))}</TableCell>
                        {podeMovimentar && (
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Entrada"
                              onClick={() => setDialogo({ produtoId: p.id, tipo: "entrada" })}
                            >
                              <ArrowDownToLine className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Saida"
                              onClick={() => setDialogo({ produtoId: p.id, tipo: "saida" })}
                            >
                              <ArrowUpFromLine className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="movimentos" className="pt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Custo unit.</TableHead>
                  <TableHead className="text-right">Saldo apos</TableHead>
                  <TableHead>Origem / destino</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Sem movimentos.
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentosFiltrados.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(m.data)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TIPOS_MOVIMENTO[m.tipo].cor}>
                          {TIPOS_MOVIMENTO[m.tipo].nome}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{m.materialNome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.tipo === "saida" ? "-" : m.tipo === "entrada" ? "+" : "="}
                        {formatNumber2(m.quantidade)} {m.unidade}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.custoUnitario !== undefined ? formatCurrency(m.custoUnitario) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber2(m.saldoApos)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[m.fornecedor, m.orcamentoNumero, m.documento, m.observacoes].filter(Boolean).join(" · ") || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <MovimentoDialog
        open={dialogo !== null}
        onOpenChange={(aberto) => !aberto && setDialogo(null)}
        produtos={produtos}
        produtoInicialId={dialogo?.produtoId}
        tipoInicial={dialogo?.tipo}
        onRegistado={carregar}
      />
    </div>
  )
}
