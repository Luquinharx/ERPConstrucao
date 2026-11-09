"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CampoNumerico } from "@/components/ui/campo-numerico"
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
import { Plus, Edit, Trash2, Search, X, Minus } from "lucide-react"
import { FirebaseService, getFuncoes } from "@/lib/firebase-service"
import type {
  Servico,
  Material,
  Funcionario,
  FuncaoMaoObra,
  ServicoComposicaoItem,
  ServicoGrupoComposicao,
  TipoMedicao,
} from "@/lib/types"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { recalcularComposicao } from "@/lib/composicao-catalogo"
import { MEDICOES, especialidadesDe } from "@/lib/precificacao"
import { custoMedioFuncao, nomeUnidade } from "@/lib/produto-calculos"
import {
  GRUPOS_COMPOSICAO,
  calcularPrecoUnitario,
  calcularTotaisComposicao,
  calcularTotalLinha,
  migrarComposicaoLegada,
} from "@/lib/service-composition"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { formatCurrency, matchesSearch, round2, toFixed2 } from "@/lib/utils"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { Checkbox } from "@/components/ui/checkbox"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
import { SERVICE_CATEGORY_PRESETS, getServiceCategoryName } from "@/lib/service-categories"
import { v4 as uuidv4 } from "uuid"
import { m, t } from "@/lib/i18n"

interface ServicoFormState {
  nome: string
  descricao: string
  unidade: string
  categoriaId: string
  categoriaNome: string
  /** Quantidade para a qual a composicao foi montada (ex.: 10 m2). */
  quantidadeReferencia: number
  composicao: ServicoComposicaoItem[]
  observacoes: string
  especialidadeId: string
  /** "" = quantidade manual no orcamento. */
  medicaoPadrao: string
}

const UNIDADES_MEDIDA = ["m2", "m", "unidade", "hora", "dia", "projeto", "litro", "kg"]
const UNIDADES_LINHA = ["h", "dia", "un", "m2", "m", "kg", "litro", "vg", "cj"]

/** Rótulo mostrado de cada unidade (o código gravado não muda). */
const ROTULOS_UNIDADE: Record<string, string> = {
  unidade: m("unidade"),
  hora: m("hora"),
  dia: m("dia"),
  projeto: m("projeto"),
  litro: m("litro"),
  un: m("un"),
  vg: m("vg"),
  cj: m("cj"),
}

function rotuloUnidade(unidade: string | undefined): string {
  const rotulo = unidade ? ROTULOS_UNIDADE[unidade] : undefined
  return rotulo ? t(rotulo) : nomeUnidade(unidade)
}

function getDefaultFormData(): ServicoFormState {
  return {
    nome: "",
    descricao: "",
    unidade: "m2",
    categoriaId: SERVICE_CATEGORY_PRESETS[0].id,
    categoriaNome: "",
    quantidadeReferencia: 10,
    composicao: [],
    observacoes: "",
    especialidadeId: "civil",
    medicaoPadrao: "",
  }
}

/** Linha em branco para preenchimento manual dentro de um grupo. */
function novaLinha(grupo: ServicoGrupoComposicao): ServicoComposicaoItem {
  return {
    id: uuidv4(),
    grupo,
    nome: "",
    unidade: grupo === "mao_obra" ? "h" : "un",
    quantidadePadrao: 1,
    quantidadePontual: 1,
    precoUnitario: 0,
    total: 0,
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
  const { pode } = usePermissoes()

  const [formData, setFormData] = useState<ServicoFormState>(getDefaultFormData())
  const [activeTab, setActiveTab] = useState("sobre")

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [funcoes, setFuncoes] = useState<FuncaoMaoObra[]>([])
  const { configuracao } = useConfiguracao()
  const catalogo = { materiais, funcionarios, funcoes, grupos: configuracao.gruposImpostos || [] }

  const totais = useMemo(() => calcularTotaisComposicao(formData.composicao), [formData.composicao])
  const precoUnitario = useMemo(
    () => calcularPrecoUnitario(totais.total, formData.quantidadeReferencia),
    [totais.total, formData.quantidadeReferencia],
  )

  useEffect(() => {
    if (user) {
      loadServicos()
      loadMateriais()
      loadFuncionarios()
      getFuncoes()
        .then((lista) => setFuncoes(lista.filter((f) => f.ativo !== false)))
        .catch(() => setFuncoes([]))
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

  const loadFuncionarios = async () => {
    if (!user) return
    try {
      const data = await FirebaseService.getFuncionarios(user.uid)
      setFuncionarios(data.filter((item) => item.ativo))
    } catch (error) {
      console.error("Erro ao carregar funcionarios:", error)
    }
  }

  // --- Manipulacao das linhas da composicao

  const adicionarLinha = (grupo: ServicoGrupoComposicao) => {
    setFormData((prev) => ({ ...prev, composicao: [...prev.composicao, novaLinha(grupo)] }))
  }

  const atualizarLinha = (id: string, campos: Partial<ServicoComposicaoItem>) => {
    setFormData((prev) => ({
      ...prev,
      composicao: prev.composicao.map((linha) => {
        if (linha.id !== id) return linha
        const atualizada = { ...linha, ...campos }
        return { ...atualizada, total: calcularTotalLinha(atualizada) }
      }),
    }))
  }

  const removerLinha = (id: string) => {
    setFormData((prev) => ({ ...prev, composicao: prev.composicao.filter((linha) => linha.id !== id) }))
  }

  /** Preenche a linha a partir de um material cadastrado. */
  const aplicarMaterial = (id: string, materialId: string) => {
    const material = materiais.find((item) => item.id === materialId)
    if (!material) return
    atualizarLinha(id, {
      materialId,
      funcionarioId: "",
      nome: material.nome,
      unidade: material.unidade || "un",
      precoUnitario: round2(material.precoUnitario),
    })
  }

  /**
   * Preenche a linha de mao de obra a partir de um funcionario.
   *
   * Usa o CUSTO REAL por hora, nao o valor de venda: a composicao e uma conta
   * de custo, e a margem e aplicada uma unica vez, no orcamento. Usar o valor de
   * venda aqui faria a margem ser cobrada duas vezes sobre a mao de obra.
   */
  const aplicarFuncionario = (id: string, funcionarioId: string) => {
    // "funcao:<id>": a linha fica ligada a funcao e usa o custo medio da equipa
    if (funcionarioId.startsWith("funcao:")) {
      const funcao = funcoes.find((item) => item.id === funcionarioId.slice(7))
      if (!funcao) return
      atualizarLinha(id, {
        funcaoId: funcao.id,
        funcionarioId: "",
        materialId: "",
        nome: funcao.nome,
        unidade: "h",
        precoUnitario: custoMedioFuncao(funcao, funcionarios),
      })
      return
    }
    const funcionario = funcionarios.find((item) => item.id === funcionarioId)
    if (!funcionario) return
    atualizarLinha(id, {
      funcionarioId,
      funcaoId: "",
      materialId: "",
      nome: funcionario.funcao || funcionario.nome,
      unidade: "h",
      precoUnitario: round2(funcionario.custoHoraCalculado ?? funcionario.custoHora ?? 0),
    })
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
        title: t("Erro ao carregar serviços"),
        description: t("Não foi possível carregar a lista de serviços."),
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
        title: t("Nome obrigatório"),
        description: t("Indique o nome do serviço."),
        variant: "destructive",
      })
      setActiveTab("sobre")
      return
    }

    setLoading(true)
    try {
      const categoriaNomeFinal =
        formData.categoriaId === "outros"
          ? formData.categoriaNome.trim() || t("Outros")
          : getServiceCategoryName(formData.categoriaId)

      // Linhas em branco (sem nome e sem valor) nao sao gravadas
      const composicaoLimpa = formData.composicao
        .filter((linha) => linha.nome.trim() || linha.precoUnitario > 0)
        .map((linha) => ({ ...linha, nome: linha.nome.trim(), total: calcularTotalLinha(linha) }))

      const totaisFinais = calcularTotaisComposicao(composicaoLimpa)
      const quantidadeReferencia = Number(formData.quantidadeReferencia) || 1

      const servicoData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim(),
        unidade: formData.unidade,
        categoriaId: formData.categoriaId,
        categoriaNome: categoriaNomeFinal,
        especialidadeId: formData.especialidadeId || "civil",
        medicaoPadrao: (formData.medicaoPadrao || undefined) as TipoMedicao | undefined,
        quantidadeReferencia,
        composicao: composicaoLimpa,
        totalComposicao: totaisFinais.total,
        // preco = custo por unidade: total da composicao / quantidade de referencia
        preco: calcularPrecoUnitario(totaisFinais.total, quantidadeReferencia),
        // Totais por grupo, uteis para relatorios
        consumiveis: totaisFinais.porGrupo.materiais,
        maoDeObra: totaisFinais.porGrupo.mao_obra,
        transporte: totaisFinais.porGrupo.transporte,
        observacoes: formData.observacoes.trim(),
      }

      if (editingServico) {
        await FirebaseService.updateServico(editingServico.id!, servicoData)
        toast({
          title: t("Serviço atualizado"),
          description: t("Os dados do serviço foram atualizados com sucesso."),
        })
      } else {
        await FirebaseService.addServico(servicoData, user.uid)
        toast({
          title: t("Serviço registado"),
          description: t("O serviço foi registado com sucesso."),
        })
      }

      resetForm()
      setIsDialogOpen(false)
      await loadServicos()
    } catch (error) {
      console.error("Erro ao salvar servico:", error)
      toast({
        title: t("Erro ao guardar serviço"),
        description: t("Não foi possível guardar os dados do serviço."),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (servico: Servico) => {
    // Servicos gravados no formato antigo sao convertidos para a composicao com grupos
    const { composicao, quantidadeReferencia } = migrarComposicaoLegada(servico)

    setEditingServico(servico)
    setFormData({
      nome: servico.nome,
      descricao: servico.descricao || "",
      unidade: servico.unidade || "m2",
      categoriaId: servico.categoriaId || "outros",
      categoriaNome: servico.categoriaNome || "",
      quantidadeReferencia,
      composicao,
      observacoes: servico.observacoes || "",
      especialidadeId: servico.especialidadeId || "civil",
      medicaoPadrao: servico.medicaoPadrao || "",
    })
    setActiveTab("sobre")
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("Tem a certeza de que pretende eliminar este serviço?"))) return

    try {
      await FirebaseService.deleteServico(id)
      toast({
        title: t("Serviço eliminado"),
        description: t("O serviço foi eliminado com sucesso."),
      })
      await loadServicos()
    } catch (error) {
      console.error("Erro ao excluir servico:", error)
      toast({
        title: t("Erro ao eliminar serviço"),
        description: t("Não foi possível eliminar o serviço."),
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData(getDefaultFormData())
    setEditingServico(null)
    setActiveTab("sobre")
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Serviços")}</h1>
          <p className="text-muted-foreground">{t("Faça a gestão dos serviços, com categoria e composição de custo")}</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) resetForm()
            setIsDialogOpen(open)
          }}>
            <DialogTrigger asChild>
              <Button disabled={!pode("servicos.gerir")} onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                {t("Novo Serviço")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1100px] max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingServico ? t("Editar Serviço") : t("Novo Serviço")}</DialogTitle>
                <DialogDescription>
                  {editingServico ? t("Atualize as informações do serviço.") : t("Adicione um novo serviço ao sistema.")}
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sobre">{t("Sobre")}</TabsTrigger>
                  <TabsTrigger value="composicao">{t("Composição do Serviço")}</TabsTrigger>
                </TabsList>
                
                <form onSubmit={handleSubmit} className="mt-4 space-y-5">
                  <TabsContent value="sobre" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">{t("Nome do Serviço")}</Label>
                        <Input
                          id="nome"
                          value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                          placeholder={t("Ex.: Pintura de parede interior")}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unidade">{t("Unidade de Medida")}</Label>
                        <Select value={formData.unidade} onValueChange={(value) => setFormData({ ...formData, unidade: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("Selecione a unidade")} />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {UNIDADES_MEDIDA.map((unidade) => (
                              <SelectItem key={unidade} value={unidade}>
                                {rotuloUnidade(unidade)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("Categoria")}</Label>
                        <Select
                          value={formData.categoriaId}
                          onValueChange={(value) => setFormData({ ...formData, categoriaId: value, categoriaNome: "" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("Selecione a categoria")} />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {SERVICE_CATEGORY_PRESETS.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {t(category.nome)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.categoriaId === "outros" && (
                        <div className="space-y-2">
                          <Label htmlFor="categoriaNome">{t("Nome da Categoria")}</Label>
                          <Input
                            id="categoriaNome"
                            value={formData.categoriaNome}
                            onChange={(e) => setFormData({ ...formData, categoriaNome: e.target.value })}
                            placeholder={t("Escreva a categoria")}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("Especialidade (margem)")}</Label>
                        <Select
                          value={formData.especialidadeId}
                          onValueChange={(especialidadeId) => setFormData({ ...formData, especialidadeId })}
                        >
                          <SelectTrigger aria-label={t("Especialidade")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {especialidadesDe(configuracao).map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {t(e.nome)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("Quantidade no orçamento")}</Label>
                        <Select
                          value={formData.medicaoPadrao || "__manual"}
                          onValueChange={(v) => setFormData({ ...formData, medicaoPadrao: v === "__manual" ? "" : v })}
                        >
                          <SelectTrigger aria-label={t("Medição padrão")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__manual">{t("Escrita à mão")}</SelectItem>
                            {(Object.keys(MEDICOES) as TipoMedicao[]).map((med) => (
                              <SelectItem key={med} value={med}>
                                {t("{medicao} da divisão", { medicao: t(MEDICOES[med].nome) })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descricao">{t("Descrição")}</Label>
                      <Textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder={t("Descreva o serviço em detalhe...")}
                        rows={3}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="composicao" className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm">
                      <span className="text-muted-foreground">
                        {t(
                          "Linhas ligadas a um produto, funcionário ou função vão buscar o custo ao catálogo. No orçamento usa-se sempre o preço atual.",
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => {
                          const atualizada = recalcularComposicao(formData.composicao, catalogo)
                          const mudaram = atualizada.filter(
                            (l, i) => l.precoUnitario !== formData.composicao[i].precoUnitario,
                          ).length
                          setFormData({ ...formData, composicao: atualizada })
                          toast({
                            title: mudaram
                              ? mudaram === 1
                                ? t("{n} linha atualizada", { n: mudaram })
                                : t("{n} linhas atualizadas", { n: mudaram })
                              : t("Os preços já estavam atualizados"),
                          })
                        }}
                      >
                        {t("Atualizar preços do catálogo")}
                      </Button>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="quantidadeReferencia">
                            {t("Composição montada para quantos {unidade}?", { unidade: rotuloUnidade(formData.unidade) })}
                          </Label>
                          <CampoNumerico
                            id="quantidadeReferencia"
                            min={0.01}
                            value={formData.quantidadeReferencia}
                            onChange={(quantidadeReferencia) => setFormData({ ...formData, quantidadeReferencia })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("Preço por {unidade} (calculado)", { unidade: rotuloUnidade(formData.unidade) })}</Label>
                          <div className="flex h-10 items-center rounded-md border bg-background px-3">
                            <span className="text-lg font-semibold text-primary">
                              {formatCurrency(precoUnitario)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "Registe abaixo tudo o que gasta para executar {quantidade} {unidade}. O sistema divide o total pela quantidade de referência e chega ao preço unitário: {total} / {quantidade} = {preco} por {unidade}.",
                          {
                            quantidade: toFixed2(formData.quantidadeReferencia),
                            unidade: rotuloUnidade(formData.unidade),
                            total: formatCurrency(totais.total),
                            preco: formatCurrency(precoUnitario),
                          },
                        )}
                      </p>
                    </div>

                    {GRUPOS_COMPOSICAO.map((grupo) => {
                      const linhas = formData.composicao.filter((linha) => linha.grupo === grupo.id)
                      const totalGrupo = totais.porGrupo[grupo.id] || 0

                      return (
                        <div key={grupo.id} className="rounded-lg border overflow-hidden">
                          <div className={`flex items-center justify-between gap-3 px-4 py-2 border-b ${grupo.cor}`}>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">{t(grupo.nome)}</div>
                              <div className="text-xs opacity-80">{t(grupo.descricao)}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="text-sm font-semibold">{formatCurrency(totalGrupo)}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => adicionarLinha(grupo.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                {t("Linha")}
                              </Button>
                            </div>
                          </div>

                          {linhas.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-muted-foreground">
                              {t("Nenhuma linha neste grupo.")}
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              {/*
                                table-fixed com larguras explicitas: em table-auto uma descricao
                                longa esmagava as colunas de quantidade ate ficarem ilegiveis.
                                min-w garante barra horizontal em vez de colunas espremidas.
                              */}
                              <Table className="w-full min-w-[840px] table-fixed [&_th]:px-2 [&_td]:px-2 [&_td]:py-2">
                                <TableHeader>
                                  <TableRow className="bg-muted/60">
                                    <TableHead className="w-auto">{t("Descrição")}</TableHead>
                                    <TableHead className="w-[96px]">{t("UN")}</TableHead>
                                    <TableHead className="w-[108px] text-center">{t("Qtd. padrão")}</TableHead>
                                    <TableHead className="w-[108px] text-center">{t("Qtd. pontual")}</TableHead>
                                    <TableHead className="w-[116px] text-right">{t("V. UN")}</TableHead>
                                    <TableHead className="w-[112px] text-right">{t("V. TOTAL")}</TableHead>
                                    <TableHead className="w-[44px]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {linhas.map((linha) => {
                                    const desligada = Number(linha.quantidadePontual) === 0
                                    return (
                                      <TableRow key={linha.id} className={desligada ? "opacity-50" : ""}>
                                        <TableCell className="max-w-0 space-y-1 align-top">
                                          <Input
                                            value={linha.nome}
                                            onChange={(e) => atualizarLinha(linha.id, { nome: e.target.value })}
                                            placeholder={t("Descrição da linha")}
                                            title={linha.nome}
                                            className="h-8 w-full text-sm"
                                          />
                                          {grupo.id === "mao_obra" ? (
                                            <SeletorComBusca
                                              compacto
                                              valor={linha.funcaoId ? `funcao:${linha.funcaoId}` : linha.funcionarioId || ""}
                                              onChange={(value) => aplicarFuncionario(linha.id, value)}
                                              placeholder={t("Puxar de uma função ou funcionário...")}
                                              placeholderBusca={t("Procurar função ou funcionário...")}
                                              vazio={t("Nenhum funcionário encontrado.")}
                                              opcoes={[
                                                ...funcoes.map((funcao) => ({
                                                  valor: `funcao:${funcao.id}`,
                                                  rotulo: t("Função: {nome}", { nome: funcao.nome }),
                                                  detalhe: t("custo médio {valor}/h", {
                                                    valor: formatCurrency(custoMedioFuncao(funcao, funcionarios)),
                                                  }),
                                                })),
                                                ...funcionarios.map((funcionario) => ({
                                                valor: funcionario.id!,
                                                rotulo: funcionario.nome,
                                                detalhe: t("{funcao} - custo {valor}/h", {
                                                  funcao: funcionario.funcao,
                                                  valor: formatCurrency(funcionario.custoHoraCalculado ?? funcionario.custoHora ?? 0),
                                                }),
                                              })),
                                              ]}
                                            />
                                          ) : (
                                            <SeletorComBusca
                                              compacto
                                              valor={linha.materialId || ""}
                                              onChange={(value) => aplicarMaterial(linha.id, value)}
                                              placeholder={t("Puxar de um material...")}
                                              placeholderBusca={t("Procurar material...")}
                                              vazio={t("Nenhum material encontrado.")}
                                              opcoes={materiais.map((material) => ({
                                                valor: material.id!,
                                                rotulo: material.nome,
                                                detalhe: `${formatCurrency(material.precoUnitario)} / ${nomeUnidade(material.unidade)}`,
                                              }))}
                                            />
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Select
                                            value={linha.unidade}
                                            onValueChange={(value) => atualizarLinha(linha.id, { unidade: value })}
                                          >
                                            <SelectTrigger className="h-8 px-2 text-sm">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-72">
                                              {UNIDADES_LINHA.map((unidade) => (
                                                <SelectItem key={unidade} value={unidade}>
                                                  {rotuloUnidade(unidade)}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </TableCell>
                                        <TableCell>
                                          <CampoNumerico
                                            tamanho="sm"
                                            alinhamento="centro"
                                            min={0}
                                            value={linha.quantidadePadrao}
                                            onChange={(quantidadePadrao) => atualizarLinha(linha.id, { quantidadePadrao })}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <CampoNumerico
                                            tamanho="sm"
                                            alinhamento="centro"
                                            min={0}
                                            value={linha.quantidadePontual}
                                            onChange={(quantidadePontual) => atualizarLinha(linha.id, { quantidadePontual })}
                                            title={t("0 desliga a linha sem a apagar")}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <CampoNumerico
                                            tamanho="sm"
                                            min={0}
                                            value={linha.precoUnitario}
                                            onChange={(precoUnitario) => atualizarLinha(linha.id, { precoUnitario })}
                                          />
                                        </TableCell>
                                        <TableCell className="text-right text-sm font-medium">
                                          {formatCurrency(linha.total)}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => removerLinha(linha.id)}
                                          >
                                            <X className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className="space-y-2">
                      <Label htmlFor="observacoes">{t("Condições de Composição / Observações")}</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder={t("Observações internas sobre a execução e a composição")}
                        rows={2}
                      />
                    </div>

                    <div className="rounded-md border bg-muted/20 p-4 space-y-2">
                      {GRUPOS_COMPOSICAO.filter((grupo) => (totais.porGrupo[grupo.id] || 0) !== 0).map((grupo) => (
                        <div key={grupo.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t(grupo.nome)}:</span>
                          <span>{formatCurrency(totais.porGrupo[grupo.id] || 0)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-base font-semibold pt-2 border-t">
                        <span>
                          {t("Total para {quantidade} {unidade}:", {
                            quantidade: toFixed2(formData.quantidadeReferencia),
                            unidade: rotuloUnidade(formData.unidade),
                          })}
                        </span>
                        <span>{formatCurrency(totais.total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-semibold">
                        <span>{t("Preço por {unidade}:", { unidade: rotuloUnidade(formData.unidade) })}</span>
                        <span className="text-primary">{formatCurrency(precoUnitario)}</span>
                      </div>
                    </div>
                  </TabsContent>

                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      {t("Cancelar")}
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? t("A guardar...") : editingServico ? t("Atualizar") : t("Guardar")}
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
        placeholder={t("Pesquisar serviços por nome, descrição, categoria ou unidade...")}
        resultCount={filteredServicos.length}
        totalCount={servicos.length}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("Lista de Serviços")}</CardTitle>
          <CardDescription>
            {servicos.length === 1
              ? t("{n} serviço registado", { n: servicos.length })
              : t("{n} serviços registados", { n: servicos.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredServicos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{searchTerm ? t("Nenhum serviço encontrado.") : t("Nenhum serviço registado.")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Nome")}</TableHead>
                  <TableHead>{t("Categoria")}</TableHead>
                  <TableHead>{t("Unidade")}</TableHead>
                  <TableHead>{t("Composição")}</TableHead>
                  <TableHead>{t("Preço Final")}</TableHead>
                  <TableHead className="text-right">{t("Ações")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServicos.map((servico) => {
                  const referencia = Number(servico.quantidadeReferencia) || 0
                  const totalComposicao = round2(servico.totalComposicao ?? 0)
                  const linhas = servico.composicao?.length ?? 0
                  const formatoAntigo = !servico.composicao

                  return (
                    <TableRow key={servico.id}>
                      <TableCell className="font-medium">
                        <div>{servico.nome}</div>
                        <div className="text-xs text-muted-foreground max-w-xs truncate">{servico.descricao || t("Sem descrição")}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getServiceCategoryName(servico.categoriaId, servico.categoriaNome)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rotuloUnidade(servico.unidade)}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatoAntigo ? (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/50">
                            {t("Formato antigo - abrir e rever")}
                          </Badge>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            <div>
                              {t("{total} para {quantidade} {unidade}", {
                                total: formatCurrency(totalComposicao),
                                quantidade: toFixed2(referencia),
                                unidade: rotuloUnidade(servico.unidade),
                              })}
                            </div>
                            <div>
                              {linhas === 1
                                ? t("{n} linha na composição", { n: linhas })
                                : t("{n} linhas na composição", { n: linhas })}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(servico.preco || 0)}
                        <div className="text-xs font-normal text-muted-foreground">
                          {t("por {unidade}", { unidade: rotuloUnidade(servico.unidade) })}
                        </div>
                      </TableCell>
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