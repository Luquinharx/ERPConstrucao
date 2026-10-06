"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowDownToLine, ArrowLeft, Loader2, Plus, ShoppingCart, X } from "lucide-react"

import { MovimentoDialog } from "@/components/estoque/movimento-dialog"
import { SemAcesso } from "@/components/sem-acesso"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { TIPOS_LANCAMENTO, apurarObra, custoMovimento, podeApurar, totalLancamento } from "@/lib/apuramento-obra"
import { FirebaseService, getMovimentosDaObra } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { custoHoraFuncionario } from "@/lib/produto-calculos"
import type {
  Funcionario,
  LancamentoObra,
  Material,
  MovimentoEstoque,
  Orcamento,
  TipoLancamentoObra,
} from "@/lib/types"
import { formatCurrency, formatDate, formatNumber2, hojeLocal, round2 } from "@/lib/utils"

const novoId = () => `lanc-${Date.now()}-${Math.round(Math.random() * 1000)}`
const hoje = hojeLocal

const novoLancamento = (tipo: TipoLancamentoObra): LancamentoObra => ({
  id: novoId(),
  tipo,
  descricao: "",
  data: hoje(),
  quantidade: tipo === "mao_obra" ? 8 : 1,
  valorUnitario: 0,
})

/** Diferenca real - previsto: positiva = gastou-se mais do que o previsto (mau). */
function Diferenca({ previsto, real }: { previsto: number | null; real: number | null }) {
  if (previsto === null || real === null) return <span className="text-muted-foreground">-</span>
  const d = round2(real - previsto)
  if (d === 0) return <span className="text-muted-foreground">0,00 €</span>
  return (
    <span className={d > 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
      {d > 0 ? "+" : ""}
      {formatCurrency(d)}
    </span>
  )
}

/**
 * Apuramento da obra: vendido x custo previsto x custo real.
 *
 * Substitui a antiga folha de custos reais. O material so entra pelo
 * estoque (saidas ligadas a obra); mao de obra, terceiros e outros custos
 * lancam-se aqui, normalmente quando se vai faturar.
 */
export default function ApuramentoObraPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode, carregando: permissoesACarregar } = usePermissoes()
  const podeLancar = pode("orcamentos.custosObra")
  const podeMovimentar = pode("materiais.gerir")

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([])
  const [produtos, setProdutos] = useState<Material[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoObra[]>([])
  const [gravados, setGravados] = useState("[]")
  const [aCarregar, setACarregar] = useState(true)
  const [aGravar, setAGravar] = useState(false)
  const [dialogo, setDialogo] = useState<"saida" | "compra" | null>(null)

  const carregarMovimentos = useCallback(async () => {
    if (!id) return
    setMovimentos(await getMovimentosDaObra(id).catch(() => []))
  }, [id])

  const carregar = useCallback(async () => {
    if (!user || !id) return
    try {
      const [lista, materiais, equipa] = await Promise.all([
        FirebaseService.getOrcamentos(user.uid),
        FirebaseService.getMateriais(user.uid).catch(() => [] as Material[]),
        FirebaseService.getFuncionarios(user.uid).catch(() => [] as Funcionario[]),
      ])
      const atual = lista.find((o) => o.id === id) || null
      setOrcamento(atual)
      setProdutos(materiais.sort((a, b) => a.nome.localeCompare(b.nome)))
      setFuncionarios(equipa.filter((f) => f.ativo !== false))
      const iniciais = atual?.lancamentosObra || []
      setLancamentos(iniciais)
      setGravados(JSON.stringify(iniciais))
      await carregarMovimentos()
    } catch (error) {
      console.error("Erro ao carregar apuramento:", error)
      toast({ title: "Erro ao carregar a obra", variant: "destructive" })
    } finally {
      setACarregar(false)
    }
  }, [user, id, carregarMovimentos])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const apuramento = useMemo(
    () => (orcamento ? apurarObra(orcamento, movimentos, lancamentos) : null),
    [orcamento, movimentos, lancamentos],
  )
  const saidas = movimentos.filter((m) => m.tipo === "saida")
  const porGravar = JSON.stringify(lancamentos) !== gravados

  const alterar = (lid: string, parcial: Partial<LancamentoObra>) =>
    setLancamentos((atual) => atual.map((l) => (l.id === lid ? { ...l, ...parcial } : l)))
  const remover = (lid: string) => setLancamentos((atual) => atual.filter((l) => l.id !== lid))
  const adicionar = (tipo: TipoLancamentoObra) => setLancamentos((atual) => [...atual, novoLancamento(tipo)])

  const escolherFuncionario = (lid: string, funcionarioId: string) => {
    const f = funcionarios.find((x) => x.id === funcionarioId)
    if (!f) return
    alterar(lid, { funcionarioId, descricao: f.nome, valorUnitario: custoHoraFuncionario(f) })
  }

  const gravar = async () => {
    if (!orcamento?.id) return
    const limpos = lancamentos
      .filter((l) => l.descricao.trim() || totalLancamento(l) > 0)
      .map((l) => ({
        ...l,
        descricao: l.descricao.trim() || TIPOS_LANCAMENTO[l.tipo].nome,
        fornecedor: l.fornecedor?.trim() || undefined,
        documento: l.documento?.trim() || undefined,
        quantidade: round2(l.quantidade),
        valorUnitario: round2(l.valorUnitario),
      }))
    setAGravar(true)
    try {
      await FirebaseService.updateOrcamento(orcamento.id, { lancamentosObra: limpos })
      setLancamentos(limpos)
      setGravados(JSON.stringify(limpos))
      toast({ title: "Apuramento gravado" })
    } catch {
      toast({ title: "Nao foi possivel gravar", variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }

  const voltar = () => router.push("/orcamentos")

  if (permissoesACarregar || aCarregar) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!pode("orcamentos.verCusto")) return <SemAcesso area="Apuramento da obra" requisito="a permissao de ver custos e margem" />
  if (!orcamento || !apuramento) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-medium">Proposta nao encontrada</p>
          <Button onClick={voltar} className="mt-4 rounded-full">
            Voltar aos orcamentos
          </Button>
        </CardContent>
      </Card>
    )
  }

  const vendidoMaoObra = apuramento.blocos.find((b) => b.id === "mao_obra")?.vendido ?? 0
  const maoObra = lancamentos.filter((l) => l.tipo === "mao_obra")
  const outros = lancamentos.filter((l) => l.tipo !== "mao_obra")

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={voltar} className="rounded-full" title="Voltar aos orcamentos">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Apuramento da obra {numeroCompleto(orcamento, configuracao)}</h1>
            <p className="text-sm text-muted-foreground">{orcamento.cliente.nome} · vendido x previsto x real, sem IVA</p>
          </div>
        </div>
        {!podeApurar(orcamento) && (
          <Badge variant="outline" className="border-amber-500/40 text-amber-700">
            Ainda nao adjudicada: o real so faz sentido depois da obra
          </Badge>
        )}
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="resumo-apuramento">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Venda (sem IVA)</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(apuramento.venda)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Custo previsto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(apuramento.custoPrevisto)}</div>
            <p className="text-sm text-muted-foreground">
              Lucro previsto {formatCurrency(apuramento.lucroPrevisto)} ({formatNumber2(apuramento.margemPrevista)}%)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Custo real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums" data-testid="custo-real">
              {formatCurrency(apuramento.custoReal)}
            </div>
            <p className="text-sm text-muted-foreground">
              {apuramento.temReal ? "Material do estoque + lancamentos" : "Ainda sem custos reais lancados"}
            </p>
          </CardContent>
        </Card>
        <Card className={apuramento.temReal && apuramento.lucroReal < apuramento.lucroPrevisto ? "border-destructive/50" : undefined}>
          <CardHeader className="pb-1">
            <CardDescription>Lucro real</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${apuramento.lucroReal < 0 ? "text-destructive" : ""}`}
              data-testid="lucro-real"
            >
              {apuramento.temReal ? formatCurrency(apuramento.lucroReal) : "-"}
            </div>
            {apuramento.temReal && (
              <p className="text-sm text-muted-foreground">
                {formatNumber2(apuramento.margemReal)}% da venda ·{" "}
                {apuramento.lucroReal === apuramento.lucroPrevisto ? (
                  "igual ao previsto"
                ) : (
                  <span className={apuramento.lucroReal < apuramento.lucroPrevisto ? "text-destructive" : "text-emerald-600"}>
                    {formatCurrency(Math.abs(round2(apuramento.lucroReal - apuramento.lucroPrevisto)))}{" "}
                    {apuramento.lucroReal < apuramento.lucroPrevisto ? "abaixo" : "acima"} do previsto
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Por bloco */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Por bloco</CardTitle>
          <CardDescription>
            Vendido e previsto vem do orcamento (antes da margem global de {formatCurrency(apuramento.margemGlobal)}).
            Diferenca a vermelho = gastou-se mais do que o previsto.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <Table data-testid="tabela-blocos">
            <TableHeader>
              <TableRow>
                <TableHead>Bloco</TableHead>
                <TableHead className="text-right">Vendido</TableHead>
                <TableHead className="text-right">Custo previsto</TableHead>
                <TableHead className="text-right">Custo real</TableHead>
                <TableHead className="text-right">Diferenca</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apuramento.blocos
                .filter((b) => (b.vendido ?? 0) !== 0 || (b.previsto ?? 0) !== 0 || (b.real ?? 0) !== 0)
                .map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{b.nome}</div>
                      {b.ajuda && <div className="text-xs text-muted-foreground">{b.ajuda}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.vendido === null ? "-" : formatCurrency(b.vendido)}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.previsto === null ? "-" : formatCurrency(b.previsto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.real === null ? "-" : formatCurrency(b.real)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Diferenca previsto={b.previsto ?? (b.real !== null ? 0 : null)} real={b.real} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(apuramento.venda)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(apuramento.custoPrevisto)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(apuramento.custoReal)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <Diferenca previsto={apuramento.custoPrevisto} real={apuramento.custoReal} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Material: so pelo estoque */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Material da obra</CardTitle>
            <CardDescription>
              Entra so pelo estoque: saidas para esta obra, ou compras feitas para ela (entram e saem logo).
            </CardDescription>
          </div>
          {podeMovimentar && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setDialogo("saida")}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Saida do estoque
              </Button>
              <Button className="rounded-full" onClick={() => setDialogo("compra")}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Compra para esta obra
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {saidas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum material saiu ainda para esta obra.
                  </TableCell>
                </TableRow>
              ) : (
                saidas.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(m.data)}</TableCell>
                    <TableCell className="font-medium">{m.materialNome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[m.fornecedor ? `Compra · ${m.fornecedor}` : "Estoque", m.documento].filter(Boolean).join(" · ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber2(m.quantidade)} {m.unidade}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.custoUnitario || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(custoMovimento(m))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mao de obra real */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Mao de obra real</CardTitle>
            <CardDescription>
              Vendido no orcamento: <span className="font-medium">{formatCurrency(vendidoMaoObra)}</span>. Ao faturar,
              informe o que se gastou: escolha o funcionario (puxa o custo/hora) ou escreva o valor.
            </CardDescription>
          </div>
          {podeLancar && (
            <Button variant="outline" className="rounded-full" onClick={() => adicionar("mao_obra")}>
              <Plus className="mr-2 h-4 w-4" />
              Mao de obra
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {maoObra.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mao de obra lancada.</p>}
          {maoObra.map((l) => (
            <div
              key={l.id}
              data-testid="linha-mao-obra"
              className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1.4fr_1.4fr_100px_120px_120px_auto]"
            >
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Funcionario</span>
                <SeletorComBusca
                  valor={l.funcionarioId || ""}
                  onChange={(fid) => escolherFuncionario(l.id, fid)}
                  placeholder="Opcional"
                  placeholderBusca="Procurar funcionario..."
                  vazio="Nenhum funcionario."
                  opcoes={funcionarios.map((f) => ({
                    valor: f.id!,
                    rotulo: f.nome,
                    detalhe: `${f.funcao} · ${formatCurrency(custoHoraFuncionario(f))}/h`,
                  }))}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Descricao</span>
                <Input
                  value={l.descricao}
                  disabled={!podeLancar}
                  onChange={(e) => alterar(l.id, { descricao: e.target.value })}
                  placeholder={TIPOS_LANCAMENTO.mao_obra.exemplo}
                  aria-label="Descricao da mao de obra"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Horas</span>
                <CampoNumerico
                  min={0}
                  value={l.quantidade}
                  disabled={!podeLancar}
                  aria-label="Horas"
                  onChange={(quantidade) => alterar(l.id, { quantidade })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Custo/hora</span>
                <CampoNumerico
                  min={0}
                  sufixo="EUR"
                  value={l.valorUnitario}
                  disabled={!podeLancar}
                  aria-label="Custo por hora"
                  onChange={(valorUnitario) => alterar(l.id, { valorUnitario })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Total</span>
                <div className="flex h-10 items-center justify-end rounded-md bg-muted px-3 text-sm font-medium tabular-nums">
                  {formatCurrency(totalLancamento(l))}
                </div>
              </div>
              {podeLancar && (
                <Button variant="ghost" size="icon" title="Remover" onClick={() => remover(l.id)} className="text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Terceiros e outros custos */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Servicos de terceiros e outros custos</CardTitle>
            <CardDescription>Subempreitadas, aluguer de equipamento, transporte, vazadouro... Valores sem IVA.</CardDescription>
          </div>
          {podeLancar && (
            <Button variant="outline" className="rounded-full" onClick={() => adicionar("terceiros")}>
              <Plus className="mr-2 h-4 w-4" />
              Custo
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {outros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum custo lancado.</p>}
          {outros.map((l) => (
            <div
              key={l.id}
              data-testid="linha-outro-custo"
              className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-[180px_1.5fr_1fr_1fr_90px_120px_120px_auto]"
            >
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Tipo</span>
                <Select
                  value={l.tipo}
                  disabled={!podeLancar}
                  onValueChange={(tipo) => alterar(l.id, { tipo: tipo as TipoLancamentoObra })}
                >
                  <SelectTrigger aria-label="Tipo de custo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPOS_LANCAMENTO) as TipoLancamentoObra[])
                      .filter((t) => t !== "mao_obra")
                      .map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIPOS_LANCAMENTO[t].nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Descricao</span>
                <Input
                  value={l.descricao}
                  disabled={!podeLancar}
                  onChange={(e) => alterar(l.id, { descricao: e.target.value })}
                  placeholder={TIPOS_LANCAMENTO[l.tipo].exemplo}
                  aria-label="Descricao do custo"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Fornecedor</span>
                <Input
                  value={l.fornecedor || ""}
                  disabled={!podeLancar}
                  onChange={(e) => alterar(l.id, { fornecedor: e.target.value })}
                  aria-label="Fornecedor"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Fatura</span>
                <Input
                  value={l.documento || ""}
                  disabled={!podeLancar}
                  onChange={(e) => alterar(l.id, { documento: e.target.value })}
                  aria-label="Fatura"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Qtd.</span>
                <CampoNumerico
                  min={0}
                  value={l.quantidade}
                  disabled={!podeLancar}
                  aria-label="Quantidade"
                  onChange={(quantidade) => alterar(l.id, { quantidade })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Valor sem IVA</span>
                <CampoNumerico
                  min={0}
                  sufixo="EUR"
                  value={l.valorUnitario}
                  disabled={!podeLancar}
                  aria-label="Valor sem IVA"
                  onChange={(valorUnitario) => alterar(l.id, { valorUnitario })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Total</span>
                <div className="flex h-10 items-center justify-end rounded-md bg-muted px-3 text-sm font-medium tabular-nums">
                  {formatCurrency(totalLancamento(l))}
                </div>
              </div>
              {podeLancar && (
                <Button variant="ghost" size="icon" title="Remover" onClick={() => remover(l.id)} className="text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {podeLancar && (
        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <div className="text-sm">
            <span className="text-muted-foreground">Lucro real: </span>
            <span className="font-semibold tabular-nums">
              {apuramento.temReal ? formatCurrency(apuramento.lucroReal) : "-"}
            </span>
            {porGravar && <span className="ml-3 text-amber-600">Alteracoes por gravar</span>}
          </div>
          <Button onClick={gravar} disabled={aGravar || !porGravar} className="rounded-full">
            {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gravar apuramento
          </Button>
        </div>
      )}

      <MovimentoDialog
        open={dialogo !== null}
        onOpenChange={(aberto) => !aberto && setDialogo(null)}
        produtos={produtos}
        tipoInicial={dialogo || "saida"}
        obra={orcamento}
        onRegistado={carregarMovimentos}
      />
    </div>
  )
}
