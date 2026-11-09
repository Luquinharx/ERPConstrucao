"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CampoNumerico } from "@/components/ui/campo-numerico"
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
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, db } from "@/lib/db/cliente"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { matchesSearch } from "@/lib/utils"
import { CONDICOES_GERAIS_MODELO } from "@/lib/condicoes-gerais"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { t, m } from "@/lib/i18n"

const TIPO_LABELS: Record<string, string> = {
  termos: m("Termos"),
  regras: m("Regras"),
  condicoes: m("Condições"),
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
      toast({ title: t("Notas guardadas"), description: t("Passam a sair no rodapé das propostas.") })
    } catch (error) {
      toast({ title: t("Erro ao guardar as notas"), description: t("Tente novamente."), variant: "destructive" })
    } finally {
      setGuardandoNotas(false)
    }
  }

  /** Carrega as Condicoes Gerais da empresa como ponto de partida. */
  const carregarCondicoesGerais = async () => {
    if (!user) return
    if (
      !confirm(
        t("Vão ser criados {n} pontos das Condições Gerais. Os termos que já existem não são eliminados. Continuar?", {
          n: CONDICOES_GERAIS_MODELO.length,
        }),
      )
    )
      return

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
        title: t("Condições Gerais carregadas"),
        description: t("{n} pontos criados. Edite o que precisar.", { n: CONDICOES_GERAIS_MODELO.length }),
      })
      await loadTermos()
    } catch (error) {
      toast({ title: t("Erro ao carregar"), description: t("Não foi possível criar os termos."), variant: "destructive" })
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
        title: t("Erro ao carregar os termos"),
        description: t("Não foi possível carregar os termos de serviço."),
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
          title: t("Termo atualizado"),
          description: t("O termo foi atualizado com sucesso."),
        })
      } else {
        await addDoc(collection(db, "termos_servico"), {
          ...formData,
          userId: user.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        toast({
          title: t("Termo criado"),
          description: t("O termo foi criado com sucesso."),
        })
      }

      resetForm()
      setFormAberto(false)
      await loadTermos()
    } catch (error) {
      console.error("Erro ao salvar termo:", error)
      toast({
        title: t("Erro ao guardar o termo"),
        description: t("Não foi possível guardar o termo."),
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
    if (!confirm(t("Tem a certeza de que quer eliminar este termo?"))) return

    try {
      await deleteDoc(doc(db, "termos_servico", id))
      toast({
        title: t("Termo eliminado"),
        description: t("O termo foi eliminado com sucesso."),
      })
      await loadTermos()
    } catch (error) {
      console.error("Erro ao excluir termo:", error)
      toast({
        title: t("Erro ao eliminar o termo"),
        description: t("Não foi possível eliminar o termo."),
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
      t(TIPO_LABELS[termo.tipo]),
      termo.ativo ? t("ativo") : t("inativo"),
    ]),
  )

  /**
   * Pre-visualizacao com o mesmo formato do documento impresso.
   *
   * Os titulos ja trazem a numeracao (1.1, 2.3...), entao nao se acrescenta
   * outra por cima, que era o que fazia sair "1. 1.1 Recursos Humanos".
   */
  const generatePreview = () => {
    const termosAtivos = termos.filter((x) => x.ativo)
    const seccoes = [
      { titulo: t("1. Inclusões"), itens: termosAtivos.filter((x) => x.tipo === "termos") },
      { titulo: t("2. Exclusões"), itens: termosAtivos.filter((x) => x.tipo === "regras") },
      { titulo: t("3. Condições gerais"), itens: termosAtivos.filter((x) => x.tipo === "condicoes") },
    ].filter((seccao) => seccao.itens.length > 0)

    return (
      <div className="space-y-5 bg-white p-6 text-black max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 border-b pb-3">
          <h1 className="text-lg font-bold">{t("Condições gerais da {empresa}", { empresa: configuracao.nome })}</h1>
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
          <p className="text-sm text-gray-500">{t("Nenhum termo ativo. Ative pelo menos um para aparecer na proposta.")}</p>
        )}
      </div>
    )
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "termos":
        return t("Termos")
      case "regras":
        return t("Regras")
      case "condicoes":
        return t("Condições")
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
          {t("Os termos ativos são anexados a cada proposta, depois das notas.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={carregarCondicoesGerais}
            disabled={carregandoModelo}
            className="rounded-full bg-transparent"
          >
            <FileText className="h-4 w-4 mr-2" />
            {carregandoModelo ? t("A carregar...") : t("Carregar Condições Gerais")}
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(true)} className="rounded-full bg-transparent">
            <Eye className="h-4 w-4 mr-2" />
            {t("Pré-visualizar")}
          </Button>
          <Button
            onClick={() => {
              resetForm()
              setFormAberto(true)
            }}
            className="rounded-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("Novo termo")}
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-black">{t("Pré-visualização dos termos")}</h2>
              <Button
                variant="ghost"
                onClick={() => setShowPreview(false)}
                aria-label={t("Fechar")}
                className="text-black hover:bg-gray-100"
              >
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
            <DialogTitle>{editingTermo ? t("Editar termo") : t("Novo termo")}</DialogTitle>
            <DialogDescription>
              {editingTermo ? t("Atualize o termo selecionado.") : t("Adicione um novo termo ou condição.")}
            </DialogDescription>
          </DialogHeader>
        <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">{t("Tipo")}</Label>
                  <select
                    id="tipo"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                    className="w-full p-2 border rounded-full"
                    required
                  >
                    <option value="termos">{t("Termos de serviço")}</option>
                    <option value="regras">{t("Regras e políticas")}</option>
                    <option value="condicoes">{t("Condições gerais")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ordem">{t("Ordem")}</Label>
                  <CampoNumerico
                    id="ordem"
                    min={1}
                    decimais={0}
                    value={formData.ordem}
                    onChange={(ordem) => setFormData({ ...formData, ordem })}
                    className="rounded-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="titulo">{t("Título")}</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder={t("Ex.: Prazo de execução")}
                  className="rounded-full"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conteudo">{t("Conteúdo")}</Label>
                <Textarea
                  id="conteudo"
                  value={formData.conteudo}
                  onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                  placeholder={t("Descreva o termo ou condição...")}
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
                <Label htmlFor="ativo">{t("Termo ativo (será incluído nos orçamentos)")}</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                {editingTermo && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t("Cancelar")}
                  </Button>
                )}
                <Button type="submit" disabled={loading} className="rounded-full">
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      {t("A guardar...")}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingTermo ? t("Atualizar") : t("Criar")}
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
            <CardTitle>{t("Notas da proposta")}</CardTitle>
            <CardDescription>
              {t("Saem numeradas no rodapé de cada proposta, antes das condições. Uma nota por linha.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={7}
              value={notas.join("\n")}
              onChange={(e) => setNotas(e.target.value.split("\n"))}
              placeholder={t("Condições de pagamento, validade da proposta, IVA...")}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {notas.filter((nota) => nota.trim()).length === 1
                  ? t("{n} nota. Também editável em Configurações.", { n: 1 })
                  : t("{n} notas. Também editável em Configurações.", {
                      n: notas.filter((nota) => nota.trim()).length,
                    })}
              </p>
              <Button onClick={guardarNotas} disabled={guardandoNotas} className="rounded-full">
                <Save className="h-4 w-4 mr-2" />
                {guardandoNotas ? t("A guardar...") : t("Guardar notas")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Termos */}
        <Card>
          <CardHeader>
            <CardTitle>{t("Termos registados")}</CardTitle>
            <CardDescription>
              {t("{ativos} termos ativos de {total} no total", {
                ativos: termos.filter((x) => x.ativo).length,
                total: termos.length,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <ListToolbar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onClear={clearSearch}
                placeholder={t("Pesquisar termos por título, conteúdo ou tipo...")}
                resultCount={filteredTermos.length}
                totalCount={termos.length}
              />
            </div>
            <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
              {filteredTermos.length > 0 ? (
                (["termos", "regras", "condicoes"] as const)
                  .map((tipo) => ({ tipo, lista: filteredTermos.filter((x) => x.tipo === tipo) }))
                  .filter(({ lista }) => lista.length > 0)
                  .map(({ tipo, lista }) => (
                    <div key={tipo} className="space-y-2">
                      <div className="sticky top-0 z-10 flex items-center justify-between bg-card/95 py-1 backdrop-blur">
                        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {t(TIPO_LABELS[tipo])}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("{ativos} de {total} ativos", {
                            ativos: lista.filter((x) => x.ativo).length,
                            total: lista.length,
                          })}
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
                              {t("Ativo")}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium">{termo.titulo}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{termo.conteudo}</p>
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(termo)}
                          title={t("Editar")}
                          aria-label={t("Editar")}
                          className="h-8 w-8"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("Eliminar")}
                          aria-label={t("Eliminar")}
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
                    {termos.length > 0 ? t("Nenhum termo encontrado") : t("Nenhum termo registado")}
                  </h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {termos.length > 0
                      ? t("Nenhum resultado para \"{pesquisa}\".", { pesquisa: searchTerm })
                      : t("Comece por criar termos e condições para os seus orçamentos.")}
                  </p>
                  {termos.length > 0 && (
                    <Button onClick={clearSearch} variant="outline" className="rounded-full">
                      {t("Limpar pesquisa")}
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
