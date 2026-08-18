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

/** Como cada encargo foi definido: por percentagem ou por valor fixo. */
export type ModoTaxa = "percentual" | "valor"

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

  /** Cada taxa pode ser definida por percentagem ou por valor fixo em euros. */
  modoSeguranca?: ModoTaxa
  modoSeguroAcidentes?: ModoTaxa
  modoSegurancaLiquido?: ModoTaxa
  modoIRSLiquido?: ModoTaxa

  /** Seguro de acidentes de trabalho (%) sobre o salario base - obrigatorio em PT. */
  percentualSeguroAcidentes?: number
  valorSeguroAcidentes?: number
  /** Diluir subsidios de ferias e Natal no custo mensal (14 meses). */
  incluiSubsidios?: boolean
  valorSubsidiosMensal?: number
  /** Meses de subsidio de alimentacao por ano (por norma 11: nao ha refeicao em ferias). */
  mesesSubsidioAlimentacao?: number
  /** Media mensal do subsidio de alimentacao ja diluida no ano. */
  beneficiosMensalMedio?: number

  // Encargo liquido: o que o trabalhador recebe (descontos do lado do trabalhador)
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

/** Grupos da composicao de preco, no formato das folhas usadas em obra. */
export type ServicoGrupoComposicao =
  | "mao_obra"
  | "materiais"
  | "aluguel"
  | "vazadouro"
  | "transporte"
  | "extras"

export interface ServicoComposicaoItem {
  id: string
  grupo: ServicoGrupoComposicao
  materialId?: string
  /** Preenchido quando a linha de mao de obra vem de um funcionario. */
  funcionarioId?: string
  nome: string
  descricao?: string
  unidade: string
  /** Consumo tipico para a quantidade de referencia do servico. */
  quantidadePadrao: number
  /** Ajuste desta composicao. 0 desliga a linha sem a apagar. */
  quantidadePontual: number
  precoUnitario: number
  /** quantidadePadrao x quantidadePontual x precoUnitario */
  total: number

  /** @deprecated formato antigo, mantido para ler registos ja gravados */
  quantidade?: number
  /** @deprecated substituido pela quantidade de referencia do servico */
  valorFixo?: boolean
}

export interface Servico {
  id?: string
  nome: string
  descricao?: string
  /** Preco por unidade: total da composicao / quantidade de referencia. */
  preco: number
  /** Quantidade para a qual a composicao foi montada (ex.: 10 m2). */
  quantidadeReferencia?: number
  /** Linhas da composicao, agrupadas por mao de obra, materiais, aluguel, etc. */
  composicao?: ServicoComposicaoItem[]
  /** Soma da composicao para a quantidade de referencia (ex.: 119,33 EUR). */
  totalComposicao?: number
  unidade: string
  categoriaId?: string
  categoriaNome?: string
  maoDeObra?: number
  consumiveis?: number
  listaConsumiveis?: ServicoComposicaoItem[]
  itens?: number
  listaItens?: ServicoComposicaoItem[]
  /** @deprecated transporte passou a ser um grupo da composicao */
  transporte?: number
  /** @deprecated formato antigo (parte que multiplicava pela area) */
  precoVariavel?: number
  /** @deprecated formato antigo (parte de valor fixo) */
  precoFixo?: number
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
  /** Base tributavel: subtotal + margem + transporte, antes do IVA. */
  baseTributavel?: number
  /** Taxa de IVA aplicada (%). Orcamentos antigos sem este campo valem 0. */
  taxaIVA?: number
  /** Valor do IVA sobre a base tributavel. */
  valorIVA?: number
  /** Total final que o cliente paga (base tributavel + IVA). */
  valorTotal: number
  /** Total pelo custo real (custo dos itens + transporte). Nao leva IVA. */
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
