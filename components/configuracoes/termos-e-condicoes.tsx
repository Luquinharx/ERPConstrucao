"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { CONDICOES_GERAIS_MODELO } from "@/lib/condicoes-gerais"
import { useConfiguracao } from "@/hooks/use-configuracao"

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

export function TermosECondicoes() {
  const [termos, setTermos] = useState<TermoServico[]>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [editingTermo, setEditingTermo] = useState<TermoServico | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const { user } = useAuth()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()
  const { configuracao, guardar } = useConfiguracao()
  const [notas, setNotas] = useState<string[]>([])
  const [guardandoNotas, setGuardandoNotas] = useState(false)
  const [carregandoModelo, setCarregandoModelo] = useState(false)
  const [formAberto, setFormAberto] = useState(false)

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

  useEffect(() => {
    setNotas(configuracao.notasOrcamento || [])
  }, [configuracao.notasOrcamento])

  /** As notas vivem na configuracao da empresa, mas editam-se aqui, junto dos termos. */
  const guardarNotas = async () => {
    setGuardandoNotas(true)
    try {
      await guardar({ notasOrcamento: notas.filter((nota) => nota.trim()) })
      toast({ title: "Notas guardadas", description: "Passam a sair no rodape das propostas." })
    } catch (error) {
      toast({ title: "Erro ao guardar notas", description: "Tente novamente.", variant: "destructive" })
    } finally {
      setGuardandoNotas(false)
    }
  }

  /** Carrega as Condicoes Gerais da empresa como ponto de partida. */
  const carregarCondicoesGerais = async () => {
    if (!user) return
    if (!confirm(`Vao ser criados ${CONDICOES_GERAIS_MODELO.length} pontos das Condicoes Gerais. Os termos que ja existem nao sao apagados. Continuar?`)) return

    setCarregandoModelo(true)
    try {
      const base = termos.length
      await Promise.all(
        CONDICOES_GERAIS_MODELO.map((modelo, indice) =>
          addDoc(collection(db, "termos_servico"), {
            ...modelo,
            ativo: true,
            ordem: base + indice + 1,
            userId: user.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      )
      toast({
        title: "Condicoes Gerais carregadas",
        description: `${CONDICOES_GERAIS_MODELO.length} pontos criados. Edite o que precisar.`,
      })
      await loadTermos()
    } catch (error) {
      toast({ title: "Erro ao carregar", description: "Nao foi possivel criar os termos.", variant: "destructive" })
    } finally {
      setCarregandoModelo(false)
    }
  }

  const loadTermos = async () => {
    if (!user) return

    try {
      setPageLoading(true)
      // Base partilhada: os termos sao da empresa, nao de cada conta
      const q = query(collection(db, "termos_servico"))
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
      setFormAberto(false)
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
    setFormAberto(true)
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

  /**
   * Pre-visualizacao com o mesmo formato do documento impresso.
   *
   * Os titulos ja trazem a numeracao (1.1, 2.3...), entao nao se acrescenta
   * outra por cima, que era o que fazia sair "1. 1.1 Recursos Humanos".
   */
  const generatePreview = () => {
    const termosAtivos = termos.filter((t) => t.ativo)
    const seccoes = [
      { titulo: "1. Inclusoes", itens: termosAtivos.filter((t) => t.tipo === "termos") },
      { titulo: "2. Exclusoes", itens: termosAtivos.filter((t) => t.tipo === "regras") },
      { titulo: "3. Condicoes gerais", itens: termosAtivos.filter((t) => t.tipo === "condicoes") },
    ].filter((seccao) => seccao.itens.length > 0)

    return (
      <div className="space-y-5 bg-white p-6 text-black max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 border-b pb-3">
          <h1 className="text-lg font-bold">Condicoes gerais da {configuracao.nome}</h1>
          {configuracao.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={configuracao.logoUrl} alt={configuracao.nome} className="max-h-10 w-auto object-contain" />
          )}
        </div>

        {seccoes.map((seccao) => (
          <div key={seccao.titulo}>
            <h2 className="mb-2 border-b pb-1 text-sm font-bold text-orange-600">{seccao.titulo}</h2>
            {seccao.itens.map((termo) => (
              <div key={termo.id} className="mb-3">
                <h3 className="text-sm font-semibold">{termo.titulo}</h3>
                <div className="whitespace-pre-line text-sm text-gray-700">{termo.conteudo}</div>
              </div>
            ))}
          </div>
        ))}

        {seccoes.length === 0 && (
          <p className="text-sm text-gray-500">Nenhum termo ativo. Ative pelo menos um para aparecer na proposta.</p>
        )}
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
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Os termos ativos são anexados a cada proposta, depois das notas.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={carregarCondicoesGerais}
            disabled={carregandoModelo}
            className="rounded-full bg-transparent"
          >
            <FileText className="h-4 w-4 mr-2" />
            {carregandoModelo ? "A carregar..." : "Carregar Condições Gerais"}
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(true)} className="rounded-full bg-transparent">
            <Eye className="h-4 w-4 mr-2" />
            Pré-visualizar
          </Button>
          <Button
            onClick={() => {
              resetForm()
              setFormAberto(true)
            }}
            className="rounded-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo termo
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

      {/* Formulario num dialogo: a lista fica a vista e o ecra deixa de ter
          duas colunas a competir pela atencao */}
      <Dialog open={formAberto} onOpenChange={(aberto) => { if (!aberto) { setFormAberto(false); resetForm() } }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTermo ? "Editar termo" : "Novo termo"}</DialogTitle>
            <DialogDescription>
              {editingTermo ? "Atualize o termo selecionado." : "Adicione um novo termo ou condição."}
            </DialogDescription>
          </DialogHeader>
        <div>
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
        </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">

        {/* Notas da proposta: vivem na configuracao da empresa, editam-se aqui */}
        <Card>
          <CardHeader>
            <CardTitle>Notas da proposta</CardTitle>
            <CardDescription>
              Saem numeradas no rodapé de cada proposta, antes das condições. Uma nota por linha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={7}
              value={notas.join("\n")}
              onChange={(e) => setNotas(e.target.value.split("\n"))}
              placeholder="Condições de pagamento, validade da proposta, IVA..."
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {notas.filter((nota) => nota.trim()).length} nota(s). Também editável em Configurações.
              </p>
              <Button onClick={guardarNotas} disabled={guardandoNotas} className="rounded-full">
                <Save className="h-4 w-4 mr-2" />
                {guardandoNotas ? "A guardar..." : "Guardar notas"}
              </Button>
            </div>
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
            <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
              {filteredTermos.length > 0 ? (
                (["termos", "regras", "condicoes"] as const)
                  .map((tipo) => ({ tipo, lista: filteredTermos.filter((t) => t.tipo === tipo) }))
                  .filter(({ lista }) => lista.length > 0)
                  .map(({ tipo, lista }) => (
                    <div key={tipo} className="space-y-2">
                      <div className="sticky top-0 z-10 flex items-center justify-between bg-card/95 py-1 backdrop-blur">
                        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {TIPO_LABELS[tipo]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {lista.filter((t) => t.ativo).length} de {lista.length} ativos
                        </span>
                      </div>
                      {lista.map((termo) => (
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
                      ))}
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
