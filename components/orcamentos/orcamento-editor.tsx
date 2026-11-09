"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
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
  nomeUnidade,
  vendaDoProduto,
} from "@/lib/produto-calculos"
import { custoServicoAtual } from "@/lib/composicao-catalogo"
import {
  MEDICOES,
  TAXAS_REGIAO,
  TIPOS_CLIENTE,
  TIPOS_OBRA,
  TIPOS_OPERACAO,
  especialidadesDe,
  estruturaDe,
  margemSobreVenda,
  medirAmbiente,
  pesoMateriaisDe,
  precoPorEspecialidade,
  sugerirIVA,
  temDimensoes,
} from "@/lib/precificacao"
import type {
  Cliente,
  ConfiguracaoEmpresa,
  ContextoFiscal,
  CustosIndiretos,
  DecomposicaoCusto,
  DimensoesAmbiente,
  MaterialPrevisto,
  TipoMedicao,
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
import { m, t } from "@/lib/i18n"

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
  /** Modelo de preco: por especialidade (folha de obra) ou por margens. */
  modoPreco: "especialidade" | "margens"
  /** Margem adicional desta proposta (%), somada a estrutura + especialidade. */
  margemAdicional: number
  dimensoesAmbientes: Record<string, DimensoesAmbiente>
  custosIndiretos: CustosIndiretos
  contextoFiscal: ContextoFiscal
  discriminarPDF: boolean
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
  /** Custo direto por unidade, ja com os precos atuais do catalogo. */
  precoUnitario: number
  decomposicao?: DecomposicaoCusto
  materiaisPrevistos?: MaterialPrevisto[]
  /** Linhas da composicao cujo preco mudou desde que o servico foi gravado. */
  linhasAtualizadas: number
  especialidadeId?: string
  medicao?: TipoMedicao
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
  return { servicoId: "", quantidade: 1, unidade: "", precoUnitario: 0, precoFixo: 0, transporte: 0, linhasAtualizadas: 0 }
}

function getDefaultMaoObraForm(): MaoObraFormState {
  return { funcaoId: "", funcionarioId: "", quantidade: 8, unidade: "horas" }
}

function getDefaultProdutoForm(): ProdutoFormState {
  return { materialId: "", quantidade: 1 }
}

/** Campos das dimensoes de um comodo: campo, rotulo, unidade. */
const CAMPOS_DIMENSAO = [
  ["comprimento", m("Comprimento"), "m"],
  ["largura", m("Largura"), "m"],
  ["altura", m("Pé-direito"), "m"],
  ["aberturas", m("Portas/janelas"), "m2"],
] as const

/**
 * Texto com marcadores {nome} em que cada marcador e substituido por um
 * elemento (ex.: um valor a negrito), sem partir a frase traduzida.
 */
function comElementos(texto: string, partes: Record<string, React.ReactNode>): React.ReactNode[] {
  return texto.split(/\{(\w+)\}/).map((pedaco, i) => (i % 2 ? <span key={i}>{partes[pedaco]}</span> : pedaco))
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

  const porEspecialidade = formData.modoPreco === "especialidade"
  const subtotalAtual = calculateSubtotal(formData.itens)
  const subtotalCustoAtual = calculateSubtotalCusto(formData.itens)
  const transporteAtual = round2(formData.transporte)
  // Margem global desligada (ou modo por especialidade) vale zero nas contas
  const margemGlobalAtual = !porEspecialidade && formData.usarMargemGlobal ? round2(formData.margemLucro) : 0
  // Quanto os itens ja levam de margem, antes da global (0 com a margem por item desligada)
  const margemItensAtual = round2(subtotalAtual - subtotalCustoAtual)
  /**
   * Custos indiretos (estaleiro, seguros, licenciamento): sao custo da obra e
   * vendem-se com a mesma regra dos itens - estrutura + construcao civil no
   * modo por especialidade, ou margem global no modo por margens.
   */
  const indiretosCusto = round2(
    (Number(formData.custosIndiretos.estaleiro) || 0) +
      (Number(formData.custosIndiretos.seguros) || 0) +
      (Number(formData.custosIndiretos.licenciamento) || 0),
  )
  const indiretosVenda = porEspecialidade ? precoPorEspecialidade(indiretosCusto, "civil", configuracao, formData.margemAdicional) : indiretosCusto
  const baseTributavelAtual = calculateBaseTributavel(subtotalAtual + indiretosVenda, margemGlobalAtual, transporteAtual)
  const valorIVAAtual = calculateIVA(baseTributavelAtual, formData.taxaIVA)
  const valorTotalAtual = round2(baseTributavelAtual + valorIVAAtual)
  const valorTotalCustoAtual = round2(calculateTotalCusto(subtotalCustoAtual, transporteAtual) + indiretosCusto)
  const margemVendaAtual = margemSobreVenda(valorTotalCustoAtual, baseTributavelAtual)
  const pesoMateriais = pesoMateriaisDe(formData.itens.map((i) => ({ d: i.decomposicao, quantidade: i.quantidade })))
  const sugestaoIVA = sugerirIVA(formData.contextoFiscal, pesoMateriais)
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

  const catalogo = { materiais, funcionarios, funcoes, grupos: gruposImpostos }
  const medidasAtuais = medirAmbiente(formData.dimensoesAmbientes[ambienteAtual])
  const ambienteComDimensoes = !!ambienteAtual && temDimensoes(formData.dimensoesAmbientes[ambienteAtual])

  const handleServicoSelect = (servicoId: string) => {
    const servico = servicos.find((item) => item.id === servicoId)
    if (!servico) return

    // O custo vem da composicao com os precos de HOJE do catalogo
    const { precoFixo, transporte } = getServicoPrecos(servico)
    const atual = custoServicoAtual(servico, catalogo)
    const medicao = ambienteComDimensoes ? servico.medicaoPadrao : undefined
    setServicoForm({
      servicoId,
      quantidade: medicao ? medidasAtuais[medicao] || 1 : 1,
      unidade: servico.unidade || "un",
      precoUnitario: atual.custoUnitario,
      decomposicao: atual.decomposicao,
      materiaisPrevistos: atual.materiaisPrevistos,
      linhasAtualizadas: atual.linhasAtualizadas,
      especialidadeId: servico.especialidadeId,
      medicao,
      precoFixo,
      transporte,
    })
  }

  /**
   * Preco que o item leva.
   * - Por especialidade: custo x (1 + estrutura + margem da especialidade).
   * - Por margens: o de tabela com a margem por item ligada, o custo sem ela.
   */
  const precoDoItem = (precoTabela: number, custo: number, especialidadeId?: string) =>
    porEspecialidade
      ? precoPorEspecialidade(custo, especialidadeId, configuracao, formData.margemAdicional)
      : round2(formData.usarMargemItem ? precoTabela : custo)

  /** Venda de um servico em escolha: e vendido ao custo, salvo no modo por especialidade. */
  const vendaServico = (custo: number) => precoDoItem(custo, custo, servicoForm.especialidadeId)

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
        title: t("Dados incompletos"),
        description: t("Selecione um serviço e indique a quantidade."),
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
        title: t("Serviço já consta nesta divisão"),
        description: ambienteAtual
          ? t('Este serviço já está em "{comodo}". Escolha outra divisão ou ajuste a quantidade do item existente.', { comodo: ambienteAtual })
          : t("Este serviço já foi adicionado. Escolha uma divisão ou ajuste a quantidade do item existente."),
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

    // Servicos nao tem preco de tabela proprio: no modo por margens vendem-se
    // ao custo e a margem global faz o resto
    const custoServico = round2(servicoForm.precoUnitario)
    const especialidadeId = servicoForm.especialidadeId || "civil"
    const precoServico = precoDoItem(custoServico, custoServico, especialidadeId)
    const novosItens: ItemOrcamento[] = [
      {
        id: `servico-${servicoForm.servicoId}-${timestamp}`,
        nome,
        descricao,
        quantidade: round2(servicoForm.quantidade),
        unidade: servicoForm.unidade,
        precoUnitario: precoServico,
        precoTabela: custoServico,
        custoUnitario: custoServico,
        total: calculateItemTotal(servicoForm.quantidade, precoServico),
        valorFixo: false,
        ambiente: ambienteAtual,
        tipo: "servico",
        servicoId: servicoForm.servicoId,
        especialidadeId,
        medicao: servicoForm.medicao,
        decomposicao: servicoForm.decomposicao,
        materiaisPrevistos: servicoForm.materiaisPrevistos,
      },
    ]

    // Parte fixa do servico: entra uma unica vez, sem multiplicar pela area
    if (servicoForm.precoFixo > 0) {
      novosItens.push({
        id: `servico-fixo-${servicoForm.servicoId}-${timestamp}`,
        nome: t("{nome} - valor fixo", { nome: servico.nome }),
        descricao: t("Itens e equipamentos que não acompanham a área (cobrados uma única vez)"),
        quantidade: 1,
        unidade: servicoForm.unidade,
        precoUnitario: precoDoItem(servicoForm.precoFixo, servicoForm.precoFixo, especialidadeId),
        precoTabela: round2(servicoForm.precoFixo),
        custoUnitario: round2(servicoForm.precoFixo),
        total: precoDoItem(servicoForm.precoFixo, servicoForm.precoFixo, especialidadeId),
        especialidadeId,
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
    const precoUnitario = precoDoItem(precoTabela, custo, "civil")
    const nomeFuncao = funcao?.nome || funcionario?.funcao || ""
    const quem = funcionario ? funcionario.nome : t("custo médio da função")

    return {
      id: `maoobra-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      nome: t("Mão de obra - {nome}", { nome: funcionario?.nome || nomeFuncao }),
      descricao: nomeFuncao
        ? t("Mão de obra - {funcao} ({quem})", { funcao: nomeFuncao, quem })
        : t("Mão de obra - {nome}", { nome: quem }),
      descricaoCliente: funcao
        ? descricaoClienteFuncao(funcao)
        : nomeFuncao
          ? t("Mão de obra - {nome}", { nome: nomeFuncao })
          : t("Mão de obra"),
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
      especialidadeId: "civil",
      decomposicao: { mao_obra: custo, materiais: 0, outros: 0 },
    }
  }

  const handleMaoObraFormSubmit = () => {
    if ((!funcaoSelecionada && !funcionarioSelecionado) || maoObraForm.quantidade <= 0) {
      toast({
        title: t("Dados incompletos"),
        description: t("Escolha a função (ou um funcionário) e indique a quantidade."),
        variant: "destructive",
      })
      return
    }
    if (previaMaoObra.custo <= 0) {
      toast({
        title: t("Mão de obra sem custo"),
        description: t("Nenhum funcionário ativo tem esta função: o item entra com custo 0. Escolha um funcionário para ter o custo real."),
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
        title: t("Dados incompletos"),
        description: t("Escolha o produto e indique a quantidade."),
        variant: "destructive",
      })
      return
    }

    const custo = custoOrcamentoProduto(produtoSelecionado, gruposImpostos)
    const precoTabela = vendaDoProduto(produtoSelecionado, gruposImpostos)
    const precoUnitario = precoDoItem(precoTabela, custo, "civil")

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
      especialidadeId: "civil",
      decomposicao: { mao_obra: 0, materiais: custo, outros: 0 },
      materiaisPrevistos: [
        { materialId: produtoSelecionado.id!, nome: produtoSelecionado.nome, unidade: produtoSelecionado.unidade, porUnidade: 1 },
      ],
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

  /** Preco de um item no modelo dado, a partir do custo e do preco de tabela guardados. */
  const repreco = (
    item: ItemOrcamento,
    modo: OrcamentoFormState["modoPreco"],
    usarMargemItem: boolean,
    adicional = formData.margemAdicional,
  ): ItemOrcamento => {
    const custo = item.custoUnitario ?? item.precoUnitario
    const precoTabela = item.precoTabela ?? item.precoUnitario
    const precoUnitario =
      modo === "especialidade"
        ? precoPorEspecialidade(custo, item.especialidadeId, configuracao, adicional)
        : round2(usarMargemItem ? precoTabela : custo)
    return { ...item, precoTabela, precoUnitario, total: calculateItemTotal(item.quantidade, precoUnitario, item.valorFixo) }
  }

  /**
   * Troca o modelo de preco e recalcula todos os itens. Nada se perde: o
   * custo e o preco de tabela ficam guardados em cada item, e voltar ao
   * modelo anterior repoe os precos.
   */
  const trocarModoPreco = (modoPreco: OrcamentoFormState["modoPreco"]) =>
    setFormData((atual) => ({
      ...atual,
      modoPreco,
      itens: atual.itens.map((item) => repreco(item, modoPreco, atual.usarMargemItem, atual.margemAdicional)),
    }))

  /** Muda a margem adicional e recalcula os itens (so no modelo por especialidade). */
  const alterarMargemAdicional = (margemAdicional: number) =>
    setFormData((atual) => ({
      ...atual,
      margemAdicional,
      itens: atual.itens.map((item) => repreco(item, atual.modoPreco, atual.usarMargemItem, margemAdicional)),
    }))

  /**
   * Itens cujo preco ja nao bate com as margens de hoje (Configuracoes >
   * Precos mudou depois de a proposta ser feita).
   */
  const itensDesatualizados = porEspecialidade
    ? formData.itens.filter(
        (i) => Math.abs(repreco(i, "especialidade", formData.usarMargemItem).precoUnitario - i.precoUnitario) > 0.004,
      ).length
    : 0
  const atualizarMargens = () =>
    setFormData((atual) => ({
      ...atual,
      itens: atual.itens.map((item) => repreco(item, atual.modoPreco, atual.usarMargemItem, atual.margemAdicional)),
    }))
  // So o rascunho abre no editor: o preco ainda nao foi entregue ao cliente,
  // por isso segue sempre as margens de hoje.
  const avisouMargens = useRef(false)
  useEffect(() => {
    if (!porEspecialidade || itensDesatualizados === 0) return
    atualizarMargens()
    if (!avisouMargens.current && orcamento) {
      avisouMargens.current = true
      toast({
        title: t("Preços atualizados"),
        description:
          itensDesatualizados === 1
            ? t("{n} item passou para as margens atuais de Configurações > Preços. Guarde a proposta para manter a alteração.", { n: itensDesatualizados })
            : t("{n} itens passaram para as margens atuais de Configurações > Preços. Guarde a proposta para manter a alteração.", { n: itensDesatualizados }),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuracao, porEspecialidade, itensDesatualizados])

  /** Muda as dimensoes de um comodo e as quantidades de todos os itens ligados a ele. */
  const alterarDimensoes = (ambiente: string, parcial: Partial<DimensoesAmbiente>) =>
    setFormData((atual) => {
      const anterior = atual.dimensoesAmbientes[ambiente] || { comprimento: 0, largura: 0, altura: 0, aberturas: 0 }
      const dimensoes = { ...anterior, ...parcial }
      const medidas = medirAmbiente(dimensoes)
      return {
        ...atual,
        dimensoesAmbientes: { ...atual.dimensoesAmbientes, [ambiente]: dimensoes },
        itens: atual.itens.map((item) => {
          if ((item.ambiente || "") !== ambiente || !item.medicao) return item
          const quantidade = medidas[item.medicao]
          return { ...item, quantidade, total: calculateItemTotal(quantidade, item.precoUnitario, item.valorFixo) }
        }),
      }
    })

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
          title: t("Selecione um funcionário"),
          description: t("Escolha o funcionário que vai receber a cópia da mão de obra."),
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
      title: t("Item duplicado"),
      description: destino ? t('Cópia criada em "{destino}".', { destino }) : t("Cópia criada sem divisão."),
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
      dimensoesAmbientes: Object.fromEntries(
        Object.entries(prev.dimensoesAmbientes).map(([nome, d]) => [nome === antigo ? novo : nome, d]),
      ),
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
    let destino = t("{nome} (cópia)", { nome })
    let sufixo = 2
    while (formData.ambientes.includes(destino)) {
      destino = t("{nome} (cópia {n})", { nome, n: sufixo })
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
      dimensoesAmbientes: formData.dimensoesAmbientes[nome]
        ? { ...formData.dimensoesAmbientes, [destino]: { ...formData.dimensoesAmbientes[nome] } }
        : formData.dimensoesAmbientes,
    })
    setAmbienteAtual(destino)

    toast({
      title: t("Divisão duplicada"),
      description:
        copias.length === 1
          ? t('{n} item copiado para "{destino}".', { n: copias.length, destino })
          : t('{n} itens copiados para "{destino}".', { n: copias.length, destino }),
    })
  }

  const adicionarAmbiente = () => {
    const nome = novoAmbiente.trim()
    if (!nome) return
    if (formData.ambientes.some((item) => item.toLowerCase() === nome.toLowerCase())) {
      toast({ title: t("A divisão já existe"), description: t('"{nome}" já está na lista.', { nome }), variant: "destructive" })
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

      // Ligar o item a uma medicao do comodo puxa logo a quantidade
      if (field === "medicao") {
        const medida = value ? medirAmbiente(formData.dimensoesAmbientes[item.ambiente || ""])[value as TipoMedicao] : undefined
        updatedItem.medicao = (value || undefined) as TipoMedicao | undefined
        if (medida !== undefined) updatedItem.quantidade = medida
      }
      // Por especialidade o preco segue sempre o custo e a especialidade
      if (porEspecialidade && (field === "custoUnitario" || field === "especialidadeId")) {
        updatedItem.precoUnitario = precoPorEspecialidade(
          updatedItem.custoUnitario ?? updatedItem.precoUnitario,
          updatedItem.especialidadeId,
          configuracao,
          formData.margemAdicional,
        )
      }

      // Com margem por item, o preco escrito a mao passa a ser o de tabela deste
      // item; sem ela, o preco segue sempre o custo.
      if (!porEspecialidade && field === "precoUnitario" && formData.usarMargemItem) updatedItem.precoTabela = Number(value)
      if (!porEspecialidade && field === "custoUnitario" && !formData.usarMargemItem) updatedItem.precoUnitario = Number(value)

      if (
        field === "quantidade" ||
        field === "precoUnitario" ||
        field === "custoUnitario" ||
        field === "valorFixo" ||
        field === "medicao" ||
        field === "especialidadeId"
      ) {
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
    if (!user) throw new Error(t("Utilizador não autenticado"))
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
      ["nome", t("Indique o nome do cliente.")],
      ["email", t("Indique o email.")],
      ["telefone", t("Indique o telefone.")],
      ["morada", t("Indique a morada.")],
      ["cidade", t("Indique a cidade.")],
      ["codigoPostal", t("Indique o código postal.")],
    ]

    for (const [campo, mensagem] of obrigatoriosCliente) {
      if (!(formData.cliente[campo] || "").toString().trim()) {
        setAba("dados")
        toast({ title: t("Falta preencher"), description: mensagem, variant: "destructive" })
        return false
      }
    }

    if (!formData.dataOrcamento || !formData.dataValidade) {
      setAba("dados")
      toast({ title: t("Falta preencher"), description: t("Indique as datas da proposta."), variant: "destructive" })
      return false
    }

    if (formData.itens.length === 0) {
      setAba("itens")
      toast({
        title: t("Adicione itens"),
        description: t("Inclua pelo menos um serviço, produto ou mão de obra no orçamento."),
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
        title: t("Sessão terminada"),
        description: t("Volte a iniciar sessão para guardar as alterações."),
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
        modoPreco: formData.modoPreco,
        margemAdicional: porEspecialidade ? round2(formData.margemAdicional) : 0,
        dimensoesAmbientes: formData.dimensoesAmbientes,
        custosIndiretos: formData.custosIndiretos,
        contextoFiscal: formData.contextoFiscal,
        discriminarPDF: formData.discriminarPDF,
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
        toast({ title: t("Orçamento atualizado"), description: t("O orçamento foi atualizado com sucesso.") })
      } else {
        await FirebaseService.addOrcamento(orcamentoData, user.uid)
        toast({ title: t("Orçamento criado"), description: t("O orçamento foi criado com sucesso.") })
      }

      onGuardado()
    } catch (error) {
      console.error("Erro ao salvar orcamento:", error)
      toast({
        title: t("Erro ao guardar o orçamento"),
        description: t("Não foi possível guardar o orçamento."),
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
          <TabsTrigger value="dados">{t("Dados")}</TabsTrigger>
          <TabsTrigger value="itens">
            {t("Itens")}
            {formData.itens.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
                {formData.itens.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preco">{t("Preço")}</TabsTrigger>
          <TabsTrigger value="resumo">{t("Resumo")}</TabsTrigger>
          {verCusto && CUSTOS_OBRA_ATIVO && <TabsTrigger value="custos">{t("Custos reais")}</TabsTrigger>}
        </TabsList>

        {/* ---------------------------------------------------------- Dados */}
        <TabsContent value="dados" className="space-y-6 pt-4">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t("Cliente")}</h3>
            <div className="space-y-2">
              <Label>{t("Selecionar cliente existente")}</Label>
              <Select value={selectedClientValue} onValueChange={handleClientSelect}>
                <SelectTrigger className="rounded-full">
                  <SelectValue placeholder={t("Selecione um cliente ou use um novo registo")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__novo">{t("Novo cliente")}</SelectItem>
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
                <Label htmlFor="clienteNome">{t("Nome completo")}</Label>
                <Input
                  id="clienteNome"
                  value={formData.cliente.nome}
                  onChange={(e) => alterarCliente("nome", e.target.value)}
                  placeholder={t("Nome do cliente")}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteEmail">{t("Email")}</Label>
                <Input
                  id="clienteEmail"
                  type="email"
                  value={formData.cliente.email}
                  onChange={(e) => alterarCliente("email", e.target.value)}
                  placeholder={t("email@exemplo.com")}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteTelefone">{t("Telefone")}</Label>
                <Input
                  id="clienteTelefone"
                  value={formData.cliente.telefone}
                  onChange={(e) => alterarCliente("telefone", e.target.value)}
                  placeholder="+351 xxx xxx xxx"
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteNif">{t("NIF (opcional)")}</Label>
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
              <Label htmlFor="clienteMorada">{t("Morada")}</Label>
              <Input
                id="clienteMorada"
                value={formData.cliente.morada}
                onChange={(e) => alterarCliente("morada", e.target.value)}
                placeholder={t("Rua, número, andar")}
                className="rounded-full"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clienteCidade">{t("Cidade")}</Label>
                <Input
                  id="clienteCidade"
                  value={formData.cliente.cidade}
                  onChange={(e) => alterarCliente("cidade", e.target.value)}
                  placeholder={t("Cidade")}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteCodigoPostal">{t("Código postal")}</Label>
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
            <h3 className="text-lg font-medium">{t("Documento")}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="tipoDocumento">{t("Tipo")}</Label>
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
                        {t(tipo.nome)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t(getTipoDocumento(formData.tipoDocumento).descricao)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero">{t("Número da proposta")}</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder={numeroSugerido()}
                  className="rounded-full"
                />
                <p className="text-xs text-muted-foreground">
                  {t("Sai como {numero}. Deixe vazio para numerar automaticamente.", {
                    numero: numeroCompleto(
                      { numero: formData.numero || numeroSugerido(), tipoDocumento: formData.tipoDocumento },
                      configuracao,
                    ),
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataOrcamento">{t("Data do orçamento")}</Label>
                <Input
                  id="dataOrcamento"
                  type="date"
                  value={formData.dataOrcamento}
                  onChange={(e) => setFormData({ ...formData, dataOrcamento: e.target.value })}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataValidade">{t("Data de validade")}</Label>
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
              <h3 className="text-lg font-medium">{t("Divisões")}</h3>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Organize o orçamento por divisões da casa. No documento, cada divisão sai como uma secção com o seu subtotal, e os itens ficam numerados 1.1, 1.2, 2.1...",
                )}
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
                  placeholder={t("Ex.: Sala, Hall, Cozinha, Quarto 01, Marquise")}
                  className="rounded-full"
                />
                <Button type="button" onClick={adicionarAmbiente} className="rounded-full">
                  <Plus className="h-4 w-4 mr-1" />
                  {t("Adicionar")}
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
                        aria-label={t("Remover {nome}", { nome })}
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
                  ? t("Os próximos itens vão para: {comodo}. Clique na divisão para trocar.", { comodo: ambienteAtual })
                  : t("Nenhuma divisão selecionada: os próximos itens ficam sem divisão. Clique numa divisão para a escolher.")}
              </p>

              {/* Quadro de areas: dimensoes do comodo -> quantidades automaticas */}
              {ambienteAtual && (
                <div className="rounded-lg border bg-background p-3 space-y-2" data-testid="dimensoes-comodo">
                  <p className="text-sm font-medium">{t("Dimensões de {comodo}", { comodo: ambienteAtual })}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CAMPOS_DIMENSAO.map(([campo, rotulo, un]) => (
                      <div key={campo} className="space-y-1">
                        <Label className="text-xs">{t(rotulo)}</Label>
                        <CampoNumerico
                          tamanho="sm"
                          min={0}
                          sufixo={un}
                          aria-label={t(rotulo)}
                          value={formData.dimensoesAmbientes[ambienteAtual]?.[campo] ?? 0}
                          onChange={(valor) => alterarDimensoes(ambienteAtual, { [campo]: valor })}
                        />
                      </div>
                    ))}
                  </div>
                  {ambienteComDimensoes && (
                    <p className="text-xs text-muted-foreground" data-testid="medidas-comodo">
                      {t(
                        "Pavimento/teto {pavimento} m2 · Paredes {paredes} m2 · Perímetro {perimetro} ml. Os itens ligados a uma medição acompanham estas dimensões.",
                        {
                          pavimento: formatNumber2(medidasAtuais.pavimento),
                          paredes: formatNumber2(medidasAtuais.paredes),
                          perimetro: formatNumber2(medidasAtuais.perimetro),
                        },
                      )}
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t("Serviço no orçamento")}</h3>
            <Card className="p-4 border-2 border-dashed">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("Selecionar serviço")}</Label>
                  <SeletorComBusca
                    valor={servicoForm.servicoId}
                    onChange={handleServicoSelect}
                    placeholder={t("Escolha um serviço")}
                    placeholderBusca={t("Procurar serviço...")}
                    vazio={t("Nenhum serviço encontrado.")}
                    className="rounded-full"
                    opcoes={servicos.map((servico) => ({
                      valor: servico.id!,
                      rotulo: servico.nome,
                      detalhe: `${getServiceCategoryName(servico.categoriaId, servico.categoriaNome)} - ${formatCurrency(
                        servico.preco || 0,
                      )} / ${nomeUnidade(servico.unidade)}`,
                    }))}
                  />
                </div>

                {servicoForm.servicoId && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>{t("Unidade (automático)")}</Label>
                        <Input value={nomeUnidade(servicoForm.unidade)} readOnly className="rounded-full bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          {t("Quantidade")}
                          {servicoForm.medicao &&
                            ` (${t("{medicao} de {comodo}", {
                              medicao: t(MEDICOES[servicoForm.medicao].nome).toLowerCase(),
                              comodo: ambienteAtual,
                            })})`}
                        </Label>
                        <CampoNumerico
                          min={0.01}
                          value={servicoForm.quantidade}
                          onChange={(quantidade) => setServicoForm({ ...servicoForm, quantidade, medicao: undefined })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("Venda por {unidade} (automático)", { unidade: nomeUnidade(servicoForm.unidade) || t("unidade") })}</Label>
                        <Input
                          value={toFixed2(vendaServico(servicoForm.precoUnitario))}
                          readOnly
                          data-testid="servico-venda-unitaria"
                          className="rounded-full bg-muted"
                        />
                      </div>
                    </div>
                    {verCusto && (
                      <p className="text-xs text-muted-foreground" data-testid="servico-custo-info">
                        {t("Custo da composição: {custo}/{unidade}", {
                          custo: formatCurrency(servicoForm.precoUnitario),
                          unidade: nomeUnidade(servicoForm.unidade),
                        })}
                        {servicoForm.decomposicao &&
                          ` (${t("mão de obra {maoObra} · materiais {materiais} · outros {outros}", {
                            maoObra: formatCurrency(servicoForm.decomposicao.mao_obra),
                            materiais: formatCurrency(servicoForm.decomposicao.materiais),
                            outros: formatCurrency(servicoForm.decomposicao.outros),
                          })})`}
                        {servicoForm.linhasAtualizadas > 0 &&
                          ` · ${
                            servicoForm.linhasAtualizadas === 1
                              ? t("{n} linha com preço atualizado pelo catálogo", { n: servicoForm.linhasAtualizadas })
                              : t("{n} linhas com preço atualizado pelo catálogo", { n: servicoForm.linhasAtualizadas })
                          }`}
                      </p>
                    )}

                    <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span>
                          {toFixed2(servicoForm.quantidade)} {nomeUnidade(servicoForm.unidade)} x{" "}
                          {formatCurrency(vendaServico(servicoForm.precoUnitario))}
                        </span>
                        <span>
                          {formatCurrency(calculateItemTotal(servicoForm.quantidade, vendaServico(servicoForm.precoUnitario)))}
                        </span>
                      </div>
                      {servicoForm.precoFixo > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t("Valor fixo (não multiplica pela área)")}</span>
                          <span>{formatCurrency(servicoForm.precoFixo)}</span>
                        </div>
                      )}
                      {servicoForm.transporte > 0 && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{t("Transporte (vai para a linha final)")}</span>
                          <span>{formatCurrency(servicoForm.transporte)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t pt-1 font-medium">
                        <span>{t("Total do item")}</span>
                        <span className="text-lg font-bold">
                          {formatCurrency(
                            round2(
                              calculateItemTotal(servicoForm.quantidade, vendaServico(servicoForm.precoUnitario)) +
                                (servicoForm.precoFixo > 0 ? vendaServico(servicoForm.precoFixo) : 0),
                            ),
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="button" onClick={handleServicoFormSubmit} className="rounded-full">
                        {t("Adicionar ao orçamento")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">{t("Produto no orçamento")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("O custo real e o preço de venda vêm do registo de Produtos.")}
              </p>
            </div>
            <Card className="p-4 border-2 border-dashed">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("Selecionar produto")}</Label>
                  <SeletorComBusca
                    valor={produtoForm.materialId}
                    onChange={(materialId) => setProdutoForm({ ...produtoForm, materialId })}
                    placeholder={t("Escolha um produto")}
                    placeholderBusca={t("Procurar produto...")}
                    vazio={t("Nenhum produto encontrado.")}
                    className="rounded-full"
                    opcoes={materiais.map((produto) => ({
                      valor: produto.id!,
                      rotulo: produto.codigo ? `${produto.codigo} - ${produto.nome}` : produto.nome,
                      detalhe: `${formatCurrency(vendaDoProduto(produto, gruposImpostos))} / ${nomeUnidade(produto.unidade)}${
                        produto.controlaEstoque ? ` - ${t("stock {n}", { n: formatNumber2(Number(produto.estoqueAtual) || 0) })}` : ""
                      }`,
                    }))}
                  />
                </div>

                {produtoSelecionado && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>{t("Quantidade ({unidade})", { unidade: nomeUnidade(produtoSelecionado.unidade) })}</Label>
                        <CampoNumerico
                          min={0.01}
                          value={produtoForm.quantidade}
                          onChange={(quantidade) => setProdutoForm({ ...produtoForm, quantidade })}
                          className="rounded-full"
                        />
                      </div>
                      {verCusto && (
                        <div className="space-y-2">
                          <Label>{t("Custo (inclui impostos de venda)")}</Label>
                          <Input
                            value={toFixed2(custoOrcamentoProduto(produtoSelecionado, gruposImpostos))}
                            readOnly
                            className="rounded-full bg-muted"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>{formData.usarMargemItem ? t("Venda unitária") : t("Venda unitária (margem por item desligada)")}</Label>
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
                          {t("Stock atual: {quantidade} {unidade} - abaixo da quantidade orçamentada.", {
                            quantidade: formatNumber2(Number(produtoSelecionado.estoqueAtual) || 0),
                            unidade: nomeUnidade(produtoSelecionado.unidade),
                          })}
                        </p>
                      )}
                    <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
                      <span className="font-medium">{t("Total do item (venda)")}</span>
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
                        {t("Adicionar ao orçamento")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">{t("Mão de obra avulsa (opcional)")}</h3>
              <p className="text-sm text-muted-foreground">
                {t(
                  "A função define o preço ao cliente; o funcionário define o custo. Sem funcionário escolhido, usa-se o custo médio da função. A mão de obra normal já vem incluída no preço dos serviços.",
                )}
              </p>
            </div>
            <Card className="p-4 border-2 border-dashed">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("Função (preço ao cliente)")}</Label>
                    <SeletorComBusca
                      valor={maoObraForm.funcaoId}
                      onChange={handleFuncaoSelect}
                      placeholder={funcoes.length ? t("Escolha a função") : t("Sem funções registadas")}
                      placeholderBusca={t("Procurar função...")}
                      vazio={t("Nenhuma função encontrada.")}
                      className="rounded-full"
                      opcoes={funcoes.map((funcao) => ({
                        valor: funcao.id!,
                        rotulo: funcao.nome,
                        detalhe: t("{preco}/hora", { preco: formatCurrency(funcao.precoHora) }),
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Funcionário (custo)")}</Label>
                    <SeletorComBusca
                      valor={maoObraForm.funcionarioId}
                      onChange={handleFuncionarioSelect}
                      placeholder={t("Escolha um funcionário")}
                      placeholderBusca={t("Procurar funcionário...")}
                      vazio={t("Nenhum funcionário encontrado.")}
                      className="rounded-full"
                      opcoes={[
                        ...(funcaoSelecionada
                          ? [
                              {
                                valor: CUSTO_MEDIO,
                                rotulo: t("Custo médio da função"),
                                detalhe: verCusto
                                  ? t("{preco}/hora", { preco: formatCurrency(custoMedioFuncao(funcaoSelecionada, funcionarios)) })
                                  : undefined,
                              },
                            ]
                          : []),
                        ...funcionariosParaEscolher.map((funcionario) => ({
                          valor: funcionario.id!,
                          rotulo: funcionario.nome,
                          detalhe: verCusto
                            ? t("{funcao} - custo {custo}/hora", {
                                funcao: funcionario.funcao,
                                custo: formatCurrency(custoHoraFuncionario(funcionario)),
                              })
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
                        <Label>{t("Unidade")}</Label>
                        <Select
                          value={maoObraForm.unidade}
                          onValueChange={(value) => setMaoObraForm({ ...maoObraForm, unidade: value })}
                        >
                          <SelectTrigger className="rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="horas">{t("Horas")}</SelectItem>
                            <SelectItem value="dias">{t("Dias")}</SelectItem>
                            <SelectItem value="projeto">{t("Projeto")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("Quantidade de horas")}</Label>
                        <CampoNumerico
                          min={0.01}
                          value={maoObraForm.quantidade}
                          onChange={(quantidade) => setMaoObraForm({ ...maoObraForm, quantidade })}
                          className="rounded-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("Valor de venda/hora (automático)")}</Label>
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
                            {t("Custo real ({custo}/hora - {quem})", {
                              custo: toFixed2(previaMaoObra.custo),
                              quem: funcionarioSelecionado ? funcionarioSelecionado.nome : t("média da função"),
                            })}
                          </span>
                          <span>{formatCurrency(calculateItemTotal(maoObraForm.quantidade, previaMaoObra.custo))}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t pt-1">
                        <span className="font-medium">{t("Total do item (venda)")}</span>
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
                      {t(
                        'O nome do funcionário fica só no uso interno e no PDF de custo. No PDF de venda, o item aparece como "Mão de obra" com a função.',
                      )}
                    </p>

                    <div className="flex justify-end">
                      <Button type="button" onClick={handleMaoObraFormSubmit} className="rounded-full">
                        {t("Adicionar ao orçamento")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          {formData.itens.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-10 text-center">
              <p className="font-medium">{t("Ainda sem itens")}</p>
              <p className="text-sm text-muted-foreground">
                {t("Escolha um serviço ou produto acima, ou lance horas na mão de obra avulsa.")}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t("Itens do orçamento")}</h3>
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
                          title={recolhido ? t("Expandir divisão") : t("Recolher divisão")}
                          onClick={() => alternarAmbiente(grupo.nome)}
                        >
                          {recolhido ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span className="text-sm font-semibold">{indiceGrupo + 1}.</span>
                        {grupo.nome === SEM_AMBIENTE ? (
                          <span className="text-sm font-semibold">{t(SEM_AMBIENTE)}</span>
                        ) : (
                          <Input
                            value={grupo.nome}
                            onChange={(e) => renomearAmbiente(grupo.nome, e.target.value)}
                            className="h-7 max-w-[240px] border-none bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:bg-background"
                            title={t("Clique para mudar o nome da divisão")}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {recolhido && (
                          <span className="text-xs opacity-80">
                            {grupo.itens.length === 1
                              ? t("{n} item", { n: grupo.itens.length })
                              : t("{n} itens", { n: grupo.itens.length })}
                          </span>
                        )}
                        <span className="text-sm font-semibold">{formatCurrency(grupo.subtotal)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          title={t('Duplicar "{nome}" com todos os itens', { nome: grupo.nome === SEM_AMBIENTE ? t(SEM_AMBIENTE) : grupo.nome })}
                          onClick={() => duplicarAmbiente(grupo.nome)}
                        >
                          <Copy className="h-3 w-3" />
                          {t("Duplicar divisão")}
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
                                    <SelectItem value="__sem">{t("Sem divisão")}</SelectItem>
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
                                  <Label className="text-xs">{t("Nome do item")}</Label>
                                  <Input
                                    value={item.nome ?? item.descricao}
                                    onChange={(e) => handleItemUpdate(item.id, "nome", e.target.value)}
                                    className="h-8 text-sm font-medium"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">{t("Descrição do item")}</Label>
                                  <Textarea
                                    value={item.descricao}
                                    onChange={(e) => handleItemUpdate(item.id, "descricao", e.target.value)}
                                    rows={2}
                                    className="text-sm"
                                    placeholder={t("Descrição detalhada impressa no orçamento")}
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {item.valorFixo && (
                                    <Badge variant="secondary" className="text-xs">
                                      {t("Valor fixo")}
                                    </Badge>
                                  )}
                                  {item.tipo === "mao_obra" && (
                                    <Badge variant="secondary" className="text-xs">
                                      {t("No PDF do cliente: {texto}", { texto: item.descricaoCliente || t("Mão de obra") })}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title={t("Duplicar este item para outra divisão")}
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
                                <Label className="text-xs">{t("Quantidade")}</Label>
                                <CampoNumerico
                                  tamanho="sm"
                                  value={item.quantidade}
                                  disabled={item.valorFixo || !!item.medicao}
                                  title={item.medicao ? t("Vem das dimensões da divisão") : undefined}
                                  onChange={(quantidade) => handleItemUpdate(item.id, "quantidade", quantidade)}
                                  className={item.valorFixo || item.medicao ? "bg-muted" : undefined}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">{t("Unidade")}</Label>
                                <Input
                                  value={item.unidade}
                                  readOnly={readOnlyServico}
                                  onChange={(e) => handleItemUpdate(item.id, "unidade", e.target.value)}
                                  className={`h-8 text-sm ${readOnlyServico ? "bg-muted" : ""}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">{t("Custo unit. (EUR)")}</Label>
                                <CampoNumerico
                                  tamanho="sm"
                                  value={custoUnitario}
                                  onChange={(valor) => handleItemUpdate(item.id, "custoUnitario", valor)}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">{t("Venda unit. (EUR)")}</Label>
                                <CampoNumerico
                                  tamanho="sm"
                                  value={item.precoUnitario}
                                  readOnly={porEspecialidade || !formData.usarMargemItem}
                                  title={
                                    porEspecialidade
                                      ? t("Custo x (estrutura + margem da especialidade)")
                                      : formData.usarMargemItem
                                        ? undefined
                                        : t("Margem por item desligada: vende ao custo")
                                  }
                                  className={porEspecialidade || !formData.usarMargemItem ? "bg-muted" : undefined}
                                  onChange={(valor) => handleItemUpdate(item.id, "precoUnitario", valor)}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">{t("Total venda (EUR)")}</Label>
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
                                {t("Valor fixo: não multiplica pela quantidade/área")}
                              </label>
                              {porEspecialidade && (
                                <Select
                                  value={item.especialidadeId || especialidadesDe(configuracao)[0].id}
                                  onValueChange={(valor) => handleItemUpdate(item.id, "especialidadeId", valor)}
                                >
                                  <SelectTrigger className="h-7 w-auto gap-1 rounded-full text-xs" aria-label={t("Especialidade")}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {especialidadesDe(configuracao).map((e) => (
                                      <SelectItem key={e.id} value={e.id}>
                                        {t(e.nome)} ({formatNumber2(estruturaDe(configuracao) + e.margem + (formData.margemAdicional || 0))}%)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {!item.valorFixo && temDimensoes(formData.dimensoesAmbientes[item.ambiente || ""]) && (
                                <Select
                                  value={item.medicao || "__manual"}
                                  onValueChange={(valor) => handleItemUpdate(item.id, "medicao", valor === "__manual" ? "" : valor)}
                                >
                                  <SelectTrigger className="h-7 w-auto gap-1 rounded-full text-xs" aria-label={t("Medição")}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__manual">{t("Quantidade manual")}</SelectItem>
                                    {(Object.keys(MEDICOES) as TipoMedicao[]).map((m) => (
                                      <SelectItem key={m} value={m}>
                                        {t("Qtd = {medicao} da divisão", { medicao: t(MEDICOES[m].nome).toLowerCase() })}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {t("Custo do item: {custo}", {
                                  custo: formatCurrency(calculateItemTotal(item.quantidade, custoUnitario, item.valorFixo)),
                                })}
                                {verCusto &&
                                  ` · ${t("Margem do item: {sobreCusto}% sobre o custo ({sobreVenda}% da venda)", {
                                    sobreCusto: formatNumber2(margemPorPreco(custoUnitario, item.precoUnitario)),
                                    sobreVenda: formatNumber2(margemSobreVenda(custoUnitario, item.precoUnitario)),
                                  })}`}
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
            <h3 className="text-lg font-medium">{t("Definição do preço")}</h3>

            {/* Modelo de preco: o da folha de obra, ou o das margens */}
            <div className="grid gap-3 sm:grid-cols-2" data-testid="modo-preco">
              {(
                [
                  ["especialidade", t("Por especialidade (folha de obra)"), t("Preço = custo x (1 + estrutura + margem da especialidade). Cada item escolhe a especialidade.")],
                  ["margens", t("Por margens"), t("Margem por item (preço de venda do registo) e/ou margem global sobre o subtotal.")],
                ] as const
              ).map(([modo, titulo, ajuda]) => (
                <button
                  key={modo}
                  type="button"
                  onClick={() => trocarModoPreco(modo)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    formData.modoPreco === modo ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"
                  }`}
                >
                  <div className="font-medium">{titulo}</div>
                  <div className="text-xs text-muted-foreground">{ajuda}</div>
                </button>
              ))}
            </div>

            {porEspecialidade && (
              <Card className="p-4 space-y-2" data-testid="painel-especialidades">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {t("Estrutura {percentagem}% + margem da especialidade", { percentagem: formatNumber2(estruturaDe(configuracao)) })}
                  </span>
                  <a href="/configuracoes?aba=precos" target="_blank" className="text-xs text-primary underline">
                    {t("Alterar em Configurações > Preços")}
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  {especialidadesDe(configuracao).map((e) => (
                    <Badge key={e.id} variant="outline" className="font-normal">
                      {t("{nome}: +{percentagem}% sobre o custo", {
                        nome: t(e.nome),
                        percentagem: formatNumber2(estruturaDe(configuracao) + e.margem + (formData.margemAdicional || 0)),
                      })}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-3 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor="margemAdicional">{t("Margem adicional desta proposta")}</Label>
                    <CampoNumerico
                      id="margemAdicional"
                      min={-100}
                      max={500}
                      sufixo="%"
                      value={formData.margemAdicional}
                      onChange={alterarMargemAdicional}
                      className="w-32"
                    />
                  </div>
                  <p className="max-w-md pb-1 text-xs text-muted-foreground">
                    {t(
                      "Soma-se à estrutura e à margem de cada especialidade, só nesta proposta. Positiva, serve de coeficiente de segurança; negativa, de desconto.",
                    )}
                  </p>
                </div>

                {verCusto && (
                  <p className="text-sm">
                    {comElementos(t("Lucro previsto {lucro} = {percentagem} da venda sem IVA"), {
                      lucro: <span className="font-medium tabular-nums">{formatCurrency(lucroPrevisto)}</span>,
                      percentagem: <span className="font-medium tabular-nums">{formatNumber2(margemVendaAtual)}%</span>,
                    })}
                  </p>
                )}
              </Card>
            )}

            {/* As duas margens sao independentes: qualquer combinacao vale */}
            {!porEspecialidade && <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-4 space-y-2">
                <label className="flex items-center gap-3 font-medium">
                  <Switch checked={formData.usarMargemItem} onCheckedChange={alternarMargemItem} />
                  {t("Margem por item")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {formData.usarMargemItem
                    ? t("Cada produto e mão de obra entra pelo preço de venda do registo (com a respetiva margem).")
                    : t("Desligada: cada item entra ao preço de custo. Ao voltar a ligar, os preços de tabela são repostos.")}
                </p>
                {verCusto && (
                  <p className="text-sm">
                    {comElementos(t("Margem dos itens: {valor}"), {
                      valor: <span className="font-medium tabular-nums">{formatCurrency(margemItensAtual)}</span>,
                    })}
                  </p>
                )}
              </Card>
              <Card className="p-4 space-y-2">
                <label className="flex items-center gap-3 font-medium">
                  <Switch checked={formData.usarMargemGlobal} onCheckedChange={alternarMargemGlobal} />
                  {t("Margem global")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t("Percentagem somada ao subtotal de todos os itens, por cima da margem de cada item.")}
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
            </div>}

            {/* Custos indiretos: estaleiro, seguros, licenciamento */}
            <Card className="p-4 space-y-3">
              <div>
                <div className="font-medium">{t("Custos indiretos da obra")}</div>
                <p className="text-xs text-muted-foreground">
                  {porEspecialidade
                    ? t("Entram no custo e vendem-se com a mesma regra dos itens (estrutura + construção civil).")
                    : t("Entram no custo e vendem-se com a mesma regra dos itens (margem global).")}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["estaleiro", t("Estaleiro")],
                    ["seguros", t("Seguros")],
                    ["licenciamento", t("Licenciamento")],
                  ] as const
                ).map(([campo, rotulo]) => (
                  <div key={campo} className="space-y-1">
                    <Label className="text-xs">{rotulo}</Label>
                    <CampoNumerico
                      min={0}
                      sufixo="EUR"
                      aria-label={rotulo}
                      value={formData.custosIndiretos[campo]}
                      onChange={(valor) =>
                        setFormData({ ...formData, custosIndiretos: { ...formData.custosIndiretos, [campo]: valor } })
                      }
                      className="rounded-full"
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Contexto fiscal: sugere a taxa de IVA */}
            <Card className="p-4 space-y-3" data-testid="contexto-fiscal">
              <div className="font-medium">{t("Contexto fiscal")}</div>
              <div className="grid gap-3 sm:grid-cols-4">
                {(
                  [
                    ["regiao", t("Região"), Object.fromEntries(Object.entries(TAXAS_REGIAO).map(([k, v]) => [k, v.nome]))],
                    ["tipoObra", t("Tipo de obra"), TIPOS_OBRA],
                    ["tipoCliente", t("Tipo de cliente"), TIPOS_CLIENTE],
                    ["tipoOperacao", t("Operação"), TIPOS_OPERACAO],
                  ] as const
                ).map(([campo, rotulo, opcoes]) => (
                  <div key={campo} className="space-y-1">
                    <Label className="text-xs">{rotulo}</Label>
                    <Select
                      value={(formData.contextoFiscal[campo] as string | undefined) || "__nd"}
                      onValueChange={(valor) =>
                        setFormData({
                          ...formData,
                          contextoFiscal: { ...formData.contextoFiscal, [campo]: valor === "__nd" ? undefined : valor },
                        })
                      }
                    >
                      <SelectTrigger className="rounded-full" aria-label={rotulo}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {campo !== "regiao" && <SelectItem value="__nd">{t("Não especificado")}</SelectItem>}
                        {Object.entries(opcoes).map(([valor, nome]) => (
                          <SelectItem key={valor} value={valor}>
                            {t(nome)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted p-3 text-sm">
                <div>
                  <div className="font-medium" data-testid="sugestao-iva">
                    {t("Sugerido: {regime} - {taxa}%", { regime: sugestaoIVA.regime, taxa: formatNumber2(sugestaoIVA.taxa) })}
                  </div>
                  <div className="text-xs text-muted-foreground">{sugestaoIVA.fundamento}</div>
                  {sugestaoIVA.aviso && <div className="text-xs text-amber-700 dark:text-amber-400">{sugestaoIVA.aviso}</div>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={formData.taxaIVA === sugestaoIVA.taxa}
                  onClick={() => setFormData({ ...formData, taxaIVA: sugestaoIVA.taxa })}
                >
                  {formData.taxaIVA === sugestaoIVA.taxa ? t("Aplicado") : t("Aplicar")}
                </Button>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transporte">{t("Custo de transporte (EUR)")}</Label>
                <CampoNumerico
                  id="transporte"
                  min={0}
                  sufixo="EUR"
                  value={formData.transporte}
                  onChange={(transporte) => setFormData({ ...formData, transporte })}
                  className="rounded-full"
                />
                <p className="text-xs text-muted-foreground">
                  {t("Somado automaticamente a partir dos serviços e lançado como linha própria no final do orçamento.")}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxaIVA">{t("IVA (%)")}</Label>
                <Select
                  value={TAXAS_IVA.some((taxa) => taxa.valor === formData.taxaIVA) ? String(formData.taxaIVA) : "outra"}
                  onValueChange={(value) => {
                    if (value === "outra") return
                    setFormData({ ...formData, taxaIVA: Number(value) })
                  }}
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder={t("Selecione a taxa")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TAXAS_IVA.map((taxa) => (
                      <SelectItem key={taxa.valor} value={String(taxa.valor)}>
                        {t(taxa.label)}
                      </SelectItem>
                    ))}
                    <SelectItem value="outra">{t("Outra taxa (indicar ao lado)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxaIVAValor">{t("Taxa aplicada (%)")}</Label>
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
                  {t("Incide sobre subtotal + margem + transporte. Não entra no lucro: é cobrado ao cliente e entregue ao Estado.")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">{t("Observações (opcional)")}</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder={t("Observações adicionais sobre o orçamento...")}
              rows={3}
            />
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Switch
              checked={formData.discriminarPDF}
              onCheckedChange={(discriminarPDF) => setFormData({ ...formData, discriminarPDF })}
              aria-label={t("Discriminar material e mão de obra no PDF")}
            />
            <span>
              <span className="font-medium">{t("Discriminar material e mão de obra no PDF")}</span>
              <span className="block text-xs text-muted-foreground">
                {t(
                  "Por baixo de cada item aparece quanto é material e quanto é mão de obra, segundo a composição. Útil quando o cliente pede o valor repartido.",
                )}
              </span>
            </span>
          </label>
        </TabsContent>

        {/* --------------------------------------------------------- Resumo */}
        <TabsContent value="resumo" className="space-y-4 pt-4">
          {formData.itens.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-10 text-center">
              <p className="font-medium">{t("Sem itens, sem resumo")}</p>
              <p className="text-sm text-muted-foreground">{t("Adicione itens no separador Itens para ver os totais.")}</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <h4 className="font-medium">{t("Orçamento de venda (cliente)")}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{t("Subtotal:")}</span>
                    <span>{formatCurrency(subtotalAtual)}</span>
                  </div>
                  {indiretosCusto > 0 && (
                    <div className="flex justify-between">
                      <span>{t("Custos indiretos (estaleiro, seguros...):")}</span>
                      <span>{formatCurrency(indiretosVenda)}</span>
                    </div>
                  )}
                  {!porEspecialidade && formData.usarMargemGlobal && (
                    <div className="flex justify-between">
                      <span>{t("Margem global ({percentagem}%):", { percentagem: formatNumber2(margemGlobalAtual) })}</span>
                      <span>{formatCurrency(round2(((subtotalAtual + indiretosVenda) * margemGlobalAtual) / 100))}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t("Transporte:")}</span>
                    <span>{formatCurrency(transporteAtual)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span>{t("Base tributável:")}</span>
                    <span>{formatCurrency(baseTributavelAtual)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("IVA ({percentagem}%):", { percentagem: formatNumber2(formData.taxaIVA) })}</span>
                    <span>{formatCurrency(valorIVAAtual)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>{t("Total com IVA:")}</span>
                    <span>{formatCurrency(valorTotalAtual)}</span>
                  </div>
                </div>
              </div>

              {verCusto && (
                <div className="space-y-2 p-4 border rounded-lg">
                  <h4 className="font-medium">{t("Orçamento de custo (interno)")}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>{t("Custo dos itens:")}</span>
                      <span>{formatCurrency(subtotalCustoAtual)}</span>
                    </div>
                    {indiretosCusto > 0 && (
                      <div className="flex justify-between">
                        <span>{t("Custos indiretos:")}</span>
                        <span>{formatCurrency(indiretosCusto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{t("Transporte:")}</span>
                      <span>{formatCurrency(transporteAtual)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>{t("Total de custo:")}</span>
                      <span>{formatCurrency(valorTotalCustoAtual)}</span>
                    </div>
                    {porEspecialidade ? (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t("Estrutura + margens das especialidades:")}</span>
                        <span>{formatCurrency(round2(margemItensAtual + indiretosVenda - indiretosCusto))}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>{formData.usarMargemItem ? t("Margem dos itens:") : t("Margem dos itens (desligada):")}</span>
                          <span>{formatCurrency(margemItensAtual)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>{formData.usarMargemGlobal ? t("Margem global:") : t("Margem global (desligada):")}</span>
                          <span>{formatCurrency(round2(((subtotalAtual + indiretosVenda) * margemGlobalAtual) / 100))}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-primary font-medium">
                      <span>{t("Lucro previsto:")}</span>
                      <span data-testid="resumo-lucro">
                        {t("{lucro} ({percentagem}% da venda)", { lucro: formatCurrency(lucroPrevisto), percentagem: formatNumber2(margemVendaAtual) })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      {t("Lucro = base tributável ({base}) - custo, sem o IVA.", { base: formatCurrency(baseTributavelAtual) })}
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
              {t(
                "O que a obra gastou de facto. Escreva o valor da fatura (com IVA) e escolha a taxa: o custo sem IVA e o IVA suportado são calculados. A análise compara com a margem desta proposta, já com o que estiver em edição nos outros separadores.",
              )}
            </p>
            {!podeLancarCustos && (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                {t(
                  'O seu cargo permite ver os custos, mas não lançá-los. Peça a permissão "Lançar custos reais da obra" a quem gere os utilizadores.',
                )}
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
          <span className="text-muted-foreground">{t("Total com IVA:")} </span>
          <span className="font-semibold tabular-nums">{formatCurrency(valorTotalAtual)}</span>
          {verCusto && formData.itens.length > 0 && (
            <>
              <span className="text-muted-foreground"> · {t("Lucro previsto:")} </span>
              <span className="font-semibold tabular-nums">{formatCurrency(lucroPrevisto)}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancelar} className="rounded-full">
            {t("Cancelar")}
          </Button>
          <Button type="submit" disabled={aGravar} className="rounded-full">
            {aGravar && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {aGravar ? t("A guardar...") : orcamento ? t("Guardar alterações") : t("Criar orçamento")}
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
            <DialogTitle>{t("Duplicar item")}</DialogTitle>
            <DialogDescription>
              {t(
                'Copia "{nome}" ({quantidade} {unidade}) para outra divisão. Útil quando o Quarto 02 leva os mesmos trabalhos do Quarto 01.',
                {
                  nome: duplicandoItem?.nome || duplicandoItem?.descricao,
                  quantidade: toFixed2(duplicandoItem?.quantidade || 0),
                  unidade: nomeUnidade(duplicandoItem?.unidade),
                },
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Divisão de destino")}</Label>
              <Select value={duplicarAmbienteDestino} onValueChange={setDuplicarAmbienteDestino}>
                <SelectTrigger className="rounded-full">
                  <SelectValue placeholder={t("Escolha a divisão")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__sem">{t("Sem divisão")}</SelectItem>
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
                <Label>{t("Funcionário da cópia")}</Label>
                <Select value={duplicarFuncionarioId} onValueChange={setDuplicarFuncionarioId}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder={t("Escolha um funcionário")} />
                  </SelectTrigger>
                  <SelectContent>
                    {duplicandoItem.funcaoId && <SelectItem value={CUSTO_MEDIO}>{t("Custo médio da função")}</SelectItem>}
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
              {t("Cancelar")}
            </Button>
            <Button type="button" onClick={handleDuplicarItem} className="rounded-full">
              <Copy className="h-4 w-4 mr-2" />
              {t("Duplicar")}
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
  configuracao: Partial<ConfiguracaoEmpresa>,
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
      // Propostas novas seguem a folha de obra: custo x estrutura x especialidade
      modoPreco: "especialidade",
      margemAdicional: 0,
      dimensoesAmbientes: {},
      custosIndiretos: { estaleiro: 0, seguros: 0, licenciamento: 0 },
      contextoFiscal: { regiao: "continente" },
      discriminarPDF: false,
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
    // Propostas gravadas antes do modelo por especialidade ficam como estavam
    modoPreco: orcamento.modoPreco ?? "margens",
    margemAdicional: Number(orcamento.margemAdicional) || 0,
    dimensoesAmbientes: orcamento.dimensoesAmbientes || {},
    custosIndiretos: orcamento.custosIndiretos || { estaleiro: 0, seguros: 0, licenciamento: 0 },
    contextoFiscal: orcamento.contextoFiscal || { regiao: "continente" },
    discriminarPDF: !!orcamento.discriminarPDF,
    transporte: round2(orcamento.transporte || 0),
    taxaIVA: round2(orcamento.taxaIVA ?? 0),
    observacoes: orcamento.observacoes || "",
    custosObra: orcamento.custosObra || [],
  }
}
