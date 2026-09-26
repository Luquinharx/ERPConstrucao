"use client"

import type React from "react"
import { useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CustosObraFolha } from "@/components/orcamentos/custos-obra-folha"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { FirebaseService } from "@/lib/firebase-service"
import { analisarCustoObra, prepararParaGravar } from "@/lib/custos-obra"
import {
  SEM_AMBIENTE,
  TAXAS_IVA,
  addDays,
  agruparPorAmbiente,
  calculateBaseTributavel,
  calculateIVA,
  calculateItemTotal,
  calculateSubtotal,
  calculateSubtotalCusto,
  calculateTotalCusto,
  getCorAmbiente,
  getItemEstilo,
  getServicoPrecos,
  toDateInput,
} from "@/lib/orcamento-calculos"
import { TIPOS_DOCUMENTO, getTipoDocumento, numeroCompleto, numeroParaGravar, proximoNumero, tipoDoDocumento } from "@/lib/numeracao"
import { getServiceCategoryName } from "@/lib/service-categories"
import type {
  Cliente,
  Funcionario,
  ItemOrcamento,
  LinhaCustoObra,
  Orcamento,
  Servico,
  TipoDocumentoProposta,
} from "@/lib/types"
import { formatCurrency, formatNumber2, round2, toFixed2 } from "@/lib/utils"

interface OrcamentoFormState {
  /** Numero da proposta, editavel para corrigir sequencias. */
  numero: string
  /** Concurso ou obra: manda no prefixo e na contagem. */
  tipoDocumento: TipoDocumentoProposta
  clienteId: string
  cliente: Orcamento["cliente"]
  dataOrcamento: string
  dataValidade: string
  funcionariosSelecionados: string[]
  servicosSelecionados: string[]
  itens: ItemOrcamento[]
  /** Comodos do orcamento, pela ordem de apresentacao. */
  ambientes: string[]
  margemLucro: number
  /** Custo de transporte: linha propria no final do orcamento. */
  transporte: number
  /** Taxa de IVA (%) aplicada sobre a base tributavel. */
  taxaIVA: number
  observacoes: string
  /** Custos reais lancados na obra (aba propria). */
  custosObra: LinhaCustoObra[]
}

interface ServicoFormState {
  servicoId: string
  quantidade: number
  unidade: string
  precoUnitario: number
  precoFixo: number
  transporte: number
}

interface MaoObraFormState {
  funcionarioId: string
  quantidade: number
  unidade: string
  precoUnitario: number
  custoUnitario: number
}

function getDefaultServicoForm(): ServicoFormState {
  return { servicoId: "", quantidade: 1, unidade: "", precoUnitario: 0, precoFixo: 0, transporte: 0 }
}

function getDefaultMaoObraForm(): MaoObraFormState {
  return { funcionarioId: "", quantidade: 8, unidade: "horas", precoUnitario: 0, custoUnitario: 0 }
}

/** Abas, pela ordem em que uma proposta e normalmente preenchida. */
type Aba = "dados" | "itens" | "preco" | "resumo" | "custos"

interface OrcamentoEditorProps {
  /** null = proposta nova. */
  orcamento: Orcamento | null
  /** Todas as propostas, para a numeracao saber o proximo numero livre. */
  orcamentos: Orcamento[]
  clientes: Cliente[]
  funcionarios: Funcionario[]
  servicos: Servico[]
  onGuardado: () => void
  onCancelar: () => void
}

/**
 * Editor de uma proposta, repartido por abas.
 *
 * Era um formulario unico dentro de um modal, com quase mil linhas de scroll:
 * para mexer na margem passava-se por toda a lista de itens. As abas nao
 * mudam nenhuma conta, so deixam de obrigar a percorrer o que nao interessa.
 *
 * O estado e um so, partilhado pelas abas, porque tudo aqui se influencia -
 * um item novo mexe no total, que mexe na margem real da aba dos custos.
 */
export function OrcamentoEditor({
  orcamento,
  orcamentos,
  clientes,
  funcionarios,
  servicos,
  onGuardado,
  onCancelar,
}: OrcamentoEditorProps) {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode } = usePermissoes()

  const [aba, setAba] = useState<Aba>("dados")
  const [aGravar, setAGravar] = useState(false)

  const [formData, setFormData] = useState<OrcamentoFormState>(() => estadoInicial(orcamento, configuracao))
  const [servicoForm, setServicoForm] = useState<ServicoFormState>(getDefaultServicoForm())
  const [maoObraForm, setMaoObraForm] = useState<MaoObraFormState>(getDefaultMaoObraForm())

  /** Comodo em que os proximos itens serao lancados. */
  const [ambienteAtual, setAmbienteAtual] = useState("")
  const [novoAmbiente, setNovoAmbiente] = useState("")
  /** Comodos recolhidos, para nao ter de rolar tanto em orcamentos grandes. */
  const [ambientesRecolhidos, setAmbientesRecolhidos] = useState<string[]>([])

  const [duplicandoItem, setDuplicandoItem] = useState<ItemOrcamento | null>(null)
  const [duplicarFuncionarioId, setDuplicarFuncionarioId] = useState("")
  const [duplicarAmbienteDestino, setDuplicarAmbienteDestino] = useState("")

  const verCusto = pode("orcamentos.verCusto")
  const podeLancarCustos = pode("orcamentos.custosObra")

  // --- Totais: recalculados a cada tecla, e o que alimenta a aba do resumo

  const subtotalAtual = calculateSubtotal(formData.itens)
  const subtotalCustoAtual = calculateSubtotalCusto(formData.itens)
  const transporteAtual = round2(formData.transporte)
  const baseTributavelAtual = calculateBaseTributavel(subtotalAtual, formData.margemLucro, transporteAtual)
  const valorIVAAtual = calculateIVA(baseTributavelAtual, formData.taxaIVA)
  const valorTotalAtual = round2(baseTributavelAtual + valorIVAAtual)
  const valorTotalCustoAtual = calculateTotalCusto(subtotalCustoAtual, transporteAtual)
  // O IVA nao entra no lucro: e cobrado ao cliente e entregue ao Estado
  const lucroPrevisto = round2(baseTributavelAtual - valorTotalCustoAtual)

  /**
   * A analise da obra corre sobre os valores em edicao, nao sobre os gravados:
   * mexer na margem tem de se reflectir logo na margem real.
   */
  const analiseCustos = useMemo(
    () =>
      analisarCustoObra(
        { baseTributavel: baseTributavelAtual, ivaCobrado: valorIVAAtual, custoOrcado: valorTotalCustoAtual },
        formData.custosObra,
      ),
    [baseTributavelAtual, valorIVAAtual, valorTotalCustoAtual, formData.custosObra],
  )

  const selectedClientValue =
    formData.clienteId && clientes.some((cliente) => cliente.id === formData.clienteId) ? formData.clienteId : "__novo"

  /**
   * Numeracao no formato 26/0001. O prefixo (CO nos concursos, O nas obras)
   * vem do tipo do documento e e acrescentado na apresentacao.
   */
  const numeroSugerido = (tipo: TipoDocumentoProposta = formData.tipoDocumento) => proximoNumero(orcamentos, tipo)

  // --- Cliente

  const handleClientSelect = (selectedValue: string) => {
    if (selectedValue === "__novo") {
      setFormData({ ...formData, clienteId: "" })
      return
    }

    const client = clientes.find((item) => item.id === selectedValue)
    if (!client) return

    setFormData({
      ...formData,
      clienteId: client.id || "",
      cliente: {
        nome: client.nome,
        email: client.email,
        telefone: client.telefone,
        morada: client.morada || "",
        cidade: client.cidade || "",
        codigoPostal: client.codigoPostal || "",
        nif: client.nif || "",
      },
    })
  }

  const alterarCliente = (campo: keyof Orcamento["cliente"], valor: string) =>
    setFormData({ ...formData, clienteId: "", cliente: { ...formData.cliente, [campo]: valor } })

  // --- Servicos e mao de obra

  const handleServicoSelect = (servicoId: string) => {
    const servico = servicos.find((item) => item.id === servicoId)
    if (!servico) return

    const { precoVariavel, precoFixo, transporte } = getServicoPrecos(servico)
    setServicoForm({
      servicoId,
      quantidade: 1,
      unidade: servico.unidade || "un",
      precoUnitario: precoVariavel,
      precoFixo,
      transporte,
    })
  }

  const handleFuncionarioSelect = (funcionarioId: string) => {
    const funcionario = funcionarios.find((item) => item.id === funcionarioId)
    if (!funcionario) return

    setMaoObraForm({
      ...maoObraForm,
      funcionarioId,
      precoUnitario: round2(funcionario.custoHora || 0),
      custoUnitario: round2(funcionario.custoHoraCalculado ?? funcionario.custoHora ?? 0),
    })
  }

  const handleServicoFormSubmit = () => {
    if (!servicoForm.servicoId || servicoForm.quantidade <= 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um servico e informe a quantidade.",
        variant: "destructive",
      })
      return
    }

    // O mesmo servico pode entrar em varios comodos (ex.: pintura na sala e no quarto).
    // So se bloqueia a repeticao dentro do MESMO comodo, onde bastaria somar a quantidade.
    const repetidoNoMesmoAmbiente = formData.itens.some(
      (item) =>
        item.tipo === "servico" &&
        item.servicoId === servicoForm.servicoId &&
        (item.ambiente || "") === (ambienteAtual || ""),
    )
    if (repetidoNoMesmoAmbiente) {
      toast({
        title: "Servico ja consta neste comodo",
        description: ambienteAtual
          ? `Este servico ja esta em "${ambienteAtual}". Escolha outro comodo ou ajuste a quantidade do item existente.`
          : "Este servico ja foi adicionado. Escolha um comodo ou ajuste a quantidade do item existente.",
        variant: "destructive",
      })
      return
    }

    const servico = servicos.find((item) => item.id === servicoForm.servicoId)
    if (!servico) return

    const categoryName = getServiceCategoryName(servico.categoriaId, servico.categoriaNome)
    const nome = `${servico.nome} (${categoryName})`
    const descricao = servico.descricao?.trim() || nome
    const timestamp = Date.now()

    const novosItens: ItemOrcamento[] = [
      {
        id: `servico-${servicoForm.servicoId}-${timestamp}`,
        nome,
        descricao,
        quantidade: round2(servicoForm.quantidade),
        unidade: servicoForm.unidade,
        precoUnitario: round2(servicoForm.precoUnitario),
        custoUnitario: round2(servicoForm.precoUnitario),
        total: calculateItemTotal(servicoForm.quantidade, servicoForm.precoUnitario),
        valorFixo: false,
        ambiente: ambienteAtual,
        tipo: "servico",
        servicoId: servicoForm.servicoId,
      },
    ]

    // Parte fixa do servico: entra uma unica vez, sem multiplicar pela area
    if (servicoForm.precoFixo > 0) {
      novosItens.push({
        id: `servico-fixo-${servicoForm.servicoId}-${timestamp}`,
        nome: `${servico.nome} - valor fixo`,
        descricao: "Itens e equipamentos que nao acompanham a area (cobrados uma unica vez)",
        quantidade: 1,
        unidade: servicoForm.unidade,
        precoUnitario: round2(servicoForm.precoFixo),
        custoUnitario: round2(servicoForm.precoFixo),
        total: round2(servicoForm.precoFixo),
        valorFixo: true,
        ambiente: ambienteAtual,
        tipo: "servico",
        servicoId: servicoForm.servicoId,
      })
    }

    setFormData({
      ...formData,
      itens: [...formData.itens, ...novosItens],
      servicosSelecionados: [...formData.servicosSelecionados, servicoForm.servicoId],
      // Transporte do servico soma na linha final do orcamento
      transporte: round2(formData.transporte + servicoForm.transporte),
    })
    setServicoForm(getDefaultServicoForm())
  }

  /**
   * Monta um item de mao de obra. O nome do funcionario fica apenas no uso interno:
   * o PDF de venda usa a descricao para o cliente (funcao, sem nome).
   */
  const buildMaoObraItem = (funcionario: Funcionario, quantidade: number, unidade: string): ItemOrcamento => {
    const precoUnitario = round2(funcionario.custoHora || 0)
    const custoUnitario = round2(funcionario.custoHoraCalculado ?? funcionario.custoHora ?? 0)

    return {
      id: `funcionario-${funcionario.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      nome: `Mao de obra - ${funcionario.nome}`,
      descricao: `Mao de obra - ${funcionario.nome}${funcionario.funcao ? ` (${funcionario.funcao})` : ""}`,
      descricaoCliente: funcionario.funcao ? `Mao de obra - ${funcionario.funcao}` : "Mao de obra",
      quantidade: round2(quantidade),
      unidade,
      precoUnitario,
      custoUnitario,
      total: calculateItemTotal(quantidade, precoUnitario),
      valorFixo: false,
      ambiente: ambienteAtual,
      tipo: "mao_obra",
      funcionarioId: funcionario.id,
      funcionarioNome: funcionario.nome,
      funcionarioFuncao: funcionario.funcao,
    }
  }

  const handleMaoObraFormSubmit = () => {
    if (!maoObraForm.funcionarioId || maoObraForm.quantidade <= 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um funcionario e informe a quantidade.",
        variant: "destructive",
      })
      return
    }

    const funcionario = funcionarios.find((item) => item.id === maoObraForm.funcionarioId)
    if (!funcionario) return

    const novoItem = buildMaoObraItem(funcionario, maoObraForm.quantidade, maoObraForm.unidade)

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem],
      funcionariosSelecionados: [...new Set([...formData.funcionariosSelecionados, maoObraForm.funcionarioId])],
    })
    setMaoObraForm(getDefaultMaoObraForm())
  }

  /**
   * Duplica um item para outro comodo (ou para o mesmo).
   * Em mao de obra pode-se ainda trocar o funcionario, recalculando o valor/hora.
   */
  const handleDuplicarItem = () => {
    if (!duplicandoItem) return

    const destino = duplicarAmbienteDestino === "__sem" ? "" : duplicarAmbienteDestino
    let novoItem: ItemOrcamento

    if (duplicandoItem.tipo === "mao_obra") {
      const funcionario = funcionarios.find((item) => item.id === duplicarFuncionarioId)
      if (!funcionario) {
        toast({
          title: "Selecione um funcionario",
          description: "Escolha o funcionario que vai receber a copia da mao de obra.",
          variant: "destructive",
        })
        return
      }
      novoItem = {
        ...buildMaoObraItem(funcionario, duplicandoItem.quantidade, duplicandoItem.unidade),
        ambiente: destino,
      }
    } else {
      novoItem = {
        ...duplicandoItem,
        id: `${duplicandoItem.tipo}-copia-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        ambiente: destino,
      }
    }

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem],
      funcionariosSelecionados: novoItem.funcionarioId
        ? [...new Set([...formData.funcionariosSelecionados, novoItem.funcionarioId])]
        : formData.funcionariosSelecionados,
    })

    toast({
      title: "Item duplicado",
      description: destino ? `Copia criada em "${destino}".` : "Copia criada sem comodo.",
    })

    setDuplicandoItem(null)
    setDuplicarFuncionarioId("")
    setDuplicarAmbienteDestino("")
  }

  // --- Comodos (Sala, Cozinha, Quarto...): agrupam os itens no documento

  /** Renomeia um comodo e leva junto todos os itens que estavam nele. */
  const renomearAmbiente = (antigo: string, novo: string) => {
    setFormData((prev) => ({
      ...prev,
      ambientes: prev.ambientes.map((nome) => (nome === antigo ? novo : nome)),
      itens: prev.itens.map((item) => (item.ambiente === antigo ? { ...item, ambiente: novo } : item)),
    }))
    setAmbienteAtual((atual) => (atual === antigo ? novo : atual))
  }

  /**
   * Duplica um comodo inteiro com todos os seus itens.
   * Util quando o Quarto 02 leva os mesmos trabalhos do Quarto 01.
   */
  const duplicarAmbiente = (nome: string) => {
    const itensOrigem = formData.itens.filter((item) => (item.ambiente || "") === (nome === SEM_AMBIENTE ? "" : nome))
    if (itensOrigem.length === 0) return

    // Encontra um nome livre: "Quarto 01" -> "Quarto 01 (copia)" -> "... (copia 2)"
    let destino = `${nome} (copia)`
    let sufixo = 2
    while (formData.ambientes.includes(destino)) {
      destino = `${nome} (copia ${sufixo})`
      sufixo++
    }

    const carimbo = Date.now()
    const copias = itensOrigem.map((item, indice) => ({
      ...item,
      id: `${item.tipo}-copia-${carimbo}-${indice}`,
      ambiente: destino,
    }))

    setFormData({
      ...formData,
      ambientes: [...formData.ambientes, destino],
      itens: [...formData.itens, ...copias],
    })
    setAmbienteAtual(destino)

    toast({ title: "Comodo duplicado", description: `${copias.length} item(s) copiados para "${destino}".` })
  }

  const adicionarAmbiente = () => {
    const nome = novoAmbiente.trim()
    if (!nome) return
    if (formData.ambientes.some((item) => item.toLowerCase() === nome.toLowerCase())) {
      toast({ title: "Comodo ja existe", description: `"${nome}" ja esta na lista.`, variant: "destructive" })
      return
    }
    setFormData({ ...formData, ambientes: [...formData.ambientes, nome] })
    setNovoAmbiente("")
    if (!ambienteAtual) setAmbienteAtual(nome)
  }

  const removerAmbiente = (nome: string) => {
    setFormData({
      ...formData,
      ambientes: formData.ambientes.filter((item) => item !== nome),
      // Os itens do comodo removido ficam sem comodo, nao se perdem
      itens: formData.itens.map((item) => (item.ambiente === nome ? { ...item, ambiente: "" } : item)),
    })
    if (ambienteAtual === nome) setAmbienteAtual("")
  }

  const alternarAmbiente = (nome: string) =>
    setAmbientesRecolhidos((atual) =>
      atual.includes(nome) ? atual.filter((item) => item !== nome) : [...atual, nome],
    )

  // --- Itens

  const handleItemUpdate = (itemId: string, field: keyof ItemOrcamento, value: string | number | boolean) => {
    const updatedItens = formData.itens.map((item) => {
      if (item.id !== itemId) return item

      const updatedItem = { ...item, [field]: value } as ItemOrcamento

      if (field === "quantidade" || field === "precoUnitario" || field === "custoUnitario" || field === "valorFixo") {
        updatedItem.total = calculateItemTotal(
          updatedItem.quantidade,
          updatedItem.precoUnitario,
          updatedItem.valorFixo,
        )
      }

      return updatedItem
    })

    setFormData({ ...formData, itens: updatedItens })
  }

  const handleItemRemove = (itemId: string) => {
    const target = formData.itens.find((item) => item.id === itemId)
    const updatedItens = formData.itens.filter((item) => item.id !== itemId)

    let servicosSelecionados = formData.servicosSelecionados
    let funcionariosSelecionados = formData.funcionariosSelecionados
    let transporte = formData.transporte

    if (target?.tipo === "servico" && target.servicoId) {
      const aindaTemServico = updatedItens.some(
        (item) => item.tipo === "servico" && item.servicoId === target.servicoId,
      )

      if (!aindaTemServico) {
        servicosSelecionados = formData.servicosSelecionados.filter((id) => id !== target.servicoId)
        // Devolve o transporte que este servico tinha somado na linha final
        const servico = servicos.find((item) => item.id === target.servicoId)
        if (servico) {
          transporte = round2(Math.max(0, transporte - getServicoPrecos(servico).transporte))
        }
      }
    }

    if (target?.tipo === "mao_obra" && target.funcionarioId) {
      const hasOther = updatedItens.some(
        (item) => item.tipo === "mao_obra" && item.funcionarioId && item.funcionarioId === target.funcionarioId,
      )
      if (!hasOther) {
        funcionariosSelecionados = formData.funcionariosSelecionados.filter((id) => id !== target.funcionarioId)
      }
    }

    setFormData({ ...formData, itens: updatedItens, servicosSelecionados, funcionariosSelecionados, transporte })
  }

  // --- Gravar

  const resolveCliente = async (): Promise<string> => {
    if (!user) throw new Error("Usuario nao autenticado")
    if (formData.clienteId) return formData.clienteId

    const nome = formData.cliente.nome.trim().toLowerCase()
    const email = formData.cliente.email.trim().toLowerCase()

    const existing = clientes.find((cliente) => {
      const sameEmail = email && cliente.email.trim().toLowerCase() === email
      const sameName = nome && cliente.nome.trim().toLowerCase() === nome
      return sameEmail || sameName
    })

    if (existing?.id) return existing.id

    return FirebaseService.addCliente(
      {
        nome: formData.cliente.nome.trim(),
        email: formData.cliente.email.trim(),
        telefone: formData.cliente.telefone.trim(),
        morada: formData.cliente.morada.trim(),
        cidade: formData.cliente.cidade.trim(),
        codigoPostal: formData.cliente.codigoPostal.trim(),
        nif: formData.cliente.nif?.trim() || "",
        observacoes: "",
        userId: user.uid,
      },
      user.uid,
    )
  }

  /**
   * Valida por aba, e nao com o `required` do browser.
   *
   * Com o formulario repartido, os campos das abas fechadas nem estao no DOM:
   * o browser tentava focar um campo invisivel e o envio morria calado. Aqui
   * a aba que tem o problema abre-se sozinha.
   */
  const validar = (): boolean => {
    const obrigatoriosCliente: Array<[keyof Orcamento["cliente"], string]> = [
      ["nome", "o nome do cliente"],
      ["email", "o email"],
      ["telefone", "o telefone"],
      ["morada", "a morada"],
      ["cidade", "a cidade"],
      ["codigoPostal", "o codigo postal"],
    ]

    for (const [campo, rotulo] of obrigatoriosCliente) {
      if (!(formData.cliente[campo] || "").toString().trim()) {
        setAba("dados")
        toast({ title: "Falta preencher", description: `Indique ${rotulo}.`, variant: "destructive" })
        return false
      }
    }

    if (!formData.dataOrcamento || !formData.dataValidade) {
      setAba("dados")
      toast({ title: "Falta preencher", description: "Indique as datas da proposta.", variant: "destructive" })
      return false
    }

    if (formData.itens.length === 0) {
      setAba("itens")
      toast({
        title: "Adicione itens",
        description: "Inclua pelo menos um servico ou mao de obra no orcamento.",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validar primeiro: uma sessao expirada nao deve engolir o aviso de um
    // campo em falta, senao o botao parece nao fazer nada nenhuma.
    if (!validar()) return
    if (!user) {
      toast({
        title: "Sessao terminada",
        description: "Volte a entrar para guardar as alteracoes.",
        variant: "destructive",
      })
      return
    }

    setAGravar(true)
    try {
      const clienteId = await resolveCliente()

      const orcamentoData: Omit<Orcamento, "id"> = {
        numero: numeroParaGravar(formData.numero, orcamentos, formData.tipoDocumento),
        tipoDocumento: formData.tipoDocumento,
        clienteId,
        cliente: {
          nome: formData.cliente.nome.trim(),
          email: formData.cliente.email.trim(),
          telefone: formData.cliente.telefone.trim(),
          morada: formData.cliente.morada.trim(),
          cidade: formData.cliente.cidade.trim(),
          codigoPostal: formData.cliente.codigoPostal.trim(),
          nif: formData.cliente.nif?.trim() || "",
        },
        dataOrcamento: new Date(formData.dataOrcamento),
        dataValidade: new Date(formData.dataValidade),
        orcamentista: user.email || "",
        itens: formData.itens,
        ambientes: formData.ambientes,
        funcionariosSelecionados: formData.funcionariosSelecionados,
        servicosSelecionados: formData.servicosSelecionados,
        subtotal: subtotalAtual,
        subtotalCusto: subtotalCustoAtual,
        transporte: transporteAtual,
        impostos: valorIVAAtual,
        margemLucro: round2(formData.margemLucro),
        baseTributavel: baseTributavelAtual,
        taxaIVA: round2(formData.taxaIVA),
        valorIVA: valorIVAAtual,
        valorTotal: valorTotalAtual,
        valorTotalCusto: valorTotalCustoAtual,
        custosObra: prepararParaGravar(formData.custosObra),
        observacoes: formData.observacoes,
        status: orcamento?.status || "rascunho",
        userId: user.uid,
        createdAt: orcamento?.createdAt || new Date(),
        updatedAt: new Date(),
      }

      if (orcamento?.id) {
        await FirebaseService.updateOrcamento(orcamento.id, orcamentoData)
        toast({ title: "Orcamento atualizado", description: "O orcamento foi atualizado com sucesso." })
      } else {
        await FirebaseService.addOrcamento(orcamentoData, user.uid)
        toast({ title: "Orcamento criado", description: "O orcamento foi criado com sucesso." })
      }

      onGuardado()
    } catch (error) {
      console.error("Erro ao salvar orcamento:", error)
      toast({
        title: "Erro ao salvar orcamento",
        description: "Nao foi possivel salvar o orcamento.",
        variant: "destructive",
      })
    } finally {
      setAGravar(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)}>
        <TabsList className="flex w-full flex-wrap justify-start h-auto">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="itens">
            Itens
            {formData.itens.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
                {formData.itens.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preco">Preco</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          {verCusto && <TabsTrigger value="custos">Custos reais</TabsTrigger>}
        </TabsList>

        {/* ---------------------------------------------------------- Dados */}
        <TabsContent value="dados" className="space-y-6 pt-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Cliente</h3>
            <div className="space-y-2">
              <Label>Selecionar cliente existente</Label>
              <Select value={selectedClientValue} onValueChange={handleClientSelect}>
                <SelectTrigger className="rounded-full">
                  <SelectValue placeholder="Selecione um cliente ou use novo cadastro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__novo">Novo cliente</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id || ""}>
                      {cliente.nome} - {cliente.numeroUnico}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clienteNome">Nome Completo</Label>
                <Input
                  id="clienteNome"
                  value={formData.cliente.nome}
                  onChange={(e) => alterarCliente("nome", e.target.value)}
                  placeholder="Nome do cliente"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteEmail">Email</Label>
                <Input
                  id="clienteEmail"
                  type="email"
                  value={formData.cliente.email}
                  onChange={(e) => alterarCliente("email", e.target.value)}
                  placeholder="email@exemplo.com"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteTelefone">Telefone</Label>
                <Input
                  id="clienteTelefone"
                  value={formData.cliente.telefone}
                  onChange={(e) => alterarCliente("telefone", e.target.value)}
                  placeholder="+351 xxx xxx xxx"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteNif">NIF (Opcional)</Label>
                <Input
                  id="clienteNif"
                  value={formData.cliente.nif || ""}
                  onChange={(e) => alterarCliente("nif", e.target.value)}
                  placeholder="123456789"
                  className="rounded-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clienteMorada">Morada</Label>
              <Input
                id="clienteMorada"
                value={formData.cliente.morada}
                onChange={(e) => alterarCliente("morada", e.target.value)}
                placeholder="Rua, numero, andar"
                className="rounded-full"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clienteCidade">Cidade</Label>
                <Input
                  id="clienteCidade"
                  value={formData.cliente.cidade}
                  onChange={(e) => alterarCliente("cidade", e.target.value)}
                  placeholder="Cidade"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteCodigoPostal">Codigo Postal</Label>
                <Input
                  id="clienteCodigoPostal"
                  value={formData.cliente.codigoPostal}
                  onChange={(e) => alterarCliente("codigoPostal", e.target.value)}
                  placeholder="0000-000"
                  className="rounded-full"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Documento</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="tipoDocumento">Tipo</Label>
                <Select
                  value={formData.tipoDocumento}
                  onValueChange={(valor) =>
                    setFormData({ ...formData, tipoDocumento: valor as TipoDocumentoProposta })
                  }
                >
                  <SelectTrigger id="tipoDocumento" className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((tipo) => (
                      <SelectItem key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{getTipoDocumento(formData.tipoDocumento).descricao}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero">Numero da proposta</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder={numeroSugerido()}
                  className="rounded-full"
                />
                <p className="text-xs text-muted-foreground">
                  Sai como{" "}
                  {numeroCompleto(
                    { numero: formData.numero || numeroSugerido(), tipoDocumento: formData.tipoDocumento },
                    configuracao,
                  )}
                  . Deixe vazio para numerar automaticamente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataOrcamento">Data do Orcamento</Label>
                <Input
                  id="dataOrcamento"
                  type="date"
                  value={formData.dataOrcamento}
                  onChange={(e) => setFormData({ ...formData, dataOrcamento: e.target.value })}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataValidade">Data de Validade</Label>
                <Input
                  id="dataValidade"
                  type="date"
                  value={formData.dataValidade}
                  onChange={(e) => setFormData({ ...formData, dataValidade: e.target.value })}
                  className="rounded-full"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------- Itens */}
        <TabsContent value="itens" className="space-y-6 pt-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Comodos</h3>
              <p className="text-sm text-muted-foreground">
                Organize o orcamento por divisao da casa. No documento cada comodo sai como uma seccao com o seu
                subtotal, e os itens ficam numerados 1.1, 1.2, 2.1...
              </p>
            </div>

            <Card className="p-4 border-2 border-dashed space-y-3">
              <div className="flex gap-2">
                <Input
                  value={novoAmbiente}
                  onChange={(e) => setNovoAmbiente(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      adicionarAmbiente()
                    }
                  }}
                  placeholder="Ex.: Sala, Hall, Cozinha, Quarto 01, Marquise"
                  className="rounded-full"
                />
                <Button type="button" onClick={adicionarAmbiente} className="rounded-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {formData.ambientes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.ambientes.map((nome) => (
                    <Badge
                      key={nome}
                      variant={ambienteAtual === nome ? "default" : "outline"}
                      className="cursor-pointer gap-1 py-1"
                      onClick={() => setAmbienteAtual(ambienteAtual === nome ? "" : nome)}
                    >
                      {nome}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removerAmbiente(nome)
                        }}
                        aria-label={`Remover ${nome}`}
                        className="ml-1 opacity-70 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {ambienteAtual
                  ? `Os proximos itens vao para: ${ambienteAtual}. Clique no comodo para trocar.`
                  : "Nenhum comodo selecionado: os proximos itens ficam sem comodo. Clique num comodo para o escolher."}
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Servico no orcamento</h3>
            <Card className="p-4 border-2 border-dashed">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecionar servico</Label>
                  <SeletorComBusca
                    valor={servicoForm.servicoId}
                    onChange={handleServicoSelect}
                    placeholder="Escolha um servico"
                    placeholderBusca="Procurar servico..."
                    vazio="Nenhum servico encontrado."
                    className="rounded-full"
                    opcoes={servicos.map((servico) => ({
                      valor: servico.id!,
                      rotulo: servico.nome,
                      detalhe: `${getServiceCategoryName(servico.categoriaId, servico.categoriaNome)} - ${formatCurrency(
                        servico.preco || 0,
                      )} / ${servico.unidade}`,
                    }))}
                  />
                </div>

                {servicoForm.servicoId && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Unidade (automatico)</Label>
                        <Input value={servicoForm.unidade} readOnly className="rounded-full bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <CampoNumerico
                          min={0.01}
                          value={servicoForm.quantidade}
                          onChange={(quantidade) => setServicoForm({ ...servicoForm, quantidade })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor por {servicoForm.unidade || "unidade"} (automatico)</Label>
                        <Input value={toFixed2(servicoForm.precoUnitario)} readOnly className="rounded-full bg-muted" />
                      </div>
                    </div>

                    <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span>
                          {toFixed2(servicoForm.quantidade)} {servicoForm.unidade} x{" "}
                          {formatCurrency(servicoForm.precoUnitario)}
                        </span>
                        <span>
                          {formatCurrency(calculateItemTotal(servicoForm.quantidade, servicoForm.precoUnitario))}
                        </span>
                      </div>
                      {servicoForm.precoFixo > 0 && (
                        <div className="flex items-center justify-between">
                          <span>Valor fixo (nao multiplica pela area)</span>
                          <span>{formatCurrency(servicoForm.precoFixo)}</span>
                        </div>
                      )}
                      {servicoForm.transporte > 0 && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Transporte (vai para a linha final)</span>
                          <span>{formatCurrency(servicoForm.transporte)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t pt-1 font-medium">
                        <span>Total do item</span>
                        <span className="text-lg font-bold">
                          {formatCurrency(
                            round2(
                              calculateItemTotal(servicoForm.quantidade, servicoForm.precoUnitario) +
                                servicoForm.precoFixo,
                            ),
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="button" onClick={handleServicoFormSubmit} className="rounded-full">
                        Adicionar ao Orcamento
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Mao de obra avulsa (opcional)</h3>
              <p className="text-sm text-muted-foreground">
                A mao de obra normal ja vem dentro do preco do servico, pelo grupo Mao de obra da composicao. Use esta
                seccao apenas para horas extra que fogem ao padrao do servico.
              </p>
            </div>
            <Card className="p-4 border-2 border-dashed">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecionar funcionario</Label>
                  <SeletorComBusca
                    valor={maoObraForm.funcionarioId}
                    onChange={handleFuncionarioSelect}
                    placeholder="Escolha um funcionario"
                    placeholderBusca="Procurar funcionario..."
                    vazio="Nenhum funcionario encontrado."
                    className="rounded-full"
                    opcoes={funcionarios.map((funcionario) => ({
                      valor: funcionario.id!,
                      rotulo: funcionario.nome,
                      detalhe: `${funcionario.funcao} - ${formatCurrency(funcionario.custoHora)}/hora`,
                    }))}
                  />
                </div>

                {maoObraForm.funcionarioId && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Unidade</Label>
                        <Select
                          value={maoObraForm.unidade}
                          onValueChange={(value) => setMaoObraForm({ ...maoObraForm, unidade: value })}
                        >
                          <SelectTrigger className="rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="horas">Horas</SelectItem>
                            <SelectItem value="dias">Dias</SelectItem>
                            <SelectItem value="projeto">Projeto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade de horas</Label>
                        <CampoNumerico
                          min={0.01}
                          value={maoObraForm.quantidade}
                          onChange={(quantidade) => setMaoObraForm({ ...maoObraForm, quantidade })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor de venda/hora (automatico)</Label>
                        <Input value={toFixed2(maoObraForm.precoUnitario)} readOnly className="rounded-full bg-muted" />
                      </div>
                    </div>

                    <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Custo real ({toFixed2(maoObraForm.custoUnitario)}/hora)</span>
                        <span>
                          {formatCurrency(calculateItemTotal(maoObraForm.quantidade, maoObraForm.custoUnitario))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-1">
                        <span className="font-medium">Total do item (venda)</span>
                        <span className="text-lg font-bold">
                          {formatCurrency(calculateItemTotal(maoObraForm.quantidade, maoObraForm.precoUnitario))}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O nome do funcionario fica so no uso interno e no PDF de custo. No PDF de venda o item aparece
                      como &quot;Mao de obra&quot; com a funcao.
                    </p>

                    <div className="flex justify-end">
                      <Button type="button" onClick={handleMaoObraFormSubmit} className="rounded-full">
                        Adicionar ao Orcamento
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          {formData.itens.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-10 text-center">
              <p className="font-medium">Ainda sem itens</p>
              <p className="text-sm text-muted-foreground">
                Escolha um servico acima, ou lance horas na mao de obra avulsa.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Itens do Orcamento</h3>
              {agruparPorAmbiente(formData.itens, formData.ambientes).map((grupo, indiceGrupo) => {
                const recolhido = ambientesRecolhidos.includes(grupo.nome)
                return (
                  <div key={grupo.nome} className="space-y-3">
                    <div
                      className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 ${
                        getCorAmbiente(indiceGrupo).cabecalho
                      }`}
                    >
                      <div className="flex flex-1 items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          title={recolhido ? "Expandir comodo" : "Recolher comodo"}
                          onClick={() => alternarAmbiente(grupo.nome)}
                        >
                          {recolhido ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span className="text-sm font-semibold">{indiceGrupo + 1}.</span>
                        {grupo.nome === SEM_AMBIENTE ? (
                          <span className="text-sm font-semibold">{grupo.nome}</span>
                        ) : (
                          <Input
                            value={grupo.nome}
                            onChange={(e) => renomearAmbiente(grupo.nome, e.target.value)}
                            className="h-7 max-w-[240px] border-none bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:bg-background"
                            title="Clique para renomear o comodo"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {recolhido && (
                          <span className="text-xs opacity-80">
                            {grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"}
                          </span>
                        )}
                        <span className="text-sm font-semibold">{formatCurrency(grupo.subtotal)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          title={`Duplicar "${grupo.nome}" com todos os itens`}
                          onClick={() => duplicarAmbiente(grupo.nome)}
                        >
                          <Copy className="h-3 w-3" />
                          Duplicar comodo
                        </Button>
                      </div>
                    </div>
                    {!recolhido &&
                      grupo.itens.map((item, indiceItem) => {
                        const readOnlyServico = item.tipo === "servico"
                        const custoUnitario = item.custoUnitario ?? item.precoUnitario
                        const estilo = getItemEstilo(item.tipo)
                        return (
                          <div key={item.id} className={`p-4 border rounded-lg ${estilo.card}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="flex h-6 shrink-0 items-center justify-center rounded-full bg-background px-2 text-xs font-semibold">
                                {indiceGrupo + 1}.{indiceItem + 1}
                              </span>
                              <Badge variant="outline" className={`text-xs ${estilo.badge}`}>
                                {estilo.label}
                              </Badge>
                              {formData.ambientes.length > 0 && (
                                <Select
                                  value={item.ambiente || "__sem"}
                                  onValueChange={(value) =>
                                    handleItemUpdate(item.id, "ambiente", value === "__sem" ? "" : value)
                                  }
                                >
                                  <SelectTrigger className="h-6 w-auto gap-1 rounded-full border-none bg-background/60 px-2 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__sem">Sem comodo</SelectItem>
                                    {formData.ambientes.map((nome) => (
                                      <SelectItem key={nome} value={nome}>
                                        {nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <span className="ml-auto text-sm font-semibold">{formatCurrency(item.total)}</span>
                            </div>
                            <div className="flex items-start justify-between mb-2 gap-2">
                              {/* min-w-0: flex-1 sozinho nao encolhe abaixo do conteudo */}
                              <div className="min-w-0 flex-1 space-y-2">
                                <div>
                                  <Label className="text-xs">Nome do item</Label>
                                  <Input
                                    value={item.nome ?? item.descricao}
                                    onChange={(e) => handleItemUpdate(item.id, "nome", e.target.value)}
                                    className="h-8 text-sm font-medium"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Descricao do item</Label>
                                  <Textarea
                                    value={item.descricao}
                                    onChange={(e) => handleItemUpdate(item.id, "descricao", e.target.value)}
                                    rows={2}
                                    className="text-sm"
                                    placeholder="Descricao detalhada impressa no orcamento"
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {item.valorFixo && (
                                    <Badge variant="secondary" className="text-xs">
                                      Valor fixo
                                    </Badge>
                                  )}
                                  {item.tipo === "mao_obra" && (
                                    <Badge variant="secondary" className="text-xs">
                                      No PDF do cliente: {item.descricaoCliente || "Mao de obra"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Duplicar este item para outro comodo"
                                  onClick={() => {
                                    setDuplicandoItem(item)
                                    setDuplicarFuncionarioId(item.funcionarioId || "")
                                    setDuplicarAmbienteDestino(item.ambiente || "__sem")
                                  }}
                                  className="h-6 w-6"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleItemRemove(item.id)}
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              <div>
                                <Label className="text-xs">Quantidade</Label>
                                <CampoNumerico
                                  tamanho="sm"
                                  value={item.quantidade}
                                  disabled={item.valorFixo}
                                  onChange={(quantidade) => handleItemUpdate(item.id, "quantidade", quantidade)}
                                  className={item.valorFixo ? "bg-muted" : undefined}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Unidade</Label>
                                <Input
                                  value={item.unidade}
                                  readOnly={readOnlyServico}
                                  onChange={(e) => handleItemUpdate(item.id, "unidade", e.target.value)}
                                  className={`h-8 text-sm ${readOnlyServico ? "bg-muted" : ""}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Custo Unit. (EUR)</Label>
                                <CampoNumerico
                                  tamanho="sm"
                                  value={custoUnitario}
                                  onChange={(valor) => handleItemUpdate(item.id, "custoUnitario", valor)}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Venda Unit. (EUR)</Label>
                                <CampoNumerico
                                  tamanho="sm"
                                  value={item.precoUnitario}
                                  onChange={(valor) => handleItemUpdate(item.id, "precoUnitario", valor)}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Total venda (EUR)</Label>
                                <Input value={toFixed2(item.total)} readOnly className="h-8 text-sm bg-muted" />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Checkbox
                                  checked={!!item.valorFixo}
                                  onCheckedChange={(checked) =>
                                    handleItemUpdate(item.id, "valorFixo", checked === true)
                                  }
                                />
                                Valor fixo: nao multiplica pela quantidade/area
                              </label>
                              <span className="text-xs text-muted-foreground">
                                Custo do item:{" "}
                                {formatCurrency(calculateItemTotal(item.quantidade, custoUnitario, item.valorFixo))}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------- Preco */}
        <TabsContent value="preco" className="space-y-6 pt-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Precificacao</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="margemLucro">Margem de lucro (%)</Label>
                <CampoNumerico
                  id="margemLucro"
                  sufixo="%"
                  value={formData.margemLucro}
                  onChange={(margemLucro) => setFormData({ ...formData, margemLucro })}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transporte">Custo de transporte (EUR)</Label>
                <CampoNumerico
                  id="transporte"
                  min={0}
                  sufixo="EUR"
                  value={formData.transporte}
                  onChange={(transporte) => setFormData({ ...formData, transporte })}
                  className="rounded-full"
                />
                <p className="text-xs text-muted-foreground">
                  Somado automaticamente a partir dos servicos e lancado como linha propria no final do orcamento.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxaIVA">IVA (%)</Label>
                <Select
                  value={TAXAS_IVA.some((t) => t.valor === formData.taxaIVA) ? String(formData.taxaIVA) : "outra"}
                  onValueChange={(value) => {
                    if (value === "outra") return
                    setFormData({ ...formData, taxaIVA: Number(value) })
                  }}
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="Selecione a taxa" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAXAS_IVA.map((taxa) => (
                      <SelectItem key={taxa.valor} value={String(taxa.valor)}>
                        {taxa.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="outra">Outra taxa (indicar ao lado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxaIVAValor">Taxa aplicada (%)</Label>
                <CampoNumerico
                  id="taxaIVAValor"
                  min={0}
                  max={100}
                  sufixo="%"
                  value={formData.taxaIVA}
                  onChange={(taxaIVA) => setFormData({ ...formData, taxaIVA })}
                  className="rounded-full"
                />
                <p className="text-xs text-muted-foreground">
                  Incide sobre subtotal + margem + transporte. Nao entra no lucro: e cobrado ao cliente e entregue ao
                  Estado.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observacoes (Opcional)</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observacoes adicionais sobre o orcamento..."
              rows={3}
            />
          </div>
        </TabsContent>

        {/* --------------------------------------------------------- Resumo */}
        <TabsContent value="resumo" className="space-y-4 pt-4">
          {formData.itens.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-10 text-center">
              <p className="font-medium">Sem itens, sem resumo</p>
              <p className="text-sm text-muted-foreground">Adicione itens na aba Itens para ver os totais.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <h4 className="font-medium">Orcamento de Venda (cliente)</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotalAtual)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Margem ({formatNumber2(formData.margemLucro)}%):</span>
                    <span>{formatCurrency(round2((subtotalAtual * formData.margemLucro) / 100))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transporte:</span>
                    <span>{formatCurrency(transporteAtual)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span>Base tributavel:</span>
                    <span>{formatCurrency(baseTributavelAtual)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA ({formatNumber2(formData.taxaIVA)}%):</span>
                    <span>{formatCurrency(valorIVAAtual)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Total com IVA:</span>
                    <span>{formatCurrency(valorTotalAtual)}</span>
                  </div>
                </div>
              </div>

              {verCusto && (
                <div className="space-y-2 p-4 border rounded-lg">
                  <h4 className="font-medium">Orcamento de Custo (interno)</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Custo dos itens:</span>
                      <span>{formatCurrency(subtotalCustoAtual)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transporte:</span>
                      <span>{formatCurrency(transporteAtual)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>Total de custo:</span>
                      <span>{formatCurrency(valorTotalCustoAtual)}</span>
                    </div>
                    <div className="flex justify-between text-primary font-medium">
                      <span>Lucro previsto:</span>
                      <span>{formatCurrency(lucroPrevisto)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Lucro = base tributavel ({formatCurrency(baseTributavelAtual)}) - custo, sem o IVA.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* --------------------------------------------------- Custos reais */}
        {verCusto && (
          <TabsContent value="custos" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              O que a obra gastou de facto. Escreva o valor da fatura (com IVA) e escolha a taxa: o custo sem IVA e o
              IVA suportado sao calculados. A analise compara com a margem desta proposta, ja com o que estiver em
              edicao nas outras abas.
            </p>
            {!podeLancarCustos && (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                O seu cargo permite ver os custos, mas nao lancar. Peca a permissao &quot;Lancar custos reais da
                obra&quot; a quem gere utilizadores.
              </p>
            )}
            <CustosObraFolha
              linhas={formData.custosObra}
              onChange={(custosObra) => setFormData({ ...formData, custosObra })}
              analise={analiseCustos}
              podeLancar={podeLancarCustos}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Barra de accoes: colada em baixo, para o Gravar estar sempre a mao */}
      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur">
        <div className="text-sm">
          <span className="text-muted-foreground">Total com IVA: </span>
          <span className="font-semibold tabular-nums">{formatCurrency(valorTotalAtual)}</span>
          {verCusto && formData.itens.length > 0 && (
            <>
              <span className="text-muted-foreground"> · Lucro previsto: </span>
              <span className="font-semibold tabular-nums">{formatCurrency(lucroPrevisto)}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancelar} className="rounded-full">
            Cancelar
          </Button>
          <Button type="submit" disabled={aGravar} className="rounded-full">
            {aGravar && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {aGravar ? "A guardar..." : orcamento ? "Guardar alteracoes" : "Criar Orcamento"}
          </Button>
        </div>
      </div>

      {/* Duplicar item: escolhe o comodo de destino e, na mao de obra, o funcionario */}
      <Dialog
        open={!!duplicandoItem}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicandoItem(null)
            setDuplicarFuncionarioId("")
            setDuplicarAmbienteDestino("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Duplicar item</DialogTitle>
            <DialogDescription>
              Copia &quot;{duplicandoItem?.nome || duplicandoItem?.descricao}&quot; (
              {toFixed2(duplicandoItem?.quantidade || 0)} {duplicandoItem?.unidade}) para outro comodo. Util quando o
              Quarto 02 leva os mesmos trabalhos do Quarto 01.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comodo de destino</Label>
              <Select value={duplicarAmbienteDestino} onValueChange={setDuplicarAmbienteDestino}>
                <SelectTrigger className="rounded-full">
                  <SelectValue placeholder="Escolha o comodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sem">Sem comodo</SelectItem>
                  {formData.ambientes.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {duplicandoItem?.tipo === "mao_obra" && (
              <div className="space-y-2">
                <Label>Funcionario da copia</Label>
                <Select value={duplicarFuncionarioId} onValueChange={setDuplicarFuncionarioId}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="Escolha um funcionario" />
                  </SelectTrigger>
                  <SelectContent>
                    {funcionarios.map((funcionario) => (
                      <SelectItem key={funcionario.id} value={funcionario.id!}>
                        {funcionario.nome} - {formatCurrency(funcionario.custoHora)} /hora
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setDuplicandoItem(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleDuplicarItem} className="rounded-full">
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  )
}

/**
 * Estado inicial do formulario.
 *
 * Numa proposta nova a margem, o IVA e a validade vem dos padroes definidos em
 * Configuracoes; numa existente vem do que esta gravado. Propostas criadas
 * antes do campo de IVA ficam com 0, para nao alterar um total ja acordado.
 */
function estadoInicial(
  orcamento: Orcamento | null,
  configuracao: { margemPadrao?: number; taxaIVAPadrao?: number; validadeDiasPadrao?: number },
): OrcamentoFormState {
  const hoje = new Date()

  if (!orcamento) {
    return {
      numero: "",
      tipoDocumento: "concurso",
      clienteId: "",
      cliente: { nome: "", email: "", telefone: "", morada: "", cidade: "", codigoPostal: "", nif: "" },
      dataOrcamento: toDateInput(hoje),
      dataValidade: toDateInput(addDays(hoje, configuracao.validadeDiasPadrao ?? 30)),
      funcionariosSelecionados: [],
      servicosSelecionados: [],
      itens: [],
      ambientes: [],
      margemLucro: configuracao.margemPadrao ?? 20,
      transporte: 0,
      taxaIVA: configuracao.taxaIVAPadrao ?? 23,
      observacoes: "",
      custosObra: [],
    }
  }

  return {
    numero: orcamento.numero || "",
    tipoDocumento: tipoDoDocumento(orcamento),
    clienteId: orcamento.clienteId || "",
    cliente: {
      nome: orcamento.cliente.nome,
      email: orcamento.cliente.email,
      telefone: orcamento.cliente.telefone,
      morada: orcamento.cliente.morada,
      cidade: orcamento.cliente.cidade,
      codigoPostal: orcamento.cliente.codigoPostal,
      nif: orcamento.cliente.nif || "",
    },
    dataOrcamento: toDateInput(new Date(orcamento.dataOrcamento)),
    dataValidade: toDateInput(new Date(orcamento.dataValidade)),
    funcionariosSelecionados: orcamento.funcionariosSelecionados || [],
    servicosSelecionados: orcamento.servicosSelecionados || [],
    itens: orcamento.itens || [],
    ambientes: orcamento.ambientes || [],
    margemLucro: orcamento.margemLucro || 0,
    transporte: round2(orcamento.transporte || 0),
    taxaIVA: round2(orcamento.taxaIVA ?? 0),
    observacoes: orcamento.observacoes || "",
    custosObra: orcamento.custosObra || [],
  }
}
