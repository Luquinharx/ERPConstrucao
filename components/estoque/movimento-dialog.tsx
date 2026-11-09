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
import { t } from "@/lib/i18n"
import { numeroCompleto } from "@/lib/numeracao"
import { custoDoProduto, custoRealProduto, nomeUnidade, saldoAposMovimento } from "@/lib/produto-calculos"
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
      toast({ title: t("Escolha o produto"), variant: "destructive" })
      return
    }
    if (tipo !== "ajuste" && quantidade <= 0) {
      toast({ title: t("Indique a quantidade"), variant: "destructive" })
      return
    }

    const obra = obraFixa || obras.find((o) => o.id === orcamentoId)
    setAGravar(true)
    try {
      if (tipo === "compra") {
        if (!obra?.id) throw new Error(t("A compra tem de estar ligada a uma obra."))
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
        toast({ title: t("Compra registada"), description: t("{produto}: entrou e saiu para a obra.", { produto: produto.nome }) })
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
      toast({
        title: t("Movimento registado"),
        description: t("{produto}: saldo {saldo}.", {
          produto: produto.nome,
          saldo: `${formatNumber2(saldoDepois)} ${nomeUnidade(produto.unidade)}`,
        }),
      })
      onRegistado()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: t("Não foi possível registar"),
        description: error instanceof Error ? error.message : t("Tente novamente."),
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
          <DialogTitle>{t("Movimento de stock")}</DialogTitle>
          <DialogDescription>
            {t("O saldo só muda por movimentos. Um engano corrige-se com outro movimento ou com um ajuste.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={tipo} onValueChange={(valor) => setTipo(valor as ModoMovimento)}>
            {obraFixa ? (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="saida">{t("Saída do stock")}</TabsTrigger>
                <TabsTrigger value="compra">{t("Compra para a obra")}</TabsTrigger>
              </TabsList>
            ) : (
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="entrada">{t("Entrada")}</TabsTrigger>
                <TabsTrigger value="saida">{t("Saída")}</TabsTrigger>
                <TabsTrigger value="ajuste">{t("Ajuste")}</TabsTrigger>
              </TabsList>
            )}
          </Tabs>
          {obraFixa && (
            <p className="text-xs text-muted-foreground">
              {ehCompra
                ? t("Material comprado para levar direto para a obra: entra no stock e sai logo para ela, ao custo desta compra.")
                : t("Material que já estava em stock e foi para a obra, ao custo médio.")}{" "}
              {t("Obra:")} <span className="font-medium">{numeroCompleto(obraFixa, configuracao)}</span>
            </p>
          )}

          <div className="space-y-2">
            <Label>{t("Produto")}</Label>
            <SeletorComBusca
              valor={materialId}
              onChange={escolherProduto}
              placeholder={t("Escolha o produto")}
              placeholderBusca={t("Pesquisar produto...")}
              vazio={t("Nenhum produto com controlo de stock.")}
              className="rounded-full"
              opcoes={produtosVisiveis.map((item) => ({
                valor: item.id!,
                rotulo: item.codigo ? `${item.codigo} - ${item.nome}` : item.nome,
                detalhe: t("Saldo: {saldo}", { saldo: `${formatNumber2(Number(item.estoqueAtual) || 0)} ${nomeUnidade(item.unidade)}` }),
              }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{tipo === "ajuste" ? t("Contagem física") : t("Quantidade")}</Label>
              <CampoNumerico
                min={0}
                sufixo={produto ? nomeUnidade(produto.unidade) : undefined}
                value={quantidade}
                onChange={setQuantidade}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Data")}</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-full" />
            </div>
          </div>

          {(tipo === "entrada" || ehCompra) && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("Preço de compra unitário")}</Label>
                  <CampoNumerico min={0} sufixo="EUR" value={precoCompra} onChange={setPrecoCompra} className="rounded-full" />
                  <p className="text-xs text-muted-foreground">
                    {t("Antes dos impostos da ficha do produto. Custo real: {custo} / {unidade}", {
                      custo: formatCurrency(custoEntrada),
                      unidade: produto?.unidade ? nomeUnidade(produto.unidade) : t("un."),
                    })}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("Fornecedor")}</Label>
                  <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="rounded-full" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={atualizarCusto} onCheckedChange={(v) => setAtualizarCusto(v === true)} />
                {t("Atualizar o preço de compra na ficha do produto com esta compra")}
              </label>
            </>
          )}

          {tipo === "saida" && !obraFixa && (
            <div className="space-y-2">
              <Label>{t("Obra (opcional)")}</Label>
              <SeletorComBusca
                valor={orcamentoId}
                onChange={setOrcamentoId}
                placeholder={t("Sem obra associada")}
                placeholderBusca={t("Pesquisar proposta ou cliente...")}
                vazio={t("Nenhuma proposta encontrada.")}
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
            <Label>{t("Documento (opcional)")}</Label>
            <Input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder={tipo === "entrada" || ehCompra ? t("N.º da fatura / guia") : t("Guia de saída, requisição...")}
              className="rounded-full"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("Observações")}</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>

          {produto && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>{t("Saldo atual")}</span>
                <span className="tabular-nums">
                  {formatNumber2(saldoAtual)} {nomeUnidade(produto.unidade)}
                </span>
              </div>
              <div className={`flex justify-between font-medium ${saldoDepois < 0 ? "text-destructive" : ""}`}>
                <span>{t("Saldo depois")}</span>
                <span className="tabular-nums">
                  {formatNumber2(saldoDepois)} {nomeUnidade(produto.unidade)}
                </span>
              </div>
              {tipo === "saida" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("Custo da saída (médio)")}</span>
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
            {t("Cancelar")}
          </Button>
          <Button type="button" onClick={gravar} disabled={aGravar || !produto} className="rounded-full">
            {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Registar movimento")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
