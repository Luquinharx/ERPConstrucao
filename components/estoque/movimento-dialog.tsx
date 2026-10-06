"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { FirebaseService, registarCompraParaObra, registarMovimentoEstoque } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { custoDoProduto, custoRealProduto, saldoAposMovimento } from "@/lib/produto-calculos"
import type { Material, Orcamento, TipoMovimentoEstoque } from "@/lib/types"
import { formatCurrency, formatNumber2, hojeLocal } from "@/lib/utils"

interface MovimentoDialogProps {
  open: boolean
  onOpenChange: (aberto: boolean) => void
  /**
   * Sem obra: so os produtos com controlo de estoque.
   * Com obra: todos (a compra para a obra aceita qualquer produto do cadastro).
   */
  produtos: Material[]
  produtoInicialId?: string
  tipoInicial?: ModoMovimento
  /** Aberto a partir de uma obra: so saida ou compra, ja ligadas a ela. */
  obra?: Orcamento
  onRegistado: () => void
}

/** "compra" = compra para uma obra: entrada e saida logo a seguir. */
type ModoMovimento = TipoMovimentoEstoque | "compra"

const hoje = hojeLocal

/**
 * Entrada, saida ou ajuste de um produto.
 *
 * O saldo so muda por aqui: e o que faz o historico explicar sempre o numero
 * que aparece no cadastro.
 */
export function MovimentoDialog({
  open,
  onOpenChange,
  produtos,
  produtoInicialId,
  tipoInicial = "entrada",
  obra: obraFixa,
  onRegistado,
}: MovimentoDialogProps) {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const grupos = useMemo(() => configuracao.gruposImpostos || [], [configuracao.gruposImpostos])
  const { pode } = usePermissoes()

  const [tipo, setTipo] = useState<ModoMovimento>(tipoInicial)
  const [materialId, setMaterialId] = useState("")
  const [quantidade, setQuantidade] = useState(0)
  const [precoCompra, setPrecoCompra] = useState(0)
  const [atualizarCusto, setAtualizarCusto] = useState(true)
  const [data, setData] = useState(hoje())
  const [documento, setDocumento] = useState("")
  const [fornecedor, setFornecedor] = useState("")
  const [orcamentoId, setOrcamentoId] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [obras, setObras] = useState<Orcamento[]>([])
  const [aGravar, setAGravar] = useState(false)

  const ehCompra = tipo === "compra"
  // Saida so do que tem estoque; compra para a obra aceita qualquer produto
  const produtosVisiveis = obraFixa && !ehCompra ? produtos.filter((p) => p.controlaEstoque) : produtos
  const produto = produtosVisiveis.find((item) => item.id === materialId)

  // Cada abertura comeca limpa, ja com o produto e o tipo de onde se veio
  useEffect(() => {
    if (!open) return
    setTipo(tipoInicial)
    setMaterialId(produtoInicialId || "")
    setQuantidade(0)
    setAtualizarCusto(true)
    setData(hoje())
    setDocumento("")
    setOrcamentoId("")
    setObservacoes("")
    const inicial = produtos.find((item) => item.id === produtoInicialId)
    setPrecoCompra(inicial?.precoCompra ?? inicial?.precoUnitario ?? 0)
    setFornecedor(inicial?.fornecedor || "")
    // So ao abrir: a lista de produtos recarregada nao deve apagar o que se escreveu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, produtoInicialId, tipoInicial])

  // Obras para ligar a saida: so se carregam se a pessoa pode ver orcamentos
  const podeVerOrcamentos = pode("orcamentos.ver")
  useEffect(() => {
    if (!open || !user || !podeVerOrcamentos) return
    FirebaseService.getOrcamentos(user.uid)
      .then((lista) => setObras(lista.filter((o) => o.status !== "cancelado")))
      .catch(() => setObras([]))
  }, [open, user, podeVerOrcamentos])

  const escolherProduto = (id: string) => {
    setMaterialId(id)
    const escolhido = produtos.find((item) => item.id === id)
    setPrecoCompra(escolhido?.precoCompra ?? escolhido?.precoUnitario ?? 0)
    setFornecedor(escolhido?.fornecedor || "")
  }

  /** Custo real por unidade desta compra, com os impostos e outros custos do cadastro. */
  const custoEntrada = useMemo(() => {
    if (!produto) return 0
    if (produto.precoCompra === undefined) return precoCompra
    return custoRealProduto({ ...produto, precoCompra }, grupos)
  }, [produto, precoCompra, grupos])

  const saldoAtual = Number(produto?.estoqueAtual) || 0
  // Na compra para a obra entra e sai a mesma quantidade
  const saldoDepois = ehCompra ? saldoAtual : saldoAposMovimento(saldoAtual, tipo, quantidade)

  const gravar = async () => {
    if (!user || !produto?.id) {
      toast({ title: "Escolha o produto", variant: "destructive" })
      return
    }
    if (tipo !== "ajuste" && quantidade <= 0) {
      toast({ title: "Indique a quantidade", variant: "destructive" })
      return
    }

    const obra = obraFixa || obras.find((o) => o.id === orcamentoId)
    setAGravar(true)
    try {
      if (tipo === "compra") {
        if (!obra?.id) throw new Error("A compra tem de estar ligada a uma obra.")
        await registarCompraParaObra(
          {
            materialId: produto.id,
            quantidade,
            precoCompra,
            custoUnitario: custoEntrada,
            orcamentoId: obra.id,
            orcamentoNumero: numeroCompleto(obra, configuracao),
            data,
            documento: documento.trim() || undefined,
            fornecedor: fornecedor.trim() || undefined,
            observacoes: observacoes.trim() || undefined,
            userId: user.uid,
          },
          { atualizarCusto, grupos },
        )
        toast({ title: "Compra registada", description: `${produto.nome}: entrou e saiu para a obra.` })
        onRegistado()
        onOpenChange(false)
        return
      }
      await registarMovimentoEstoque(
        {
          materialId: produto.id,
          tipo,
          quantidade,
          custoUnitario: tipo === "entrada" ? custoEntrada : undefined,
          data,
          documento: documento.trim() || undefined,
          fornecedor: tipo === "entrada" ? fornecedor.trim() || undefined : undefined,
          orcamentoId: tipo === "saida" && obra?.id ? obra.id : undefined,
          orcamentoNumero: tipo === "saida" && obra ? numeroCompleto(obra, configuracao) : undefined,
          observacoes: observacoes.trim() || undefined,
          userId: user.uid,
        },
        { atualizarCusto: tipo === "entrada" && atualizarCusto, precoCompra, grupos },
      )
      toast({ title: "Movimento registado", description: `${produto.nome}: saldo ${formatNumber2(saldoDepois)} ${produto.unidade}.` })
      onRegistado()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Nao foi possivel registar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Movimento de estoque</DialogTitle>
          <DialogDescription>
            O saldo so muda por movimentos. Um engano corrige-se com outro movimento ou com um ajuste.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={tipo} onValueChange={(valor) => setTipo(valor as ModoMovimento)}>
            {obraFixa ? (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="saida">Saida do estoque</TabsTrigger>
                <TabsTrigger value="compra">Compra para a obra</TabsTrigger>
              </TabsList>
            ) : (
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="entrada">Entrada</TabsTrigger>
                <TabsTrigger value="saida">Saida</TabsTrigger>
                <TabsTrigger value="ajuste">Ajuste</TabsTrigger>
              </TabsList>
            )}
          </Tabs>
          {obraFixa && (
            <p className="text-xs text-muted-foreground">
              {ehCompra
                ? "Material comprado para levar direto a obra: entra no estoque e sai logo para ela, ao custo desta compra."
                : "Material que ja estava em estoque e foi para a obra, ao custo medio."}{" "}
              Obra: <span className="font-medium">{numeroCompleto(obraFixa, configuracao)}</span>
            </p>
          )}

          <div className="space-y-2">
            <Label>Produto</Label>
            <SeletorComBusca
              valor={materialId}
              onChange={escolherProduto}
              placeholder="Escolha o produto"
              placeholderBusca="Procurar produto..."
              vazio="Nenhum produto com controlo de estoque."
              className="rounded-full"
              opcoes={produtosVisiveis.map((item) => ({
                valor: item.id!,
                rotulo: item.codigo ? `${item.codigo} - ${item.nome}` : item.nome,
                detalhe: `Saldo: ${formatNumber2(Number(item.estoqueAtual) || 0)} ${item.unidade}`,
              }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{tipo === "ajuste" ? "Contagem fisica" : "Quantidade"}</Label>
              <CampoNumerico
                min={0}
                sufixo={produto?.unidade}
                value={quantidade}
                onChange={setQuantidade}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-full" />
            </div>
          </div>

          {(tipo === "entrada" || ehCompra) && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Preco de compra unitario</Label>
                  <CampoNumerico min={0} sufixo="EUR" value={precoCompra} onChange={setPrecoCompra} className="rounded-full" />
                  <p className="text-xs text-muted-foreground">
                    Antes dos impostos do cadastro. Custo real: {formatCurrency(custoEntrada)} / {produto?.unidade || "un"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="rounded-full" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={atualizarCusto} onCheckedChange={(v) => setAtualizarCusto(v === true)} />
                Atualizar o preco de compra do cadastro com esta compra
              </label>
            </>
          )}

          {tipo === "saida" && !obraFixa && (
            <div className="space-y-2">
              <Label>Obra (opcional)</Label>
              <SeletorComBusca
                valor={orcamentoId}
                onChange={setOrcamentoId}
                placeholder="Sem obra associada"
                placeholderBusca="Procurar proposta ou cliente..."
                vazio="Nenhuma proposta encontrada."
                className="rounded-full"
                opcoes={obras.map((o) => ({
                  valor: o.id!,
                  rotulo: numeroCompleto(o, configuracao),
                  detalhe: o.cliente?.nome,
                }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Documento (opcional)</Label>
            <Input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder={tipo === "entrada" || ehCompra ? "N.o da fatura / guia" : "Guia de saida, requisicao..."}
              className="rounded-full"
            />
          </div>

          <div className="space-y-2">
            <Label>Observacoes</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>

          {produto && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Saldo atual</span>
                <span className="tabular-nums">
                  {formatNumber2(saldoAtual)} {produto.unidade}
                </span>
              </div>
              <div className={`flex justify-between font-medium ${saldoDepois < 0 ? "text-destructive" : ""}`}>
                <span>Saldo depois</span>
                <span className="tabular-nums">
                  {formatNumber2(saldoDepois)} {produto.unidade}
                </span>
              </div>
              {tipo === "saida" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Custo da saida (medio)</span>
                  <span className="tabular-nums">
                    {formatCurrency((Number(produto.custoMedio) || custoDoProduto(produto, grupos)) * quantidade)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={gravar} disabled={aGravar || !produto} className="rounded-full">
            {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
