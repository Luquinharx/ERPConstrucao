"use client"

import { Badge } from "@/components/ui/badge"
import type React from "react"
import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ArrowDownToLine, ArrowUpFromLine, Plus, Edit, Trash2, Package, Search, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import type { GrupoImpostos, ImpostoProduto, Material, MaterialCategory, TipoMovimentoEstoque } from "@/lib/types"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { FirebaseService, registarMovimentoEstoque } from "@/lib/firebase-service"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { formatCurrency, formatNumber2, hojeLocal, matchesSearch, round2 } from "@/lib/utils"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { MovimentoDialog } from "@/components/estoque/movimento-dialog"
import { m, t } from "@/lib/i18n"
import {
  custoDoProduto,
  custoRealProduto,
  estoqueBaixo,
  margemPorPreco,
  nomeUnidade,
  precoPorMargem,
  resumoImpostos,
  vendaDoProduto,
} from "@/lib/produto-calculos"

/** [valor gravado, rótulo mostrado]. O valor não muda com o idioma. */
const UNIDADES = [
  ["Unidades", m("Unidades")],
  ["Litros", m("Litros")],
  ["Kg", m("Quilogramas")],
  ["Metros", m("Metros")],
  ["M²", m("Metros quadrados")],
  ["M³", m("Metros cúbicos")],
  ["Galões", m("Galões")],
  ["Latas", m("Latas")],
  ["Rolos", m("Rolos")],
  ["Sacos", m("Sacos")],
  ["Caixas", m("Caixas")],
]

interface ProdutoForm {
  codigo: string
  nome: string
  unidade: string
  categoriaId: string
  fornecedor: string
  observacoes: string
  precoCompra: number
  /** "" = sem impostos. */
  grupoImpostosId: string
  /** Formato antigo, guardado tal como veio: so conta enquanto nao houver grupo. */
  temImpostos: boolean
  impostos: ImpostoProduto[]
  outrosCustos: number
  margemVenda: number
  precoVenda: number
  controlaEstoque: boolean
  estoqueMinimo: number
  /** So na criacao: entra como primeira entrada de estoque. */
  estoqueInicial: number
  unidadeCompra: string
  qtdPorEmbalagem: number
  codigoBarras: string
  tipoItem: "consumivel" | "equipamento"
}

function formVazio(): ProdutoForm {
  return {
    codigo: "",
    nome: "",
    unidade: "Unidades",
    categoriaId: "sem-categoria",
    fornecedor: "",
    observacoes: "",
    precoCompra: 0,
    grupoImpostosId: "",
    temImpostos: false,
    impostos: [],
    outrosCustos: 0,
    margemVenda: 0,
    precoVenda: 0,
    controlaEstoque: false,
    estoqueMinimo: 0,
    estoqueInicial: 0,
    unidadeCompra: "",
    qtdPorEmbalagem: 0,
    codigoBarras: "",
    tipoItem: "consumivel",
  }
}

/**
 * Produtos antigos so tinham `precoUnitario` (o custo). Ao abri-los, esse valor
 * passa a ser o preco de compra, sem impostos, e a venda fica ao custo ate
 * alguem definir a margem.
 */
function formDoProduto(produto: Material, grupos: GrupoImpostos[]): ProdutoForm {
  const custo = custoDoProduto(produto, grupos)
  const venda = vendaDoProduto(produto, grupos)
  const { percentualVenda } = resumoImpostos(produto, grupos)
  return {
    codigo: produto.codigo || "",
    nome: produto.nome,
    unidade: produto.unidade || "Unidades",
    categoriaId: produto.categoriaId || "sem-categoria",
    fornecedor: produto.fornecedor || "",
    observacoes: produto.observacoes || "",
    precoCompra: produto.precoCompra ?? produto.precoUnitario ?? 0,
    grupoImpostosId: produto.grupoImpostosId || "",
    temImpostos: !!produto.temImpostos,
    impostos: produto.impostos || [],
    outrosCustos: produto.outrosCustos || 0,
    margemVenda: produto.margemVenda ?? margemPorPreco(custo, venda, percentualVenda),
    precoVenda: venda,
    controlaEstoque: !!produto.controlaEstoque,
    estoqueMinimo: produto.estoqueMinimo || 0,
    estoqueInicial: 0,
    unidadeCompra: produto.unidadeCompra || "",
    qtdPorEmbalagem: produto.qtdPorEmbalagem || 0,
    codigoBarras: produto.codigoBarras || "",
    tipoItem: produto.tipoItem || "consumivel",
  }
}

export default function ProdutosPage() {
  const [materiais, setMateriais] = useState<Material[]>([])
  const [categories, setCategories] = useState<MaterialCategory[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [movimento, setMovimento] = useState<{ produtoId: string; tipo: TipoMovimentoEstoque } | null>(null)
  const { user } = useAuth()
  const { pode } = usePermissoes()
  const { configuracao } = useConfiguracao()
  const grupos = useMemo(() => configuracao.gruposImpostos || [], [configuracao.gruposImpostos])
  const podeGerir = pode("materiais.gerir")

  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("todas")

  const [formData, setFormData] = useState<ProdutoForm>(formVazio())

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return

    try {
      // Sem spinner nas recargas: depois de um movimento so muda o saldo de um cartao
      const [materiaisData, categoriesData] = await Promise.all([
        FirebaseService.getMateriais(user.uid),
        FirebaseService.getMaterialCategories(user.uid),
      ])
      setMateriais(materiaisData)
      setCategories(categoriesData)
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast({
        title: t("Erro ao carregar dados"),
        description: t("Não foi possível carregar a lista de produtos ou categorias."),
        variant: "destructive",
      })
    } finally {
      setPageLoading(false)
    }
  }

  // --- Contas do formulario: custo -> preco pela margem, ou preco -> margem

  const resumoForm = resumoImpostos(formData, grupos)
  const custoForm = custoRealProduto(formData, grupos)
  const impostoVendaForm = round2((formData.precoVenda * resumoForm.percentualVenda) / 100)
  // Lucro que sobra depois de pagar o custo e os impostos da venda
  const lucroUnitario = round2(formData.precoVenda - impostoVendaForm - custoForm)
  const temImpostosAntigos = !formData.grupoImpostosId && formData.temImpostos && formData.impostos.length > 0
  // Grupo apagado em Configuracoes: o produto passou a contar sem impostos
  const grupoEmFalta = !!formData.grupoImpostosId && !grupos.some((g) => g.id === formData.grupoImpostosId)

  /** Contas de um estado do formulario (custo e % de venda mudam com o grupo). */
  const contas = (f: ProdutoForm) => ({
    custo: custoRealProduto(f, grupos),
    pv: resumoImpostos(f, grupos).percentualVenda,
  })

  /** Muda custo ou grupo mantendo a margem: o preco de venda acompanha. */
  const alterarCusto = (parcial: Partial<ProdutoForm>) => {
    setFormData((atual) => {
      const proximo = { ...atual, ...parcial }
      const { custo, pv } = contas(proximo)
      return { ...proximo, precoVenda: precoPorMargem(custo, proximo.margemVenda, pv) }
    })
  }

  const alterarMargem = (margemVenda: number) =>
    setFormData((atual) => {
      const { custo, pv } = contas(atual)
      return { ...atual, margemVenda, precoVenda: precoPorMargem(custo, margemVenda, pv) }
    })

  const alterarPrecoVenda = (precoVenda: number) =>
    setFormData((atual) => {
      const { custo, pv } = contas(atual)
      return { ...atual, precoVenda, margemVenda: margemPorPreco(custo, precoVenda, pv) }
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!formData.nome.trim()) {
      toast({ title: t("Indique o nome do produto"), variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const produto: Omit<Material, "id" | "createdAt" | "updatedAt"> = {
        // String vazia e nao undefined: com undefined o Firestore ignora o campo e nao dava para apagar
        codigo: formData.codigo.trim(),
        nome: formData.nome.trim(),
        unidade: formData.unidade,
        categoriaId: formData.categoriaId === "sem-categoria" ? undefined : formData.categoriaId,
        fornecedor: formData.fornecedor.trim(),
        observacoes: formData.observacoes.trim(),
        precoCompra: round2(formData.precoCompra),
        grupoImpostosId: formData.grupoImpostosId,
        // Com grupo escolhido, os impostos do formato antigo deixam de valer e limpam-se
        temImpostos: formData.grupoImpostosId ? false : formData.temImpostos,
        impostos: formData.grupoImpostosId ? [] : formData.impostos,
        outrosCustos: round2(formData.outrosCustos),
        precoUnitario: custoForm,
        margemVenda: round2(formData.margemVenda),
        precoVenda: round2(formData.precoVenda),
        controlaEstoque: formData.controlaEstoque,
        estoqueMinimo: round2(formData.estoqueMinimo),
        unidadeCompra: formData.unidadeCompra.trim(),
        qtdPorEmbalagem: round2(formData.qtdPorEmbalagem),
        codigoBarras: formData.codigoBarras.trim(),
        tipoItem: formData.tipoItem,
        userId: user.uid,
      }

      if (editingMaterial) {
        // Saldo e custo medio nao vao no update: so os movimentos mexem neles
        await FirebaseService.updateMaterial(editingMaterial.id!, produto)
        toast({ title: t("Produto atualizado"), description: t("Os dados do produto foram atualizados.") })
      } else {
        const id = await FirebaseService.addMaterial(
          { ...produto, estoqueAtual: 0, custoMedio: custoForm },
          user.uid,
        )
        if (formData.controlaEstoque && formData.estoqueInicial > 0) {
          await registarMovimentoEstoque({
            materialId: id,
            tipo: "entrada",
            quantidade: formData.estoqueInicial,
            custoUnitario: custoForm,
            data: hojeLocal(),
            documento: t("Stock inicial"),
            userId: user.uid,
          })
        }
        toast({ title: t("Produto criado"), description: t("O produto foi criado com sucesso.") })
      }

      resetForm()
      setIsDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error("Erro ao salvar produto:", error)
      toast({
        title: t("Erro ao guardar o produto"),
        description: t("Não foi possível guardar os dados do produto."),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (material: Material) => {
    setEditingMaterial(material)
    setFormData(formDoProduto(material, grupos))
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("Tem a certeza de que quer eliminar este produto?"))) return

    try {
      await FirebaseService.deleteMaterial(id)
      toast({ title: t("Produto eliminado"), description: t("O produto foi eliminado com sucesso.") })
      await loadData()
    } catch (error) {
      console.error("Erro ao excluir produto:", error)
      toast({ title: t("Erro ao eliminar o produto"), description: t("Não foi possível eliminar o produto."), variant: "destructive" })
    }
  }

  const resetForm = () => {
    setFormData(formVazio())
    setEditingMaterial(null)
  }

  const clearFilters = () => {
    clearSearch()
    setSelectedCategoryFilter("todas")
  }

  const produtosComEstoque = useMemo(() => materiais.filter((m) => m.controlaEstoque), [materiais])

  const filteredMaterials = useMemo(() => {
    let filtered = materiais

    if (searchTerm.trim()) {
      filtered = filtered.filter((material) =>
        matchesSearch(searchTerm, [
          material.codigo,
          material.nome,
          material.fornecedor,
          material.unidade,
          material.observacoes,
          categories.find((cat) => cat.id === material.categoriaId)?.nome,
        ]),
      )
    }

    if (selectedCategoryFilter === "estoque-baixo") {
      filtered = filtered.filter(estoqueBaixo)
    } else if (selectedCategoryFilter === "sem-categoria") {
      filtered = filtered.filter((material) => !material.categoriaId)
    } else if (selectedCategoryFilter !== "todas") {
      filtered = filtered.filter((material) => material.categoriaId === selectedCategoryFilter)
    }

    return filtered
  }, [materiais, searchTerm, selectedCategoryFilter, categories])

  const materialsByCategory = useMemo(() => {
    const grouped: { [key: string]: Material[] } = {}
    filteredMaterials.forEach((material) => {
      const categoryName = categories.find((cat) => cat.id === material.categoriaId)?.nome || t("Sem categoria")
      if (!grouped[categoryName]) grouped[categoryName] = []
      grouped[categoryName].push(material)
    })
    return grouped
  }, [filteredMaterials, categories])

  const hasActiveFilters = searchTerm.trim() || selectedCategoryFilter !== "todas"

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("Produtos")}</h1>
          <p className="text-muted-foreground mt-2">{t("Custo real, impostos, preço de venda e stock de cada produto")}</p>
        </div>
        <Button
          disabled={!podeGerir}
          onClick={() => {
            resetForm()
            setIsDialogOpen(true)
          }}
          className="rounded-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t("Novo produto")}
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMaterial ? t("Editar produto") : t("Novo produto")}</DialogTitle>
            <DialogDescription>
              {t("O custo real é o que o produto custa à empresa. O preço de venda é o que se cobra ao cliente.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identificacao */}
            <section className="space-y-4">
              <h3 className="font-medium">{t("Identificação")}</h3>
              <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="codigo">{t("Código")}</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder={t("Opcional")}
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">{t("Nome do produto")}</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder={t("Ex.: Tinta plástica branca 15 L")}
                    className="rounded-full"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("Unidade")}</Label>
                  <Select value={formData.unidade} onValueChange={(unidade) => setFormData({ ...formData, unidade })}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map(([valor, rotulo]) => (
                        <SelectItem key={valor} value={valor}>
                          {t(rotulo)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("Categoria")}</Label>
                  <Select
                    value={formData.categoriaId}
                    onValueChange={(categoriaId) => setFormData({ ...formData, categoriaId })}
                  >
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem-categoria">{t("Sem categoria")}</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id!}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">{t("Fornecedor")}</Label>
                  <Input
                    id="fornecedor"
                    value={formData.fornecedor}
                    onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                    className="rounded-full"
                  />
                </div>
              </div>
            </section>

            {/* Custo */}
            <section className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">{t("Custo")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("Preço de compra (por {unidade})", { unidade: nomeUnidade(formData.unidade).toLowerCase() })}</Label>
                  <CampoNumerico
                    min={0}
                    sufixo="EUR"
                    value={formData.precoCompra}
                    onChange={(precoCompra) => alterarCusto({ precoCompra })}
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Outros custos (frete, embalagem...)")}</Label>
                  <CampoNumerico
                    min={0}
                    sufixo="EUR"
                    value={formData.outrosCustos}
                    onChange={(outrosCustos) => alterarCusto({ outrosCustos })}
                    className="rounded-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("Grupo de impostos")}</Label>
                <Select
                  value={formData.grupoImpostosId || "__sem"}
                  onValueChange={(v) => alterarCusto({ grupoImpostosId: v === "__sem" ? "" : v })}
                >
                  <SelectTrigger className="rounded-full" aria-label={t("Grupo de impostos")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__sem">{t("Sem impostos")}</SelectItem>
                    {grupos.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {grupos.length === 0 ? t("Ainda não há grupos de impostos.") + " " : t("As taxas de cada grupo definem-se em") + " "}
                  <Link
                    href="/configuracoes?aba=impostos"
                    target="_blank"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    {grupos.length === 0 ? t("Criar grupo de impostos") : t("Configurações > Impostos")}
                  </Link>
                  {grupos.length === 0 && " " + t("(abre noutro separador; depois recarregue esta página).")}
                  {temImpostosAntigos && " " + t("Este produto tem impostos no formato antigo, que contam até escolher um grupo.")}
                </p>
                {grupoEmFalta && (
                  <p className="text-xs font-medium text-destructive" data-testid="grupo-em-falta">
                    {t("O grupo de impostos deste produto foi apagado: está a ser calculado sem impostos. Escolha outro grupo.")}
                  </p>
                )}
              </div>

              <div className="rounded-md bg-muted p-3 text-sm space-y-1" data-testid="resumo-custo">
                <div className="flex justify-between">
                  <span>{t("Compra")}</span>
                  <span className="tabular-nums">{formatCurrency(formData.precoCompra)}</span>
                </div>
                {resumoForm.compraNoCusto > 0 && (
                  <div className="flex justify-between">
                    <span>{t("Impostos no custo")}</span>
                    <span className="tabular-nums">{formatCurrency(resumoForm.compraNoCusto)}</span>
                  </div>
                )}
                {formData.outrosCustos > 0 && (
                  <div className="flex justify-between">
                    <span>{t("Outros custos")}</span>
                    <span className="tabular-nums">{formatCurrency(formData.outrosCustos)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>{t("Custo real")}</span>
                  <span className="tabular-nums" data-testid="custo-real">{formatCurrency(custoForm)}</span>
                </div>
                {resumoForm.credito > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("Crédito de impostos (recuperável, fora do custo)")}</span>
                    <span className="tabular-nums">{formatCurrency(resumoForm.credito)}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Venda */}
            <section className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">{t("Venda")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("Margem sobre o custo")}</Label>
                  <CampoNumerico sufixo="%" value={formData.margemVenda} onChange={alterarMargem} className="rounded-full" />
                </div>
                <div className="space-y-2">
                  <Label>{t("Preço de venda (sem IVA)")}</Label>
                  <CampoNumerico
                    min={0}
                    sufixo="EUR"
                    value={formData.precoVenda}
                    onChange={alterarPrecoVenda}
                    className="rounded-full"
                  />
                </div>
              </div>
              <div className="rounded-md bg-muted p-3 text-sm space-y-1" data-testid="resumo-venda">
                <div className="flex justify-between">
                  <span>{t("Preço de venda")}</span>
                  <span className="tabular-nums">{formatCurrency(formData.precoVenda)}</span>
                </div>
                {resumoForm.percentualVenda > 0 && (
                  <div className="flex justify-between">
                    <span>{t("Impostos de venda ({percentagem}%)", { percentagem: formatNumber2(resumoForm.percentualVenda) })}</span>
                    <span className="tabular-nums">- {formatCurrency(impostoVendaForm)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{t("Custo real")}</span>
                  <span className="tabular-nums">- {formatCurrency(custoForm)}</span>
                </div>
                <div className={`flex justify-between border-t pt-1 font-semibold ${lucroUnitario < 0 ? "text-destructive" : ""}`}>
                  <span>{t("Lucro por unidade")}</span>
                  <span className="tabular-nums" data-testid="lucro-unidade">{formatCurrency(lucroUnitario)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Mude a margem e o preço acompanha, ou escreva o preço e a margem é calculada. A margem é o lucro que sobra depois dos impostos de venda.",
                )}
              </p>
            </section>

            {/* Estoque */}
            <section className="space-y-4 rounded-lg border p-4">
              <label className="flex items-center gap-3 font-medium">
                <Switch
                  checked={formData.controlaEstoque}
                  onCheckedChange={(controlaEstoque) => setFormData({ ...formData, controlaEstoque })}
                />
                {t("Controlar o stock deste produto")}
              </label>
              {formData.controlaEstoque && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("Stock mínimo")}</Label>
                    <CampoNumerico
                      min={0}
                      sufixo={nomeUnidade(formData.unidade)}
                      value={formData.estoqueMinimo}
                      onChange={(estoqueMinimo) => setFormData({ ...formData, estoqueMinimo })}
                      className="rounded-full"
                    />
                  </div>
                  {editingMaterial ? (
                    <div className="space-y-2">
                      <Label>{t("Saldo atual")}</Label>
                      <Input
                        readOnly
                        value={`${formatNumber2(Number(editingMaterial.estoqueAtual) || 0)} ${nomeUnidade(editingMaterial.unidade)}`}
                        className="rounded-full bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">{t("Muda-se por entradas, saídas ou ajustes.")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>{t("Stock inicial")}</Label>
                      <CampoNumerico
                        min={0}
                        sufixo={nomeUnidade(formData.unidade)}
                        value={formData.estoqueInicial}
                        onChange={(estoqueInicial) => setFormData({ ...formData, estoqueInicial })}
                        className="rounded-full"
                      />
                      <p className="text-xs text-muted-foreground">{t("Fica registado como primeira entrada.")}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Compra e etiquetas */}
            <section className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">{t("Compra e etiquetas")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("Unidade de compra")}</Label>
                  <Input
                    value={formData.unidadeCompra}
                    onChange={(e) => setFormData({ ...formData, unidadeCompra: e.target.value })}
                    placeholder={t("rolo, saco, lata...")}
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Quantidade por embalagem ({unidade})", { unidade: nomeUnidade(formData.unidade) })}</Label>
                  <CampoNumerico
                    min={0}
                    value={formData.qtdPorEmbalagem}
                    onChange={(qtdPorEmbalagem) => setFormData({ ...formData, qtdPorEmbalagem })}
                    className="rounded-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("Ex.: rolo de 90 m². A obra que precisa de 32,67 m² pede 1 rolo.")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("Código de barras (EAN)")}</Label>
                  <Input
                    value={formData.codigoBarras}
                    onChange={(e) => setFormData({ ...formData, codigoBarras: e.target.value })}
                    placeholder={t("Opcional: o da embalagem de fábrica")}
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Tipo")}</Label>
                  <Select
                    value={formData.tipoItem}
                    onValueChange={(tipoItem) => setFormData({ ...formData, tipoItem: tipoItem as ProdutoForm["tipoItem"] })}
                  >
                    <SelectTrigger className="rounded-full" aria-label={t("Tipo de item")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumivel">{t("Consumível (gasta-se na obra)")}</SelectItem>
                      <SelectItem value="equipamento">{t("Equipamento (sai e volta)")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <div className="space-y-2">
              <Label htmlFor="observacoes">{t("Observações")}</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("Cancelar")}
              </Button>
              <Button type="submit" disabled={loading || !podeGerir} className="rounded-full">
                {loading ? t("A guardar...") : editingMaterial ? t("Atualizar") : t("Criar")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <MovimentoDialog
        open={movimento !== null}
        onOpenChange={(aberto) => !aberto && setMovimento(null)}
        produtos={produtosComEstoque}
        produtoInicialId={movimento?.produtoId}
        tipoInicial={movimento?.tipo}
        onRegistado={loadData}
      />

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearFilters}
        placeholder={t("Pesquisar por código, nome, fornecedor ou categoria...")}
        resultCount={filteredMaterials.length}
        totalCount={materiais.length}
      >
        <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[240px] rounded-full">
            <SelectValue placeholder={t("Todas as categorias")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">{t("Todas as categorias")}</SelectItem>
            <SelectItem value="estoque-baixo">{t("Stock baixo")}</SelectItem>
            <SelectItem value="sem-categoria">{t("Sem categoria")}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id!}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="rounded-full text-muted-foreground">
            <X className="h-4 w-4 mr-2" />
            {t("Limpar filtros")}
          </Button>
        )}
      </ListToolbar>

      {Object.keys(materialsByCategory).length > 0 ? (
        Object.entries(materialsByCategory).map(([categoryName, materialsInGroup]) => (
          <div key={categoryName} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold mt-6 mb-4">{categoryName}</h2>
              <Badge variant="secondary" className="text-xs">
                {materialsInGroup.length === 1
                  ? t("{n} item", { n: materialsInGroup.length })
                  : t("{n} itens", { n: materialsInGroup.length })}
              </Badge>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {materialsInGroup.map((material) => {
                const custo = custoDoProduto(material, grupos)
                const venda = vendaDoProduto(material, grupos)
                const baixo = estoqueBaixo(material)
                return (
                  <Card key={material.id} className="animate-slide-in">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 shrink-0 bg-primary rounded-full flex items-center justify-center self-start">
                            <Package className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base leading-snug break-words">
                              {material.codigo && <span className="text-muted-foreground mr-1">{material.codigo}</span>}
                              {material.nome}
                            </CardTitle>
                            <CardDescription className="truncate">{material.fornecedor || t("Sem fornecedor")}</CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {nomeUnidade(material.unidade)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("Custo real")}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(custo)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("Venda")}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(venda)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("Margem")}</span>
                          <span className="tabular-nums">{formatNumber2(margemPorPreco(custo, venda, resumoImpostos(material, grupos).percentualVenda))}%</span>
                        </div>
                        {material.controlaEstoque && (
                          <div className="flex justify-between items-center pt-1 border-t">
                            <span className="text-muted-foreground">{t("Stock")}</span>
                            <span className="flex items-center gap-2">
                              {baixo && (
                                <Badge variant="outline" className="border-rose-500/40 text-rose-600 text-[10px]">
                                  {t("Baixo")}
                                </Badge>
                              )}
                              <span className="font-medium tabular-nums">
                                {formatNumber2(Number(material.estoqueAtual) || 0)} {nomeUnidade(material.unidade)}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        {material.controlaEstoque && podeGerir && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              title={t("Entrada de stock")}
                              onClick={() => setMovimento({ produtoId: material.id!, tipo: "entrada" })}
                              className="rounded-full"
                            >
                              <ArrowDownToLine className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              title={t("Saída de stock")}
                              onClick={() => setMovimento({ produtoId: material.id!, tipo: "saida" })}
                              className="rounded-full"
                            >
                              <ArrowUpFromLine className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="outline" size="icon" onClick={() => handleEdit(material)} className="rounded-full">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={!podeGerir}
                          onClick={() => handleDelete(material.id!)}
                          className="rounded-full text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      ) : hasActiveFilters ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("Nenhum produto encontrado")}</h3>
            <p className="text-muted-foreground text-center mb-4">{t("Tente ajustar os filtros ou os termos de pesquisa.")}</p>
            <Button onClick={clearFilters} variant="outline" className="rounded-full bg-transparent">
              <X className="h-4 w-4 mr-2" />
              {t("Limpar filtros")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("Ainda não há produtos")}</h3>
            <p className="text-muted-foreground text-center mb-4">{t("Comece por adicionar os produtos que usa em obra.")}</p>
            <Button
              disabled={!podeGerir}
              onClick={() => {
                resetForm()
                setIsDialogOpen(true)
              }}
              className="rounded-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("Adicionar o primeiro produto")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
