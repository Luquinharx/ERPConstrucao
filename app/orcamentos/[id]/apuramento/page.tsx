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
import { TIPOS_LANCAMENTO, apurarObra, custoMovimento, necessidadesMaterial, podeApurar, totalLancamento } from "@/lib/apuramento-obra"
import { FirebaseService, getMovimentosDaObra, listar } from "@/lib/firebase-service"
import { CabecalhoObra } from "@/components/obra/cabecalho-obra"
import { custoHoras } from "@/lib/obra"
import { numeroCompleto } from "@/lib/numeracao"
import { custoHoraFuncionario } from "@/lib/produto-calculos"
import type {
  FaturaFornecedor,
  RegistoHoras,
  Funcionario,
  LancamentoObra,
  Material,
  MovimentoEstoque,
  Orcamento,
  TipoLancamentoObra,
} from "@/lib/types"
import { formatCurrency, formatDate, formatNumber2, hojeLocal, round2 } from "@/lib/utils"
import { m, t } from "@/lib/i18n"

/** Pequenas despesas de obra: nome e bloco do apuramento onde entram. */
const DESPESAS_RAPIDAS: Array<[string, TipoLancamentoObra]> = [
  [m("Almoço"), "outros"],
  [m("Gasóleo"), "transporte"],
  [m("Portagem"), "transporte"],
  [m("Estacionamento"), "transporte"],
  [m("Ferramenta"), "outros"],
  [m("Deslocação"), "transporte"],
]

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
  if (d === 0) return <span className="text-muted-foreground">{formatCurrency(0)}</span>
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
  const [horas, setHoras] = useState<RegistoHoras[]>([])
  const [faturas, setFaturas] = useState<FaturaFornecedor[]>([])
  const [despesa, setDespesa] = useState<{ nome: string; tipo: TipoLancamentoObra; valor: number } | null>(null)

  const carregarMovimentos = useCallback(async () => {
    if (!id) return
    setMovimentos(await getMovimentosDaObra(id).catch(() => []))
  }, [id])

  const carregar = useCallback(async () => {
    if (!user || !id) return
    try {
      const [lista, materiais, equipa, registos, faturasObra] = await Promise.all([
        FirebaseService.getOrcamentos(user.uid),
        FirebaseService.getMateriais(user.uid).catch(() => [] as Material[]),
        FirebaseService.getFuncionarios(user.uid).catch(() => [] as Funcionario[]),
        listar<RegistoHoras>("registosHoras", ["orcamentoId", id]).catch(() => [] as RegistoHoras[]),
        listar<FaturaFornecedor>("faturasFornecedor", ["orcamentoId", id]).catch(() => [] as FaturaFornecedor[]),
      ])
      setHoras(registos)
      setFaturas(faturasObra)
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
      toast({ title: t("Erro ao carregar a obra"), variant: "destructive" })
    } finally {
      setACarregar(false)
    }
  }, [user, id, carregarMovimentos])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const apuramento = useMemo(
    () => (orcamento ? apurarObra(orcamento, movimentos, lancamentos, { horas, faturas }) : null),
    [orcamento, movimentos, lancamentos, horas, faturas],
  )
  // Saidas e devolucoes (entradas marcadas como devolucao), as duas mexem no custo da obra
  const saidas = movimentos.filter((m) => m.tipo === "saida" || (m.tipo === "entrada" && m.devolucao))
  const necessidades = useMemo(
    () => (orcamento ? necessidadesMaterial(orcamento, movimentos, produtos) : []),
    [orcamento, movimentos, produtos],
  )
  const horasAprovadas = custoHoras(horas)
  const horasPendentes = horas.filter((h) => h.estado === "pendente").length
  const faturasAprovadas = faturas.filter((f) => f.estado === "aprovada")
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
        descricao: l.descricao.trim() || t(TIPOS_LANCAMENTO[l.tipo].nome),
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
      toast({ title: t("Apuramento guardado") })
    } catch {
      toast({ title: t("Não foi possível guardar"), variant: "destructive" })
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
  if (!pode("orcamentos.verCusto")) return <SemAcesso area={t("Apuramento da obra")} requisito={t("a permissão de ver custos e margem")} />
  if (!orcamento || !apuramento) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-medium">{t("Proposta não encontrada")}</p>
          <Button onClick={voltar} className="mt-4 rounded-full">
            {t("Voltar aos orçamentos")}
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
      <CabecalhoObra orcamento={orcamento} subtitulo={t("vendido × previsto × real, sem IVA")} />
      {!podeApurar(orcamento) && (
        <Badge variant="outline" className="border-amber-500/40 text-amber-700">
          {t("Ainda não adjudicada: o real só faz sentido depois da obra")}
        </Badge>
      )}

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="resumo-apuramento">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>{t("Venda (sem IVA)")}</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(apuramento.venda)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>{t("Custo previsto")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(apuramento.custoPrevisto)}</div>
            <p className="text-sm text-muted-foreground">
              {t("Lucro previsto {valor} ({margem}%)", { valor: formatCurrency(apuramento.lucroPrevisto), margem: formatNumber2(apuramento.margemPrevista) })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>{t("Custo real")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums" data-testid="custo-real">
              {formatCurrency(apuramento.custoReal)}
            </div>
            <p className="text-sm text-muted-foreground">
              {apuramento.temReal ? t("Material do stock + lançamentos") : t("Ainda sem custos reais lançados")}
            </p>
          </CardContent>
        </Card>
        <Card className={apuramento.temReal && apuramento.lucroReal < apuramento.lucroPrevisto ? "border-destructive/50" : undefined}>
          <CardHeader className="pb-1">
            <CardDescription>{t("Lucro real")}</CardDescription>
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
                {t("{margem}% da venda", { margem: formatNumber2(apuramento.margemReal) })} ·{" "}
                {apuramento.lucroReal === apuramento.lucroPrevisto ? (
                  t("igual ao previsto")
                ) : (
                  <span className={apuramento.lucroReal < apuramento.lucroPrevisto ? "text-destructive" : "text-emerald-600"}>
                    {apuramento.lucroReal < apuramento.lucroPrevisto
                      ? t("{valor} abaixo do previsto", { valor: formatCurrency(Math.abs(round2(apuramento.lucroReal - apuramento.lucroPrevisto))) })
                      : t("{valor} acima do previsto", { valor: formatCurrency(Math.abs(round2(apuramento.lucroReal - apuramento.lucroPrevisto))) })}
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
          <CardTitle className="text-lg">{t("Por bloco")}</CardTitle>
          <CardDescription>
            {t("Vendido e previsto vêm do orçamento (antes da margem global de {valor}).", { valor: formatCurrency(apuramento.margemGlobal) })}{" "}
            {t("Diferença a vermelho = gastou-se mais do que o previsto.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <Table data-testid="tabela-blocos">
            <TableHeader>
              <TableRow>
                <TableHead>{t("Bloco")}</TableHead>
                <TableHead className="text-right">{t("Vendido")}</TableHead>
                <TableHead className="text-right">{t("Custo previsto")}</TableHead>
                <TableHead className="text-right">{t("Custo real")}</TableHead>
                <TableHead className="text-right">{t("Diferença")}</TableHead>
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
                <TableCell>{t("Total")}</TableCell>
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
            <CardTitle className="text-lg">{t("Material da obra")}</CardTitle>
            <CardDescription>
              {t("Entra só pelo stock: saídas para esta obra, ou compras feitas para ela (entram e saem logo).")}
            </CardDescription>
          </div>
          {podeMovimentar && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setDialogo("saida")}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                {t("Saída do stock")}
              </Button>
              <Button className="rounded-full" onClick={() => setDialogo("compra")}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t("Compra para esta obra")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Data")}</TableHead>
                <TableHead>{t("Produto")}</TableHead>
                <TableHead>{t("Origem")}</TableHead>
                <TableHead className="text-right">{t("Qtd.")}</TableHead>
                <TableHead className="text-right">{t("Custo unit.")}</TableHead>
                <TableHead className="text-right">{t("Total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {saidas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {t("Ainda não saiu nenhum material para esta obra.")}
                  </TableCell>
                </TableRow>
              ) : (
                saidas.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(m.data)}</TableCell>
                    <TableCell className="font-medium">{m.materialNome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[m.devolucao ? t("Devolução ao armazém") : m.fornecedor ? t("Compra · {fornecedor}", { fornecedor: m.fornecedor }) : t("Stock"), m.documento]
                        .filter(Boolean)
                        .join(" · ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber2(m.quantidade)} {m.unidade}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.custoUnitario || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.devolucao ? "-" : ""}
                      {formatCurrency(custoMovimento(m))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Material que a obra precisa, pela composicao dos itens */}
      {necessidades.length > 0 && (
        <Card data-testid="necessidades">
          <CardHeader>
            <CardTitle className="text-lg">{t("Material previsto vs. saído")}</CardTitle>
            <CardDescription>
              {t("Pela composição dos itens do orçamento. O que falta é a lista de compras da obra, já em embalagens de compra.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Produto")}</TableHead>
                  <TableHead className="text-right">{t("Previsto")}</TableHead>
                  <TableHead className="text-right">{t("Já saiu")}</TableHead>
                  <TableHead className="text-right">{t("Em falta")}</TableHead>
                  <TableHead className="text-right">{t("Comprar")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {necessidades.map((n) => (
                  <TableRow key={n.materialId}>
                    <TableCell className="font-medium">{n.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber2(n.previsto)} {n.unidade}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber2(n.saido)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${n.falta > 0 ? "font-medium" : "text-muted-foreground"}`}>
                      {formatNumber2(n.falta)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {n.comprar ? `${n.comprar.quantidade} ${n.comprar.unidade}` : n.falta > 0 ? `${formatNumber2(n.falta)} ${n.unidade}` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Horas do livro de ponto e faturas aprovadas: entram sozinhas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("Entradas automáticas")}</CardTitle>
          <CardDescription>{t("Não se escrevem aqui: vêm do livro de ponto e das faturas de fornecedor, depois de aprovadas.")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3" data-testid="auto-horas">
            <div className="font-medium">{t("Livro de ponto")}</div>
            <div>
              {t("{horas} h aprovadas · mão de obra {maoObra} · estrutura {estrutura}", {
                horas: formatNumber2(horasAprovadas.horas),
                maoObra: formatCurrency(horasAprovadas.maoObra),
                estrutura: formatCurrency(horasAprovadas.estrutura),
              })}
            </div>
            {horasPendentes > 0 && (
              <div className="text-amber-700">
                {horasPendentes === 1 ? t("{n} registo por aprovar", { n: horasPendentes }) : t("{n} registos por aprovar", { n: horasPendentes })}
              </div>
            )}
            <a href="/horas" className="text-xs text-primary underline">{t("Abrir livro de ponto")}</a>
          </div>
          <div className="rounded-lg border p-3" data-testid="auto-faturas">
            <div className="font-medium">{t("Faturas de fornecedor")}</div>
            <div>
              {faturasAprovadas.length === 1
                ? t("{n} aprovada · {valor} sem IVA", { n: faturasAprovadas.length, valor: formatCurrency(round2(faturasAprovadas.reduce((s, f) => s + f.valorSemIVA, 0))) })
                : t("{n} aprovadas · {valor} sem IVA", { n: faturasAprovadas.length, valor: formatCurrency(round2(faturasAprovadas.reduce((s, f) => s + f.valorSemIVA, 0))) })}
            </div>
            {faturas.length > faturasAprovadas.length && (
              <div className="text-amber-700">{t("{n} por aprovar", { n: faturas.filter((f) => f.estado === "pendente").length })}</div>
            )}
            <a href="/faturas" className="text-xs text-primary underline">{t("Abrir faturas")}</a>
          </div>
        </CardContent>
      </Card>

      {/* Despesas rapidas: um toque */}
      {podeLancar && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("Despesa rápida")}</CardTitle>
            <CardDescription>{t("Pequenos gastos de obra num toque. Guarde o apuramento a seguir.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {DESPESAS_RAPIDAS.map(([nome, tipo]) => (
              <Button key={nome} variant="outline" size="sm" className="rounded-full" onClick={() => setDespesa({ nome, tipo, valor: 0 })}>
                {t(nome)}
              </Button>
            ))}
            {despesa && (
              <div className="flex w-full flex-wrap items-center gap-2 pt-2" data-testid="despesa-rapida">
                <span className="text-sm font-medium">{t(despesa.nome)}</span>
                <CampoNumerico
                  tamanho="sm"
                  min={0}
                  sufixo="EUR"
                  aria-label={t("Valor da despesa")}
                  value={despesa.valor}
                  onChange={(valor) => setDespesa({ ...despesa, valor })}
                  className="w-36"
                />
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    if (despesa.valor <= 0) return
                    setLancamentos((atual) => [
                      ...atual,
                      { ...novoLancamento(despesa.tipo), descricao: t(despesa.nome), quantidade: 1, valorUnitario: round2(despesa.valor) },
                    ])
                    setDespesa(null)
                  }}
                >
                  {t("Adicionar")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mao de obra real */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">{t("Mão de obra real")}</CardTitle>
            <CardDescription>
              {t("Vendido no orçamento:")} <span className="font-medium">{formatCurrency(vendidoMaoObra)}</span>.{" "}
              {t("Ao faturar, indique o que se gastou: escolha o funcionário (puxa o custo/hora) ou escreva o valor.")}
            </CardDescription>
          </div>
          {podeLancar && (
            <Button variant="outline" className="rounded-full" onClick={() => adicionar("mao_obra")}>
              <Plus className="mr-2 h-4 w-4" />
              {t("Mão de obra")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {maoObra.length === 0 && <p className="text-sm text-muted-foreground">{t("Nenhuma mão de obra lançada.")}</p>}
          {maoObra.map((l) => (
            <div
              key={l.id}
              data-testid="linha-mao-obra"
              className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-[1.4fr_1.4fr_100px_120px_120px_auto]"
            >
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Funcionário")}</span>
                <SeletorComBusca
                  valor={l.funcionarioId || ""}
                  onChange={(fid) => escolherFuncionario(l.id, fid)}
                  placeholder={t("Opcional")}
                  placeholderBusca={t("Procurar funcionário...")}
                  vazio={t("Nenhum funcionário.")}
                  opcoes={funcionarios.map((f) => ({
                    valor: f.id!,
                    rotulo: f.nome,
                    detalhe: `${f.funcao} · ${formatCurrency(custoHoraFuncionario(f))}/h`,
                  }))}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Descrição")}</span>
                <Input
                  value={l.descricao}
                  disabled={!podeLancar}
                  onChange={(e) => alterar(l.id, { descricao: e.target.value })}
                  placeholder={t(TIPOS_LANCAMENTO.mao_obra.exemplo)}
                  aria-label={t("Descrição da mão de obra")}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Horas")}</span>
                <CampoNumerico
                  min={0}
                  value={l.quantidade}
                  disabled={!podeLancar}
                  aria-label={t("Horas")}
                  onChange={(quantidade) => alterar(l.id, { quantidade })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Custo/hora")}</span>
                <CampoNumerico
                  min={0}
                  sufixo="EUR"
                  value={l.valorUnitario}
                  disabled={!podeLancar}
                  aria-label={t("Custo por hora")}
                  onChange={(valorUnitario) => alterar(l.id, { valorUnitario })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Total")}</span>
                <div className="flex h-10 items-center justify-end rounded-md bg-muted px-3 text-sm font-medium tabular-nums">
                  {formatCurrency(totalLancamento(l))}
                </div>
              </div>
              {podeLancar && (
                <Button variant="ghost" size="icon" title={t("Remover")} onClick={() => remover(l.id)} className="text-destructive">
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
            <CardTitle className="text-lg">{t("Serviços de terceiros e outros custos")}</CardTitle>
            <CardDescription>{t("Subempreitadas, aluguer de equipamento, transporte, vazadouro... Valores sem IVA.")}</CardDescription>
          </div>
          {podeLancar && (
            <Button variant="outline" className="rounded-full" onClick={() => adicionar("terceiros")}>
              <Plus className="mr-2 h-4 w-4" />
              {t("Custo")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {outros.length === 0 && <p className="text-sm text-muted-foreground">{t("Nenhum custo lançado.")}</p>}
          {outros.map((l) => (
            <div
              key={l.id}
              data-testid="linha-outro-custo"
              className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-[180px_1.5fr_1fr_1fr_90px_120px_120px_auto]"
            >
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Tipo")}</span>
                <Select
                  value={l.tipo}
                  disabled={!podeLancar}
                  onValueChange={(tipo) => alterar(l.id, { tipo: tipo as TipoLancamentoObra })}
                >
                  <SelectTrigger aria-label={t("Tipo de custo")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPOS_LANCAMENTO) as TipoLancamentoObra[])
                      .filter((tp) => tp !== "mao_obra")
                      .map((tp) => (
                        <SelectItem key={tp} value={tp}>
                          {t(TIPOS_LANCAMENTO[tp].nome)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Descrição")}</span>
                <Input
                  value={l.descricao}
                  disabled={!podeLancar}
                  onChange={(e) => alterar(l.id, { descricao: e.target.value })}
                  placeholder={t(TIPOS_LANCAMENTO[l.tipo].exemplo)}
                  aria-label={t("Descrição do custo")}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Fornecedor")}</span>
                <Input
                  value={l.fornecedor || ""}
                  disabled={!podeLancar}
                  onChange={(e) => alterar(l.id, { fornecedor: e.target.value })}
                  aria-label={t("Fornecedor")}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Fatura")}</span>
                <Input
                  value={l.documento || ""}
                  disabled={!podeLancar}
                  onChange={(e) => alterar(l.id, { documento: e.target.value })}
                  aria-label={t("Fatura")}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Qtd.")}</span>
                <CampoNumerico
                  min={0}
                  value={l.quantidade}
                  disabled={!podeLancar}
                  aria-label={t("Quantidade")}
                  onChange={(quantidade) => alterar(l.id, { quantidade })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Valor sem IVA")}</span>
                <CampoNumerico
                  min={0}
                  sufixo="EUR"
                  value={l.valorUnitario}
                  disabled={!podeLancar}
                  aria-label={t("Valor sem IVA")}
                  onChange={(valorUnitario) => alterar(l.id, { valorUnitario })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("Total")}</span>
                <div className="flex h-10 items-center justify-end rounded-md bg-muted px-3 text-sm font-medium tabular-nums">
                  {formatCurrency(totalLancamento(l))}
                </div>
              </div>
              {podeLancar && (
                <Button variant="ghost" size="icon" title={t("Remover")} onClick={() => remover(l.id)} className="text-destructive">
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
            <span className="text-muted-foreground">{t("Lucro real:")} </span>
            <span className="font-semibold tabular-nums">
              {apuramento.temReal ? formatCurrency(apuramento.lucroReal) : "-"}
            </span>
            {porGravar && <span className="ml-3 text-amber-600">{t("Alterações por guardar")}</span>}
          </div>
          <Button onClick={gravar} disabled={aGravar || !porGravar} className="rounded-full">
            {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Guardar apuramento")}
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
