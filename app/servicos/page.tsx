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
import { Plus, Edit, Trash2, Search, RefreshCw } from "lucide-react"
import { FirebaseService } from "@/lib/firebase-service"
import type { Servico } from "@/lib/types"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { formatCurrency } from "@/lib/utils"
import { SERVICE_CATEGORY_PRESETS, getServiceCategoryName } from "@/lib/service-categories"

interface ServicoFormState {
  nome: string
  descricao: string
  unidade: string
  categoriaId: string
  categoriaNome: string
  maoDeObra: number
  consumiveis: number
  itens: number
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
    maoDeObra: 0,
    consumiveis: 0,
    itens: 0,
    transporte: 0,
    observacoes: "",
  }
}

function calculateComposicaoTotal(formData: ServicoFormState): number {
  return (Number(formData.maoDeObra) || 0) + (Number(formData.consumiveis) || 0) + (Number(formData.itens) || 0) + (Number(formData.transporte) || 0)
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingServico, setEditingServico] = useState<Servico | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { user } = useAuth()

  const [formData, setFormData] = useState<ServicoFormState>(getDefaultFormData())

  const composicaoTotal = useMemo(() => calculateComposicaoTotal(formData), [formData])

  useEffect(() => {
    if (user) {
      loadServicos()
    }
  }, [user])

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
      return
    }

    setLoading(true)
    try {
      const categoriaNomeFinal =
        formData.categoriaId === "outros"
          ? formData.categoriaNome.trim() || "Outros"
          : getServiceCategoryName(formData.categoriaId)

      const servicoData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim(),
        unidade: formData.unidade,
        categoriaId: formData.categoriaId,
        categoriaNome: categoriaNomeFinal,
        maoDeObra: Number(formData.maoDeObra) || 0,
        consumiveis: Number(formData.consumiveis) || 0,
        itens: Number(formData.itens) || 0,
        transporte: Number(formData.transporte) || 0,
        preco: composicaoTotal,
        observacoes: formData.observacoes.trim(),
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
    const maoDeObra = Number(servico.maoDeObra ?? servico.preco ?? 0)
    const consumiveis = Number(servico.consumiveis ?? 0)
    const itens = Number(servico.itens ?? 0)
    const transporte = Number(servico.transporte ?? 0)

    setEditingServico(servico)
    setFormData({
      nome: servico.nome,
      descricao: servico.descricao || "",
      unidade: servico.unidade || "m2",
      categoriaId: servico.categoriaId || "outros",
      categoriaNome: servico.categoriaNome || "",
      maoDeObra,
      consumiveis,
      itens,
      transporte,
      observacoes: servico.observacoes || "",
    })
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
  }

  const filteredServicos = servicos.filter((servico) => {
    const categoriaNome = getServiceCategoryName(servico.categoriaId, servico.categoriaNome)
    return (
      servico.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (servico.descricao && servico.descricao.toLowerCase().includes(searchTerm.toLowerCase())) ||
      categoriaNome.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Servico
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingServico ? "Editar Servico" : "Novo Servico"}</DialogTitle>
                <DialogDescription>
                  {editingServico ? "Atualize as informacoes do servico." : "Adicione um novo servico ao sistema."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
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
                    <Label>Categoria (pre-definida)</Label>
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

                <div className="space-y-3">
                  <Label>Composicao do Servico</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maoDeObra">Mao de obra (EUR)</Label>
                      <Input
                        id="maoDeObra"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.maoDeObra}
                        onChange={(e) => setFormData({ ...formData, maoDeObra: Number.parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="consumiveis">Objetos / consumiveis (EUR)</Label>
                      <Input
                        id="consumiveis"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.consumiveis}
                        onChange={(e) => setFormData({ ...formData, consumiveis: Number.parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="itens">Itens (EUR)</Label>
                      <Input
                        id="itens"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.itens}
                        onChange={(e) => setFormData({ ...formData, itens: Number.parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transporte">Transporte (EUR)</Label>
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

                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Preco do servico (soma automatica)</span>
                      <span className="font-semibold">{formatCurrency(composicaoTotal)}</span>
                    </div>
                  </div>
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

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observacoes</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observacoes internas sobre composicao e execucao"
                    rows={2}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : editingServico ? "Atualizar" : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Servicos</CardTitle>
          <CardDescription>
            {servicos.length} servico{servicos.length !== 1 ? "s" : ""} cadastrado{servicos.length !== 1 ? "s" : ""}
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar servicos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
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
                  <TableHead>Preco</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServicos.map((servico) => {
                  const maoDeObra = Number(servico.maoDeObra ?? 0)
                  const consumiveis = Number(servico.consumiveis ?? 0)
                  const itens = Number(servico.itens ?? 0)
                  const transporte = Number(servico.transporte ?? 0)

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
                          <div>MO: {formatCurrency(maoDeObra)}</div>
                          <div>Cons.: {formatCurrency(consumiveis)}</div>
                          <div>Itens: {formatCurrency(itens)}</div>
                          <div>Transp.: {formatCurrency(transporte)}</div>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(servico.preco || 0)}</TableCell>
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
