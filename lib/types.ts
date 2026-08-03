export interface Cliente {
  id?: string
  numeroUnico: string
  nome: string
  email: string
  telefone: string
  morada: string
  cidade: string
  codigoPostal: string
  nif?: string
  observacoes?: string
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface Funcionario {
  id?: string
  // Informações Pessoais
  nome: string
  email: string
  telefone: string
  dataNascimento: string
  idade: number
  morada?: string
  cidade?: string
  codigoPostal?: string
  nif?: string
  foto?: string
  observacoes?: string

  // Informações da Empresa
  funcao: string
  dataAdmissao?: string
  numeroFuncionario?: string
  departamento?: string

  // Horário e Valores
  horasPorDia: number
  diasPorSemana: number
  horasPorSemana?: number
  horasPorMes: number
  mesReferencia?: string
  margemLucro?: number
  custoHora: number
  custoHoraCalculado?: number
  salarioBase: number
  valorBeneficios: number
  valorTransporte: number
  percentualSeguranca?: number
  valorSeguranca?: number
  percentualIRS?: number
  valorIRS?: number
  totalEncargos?: number
  salarioTotal: number

  // Encargos liquidos (cenario alternativo, percentuais independentes)
  percentualSegurancaLiquido?: number
  valorSegurancaLiquido?: number
  percentualIRSLiquido?: number
  valorIRSLiquido?: number
  totalEncargosLiquido?: number
  salarioTotalLiquido?: number
  custoHoraLiquido?: number
  valorVendaHoraLiquido?: number

  // Detalhe do calculo de horas (dias uteis reais do mes de referencia)
  diasUteisMes?: number

  ativo: boolean
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface Material {
  id?: string
  nome: string
  unidade: string
  precoUnitario: number
  categoriaId?: string
  fornecedor?: string
  observacoes?: string
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface MaterialCategory {
  id?: string
  nome: string
  descricao?: string
  cor?: string
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface Categoria {
  id?: string
  nome: string
  descricao?: string
  cor: string
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface ServicoComposicaoItem {
  id: string
  materialId: string
  nome: string
  descricao?: string
  quantidade: number
  unidade: string
  precoUnitario: number
  total: number
  /**
   * Quando true o item nao acompanha a area/quantidade do orcamento:
   * entra como valor fixo (ex.: andaime, deslocacao, montagem).
   */
  valorFixo?: boolean
}

export interface Servico {
  id?: string
  nome: string
  descricao?: string
  /** Preco base total (parte variavel + parte fixa). */
  preco: number
  /** Parte que acompanha a quantidade/area do orcamento (multiplica por m2). */
  precoVariavel?: number
  /** Parte que entra uma unica vez, independente da area (nao multiplica por m2). */
  precoFixo?: number
  unidade: string
  categoriaId?: string
  categoriaNome?: string
  maoDeObra?: number
  consumiveis?: number
  listaConsumiveis?: ServicoComposicaoItem[]
  itens?: number
  listaItens?: ServicoComposicaoItem[]
  transporte?: number
  observacoes?: string
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface ItemOrcamento {
  id: string
  /** Nome curto do item (servico, funcao ou material). */
  nome?: string
  /** Descricao detalhada do item, impressa abaixo do nome. */
  descricao: string
  /** Descricao alternativa usada no PDF de venda (esconde o nome do funcionario). */
  descricaoCliente?: string
  quantidade: number
  unidade: string
  /** Preco de venda unitario (com margem do funcionario/servico). */
  precoUnitario: number
  /** Custo unitario real, usado no orcamento de custo. */
  custoUnitario?: number
  total: number
  /** Total pelo custo real. */
  totalCusto?: number
  /** Valor fixo: nao multiplica pela quantidade/area (total = preco unitario). */
  valorFixo?: boolean
  tipo: "servico" | "mao_obra" | "material"
  servicoId?: string
  funcionarioId?: string
  /** Guardado apenas para uso interno; nunca sai no PDF de venda. */
  funcionarioNome?: string
  funcionarioFuncao?: string
  materialId?: string
}

export interface Orcamento {
  id?: string
  numero: string
  clienteId?: string
  cliente: {
    nome: string
    email: string
    telefone: string
    morada: string
    cidade: string
    codigoPostal: string
    nif?: string
  }
  dataOrcamento: Date
  dataValidade: Date
  orcamentista: string
  itens: ItemOrcamento[]
  funcionariosSelecionados: string[]
  servicosSelecionados: string[]
  subtotal: number
  /** Subtotal pelo custo real (sem margem) - base do orcamento de custo. */
  subtotalCusto?: number
  /** Custo de transporte, somado como linha propria no final do orcamento. */
  transporte?: number
  impostos: number
  margemLucro: number
  valorTotal: number
  /** Total pelo custo real (custo dos itens + transporte). */
  valorTotalCusto?: number
  observacoes?: string
  status: "rascunho" | "enviado" | "aprovado" | "rejeitado"
  localidade?: string
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface TermoServico {
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

export interface DashboardStats {
  totalOrcamentos: number
  orcamentosAprovados: number
  receitaTotal: number
  clientesAtivos: number
  taxaConversao: number
}
