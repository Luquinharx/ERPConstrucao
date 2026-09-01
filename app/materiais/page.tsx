"use client"

import { Badge } from "@/components/ui/badge"
import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Edit, Trash2, Package, Search, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import type { Material, MaterialCategory } from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { formatCurrency, matchesSearch } from "@/lib/utils"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"

export default function MateriaisPage() {
  const [materiais, setMateriais] = useState<Material[]>([])
  const [categories, setCategories] = useState<MaterialCategory[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const { user } = useAuth()
  const { pode } = usePermissoes()

  // Estados para busca e filtros (termo sincronizado com a URL)
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("todas")

  const [formData, setFormData] = useState({
    nome: "",
    unidade: "Unidades",
    precoUnitario: 0,
    categoriaId: "sem-categoria",
    fornecedor: "",
  })

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return

    try {
      setPageLoading(true)

      const [materiaisData, categoriesData] = await Promise.all([
        FirebaseService.getMateriais(user.uid),
        FirebaseService.getMaterialCategories(user.uid),
      ])

      setMateriais(materiaisData)
      setCategories(categoriesData)
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error)
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar a lista de materiais ou categorias.",
        variant: "destructive",
      })
    } finally {
      setPageLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      const materialToSave = {
        ...formData,
        precoUnitario: Number.parseFloat(formData.precoUnitario.toString()) || 0,
        categoriaId: formData.categoriaId === "sem-categoria" ? undefined : formData.categoriaId,
      }

      if (editingMaterial) {
        await FirebaseService.updateMaterial(editingMaterial.id!, materialToSave)
        toast({
          title: "Material atualizado",
          description: "Os dados do material foram atualizados com sucesso.",
        })
      } else {
        await FirebaseService.addMaterial(materialToSave, user.uid)
        toast({
          title: "Material cadastrado",
          description: "O material foi cadastrado com sucesso.",
        })
      }

      resetForm()
      setIsDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error("❌ Erro ao salvar material:", error)
      toast({
        title: "Erro ao salvar material",
        description: "Não foi possível salvar os dados do material.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (material: Material) => {
    setEditingMaterial(material)
    setFormData({
      nome: material.nome,
      unidade: material.unidade || "Unidades",
      precoUnitario: material.precoUnitario,
      categoriaId: material.categoriaId || "sem-categoria",
      fornecedor: material.fornecedor || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este material?")) return

    try {
      await FirebaseService.deleteMaterial(id)
      toast({
        title: "Material excluído",
        description: "O material foi excluído com sucesso.",
      })
      await loadData()
    } catch (error) {
      console.error("❌ Erro ao excluir material:", error)
      toast({
        title: "Erro ao excluir material",
        description: "Não foi possível excluir o material.",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      nome: "",
      unidade: "Unidades",
      precoUnitario: 0,
      categoriaId: "sem-categoria",
      fornecedor: "",
    })
    setEditingMaterial(null)
  }

  const clearFilters = () => {
    clearSearch()
    setSelectedCategoryFilter("todas")
  }

  // Filtrar materiais baseado na busca e categoria
  const filteredMaterials = useMemo(() => {
    let filtered = materiais

    // Filtrar por termo de busca (nome, fornecedor, unidade, observacoes)
    if (searchTerm.trim()) {
      filtered = filtered.filter((material) =>
        matchesSearch(searchTerm, [
          material.nome,
          material.fornecedor,
          material.unidade,
          material.observacoes,
          categories.find((cat) => cat.id === material.categoriaId)?.nome,
        ]),
      )
    }

    // Filtrar por categoria
    if (selectedCategoryFilter !== "todas") {
      if (selectedCategoryFilter === "sem-categoria") {
        filtered = filtered.filter((material) => !material.categoriaId)
      } else {
        filtered = filtered.filter((material) => material.categoriaId === selectedCategoryFilter)
      }
    }

    return filtered
  }, [materiais, searchTerm, selectedCategoryFilter, categories])

  // Agrupar materiais filtrados por categoria
  const materialsByCategory = useMemo(() => {
    const grouped: { [key: string]: Material[] } = {}
    filteredMaterials.forEach((material) => {
      const categoryName = categories.find((cat) => cat.id === material.categoriaId)?.nome || "Sem Categoria"
      if (!grouped[categoryName]) {
        grouped[categoryName] = []
      }
      grouped[categoryName].push(material)
    })
    return grouped
  }, [filteredMaterials, categories])

  const hasActiveFilters = searchTerm.trim() || selectedCategoryFilter !== "todas"
  const totalFilteredResults = filteredMaterials.length

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Materiais</h1>
          <p className="text-muted-foreground mt-2">Gerir o inventário de materiais e seus custos</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!pode("materiais.gerir")} onClick={resetForm} className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Novo Material
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingMaterial ? "Editar Material" : "Novo Material"}</DialogTitle>
                <DialogDescription>
                  {editingMaterial ? "Atualize os dados do material." : "Adicione um novo material ao inventário."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Material</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome do material"
                    required
                    className="rounded-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unidade">Unidade de Medida</Label>
                    <Select
                      value={formData.unidade}
                      onValueChange={(value) => setFormData({ ...formData, unidade: value })}
                    >
                      <SelectTrigger className="rounded-full">
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Litros">Litros</SelectItem>
                        <SelectItem value="Kg">Quilogramas</SelectItem>
                        <SelectItem value="Unidades">Unidades</SelectItem>
                        <SelectItem value="Metros">Metros</SelectItem>
                        <SelectItem value="M²">Metros Quadrados</SelectItem>
                        <SelectItem value="M³">Metros Cúbicos</SelectItem>
                        <SelectItem value="Galões">Galões</SelectItem>
                        <SelectItem value="Latas">Latas</SelectItem>
                        <SelectItem value="Rolos">Rolos</SelectItem>
                        <SelectItem value="Sacos">Sacos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="precoUnitario">Preço Unitário (€)</Label>
                    <CampoNumerico
                      id="precoUnitario"
                      min={0}
                      sufixo="EUR"
                      value={formData.precoUnitario}
                      onChange={(precoUnitario) => setFormData({ ...formData, precoUnitario })}
                      className="rounded-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoriaId">Categoria</Label>
                  <Select
                    value={formData.categoriaId}
                    onValueChange={(value) => setFormData({ ...formData, categoriaId: value })}
                  >
                    <SelectTrigger className="rounded-full">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem-categoria">Sem categoria</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id!}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categories.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma categoria disponível. Crie uma categoria primeiro.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor (Opcional)</Label>
                  <Input
                    id="fornecedor"
                    value={formData.fornecedor}
                    onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                    placeholder="Nome do fornecedor"
                    className="rounded-full"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} className="rounded-full">
                    {loading ? "A guardar..." : editingMaterial ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearFilters}
        placeholder="Buscar por nome, fornecedor, unidade ou categoria..."
        resultCount={totalFilteredResults}
        totalCount={materiais.length}
      >
        <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[240px] rounded-full">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            <SelectItem value="sem-categoria">Sem categoria</SelectItem>
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
            Limpar filtros
          </Button>
        )}
      </ListToolbar>

      {/* Materiais Grouped by Category */}
      {Object.keys(materialsByCategory).length > 0 ? (
        Object.entries(materialsByCategory).map(([categoryName, materialsInGroup]) => (
          <div key={categoryName} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold mt-6 mb-4">{categoryName}</h2>
              <Badge variant="secondary" className="text-xs">
                {materialsInGroup.length} {materialsInGroup.length === 1 ? "item" : "itens"}
              </Badge>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {materialsInGroup.map((material, index) => (
                <Card key={material.id} className="animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 shrink-0 bg-primary rounded-full flex items-center justify-center self-start">
                          <Package className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base leading-snug break-words">{material.nome}</CardTitle>
                          <CardDescription className="truncate">
                            {material.fornecedor || "Sem fornecedor"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{material.unidade}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Preço Unitário:</span>
                        <span className="font-medium">{formatCurrency(material.precoUnitario)}</span>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(material)}
                        className="rounded-full"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDelete(material.id!)}
                        className="rounded-full text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      ) : hasActiveFilters ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum material encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">Tente ajustar os filtros ou termos de busca.</p>
            <Button onClick={clearFilters} variant="outline" className="rounded-full bg-transparent">
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum material cadastrado</h3>
            <p className="text-muted-foreground text-center mb-4">Comece por adicionar materiais ao seu inventário.</p>
            <Button onClick={() => setIsDialogOpen(true)} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Material
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
