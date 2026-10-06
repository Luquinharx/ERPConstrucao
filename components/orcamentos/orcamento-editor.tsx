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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CustosObraFolha } from "@/components/orcamentos/custos-obra-folha"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { FirebaseService } from "@/lib/firebase-service"
import { analisarCustoObra, CUSTOS_OBRA_ATIVO, prepararParaGravar } from "@/lib/custos-obra"
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
import {
  custoOrcamentoProduto,
  custoHoraFuncionario,
  custoMedioFuncao,
  descricaoClienteFuncao,
  funcaoDoFuncionario,
  funcionariosDaFuncao,
  margemPorPreco,
  vendaDoProduto,
} from "@/lib/produto-calculos"
import type {
  Cliente,
  FuncaoMaoObra,
  Funcionario,
  ItemOrcamento,
  LinhaCustoObra,
  Material,
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
  /** Itens ao preco de venda do cadastro (ligado) ou ao custo (desligado). */
  usarMargemItem: boolean
  /** Margem global sobre o subtotal. */
  usarMargemGlobal: boolean
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
  /** Funcao: da o preco ao cliente. */
  funcaoId: string
  /** Funcionario: da o custo. Vazio = custo medio da funcao. */
  funcionarioId: string
  quantidade: number
  unidade: string
}

interface ProdutoFormState {
  materialId: string
  quantidade: number
}

function getDefaultServicoForm(): ServicoFormState {
  return { servicoId: "", quantidade: 1, unidade: "", precoUnitario: 0, precoFixo: 0, transporte: 0 }
}

function getDefaultMaoObraForm(): MaoObraFormState {
  return { funcaoId: "", funcionarioId: "", quantidade: 8, unidade: "horas" }
}

function getDefaultProdutoForm(): ProdutoFormState {
  return { materialId: "", quantidade: 1 }
}

/** Valor do seletor de funcionario que significa "custo medio da funcao". */
const CUSTO_MEDIO = "__medio"

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
  /** Produtos (colecao materiais). */
  materiais: Material[]
  /** Funcoes de mao de obra ativas. */
  funcoes: FuncaoMaoObra[]
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
  materiais,
  funcoes,
  onGuardado,
  onCancelar,
}: OrcamentoEditorProps) {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const gruposImpostos = configuracao.gruposImpostos || []
  const { pode } = usePermissoes()

  const [aba, setAba] = useState<Aba>("dados")
  const [aGravar, setAGravar] = useState(false)

  const [formData, setFormData] = useState<OrcamentoFormState>(() => estadoInicial(orcamento, configuracao))
  const [servicoForm, setServicoForm] = useState<ServicoFormState>(getDefaultServicoForm())
  const [maoObraForm, setMaoObraForm] = useState<MaoObraFormState>(getDefaultMaoObraForm())
  const [produtoForm, setProdutoForm] = useState<ProdutoFormState>(getDefaultProdutoForm())

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
  // Margem global desligada vale zero nas contas, mas o numero escrito fica no ecra
  const margemGlobalAtual = formData.usarMargemGlobal ? round2(formData.margemLucro) : 0
  // Quanto os itens ja levam de margem, antes da global (0 com a margem por item desligada)
  const margemItensAtual = round2(subtotalAtual - subtotalCustoAtual)
  const baseTributavelAtual = calculateBaseTributavel(subtotalAtual, margemGlobalAtual, transporteAtual)
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

  /** Preco que o item leva: o de tabela com a margem por item ligada, o custo sem ela. */
  const precoDoItem = (precoTabela: number, custo: number) => round2(formData.usarMargemItem ? precoTabela : custo)

  // --- Mao de obra: a funcao da o preco ao cliente, o funcionario da o custo

  const funcaoSelecionada = funcoes.find((item) => item.id === maoObraForm.funcaoId)
  const funcionarioSelecionado = funcionarios.find((item) => item.id === maoObraForm.funcionarioId)

  /**
   * Preco/hora e custo/hora de uma combinacao funcao + funcionario.
   * Sem funcao vale o valor de venda da ficha do funcionario, como sempre foi;
   * sem funcionario vale o custo medio da funcao.
   */
  const valoresMaoObra = (funcao?: FuncaoMaoObra, funcionario?: Funcionario) => {
    const precoTabela = round2(funcao ? funcao.precoHora : funcionario?.custoHora || 0)
    const custo = funcionario
      ? custoHoraFuncionario(funcionario)
      : funcao
        ? custoMedioFuncao(funcao, funcionarios)
        : 0
    return { precoTabela, custo }
  }

  const previaMaoObra = valoresMaoObra(funcaoSelecionada, funcionarioSelecionado)

  /**
   * Funcionarios oferecidos: todos, com os da funcao escolhida primeiro.
   * Mostrar so os da funcao deixava a lista vazia quando ninguem tinha aquele
   * nome de funcao na ficha, e quem trabalha fora da sua funcao nao aparecia.
   */
  const funcionariosParaEscolher = funcaoSelecionada
    ? [
        ...funcionariosDaFuncao(funcaoSelecionada, funcionarios),
        ...funcionarios.filter((f) => !funcionariosDaFuncao(funcaoSelecionada, [f]).length),
      ]
    : funcionarios

  const handleFuncaoSelect = (funcaoId: string) => {
    const funcao = funcoes.find((item) => item.id === funcaoId)
    const mantemFuncionario = funcao && funcionarioSelecionado && funcionariosDaFuncao(funcao, [funcionarioSelecionado]).length > 0
    setMaoObraForm({ ...maoObraForm, funcaoId, funcionarioId: mantemFuncionario ? maoObraForm.funcionarioId : CUSTO_MEDIO })
  }

  const handleFuncionarioSelect = (funcionarioId: string) => {
    const funcionario = funcionarios.find((item) => item.id === funcionarioId)
    // Escolher primeiro o funcionario puxa a funcao dele, se estiver cadastrada
    const funcao = maoObraForm.funcaoId || !funcionario ? undefined : funcaoDoFuncionario(funcionario, funcoes)
    setMaoObraForm({ ...maoObraForm, funcionarioId, funcaoId: funcao?.id || maoObraForm.funcaoId })
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
        precoTabela: round2(servicoForm.precoUnitario),
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
  const buildMaoObraItem = (
    funcao: FuncaoMaoObra | undefined,
    funcionario: Funcionario | undefined,
    quantidade: number,
    unidade: string,
  ): ItemOrcamento => {
    const { precoTabela, custo } = valoresMaoObra(funcao, funcionario)
    const precoUnitario = precoDoItem(precoTabela, custo)
    const nomeFuncao = funcao?.nome || funcionario?.funcao || ""
    const quem = funcionario ? funcionario.nome : "custo medio da funcao"

    return {
      id: `maoobra-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      nome: `Mao de obra - ${funcionario?.nome || nomeFuncao}`,
      descricao: `Mao de obra - ${nomeFuncao ? `${nomeFuncao} (${quem})` : quem}`,
      descricaoCliente: funcao ? descricaoClienteFuncao(funcao) : nomeFuncao ? `Mao de obra - ${nomeFuncao}` : "Mao de obra",
      quantidade: round2(quantidade),
      unidade,
      precoUnitario,
      precoTabela,
      custoUnitario: custo,
      total: calculateItemTotal(quantidade, precoUnitario),
      valorFixo: false,
      ambiente: ambienteAtual,
      tipo: "mao_obra",
      funcaoId: funcao?.id,
      funcionarioId: funcionario?.id,
      funcionarioNome: funcionario?.nome,
      funcionarioFuncao: nomeFuncao || undefined,
    }
  }

  const handleMaoObraFormSubmit = () => {
    if ((!funcaoSelecionada && !funcionarioSelecionado) || maoObraForm.quantidade <= 0) {
      toast({
        title: "Dados incompletos",
        description: "Escolha a funcao (ou um funcionario) e informe a quantidade.",
        variant: "destructive",
      })
      return
    }
    if (previaMaoObra.custo <= 0) {
      toast({
        title: "Mao de obra sem custo",
        description: "Nenhum funcionario ativo tem esta funcao: o item entra com custo 0. Escolha um funcionario para ter o custo real.",
      })
    }

    const novoItem = buildMaoObraItem(funcaoSelecionada, funcionarioSelecionado, maoObraForm.quantidade, maoObraForm.unidade)

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem],
      funcionariosSelecionados: novoItem.funcionarioId
        ? [...new Set([...formData.funcionariosSelecionados, novoItem.funcionarioId])]
        : formData.funcionariosSelecionados,
    })
    setMaoObraForm(getDefaultMaoObraForm())
  }

  // --- Produtos: custo real e preco de venda vem do cadastro

  const produtoSelecionado = materiais.find((item) => item.id === produtoForm.materialId)

  const handleProdutoSubmit = () => {
    if (!produtoSelecionado || produtoForm.quantidade <= 0) {
      toast({
        title: "Dados incompletos",
        description: "Escolha o produto e informe a quantidade.",
        variant: "destructive",
      })
      return
    }

    const custo = custoOrcamentoProduto(produtoSelecionado, gruposImpostos)
    const precoTabela = vendaDoProduto(produtoSelecionado, gruposImpostos)
    const precoUnitario = precoDoItem(precoTabela, custo)

    const novoItem: ItemOrcamento = {
      id: `material-${produtoSelecionado.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      nome: produtoSelecionado.nome,
      descricao: produtoSelecionado.observacoes?.trim() || produtoSelecionado.nome,
      quantidade: round2(produtoForm.quantidade),
      unidade: produtoSelecionado.unidade,
      precoUnitario,
      precoTabela,
      custoUnitario: custo,
      total: calculateItemTotal(produtoForm.quantidade, precoUnitario),
      valorFixo: false,
      ambiente: ambienteAtual,
      tipo: "material",
      materialId: produtoSelecionado.id,
    }

    setFormData({ ...formData, itens: [...formData.itens, novoItem] })
    setProdutoForm(getDefaultProdutoForm())
  }

  // --- Margens: cada uma liga e desliga sozinha

  /**
   * Desligar a margem por item poe cada item ao custo; voltar a ligar repoe o
   * preco de tabela, que fica guardado no item. Itens antigos sem preco de
   * tabela guardam o preco que tinham antes de ir ao custo.
   */
  const alternarMargemItem = (ligar: boolean) =>
    setFormData((atual) => ({
      ...atual,
      usarMargemItem: ligar,
      itens: atual.itens.map((item) => {
        const custo = item.custoUnitario ?? item.precoUnitario
        const precoTabela = item.precoTabela ?? item.precoUnitario
        const precoUnitario = round2(ligar ? precoTabela : custo)
        return { ...item, precoTabela, precoUnitario, total: calculateItemTotal(item.quantidade, precoUnitario, item.valorFixo) }
      }),
    }))

  const alternarMargemGlobal = (ligar: boolean) =>
    setFormData((atual) => ({
      ...atual,
      usarMargemGlobal: ligar,
      // Proposta gravada sem margem global volta com 0: ao religar, parte do padrao
      margemLucro: ligar && !atual.margemLucro ? configuracao.margemPadrao ?? 20 : atual.margemLucro,
    }))

  /**
   * Duplica um item para outro comodo (ou para o mesmo).
   * Em mao de obra pode-se ainda trocar o funcionario, recalculando o valor/hora.
   */
  const handleDuplicarItem = () => {
    if (!duplicandoItem) return

    const destino = duplicarAmbienteDestino === "__sem" ? "" : duplicarAmbienteDestino
    let novoItem: ItemOrcamento

    if (duplicandoItem.tipo === "mao_obra") {
      const funcao = funcoes.find((item) => item.id === duplicandoItem.funcaoId)
      const funcionario = funcionarios.find((item) => item.id === duplicarFuncionarioId)
      if (!funcionario && !funcao) {
        toast({
          title: "Selecione um funcionario",
          description: "Escolha o funcionario que vai receber a copia da mao de obra.",
          variant: "destructive",
        })
        return
      }
      novoItem = {
        ...buildMaoObraItem(funcao, funcionario, duplicandoItem.quantidade, duplicandoItem.unidade),
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

      // Com margem por item, o preco escrito a mao passa a ser o de tabela deste
      // item; sem ela, o preco segue sempre o custo.
      if (field === "precoUnitario" && formData.usarMargemItem) updatedItem.precoTabela = Number(value)
      if (field === "custoUnitario" && !formData.usarMargemItem) updatedItem.precoUnitario = Number(value)

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
        description: "Inclua pelo menos um servico, produto ou mao de obra no orcamento.",
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
        margemLucro: margemGlobalAtual,
        usarMargemItem: formData.usarMargemItem,
        usarMargemGlobal: formData.usarMargemGlobal,
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
          {verCusto && CUSTOS_OBRA_ATIVO && <TabsTrigger value="custos">Custos reais</TabsTrigger>}
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
              <h3 className="text-lg font-medium">Produto no orcamento</h3>
              <p className="text-sm text-muted-foreground">
                Custo real e preco de venda vem do cadastro de Produtos.
              </p>
            </div>
            <Card className="p-4 border-2 border-dashed">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecionar produto</Label>
                  <SeletorComBusca
                    valor={produtoForm.materialId}
                    onChange={(materialId) => setProdutoForm({ ...produtoForm, materialId })}
                    placeholder="Escolha um produto"
                    placeholderBusca="Procurar produto..."
                    vazio="Nenhum produto encontrado."
                    className="rounded-full"
                    opcoes={materiais.map((produto) => ({
                      valor: produto.id!,
                      rotulo: produto.codigo ? `${produto.codigo} - ${produto.nome}` : produto.nome,
                      detalhe: `${formatCurrency(vendaDoProduto(produto, gruposImpostos))} / ${produto.unidade}${
                        produto.controlaEstoque ? ` - estoque ${formatNumber2(Number(produto.estoqueAtual) || 0)}` : ""
                      }`,
                    }))}
                  />
                </div>

                {produtoSelecionado && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Quantidade ({produtoSelecionado.unidade})</Label>
                        <CampoNumerico
                          min={0.01}
                          value={produtoForm.quantidade}
                          onChange={(quantidade) => setProdutoForm({ ...produtoForm, quantidade })}
                          className="rounded-full"
                        />
                      </div>
                      {verCusto && (
                        <div className="space-y-2">
                          <Label>Custo (inclui impostos de venda)</Label>
                          <Input
                            value={toFixed2(custoOrcamentoProduto(produtoSelecionado, gruposImpostos))}
                            readOnly
                            className="rounded-full bg-muted"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Venda unitaria {formData.usarMargemItem ? "" : "(margem por item desligada)"}</Label>
                        <Input
                          value={toFixed2(precoDoItem(vendaDoProduto(produtoSelecionado, gruposImpostos), custoOrcamentoProduto(produtoSelecionado, gruposImpostos)))}
                          readOnly
                          className="rounded-full bg-muted"
                        />
                      </div>
                    </div>
                    {produtoSelecionado.controlaEstoque &&
                      (Number(produtoSelecionado.estoqueAtual) || 0) < produtoForm.quantidade && (
                        <p className="text-xs text-amber-600">
                          Estoque atual: {formatNumber2(Number(produtoSelecionado.estoqueAtual) || 0)}{" "}
                          {produtoSelecionado.unidade} - abaixo da quantidade orcamentada.
                        </p>
                      )}
                    <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
                      <span className="font-medium">Total do item (venda)</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(
                          calculateItemTotal(
                            produtoForm.quantidade,
                            precoDoItem(vendaDoProduto(produtoSelecionado, gruposImpostos), custoOrcamentoProduto(produtoSelecionado, gruposImpostos)),
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" onClick={handleProdutoSubmit} className="rounded-full">
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
                A funcao define o preco ao cliente; o funcionario define o custo. Sem funcionario escolhido, usa-se o
                custo medio da funcao. A mao de obra normal ja vem dentro do preco dos servicos.
              </p>
            </div>
            <Card className="p-4 border-2 border-dashed">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Funcao (preco ao cliente)</Label>
                    <SeletorComBusca
                      valor={maoObraForm.funcaoId}
                      onChange={handleFuncaoSelect}
                      placeholder={funcoes.length ? "Escolha a funcao" : "Sem funcoes cadastradas"}
                      placeholderBusca="Procurar funcao..."
                      vazio="Nenhuma funcao encontrada."
                      className="rounded-full"
                      opcoes={funcoes.map((funcao) => ({
                        valor: funcao.id!,
                        rotulo: funcao.nome,
                        detalhe: `${formatCurrency(funcao.precoHora)}/hora`,
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Funcionario (custo)</Label>
                    <SeletorComBusca
                      valor={maoObraForm.funcionarioId}
                      onChange={handleFuncionarioSelect}
                      placeholder="Escolha um funcionario"
                      placeholderBusca="Procurar funcionario..."
                      vazio="Nenhum funcionario encontrado."
                      className="rounded-full"
                      opcoes={[
                        ...(funcaoSelecionada
                          ? [
                              {
                                valor: CUSTO_MEDIO,
                                rotulo: "Custo medio da funcao",
                                detalhe: verCusto
                                  ? `${formatCurrency(custoMedioFuncao(funcaoSelecionada, funcionarios))}/hora`
                                  : undefined,
                              },
                            ]
                          : []),
                        ...funcionariosParaEscolher.map((funcionario) => ({
                          valor: funcionario.id!,
                          rotulo: funcionario.nome,
                          detalhe: verCusto
                            ? `${funcionario.funcao} - custo ${formatCurrency(custoHoraFuncionario(funcionario))}/hora`
                            : funcionario.funcao,
                        })),
                      ]}
                    />
                  </div>
                </div>

                {(funcaoSelecionada || funcionarioSelecionado) && (
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
                        <Input
                          value={toFixed2(precoDoItem(previaMaoObra.precoTabela, previaMaoObra.custo))}
                          readOnly
                          className="rounded-full bg-muted"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                      {verCusto && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>
                            Custo real ({toFixed2(previaMaoObra.custo)}/hora
                            {funcionarioSelecionado ? ` - ${funcionarioSelecionado.nome}` : " - media da funcao"})
                          </span>
                          <span>{formatCurrency(calculateItemTotal(maoObraForm.quantidade, previaMaoObra.custo))}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t pt-1">
                        <span className="font-medium">Total do item (venda)</span>
                        <span className="text-lg font-bold">
                          {formatCurrency(
                            calculateItemTotal(
                              maoObraForm.quantidade,
                              precoDoItem(previaMaoObra.precoTabela, previaMaoObra.custo),
                            ),
                          )}
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
                Escolha um servico ou produto acima, ou lance horas na mao de obra avulsa.
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
                                    setDuplicarFuncionarioId(item.funcionarioId || (item.funcaoId ? CUSTO_MEDIO : ""))
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
                                  readOnly={!formData.usarMargemItem}
                                  title={formData.usarMargemItem ? undefined : "Margem por item desligada: vende ao custo"}
                                  className={formData.usarMargemItem ? undefined : "bg-muted"}
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
                                {verCusto && ` · Margem do item: ${formatNumber2(margemPorPreco(custoUnitario, item.precoUnitario))}%`}
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

            {/* As duas margens sao independentes: qualquer combinacao vale */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-4 space-y-2">
                <label className="flex items-center gap-3 font-medium">
                  <Switch checked={formData.usarMargemItem} onCheckedChange={alternarMargemItem} />
                  Margem por item
                </label>
                <p className="text-xs text-muted-foreground">
                  {formData.usarMargemItem
                    ? "Cada produto e mao de obra entra pelo preco de venda do cadastro (com a margem dele)."
                    : "Desligada: cada item entra ao preco de custo. Ao voltar a ligar, os precos de tabela voltam."}
                </p>
                {verCusto && (
                  <p className="text-sm">
                    Margem dos itens: <span className="font-medium tabular-nums">{formatCurrency(margemItensAtual)}</span>
                  </p>
                )}
              </Card>
              <Card className="p-4 space-y-2">
                <label className="flex items-center gap-3 font-medium">
                  <Switch checked={formData.usarMargemGlobal} onCheckedChange={alternarMargemGlobal} />
                  Margem global
                </label>
                <p className="text-xs text-muted-foreground">
                  Percentagem somada ao subtotal de todos os itens, por cima da margem de cada item.
                </p>
                {formData.usarMargemGlobal && (
                  <CampoNumerico
                    id="margemLucro"
                    sufixo="%"
                    value={formData.margemLucro}
                    onChange={(margemLucro) => setFormData({ ...formData, margemLucro })}
                    className="rounded-full"
                  />
                )}
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                  {formData.usarMargemGlobal && (
                    <div className="flex justify-between">
                      <span>Margem global ({formatNumber2(margemGlobalAtual)}%):</span>
                      <span>{formatCurrency(round2((subtotalAtual * margemGlobalAtual) / 100))}</span>
                    </div>
                  )}
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
                    <div className="flex justify-between text-muted-foreground">
                      <span>Margem dos itens{formData.usarMargemItem ? "" : " (desligada)"}:</span>
                      <span>{formatCurrency(margemItensAtual)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Margem global{formData.usarMargemGlobal ? "" : " (desligada)"}:</span>
                      <span>{formatCurrency(round2((subtotalAtual * margemGlobalAtual) / 100))}</span>
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
                    {duplicandoItem.funcaoId && <SelectItem value={CUSTO_MEDIO}>Custo medio da funcao</SelectItem>}
                    {funcionarios.map((funcionario) => (
                      <SelectItem key={funcionario.id} value={funcionario.id!}>
                        {funcionario.nome} - {funcionario.funcao}
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
  configuracao: {
    margemPadrao?: number
    taxaIVAPadrao?: number
    validadeDiasPadrao?: number
    margemItemPadraoAtiva?: boolean
    margemGlobalPadraoAtiva?: boolean
  },
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
      usarMargemItem: configuracao.margemItemPadraoAtiva ?? true,
      usarMargemGlobal: configuracao.margemGlobalPadraoAtiva ?? true,
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
    // Propostas de antes dos interruptores tinham as duas margens a funcionar
    usarMargemItem: orcamento.usarMargemItem ?? true,
    usarMargemGlobal: orcamento.usarMargemGlobal ?? true,
    transporte: round2(orcamento.transporte || 0),
    taxaIVA: round2(orcamento.taxaIVA ?? 0),
    observacoes: orcamento.observacoes || "",
    custosObra: orcamento.custosObra || [],
  }
}
