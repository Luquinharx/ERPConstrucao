"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Save, FileText, Eye, Edit, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { matchesSearch } from "@/lib/utils"

const TIPO_LABELS: Record<string, string> = {
  termos: "Termos",
  regras: "Regras",
  condicoes: "Condições",
}

interface TermoServico {
  id?: string
  titulo: string
  conteudo: string
  ativo: boolean
  tipo: "termos" | "regras" | "condicoes"
  ordem: number
  userId: string
  createdAt: Date
  updatedAt: Date
}

export default function TermosPage() {
  const [termos, setTermos] = useState<TermoServico[]>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [editingTermo, setEditingTermo] = useState<TermoServico | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const { user } = useAuth()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const [formData, setFormData] = useState({
    titulo: "",
    conteudo: "",
    ativo: true,
    tipo: "termos" as "termos" | "regras" | "condicoes",
    ordem: 1,
  })

  useEffect(() => {
    if (user) {
      loadTermos()
    }
  }, [user])

  const loadTermos = async () => {
    if (!user) return

    try {
      setPageLoading(true)
      const q = query(collection(db, "termos_servico"), where("userId", "==", user.uid))
      const querySnapshot = await getDocs(q)
      const termosData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as TermoServico[]

      // Ordenar por ordem e depois por tipo
      termosData.sort((a, b) => {
        if (a.tipo !== b.tipo) {
          const tipoOrder = { termos: 1, regras: 2, condicoes: 3 }
          return tipoOrder[a.tipo] - tipoOrder[b.tipo]
        }
        return a.ordem - b.ordem
      })

      setTermos(termosData)
    } catch (error) {
      console.error("Erro ao carregar termos:", error)
      toast({
        title: "Erro ao carregar termos",
        description: "Não foi possível carregar os termos de serviço.",
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
      if (editingTermo) {
        await updateDoc(doc(db, "termos_servico", editingTermo.id!), {
          ...formData,
          updatedAt: new Date(),
        })
        toast({
          title: "Termo atualizado",
          description: "O termo foi atualizado com sucesso.",
        })
      } else {
        await addDoc(collection(db, "termos_servico"), {
          ...formData,
          userId: user.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        toast({
          title: "Termo criado",
          description: "O termo foi criado com sucesso.",
        })
      }

      resetForm()
      await loadTermos()
    } catch (error) {
      console.error("Erro ao salvar termo:", error)
      toast({
        title: "Erro ao salvar termo",
        description: "Não foi possível salvar o termo.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (termo: TermoServico) => {
    setEditingTermo(termo)
    setFormData({
      titulo: termo.titulo,
      conteudo: termo.conteudo,
      ativo: termo.ativo,
      tipo: termo.tipo,
      ordem: termo.ordem,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este termo?")) return

    try {
      await deleteDoc(doc(db, "termos_servico", id))
      toast({
        title: "Termo excluído",
        description: "O termo foi excluído com sucesso.",
      })
      await loadTermos()
    } catch (error) {
      console.error("Erro ao excluir termo:", error)
      toast({
        title: "Erro ao excluir termo",
        description: "Não foi possível excluir o termo.",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      titulo: "",
      conteudo: "",
      ativo: true,
      tipo: "termos",
      ordem: 1,
    })
    setEditingTermo(null)
  }

  const filteredTermos = termos.filter((termo) =>
    matchesSearch(searchTerm, [
      termo.titulo,
      termo.conteudo,
      TIPO_LABELS[termo.tipo],
      termo.ativo ? "ativo" : "inativo",
    ]),
  )

  const generatePreview = () => {
    const termosAtivos = termos.filter((t) => t.ativo)
    const termosAgrupados = {
      termos: termosAtivos.filter((t) => t.tipo === "termos"),
      regras: termosAtivos.filter((t) => t.tipo === "regras"),
      condicoes: termosAtivos.filter((t) => t.tipo === "condicoes"),
    }

    return (
      <div className="space-y-6 p-6 bg-white text-black max-h-[70vh] overflow-y-auto">
        <div className="text-center border-b pb-4">
          <h1 className="text-2xl font-bold">TERMOS E CONDIÇÕES DE SERVIÇO</h1>
          <p className="text-sm text-gray-600 mt-2">Serviços de Pintura Profissional</p>
        </div>

        {termosAgrupados.termos.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">TERMOS DE SERVIÇO</h2>
            {termosAgrupados.termos.map((termo, index) => (
              <div key={termo.id} className="mb-4">
                <h3 className="font-medium mb-2">
                  {index + 1}. {termo.titulo}
                </h3>
                <div className="text-sm text-gray-700 whitespace-pre-line pl-4">{termo.conteudo}</div>
              </div>
            ))}
          </div>
        )}

        {termosAgrupados.regras.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">REGRAS E POLÍTICAS</h2>
            {termosAgrupados.regras.map((termo, index) => (
              <div key={termo.id} className="mb-4">
                <h3 className="font-medium mb-2">
                  {index + 1}. {termo.titulo}
                </h3>
                <div className="text-sm text-gray-700 whitespace-pre-line pl-4">{termo.conteudo}</div>
              </div>
            ))}
          </div>
        )}

        {termosAgrupados.condicoes.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">CONDIÇÕES GERAIS</h2>
            {termosAgrupados.condicoes.map((termo, index) => (
              <div key={termo.id} className="mb-4">
                <h3 className="font-medium mb-2">
                  {index + 1}. {termo.titulo}
                </h3>
                <div className="text-sm text-gray-700 whitespace-pre-line pl-4">{termo.conteudo}</div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-4 text-xs text-gray-500">
          <p>Documento gerado automaticamente em {new Date().toLocaleDateString("pt-PT")}</p>
        </div>
      </div>
    )
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "termos":
        return "Termos"
      case "regras":
        return "Regras"
      case "condicoes":
        return "Condições"
      default:
        return tipo
    }
  }

  const getTipoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case "termos":
        return "default"
      case "regras":
        return "secondary"
      case "condicoes":
        return "outline"
      default:
        return "default"
    }
  }

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
          <h1 className="text-3xl font-bold">Termos e Condições</h1>
          <p className="text-muted-foreground mt-2">Gerir termos de serviço que serão anexados aos orçamentos</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setShowPreview(true)} className="rounded-full bg-transparent">
            <Eye className="h-4 w-4 mr-2" />
            Pré-visualizar
          </Button>
          <Button onClick={resetForm} className="rounded-full">
            <Plus className="h-4 w-4 mr-2" />
            Novo Termo
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-black">Pré-visualização dos Termos</h2>
              <Button variant="ghost" onClick={() => setShowPreview(false)} className="text-black hover:bg-gray-100">
                ✕
              </Button>
            </div>
            {generatePreview()}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {editingTermo ? "Editar Termo" : "Novo Termo"}
            </CardTitle>
            <CardDescription>
              {editingTermo ? "Atualize o termo selecionado" : "Adicione um novo termo ou condição"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <select
                    id="tipo"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                    className="w-full p-2 border rounded-full"
                    required
                  >
                    <option value="termos">Termos de Serviço</option>
                    <option value="regras">Regras e Políticas</option>
                    <option value="condicoes">Condições Gerais</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordem">Ordem</Label>
                  <Input
                    id="ordem"
                    type="number"
                    min="1"
                    value={formData.ordem}
                    onChange={(e) => setFormData({ ...formData, ordem: Number.parseInt(e.target.value) || 1 })}
                    className="rounded-full"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex: Prazo de Execução"
                  className="rounded-full"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conteudo">Conteúdo</Label>
                <Textarea
                  id="conteudo"
                  value={formData.conteudo}
                  onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                  placeholder="Descreva o termo ou condição..."
                  rows={6}
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Termo ativo (será incluído nos orçamentos)</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                {editingTermo && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={loading} className="rounded-full">
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />A guardar...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingTermo ? "Atualizar" : "Criar"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Termos */}
        <Card>
          <CardHeader>
            <CardTitle>Termos Cadastrados</CardTitle>
            <CardDescription>
              {termos.filter((t) => t.ativo).length} termos ativos de {termos.length} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <ListToolbar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onClear={clearSearch}
                placeholder="Pesquisar termos por titulo, conteudo ou tipo..."
                resultCount={filteredTermos.length}
                totalCount={termos.length}
              />
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredTermos.length > 0 ? (
                filteredTermos.map((termo) => (
                  <div key={termo.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getTipoBadgeVariant(termo.tipo)}>{getTipoLabel(termo.tipo)}</Badge>
                          <span className="text-xs text-muted-foreground">#{termo.ordem}</span>
                          {termo.ativo && (
                            <Badge variant="outline" className="text-xs">
                              Ativo
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium">{termo.titulo}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{termo.conteudo}</p>
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(termo)} className="h-8 w-8">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(termo.id!)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {termos.length > 0 ? "Nenhum termo encontrado" : "Nenhum termo cadastrado"}
                  </h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {termos.length > 0
                      ? `Nenhum resultado para "${searchTerm}".`
                      : "Comece criando termos e condições para seus orçamentos."}
                  </p>
                  {termos.length > 0 && (
                    <Button onClick={clearSearch} variant="outline" className="rounded-full">
                      Limpar pesquisa
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
