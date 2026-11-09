"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Tag } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import type { MaterialCategory } from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { matchesSearch } from "@/lib/utils"
import { t } from "@/lib/i18n"

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#64748b", // slate
  "#78716c", // stone
]

export default function CategoriasPage() {
  const [categories, setCategories] = useState<MaterialCategory[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MaterialCategory | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const { user } = useAuth()
  const { pode } = usePermissoes()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    cor: PRESET_COLORS[0],
  })

  useEffect(() => {
    if (user) {
      loadCategories()
    }
  }, [user])

  const loadCategories = async () => {
    if (!user) return

    try {
      setPageLoading(true)

      const categoriesData = await FirebaseService.getMaterialCategories(user.uid)

      setCategories(categoriesData)
    } catch (error) {
      console.error("❌ Erro ao carregar categorias:", error)
      toast({
        title: t("Erro ao carregar categorias"),
        description: t("Não foi possível carregar a lista de categorias."),
        variant: "destructive",
      })
    } finally {
      setPageLoading(false)
    }
  }

  const handleAddDefaultCategories = async () => {
    if (!user) return
    setLoading(true)
    try {
      // Ficam gravadas no idioma de quem as cria: a partir daí são dados do utilizador
      const defaultCategories = [
        { nome: t("Tintas e vernizes"), descricao: t("Tintas acrílicas, esmaltes, vernizes, epóxi, sprays"), cor: "#3b82f6" },
        { nome: t("Ferramentas"), descricao: t("Rolos, trinchas, pincéis, espátulas, talochas"), cor: "#f59e0b" },
        { nome: t("Preparação de superfícies"), descricao: t("Massas, primários, seladores, texturas"), cor: "#8b5cf6" },
        { nome: t("Lixas e abrasivos"), descricao: t("Lixas de parede, de água e de ferro, discos de lixa"), cor: "#10b981" },
        { nome: t("Fitas e proteção"), descricao: t("Fitas de pintor, lonas, papéis, plásticos de proteção"), cor: "#f97316" },
        { nome: t("Solventes e químicos"), descricao: t("Aguarrás, diluentes, decapantes"), cor: "#ef4444" },
        { nome: t("Limpeza e conservação"), descricao: t("Desperdícios, panos, detergentes, sabões"), cor: "#06b6d4" },
        { nome: t("Equipamentos de proteção (EPI)"), descricao: t("Máscaras, óculos, luvas, botas"), cor: "#22c55e" },
        { nome: t("Equipamentos e máquinas"), descricao: t("Compressores, pistolas de pintura, lixadoras"), cor: "#64748b" },
        { nome: t("Manutenção geral"), descricao: t("Material elétrico, canalização, ferragens"), cor: "#a8a29e" }
      ]

      await Promise.all(defaultCategories.map(cat => FirebaseService.addMaterialCategory({ ...cat, ativo: true }, user.uid)))
      
      toast({
        title: t("Categorias predefinidas adicionadas"),
        description: t("As categorias base para pintura e manutenção foram criadas com sucesso."),
      })
      await loadCategories()
    } catch (error) {
      console.error("❌ Erro ao adicionar categorias padrão:", error)
      toast({
        title: t("Erro"),
        description: t("Ocorreu um erro ao criar as categorias predefinidas."),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      if (editingCategory) {
        await FirebaseService.updateMaterialCategory(editingCategory.id!, formData)
        toast({
          title: t("Categoria atualizada"),
          description: t("Os dados da categoria foram atualizados com sucesso."),
        })
      } else {
        await FirebaseService.addMaterialCategory(formData, user.uid)
        toast({
          title: t("Categoria criada"),
          description: t("A categoria foi criada com sucesso."),
        })
      }

      resetForm()
      setIsDialogOpen(false)
      await loadCategories()
    } catch (error) {
      console.error("❌ Erro ao salvar categoria:", error)
      toast({
        title: t("Erro ao guardar a categoria"),
        description: t("Não foi possível guardar os dados da categoria."),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (category: MaterialCategory) => {
    setEditingCategory(category)
    setFormData({
      nome: category.nome,
      descricao: category.descricao || "",
      cor: category.cor || PRESET_COLORS[0],
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("Tem a certeza de que quer eliminar esta categoria?"))) return

    try {
      await FirebaseService.deleteMaterialCategory(id)
      toast({
        title: t("Categoria eliminada"),
        description: t("A categoria foi eliminada com sucesso."),
      })
      await loadCategories()
    } catch (error) {
      console.error("❌ Erro ao excluir categoria:", error)
      toast({
        title: t("Erro ao eliminar a categoria"),
        description: t("Não foi possível eliminar a categoria."),
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      nome: "",
      descricao: "",
      cor: PRESET_COLORS[0],
    })
    setEditingCategory(null)
  }

  const filteredCategories = categories.filter((category) =>
    matchesSearch(searchTerm, [category.nome, category.descricao]),
  )

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
          <h1 className="text-3xl font-bold">{t("Categorias de materiais")}</h1>
          <p className="text-muted-foreground mt-2">{t("Organize os seus materiais por categorias")}</p>
        </div>
        <div className="flex space-x-2">
          {categories.length === 0 && (
            <Button
              variant="outline"
              onClick={handleAddDefaultCategories}
              disabled={loading}
              className="rounded-full bg-transparent border-primary/20 hover:bg-primary/5"
            >
              {t("Adicionar categorias predefinidas")}
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!pode("materiais.gerir")} onClick={resetForm} className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                {t("Nova categoria")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingCategory ? t("Editar categoria") : t("Nova categoria")}</DialogTitle>
                <DialogDescription>
                  {editingCategory ? t("Atualize os dados da categoria.") : t("Adicione uma nova categoria de materiais.")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">{t("Nome da categoria")}</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder={t("Ex.: Tintas, Pincéis, Equipamentos")}
                    required
                    className="rounded-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">{t("Descrição (opcional)")}</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder={t("Descrição da categoria...")}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("Cor da categoria")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.cor === color ? "border-foreground" : "border-muted"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, cor: color })}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: formData.cor }} />
                    <span className="text-sm text-muted-foreground">{t("Cor selecionada")}</span>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t("Cancelar")}
                  </Button>
                  <Button type="submit" disabled={loading} className="rounded-full">
                    {loading ? t("A guardar...") : editingCategory ? t("Atualizar") : t("Criar")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearSearch}
        placeholder={t("Pesquisar categorias por nome ou descrição...")}
        resultCount={filteredCategories.length}
        totalCount={categories.length}
      />

      {/* Categories List */}
      {filteredCategories.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((category, index) => (
            <Card key={category.id} className="animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: category.cor }}
                    >
                      <Tag className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.nome}</CardTitle>
                      {category.descricao && (
                        <CardDescription className="line-clamp-2">{category.descricao}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: `${category.cor}20`,
                      color: category.cor,
                      borderColor: category.cor,
                    }}
                  >
                    {t("Categoria")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(category)} className="rounded-full">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(category.id!)}
                    className="rounded-full text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : categories.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("Nenhuma categoria encontrada")}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {t("Nenhum resultado para \"{termo}\".", { termo: searchTerm })}
            </p>
            <Button onClick={clearSearch} variant="outline" className="rounded-full">
              {t("Limpar pesquisa")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("Ainda não há categorias")}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {t("Comece por criar categorias para organizar os seus materiais.")}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setIsDialogOpen(true)} className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                {t("Criar a primeira categoria")}
              </Button>
              <Button onClick={handleAddDefaultCategories} disabled={loading} variant="secondary" className="rounded-full">
                {t("Adicionar categorias predefinidas")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
