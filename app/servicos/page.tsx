"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Edit, Trash2, Search, RefreshCw, X, Minus } from "lucide-react"
import { FirebaseService } from "@/lib/firebase-service"
import type { Servico, Material, ServicoComposicaoItem } from "@/lib/types"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { formatCurrency, matchesSearch, round2, toFixed2 } from "@/lib/utils"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { Checkbox } from "@/components/ui/checkbox"
import { SERVICE_CATEGORY_PRESETS, getServiceCategoryName } from "@/lib/service-categories"
import { v4 as uuidv4 } from "uuid"

interface ServicoFormState {
  nome: string
  descricao: string
  unidade: string
  categoriaId: string
  categoriaNome: string
  listaConsumiveis: ServicoComposicaoItem[]
  listaItens: ServicoComposicaoItem[]
  transporte: number
  observacoes: string
}

const UNIDADES_MEDIDA = ["m2", "m", "unidade", "hora", "dia", "projeto", "litro", "kg"]

function getDefaultFormData(): ServicoFormState {
  return {
    nome: "",
    descricao: "",
    unidade: "m2",
    categoriaId: SERVICE_CATEGORY_PRESETS[0].id,
    categoriaNome: "",
    listaConsumiveis: [],
    listaItens: [],
    transporte: 0,
    observacoes: "",
  }
}

/** Soma apenas os itens que acompanham a area/quantidade (multiplicam por m2). */
function sumVariavel(items: ServicoComposicaoItem[]): number {
  return round2(items.filter((item) => !item.valorFixo).reduce((acc, item) => acc + item.total, 0))
}

/** Soma apenas os itens de valor fixo (entram uma unica vez, nao multiplicam por m2). */
function sumFixo(items: ServicoComposicaoItem[]): number {
  return round2(items.filter((item) => item.valorFixo).reduce((acc, item) => acc + item.total, 0))
}

function calculateComposicao(formData: ServicoFormState) {
  const precoVariavel = round2(sumVariavel(formData.listaConsumiveis) + sumVariavel(formData.listaItens))
  const precoFixo = round2(sumFixo(formData.listaConsumiveis) + sumFixo(formData.listaItens))
  const transporte = round2(formData.transporte)

  return {
    precoVariavel,
    precoFixo,
    transporte,
    /** Preco base do servico (sem transporte, que entra no final do orcamento). */
    precoBase: round2(precoVariavel + precoFixo),
    /** Referencia de 1 unidade + fixos + transporte. */
    totalReferencia: round2(precoVariavel + precoFixo + transporte),
  }
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [materiais, setMateriais] = useState<Material[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingServico, setEditingServico] = useState<Servico | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()
  const { user } = useAuth()

  const [formData, setFormData] = useState<ServicoFormState>(getDefaultFormData())
  const [activeTab, setActiveTab] = useState("sobre")

  const [selectedConsumivelId, setSelectedConsumivelId] = useState("")
  const [consumivelQtd, setConsumivelQtd] = useState<number>(1)

  const [selectedItemId, setSelectedItemId] = useState("")
  const [itemQtd, setItemQtd] = useState<number>(1)

  const composicao = useMemo(() => calculateComposicao(formData), [formData])

  useEffect(() => {
    if (user) {
      loadServicos()
      loadMateriais()
    }
  }, [user])

  const loadMateriais = async () => {
    if (!user) return
    try {
      const data = await FirebaseService.getMateriais(user.uid)
      setMateriais(data)
    } catch (error) {
      console.error("Erro ao carregar materiais:", error)
    }
  }

  const loadServicos = async () => {
    if (!user) return

    try {
      setPageLoading(true)
      const servicosData = await FirebaseService.getServicos(user.uid)
      setServicos(servicosData)
    } catch (error) {
      console.error("Erro ao carregar servicos:", error)
      toast({
        title: "Erro ao carregar servicos",
        description: "Nao foi possivel carregar a lista de servicos.",
        variant: "destructive",
      })
    } finally {
      setPageLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!formData.nome.trim()) {
      toast({
        title: "Nome obrigatorio",
        description: "Informe o nome do servico.",
        variant: "destructive",
      })
      setActiveTab("sobre")
      return
    }

    setLoading(true)
    try {
      const categoriaNomeFinal =
        formData.categoriaId === "outros"
          ? formData.categoriaNome.trim() || "Outros"
          : getServiceCategoryName(formData.categoriaId)

      const consumiveisTotal = round2(formData.listaConsumiveis.reduce((acc, item) => acc + item.total, 0))
      const itensTotal = round2(formData.listaItens.reduce((acc, item) => acc + item.total, 0))

      const servicoData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim(),
        unidade: formData.unidade,
        categoriaId: formData.categoriaId,
        categoriaNome: categoriaNomeFinal,
        consumiveis: consumiveisTotal,
        listaConsumiveis: formData.listaConsumiveis,
        itens: itensTotal,
        listaItens: formData.listaItens,
        transporte: composicao.transporte,
        // preco = base do servico (sem transporte, que passa a ser linha propria do orcamento)
        preco: composicao.precoBase,
        precoVariavel: composicao.precoVariavel,
        precoFixo: composicao.precoFixo,
        observacoes: formData.observacoes.trim(),
        maoDeObra: 0 // Removido
      }

      if (editingServico) {
        await FirebaseService.updateServico(editingServico.id!, servicoData)
        toast({
          title: "Servico atualizado",
          description: "Os dados do servico foram atualizados com sucesso.",
        })
      } else {
        await FirebaseService.addServico(servicoData, user.uid)
        toast({
          title: "Servico cadastrado",
          description: "O servico foi cadastrado com sucesso.",
        })
      }

      resetForm()
      setIsDialogOpen(false)
      await loadServicos()
    } catch (error) {
      console.error("Erro ao salvar servico:", error)
      toast({
        title: "Erro ao salvar servico",
        description: "Nao foi possivel salvar os dados do servico.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (servico: Servico) => {
    const transporte = Number(servico.transporte ?? 0)

    setEditingServico(servico)
    setFormData({
      nome: servico.nome,
      descricao: servico.descricao || "",
      unidade: servico.unidade || "m2",
      categoriaId: servico.categoriaId || "outros",
      categoriaNome: servico.categoriaNome || "",
      listaConsumiveis: servico.listaConsumiveis || [],
      listaItens: servico.listaItens || [],
      transporte,
      observacoes: servico.observacoes || "",
    })
    setActiveTab("sobre")
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este servico?")) return

    try {
      await FirebaseService.deleteServico(id)
      toast({
        title: "Servico excluido",
        description: "O servico foi excluido com sucesso.",
      })
      await loadServicos()
    } catch (error) {
      console.error("Erro ao excluir servico:", error)
      toast({
        title: "Erro ao excluir servico",
        description: "Nao foi possivel excluir o servico.",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData(getDefaultFormData())
    setEditingServico(null)
    setActiveTab("sobre")
    setSelectedConsumivelId("")
    setConsumivelQtd(1)
    setSelectedItemId("")
    setItemQtd(1)
  }

  const addComposicaoItem = (type: "consumiveis" | "itens") => {
    const materialId = type === "consumiveis" ? selectedConsumivelId : selectedItemId
    const qtd = type === "consumiveis" ? consumivelQtd : itemQtd

    if (!materialId || qtd <= 0) return

    const mat = materiais.find((m) => m.id === materialId)
    if (!mat) return

    const newItem: ServicoComposicaoItem = {
      id: uuidv4(),
      materialId: mat.id!,
      nome: mat.nome,
      descricao: mat.observacoes || "",
      unidade: mat.unidade,
      quantidade: qtd,
      precoUnitario: mat.precoUnitario,
      total: round2(qtd * mat.precoUnitario),
      // Consumiveis acompanham a area (multiplicam por m2); itens/equipamentos entram como valor fixo
      valorFixo: type === "itens",
    }

    if (type === "consumiveis") {
      setFormData((prev) => {
        // Find if already exists
        const existing = prev.listaConsumiveis.find(i => i.materialId === materialId)
        if (existing) {
          return {
            ...prev,
            listaConsumiveis: prev.listaConsumiveis.map(i => 
              i.materialId === materialId 
                ? { ...i, quantidade: round2(i.quantidade + qtd), total: round2((i.quantidade + qtd) * i.precoUnitario) }
                : i
            )
          }
        }
        return { ...prev, listaConsumiveis: [...prev.listaConsumiveis, newItem] }
      })
      setSelectedConsumivelId("")
      setConsumivelQtd(1)
    } else {
      setFormData((prev) => {
        const existing = prev.listaItens.find(i => i.materialId === materialId)
        if (existing) {
          return {
            ...prev,
            listaItens: prev.listaItens.map(i => 
              i.materialId === materialId 
                ? { ...i, quantidade: round2(i.quantidade + qtd), total: round2((i.quantidade + qtd) * i.precoUnitario) }
                : i
            )
          }
        }
        return { ...prev, listaItens: [...prev.listaItens, newItem] }
      })
      setSelectedItemId("")
      setItemQtd(1)
    }
  }

  const updateItemQuantity = (type: "consumiveis" | "itens", id: string, delta: number) => {
    setFormData((prev) => {
      const listKey = type === "consumiveis" ? "listaConsumiveis" : "listaItens"
      const list = prev[listKey]
      
      const newList = list.map(item => {
        if (item.id === id) {
          const newQtd = round2(Math.max(0, item.quantidade + delta))
          if (newQtd === 0) return null
          return {
            ...item,
            quantidade: newQtd,
            total: round2(newQtd * item.precoUnitario)
          }
        }
        return item
      }).filter(Boolean) as ServicoComposicaoItem[]

      return {
        ...prev,
        [listKey]: newList
      }
    })
  }

  /** Alterna se o item acompanha a area (multiplica por m2) ou entra como valor fixo. */
  const toggleValorFixo = (type: "consumiveis" | "itens", id: string, valorFixo: boolean) => {
    setFormData((prev) => {
      const listKey = type === "consumiveis" ? "listaConsumiveis" : "listaItens"
      return {
        ...prev,
        [listKey]: prev[listKey].map((item) => (item.id === id ? { ...item, valorFixo } : item)),
      }
    })
  }

  const removeComposicaoItem = (type: "consumiveis" | "itens", id: string) => {
    if (type === "consumiveis") {
      setFormData((prev) => ({ ...prev, listaConsumiveis: prev.listaConsumiveis.filter((i) => i.id !== id) }))
    } else {
      setFormData((prev) => ({ ...prev, listaItens: prev.listaItens.filter((i) => i.id !== id) }))
    }
  }

  const filteredServicos = servicos.filter((servico) =>
    matchesSearch(searchTerm, [
      servico.nome,
      servico.descricao,
      servico.unidade,
      getServiceCategoryName(servico.categoriaId, servico.categoriaNome),
    ]),
  )

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Servicos</h1>
          <p className="text-muted-foreground">Gerencie servicos com categoria e composicao de custo</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadServicos} className="rounded-full bg-transparent">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) resetForm()
            setIsDialogOpen(open)
          }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Servico
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingServico ? "Editar Servico" : "Novo Servico"}</DialogTitle>
                <DialogDescription>
                  {editingServico ? "Atualize as informacoes do servico." : "Adicione um novo servico ao sistema."}
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sobre">Sobre</TabsTrigger>
                  <TabsTrigger value="composicao">Composicao do Servico</TabsTrigger>
                </TabsList>
                
                <form onSubmit={handleSubmit} className="mt-4 space-y-5">
                  <TabsContent value="sobre" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome do Servico</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          placeholder="Ex: Pintura de parede interna"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unidade">Unidade de Medida</Label>
                        <Select value={formData.unidade} onValueChange={(value) => setFormData({ ...formData, unidade: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIDADES_MEDIDA.map((unidade) => (
                              <SelectItem key={unidade} value={unidade}>
                                {unidade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select
                          value={formData.categoriaId}
                          onValueChange={(value) => setFormData({ ...formData, categoriaId: value, categoriaNome: "" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_CATEGORY_PRESETS.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.nome}
                              </SelectItem>
                            ))}
                            <SelectItem value="outros">Outra categoria</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.categoriaId === "outros" && (
                        <div className="space-y-2">
                          <Label htmlFor="categoriaNome">Nome da Categoria</Label>
                          <Input
                            id="categoriaNome"
                            value={formData.categoriaNome}
                            onChange={(e) => setFormData({ ...formData, categoriaNome: e.target.value })}
                            placeholder="Digite a categoria"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descricao">Descricao</Label>
                      <Textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder="Descreva o servico detalhadamente..."
                        rows={3}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="composicao" className="space-y-6">
                    {/* Objetos Consumiveis */}
                    <div className="space-y-3 p-4 border rounded-lg bg-card">
                      <div>
                        <Label className="text-base font-semibold">1. Objetos Consumiveis</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Materiais que sao gastos na execucao (ex: Pincel, Tinta, Gesso). Por norma acompanham a area
                          do orcamento (multiplicam por {formData.unidade}).
                        </p>
                      </div>
                      
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Selecionar Objeto</Label>
                          <Select value={selectedConsumivelId} onValueChange={setSelectedConsumivelId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Buscar material cadastrado..." />
                            </SelectTrigger>
                            <SelectContent>
                              {materiais.map((mat) => (
                                <SelectItem key={mat.id} value={mat.id!}>
                                  {mat.nome} ({formatCurrency(mat.precoUnitario)}/{mat.unidade})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Qtd</Label>
                          <Input 
                            type="number" min="0.01" step="0.01" 
                            value={consumivelQtd} 
                            onChange={(e) => setConsumivelQtd(Number(e.target.value) || 0)} 
                          />
                        </div>
                        <Button type="button" onClick={() => addComposicaoItem("consumiveis")}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                      </div>

                      {formData.listaConsumiveis.length > 0 && (
                        <div className="border rounded-md mt-4 bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Objeto</TableHead>
                                <TableHead className="text-center">Qtd</TableHead>
                                <TableHead className="text-center">Valor fixo</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {formData.listaConsumiveis.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-sm font-medium">{item.nome} <span className="text-xs text-muted-foreground font-normal">({item.unidade})</span></TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-center space-x-2">
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity("consumiveis", item.id, -1)}>
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="text-sm w-8 text-center">{item.quantidade}</span>
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity("consumiveis", item.id, 1)}>
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Checkbox
                                      checked={!!item.valorFixo}
                                      onCheckedChange={(checked) => toggleValorFixo("consumiveis", item.id, checked === true)}
                                      aria-label={`Nao multiplicar ${item.nome} pela area`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{formatCurrency(item.total)}</TableCell>
                                  <TableCell>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComposicaoItem("consumiveis", item.id)}>
                                      <X className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Itens / Equipamentos */}
                    <div className="space-y-3 p-4 border rounded-lg bg-card">
                      <div>
                        <Label className="text-base font-semibold">2. Itens</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Materiais que nao sao gastos (ex: Andaime, Escada, Furadeira). Entram como valor fixo: nao
                          multiplicam pela area do orcamento. Desmarque &quot;Valor fixo&quot; se algum deles deve
                          acompanhar a area.
                        </p>
                      </div>
                      
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Selecionar Item</Label>
                          <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Buscar material cadastrado..." />
                            </SelectTrigger>
                            <SelectContent>
                              {materiais.map((mat) => (
                                <SelectItem key={mat.id} value={mat.id!}>
                                  {mat.nome} ({formatCurrency(mat.precoUnitario)}/{mat.unidade})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Qtd</Label>
                          <Input 
                            type="number" min="0.01" step="0.01" 
                            value={itemQtd} 
                            onChange={(e) => setItemQtd(Number(e.target.value) || 0)} 
                          />
                        </div>
                        <Button type="button" onClick={() => addComposicaoItem("itens")}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar
                        </Button>
                      </div>

                      {formData.listaItens.length > 0 && (
                        <div className="border rounded-md mt-4 bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-center">Qtd</TableHead>
                                <TableHead className="text-center">Valor fixo</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {formData.listaItens.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-sm font-medium">{item.nome} <span className="text-xs text-muted-foreground font-normal">({item.unidade})</span></TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-center space-x-2">
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity("itens", item.id, -1)}>
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="text-sm w-8 text-center">{item.quantidade}</span>
                                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity("itens", item.id, 1)}>
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Checkbox
                                      checked={!!item.valorFixo}
                                      onCheckedChange={(checked) => toggleValorFixo("itens", item.id, checked === true)}
                                      aria-label={`Nao multiplicar ${item.nome} pela area`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{formatCurrency(item.total)}</TableCell>
                                  <TableCell>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComposicaoItem("itens", item.id)}>
                                      <X className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Valores Fixos */}
                    <div className="space-y-3 pt-2">
                      <Label className="text-base font-semibold">3. Custos Fixos</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="transporte">Transporte Fixo (EUR)</Label>
                          <Input
                            id="transporte"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.transporte}
                            onChange={(e) => setFormData({ ...formData, transporte: Number.parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observacoes">Condicoes de Composicao / Observacoes</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder="Observacoes internas sobre a execucao e composicao"
                        rows={2}
                      />
                    </div>

                    {/* Resumo do Preco */}
                    <div className="rounded-md border bg-muted/20 p-4 space-y-2 mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Por {formData.unidade} (multiplica pela quantidade):
                        </span>
                        <span>{formatCurrency(composicao.precoVariavel)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor fixo (nao multiplica):</span>
                        <span>{formatCurrency(composicao.precoFixo)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Transporte (linha final do orcamento):</span>
                        <span>{formatCurrency(composicao.transporte)}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-semibold pt-2 border-t">
                        <span>Preco Base Final:</span>
                        <span className="text-primary">{formatCurrency(composicao.precoBase)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Exemplo para 10 {formData.unidade}: {formatCurrency(composicao.precoVariavel)} x 10 +{" "}
                        {formatCurrency(composicao.precoFixo)} ={" "}
                        {formatCurrency(round2(composicao.precoVariavel * 10 + composicao.precoFixo))} (+ transporte{" "}
                        {formatCurrency(composicao.transporte)} no final do orcamento).
                      </p>
                    </div>
                  </TabsContent>

                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Salvando..." : editingServico ? "Atualizar" : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearSearch}
        placeholder="Buscar servicos por nome, descricao, categoria ou unidade..."
        resultCount={filteredServicos.length}
        totalCount={servicos.length}
      />

      <Card>
        <CardHeader>
          <CardTitle>Lista de Servicos</CardTitle>
          <CardDescription>
            {servicos.length} servico{servicos.length !== 1 ? "s" : ""} cadastrado{servicos.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredServicos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{searchTerm ? "Nenhum servico encontrado." : "Nenhum servico cadastrado."}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Composicao</TableHead>
                  <TableHead>Preco Final</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServicos.map((servico) => {
                  const transporte = round2(servico.transporte ?? 0)
                  const temSplit = servico.precoVariavel !== undefined || servico.precoFixo !== undefined
                  const precoVariavel = temSplit
                    ? round2(servico.precoVariavel ?? 0)
                    : round2(Number(servico.preco ?? 0) - transporte)
                  const precoFixo = temSplit ? round2(servico.precoFixo ?? 0) : 0

                  return (
                    <TableRow key={servico.id}>
                      <TableCell className="font-medium">
                        <div>{servico.nome}</div>
                        <div className="text-xs text-muted-foreground max-w-xs truncate">{servico.descricao || "Sem descricao"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getServiceCategoryName(servico.categoriaId, servico.categoriaNome)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{servico.unidade}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          <div>
                            Por {servico.unidade}: {formatCurrency(precoVariavel)}
                          </div>
                          <div>Fixo: {formatCurrency(precoFixo)}</div>
                          <div>Transp.: {formatCurrency(transporte)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(servico.preco || 0)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(servico)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(servico.id!)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}