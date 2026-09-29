
/** Utilizador do sistema, com o cargo e as permissoes ja resolvidas. */
export interface UtilizadorSistema {
  /** Igual ao uid da autenticacao. */
  id?: string
  email: string
  nome?: string
  cargo: string
  /**
   * Permissoes efetivas, gravadas para as regras do Firestore as poderem
   * verificar sem saber o que cada cargo significa.
   */
  permissoes: string[]
  ativo: boolean
  /** Ultimo acesso registado pela aplicacao. */
  ultimoAcesso?: Date
  createdAt?: Date
  updatedAt?: Date
}


/** Identidade visual e dados da empresa, editaveis em Configuracoes. */
export interface ConfiguracaoEmpresa {
  id?: string
  nome: string
  slogan?: string
  /** URL publica ou data URL do logotipo. */
  logoUrl?: string
  /**
   * Fundo por tras do logotipo, para ele ser legivel em qualquer tema:
   * auto = placa clara so no modo escuro; claro/escuro = placa sempre;
   * nenhum = sem placa (logotipo ja preparado para os dois fundos).
   */
  logoFundo?: "auto" | "claro" | "escuro" | "nenhum"

  corPrimaria: string
  corSecundaria: string
  corEscura: string
  fonte: string

  /** Denominacao social completa, ex.: TECKNOWHOW, Lda. */
  razaoSocial?: string
  /** Capital social, impresso no rodape das condicoes gerais. */
  capitalSocial?: string
  nif?: string
  morada?: string
  codigoPostal?: string
  cidade?: string
  telefone?: string
  email?: string
  website?: string

  /** Prefixo da numeracao dos concursos (ex.: CO -> CO26/0033). */
  prefixoOrcamento?: string
  /** Prefixo da numeracao das obras adjudicadas (ex.: O -> O26/0033). */
  prefixoObra?: string
  /** Sufixo da numeracao, ex.: "/2026" ou "-PT". */
  sufixoOrcamento?: string
  validadeDiasPadrao?: number
  margemPadrao?: number
  taxaIVAPadrao?: number
  /** Grupos de impostos que os produtos escolhem. */
  gruposImpostos?: GrupoImpostos[]
  /** Propostas novas nascem com a margem por item ligada? (padrao: sim) */
  margemItemPadraoAtiva?: boolean
  /** Propostas novas nascem com a margem global ligada? (padrao: sim) */
  margemGlobalPadraoAtiva?: boolean

  /** Notas impressas no rodape da proposta. */
  notasOrcamento?: string[]

  updatedAt?: Date
  userId?: string
}

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
  /** Subsidio de alimentacao por dia e numero de dias considerados. */
  subsidioDiario?: number
  diasSubsidio?: number
  /** Tabela de retencao de IRS, dependentes e se o valor e automatico. */
  tabelaIRS?: string
  dependentes?: number
  irsAutomatico?: boolean
  /** Base de horas do custo/hora: media anual, maior mes, menor mes ou mes escolhido. */
  baseHoras?: "media" | "maior" | "menor" | "mes"
  /** Dias uteis usados como base do custo/hora (maior mes do ano). */
  diasUteisBase?: number
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

/** Onde o imposto incide: na compra (entra no custo) ou na venda (sai do preco). */
export type IncidenciaImposto = "compra" | "venda"

/** Um imposto dentro de um grupo, sempre em percentagem. */
export interface RegraImposto {
  id: string
  /** Ex.: IVA, Contribuicao, Ecovalor. */
  nome: string
  percentual: number
  incidencia: IncidenciaImposto
  /**
   * So na compra: imposto recuperado depois (ex.: IVA dedutivel). Gera credito
   * e nao entra no custo real.
   */
  recuperavel?: boolean
}

/**
 * Grupo de impostos, como o "Grupo de ICMS" do Sankhya: define-se uma vez
 * (ex.: "Material de construcao - IVA 23%") e cada produto so escolhe o grupo.
 * Mudar a taxa no grupo muda-a em todos os produtos de uma vez.
 */
export interface GrupoImpostos {
  id: string
  nome: string
  regras: RegraImposto[]
}

/** @deprecated imposto escrito produto a produto; substituido pelos grupos */
export interface ImpostoProduto {
  id: string
  /** Ex.: IVA nao dedutivel, ISP, Ecovalor. */
  nome: string
  /** Percentagem sobre o preco de compra, ou valor fixo em euros por unidade. */
  modo: ModoTaxa
  valor: number
}

/**
 * Produto (antigo "Material"). A colecao continua a ser `materiais` para os
 * servicos e orcamentos ja gravados continuarem a apontar para o mesmo sitio.
 *
 * `precoUnitario` e o CUSTO REAL por unidade (compra + impostos + outros
 * custos): e o valor que as composicoes de servico sempre leram, por isso
 * mantem o nome. O preco ao cliente e `precoVenda`.
 */
export interface Material {
  id?: string
  /** Codigo interno ou referencia do fornecedor. */
  codigo?: string
  nome: string
  unidade: string
  /** Custo real por unidade, derivado da compra, impostos e outros custos. */
  precoUnitario: number
  categoriaId?: string
  fornecedor?: string
  observacoes?: string

  /** Preco de compra ao fornecedor, por unidade, antes dos impostos abaixo. */
  precoCompra?: number
  /** Grupo de impostos do produto (Configuracoes > Impostos). Vazio = sem impostos. */
  grupoImpostosId?: string
  /** @deprecated formato antigo, lido apenas em produtos sem grupo */
  temImpostos?: boolean
  /** @deprecated formato antigo, lido apenas em produtos sem grupo */
  impostos?: ImpostoProduto[]
  /** Frete, embalagem, etc., em euros por unidade. */
  outrosCustos?: number

  /** Margem sobre o custo real (%). preco de venda = custo x (1 + margem). */
  margemVenda?: number
  /** Preco de venda ao cliente por unidade, sem IVA de venda. */
  precoVenda?: number

  /** Com o controlo ligado, o produto entra nas entradas e saidas de estoque. */
  controlaEstoque?: boolean
  /** Saldo atual. So muda por movimentos de estoque, nunca a mao no cadastro. */
  estoqueAtual?: number
  /** Abaixo disto o produto aparece como "estoque baixo". */
  estoqueMinimo?: number
  /** Custo medio ponderado das entradas, por unidade. */
  custoMedio?: number

  createdAt: Date
  updatedAt: Date
  userId: string
}

export type TipoMovimentoEstoque = "entrada" | "saida" | "ajuste"

/**
 * Movimento de estoque. E o historico que explica o saldo do produto: o saldo
 * nunca se escreve a mao, so se mexe por aqui.
 */
export interface MovimentoEstoque {
  id?: string
  materialId: string
  /** Copiado no momento, para o historico ler-se mesmo que o produto mude de nome. */
  materialNome: string
  unidade: string
  tipo: TipoMovimentoEstoque
  /**
   * Entrada/saida: quantidade movimentada (sempre positiva).
   * Ajuste: a contagem fisica, ou seja o novo saldo.
   */
  quantidade: number
  /** Entrada: custo real por unidade desta compra. Saida: custo medio no momento. */
  custoUnitario?: number
  /** Saldo do produto depois deste movimento. */
  saldoApos: number
  /** Data do documento (ISO yyyy-mm-dd). */
  data: string
  documento?: string
  fornecedor?: string
  /** Obra para onde o material saiu. */
  orcamentoId?: string
  orcamentoNumero?: string
  observacoes?: string
  userId: string
  createdAt: Date
}

/**
 * Funcao de mao de obra (Pintor, Pedreiro...). Tem o preco/hora cobrado ao
 * cliente; o custo/hora vem dos funcionarios dessa funcao (media).
 */
export interface FuncaoMaoObra {
  id?: string
  nome: string
  /** Preco por hora cobrado ao cliente, sem IVA. */
  precoHora: number
  /** Texto do PDF de venda. Vazio = "Mao de obra - {nome}". */
  descricaoCliente?: string
  observacoes?: string
  ativo: boolean
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

/** Fases de orcamentacao (pre-venda). */
export type StatusOrcamento = "rascunho" | "em_revisao" | "emitido" | "em_negociacao" | "aceite" | "cancelado"

/**
 * Tipo do documento. O concurso e a proposta em disputa; a obra e o trabalho
 * ja adjudicado, que a contabilidade pode faturar. Cada tipo tem prefixo e
 * contagem propria (CO26/0001 e O26/0001).
 */
export type TipoDocumentoProposta = "concurso" | "obra"

/** Registo de cada mudanca de fase, para se saber o percurso da proposta. */
export interface RegistoDeFase {
  estado: StatusOrcamento
  data: Date
  utilizador: string
  nota?: string
}

export interface ItemOrcamento {
  id: string
  /** Comodo/ambiente a que o item pertence (ex.: Sala, Cozinha, Quarto 01). */
  ambiente?: string
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
  /**
   * Preco de venda do cadastro (com a margem do item), guardado a parte para
   * se poder desligar a margem por item e voltar a liga-la sem perder o valor.
   */
  precoTabela?: number
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
  /** Funcao de mao de obra que da o preco ao cliente. */
  funcaoId?: string
  materialId?: string
}

/** Grupos da folha de custos reais da obra (ver lib/custos-obra.ts). */
export type GrupoCustoObra = "materiais" | "mao_obra" | "global"

/**
 * Uma linha de custo real lancado na obra.
 *
 * O valor escrito e o da fatura, ou seja COM IVA - e assim que o papel chega a
 * secretaria. O valor sem IVA (o custo verdadeiro da empresa) e o IVA suportado
 * sao sempre derivados dai, nunca gravados, para nao haver duas versoes da
 * mesma conta. Nao e preciso discriminar fatura a fatura linha a linha: uma
 * linha "Compras 03/08 Leroy" com o total da fatura chega.
 */
export interface LinhaCustoObra {
  id: string
  grupo: GrupoCustoObra
  /** O que se comprou ou quem trabalhou. Ex.: "Tinta plastica 15L", "Wilson". */
  descricao: string
  /** Onde se comprou ou quem prestou o servico. Ex.: "Leroy Merlin". */
  fornecedor?: string
  /** un, h, vg (verba global), m2... */
  unidade: string
  quantidade: number
  /** Valor unitario tal como vem na fatura, com IVA incluido. */
  valorUnitario: number
  /** Taxa de IVA da fatura: 23, 6 ou 0 (ex.: subempreitada com autoliquidacao). */
  taxaIVA: number
  /** Data do documento, apenas informativa (ISO yyyy-mm-dd). */
  data?: string
  /** Numero da fatura/recibo, para se encontrar o papel depois. */
  documento?: string
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
  /** Comodos do orcamento, pela ordem em que devem sair no documento. */
  ambientes?: string[]
  funcionariosSelecionados: string[]
  servicosSelecionados: string[]
  subtotal: number
  /** Subtotal pelo custo real (sem margem) - base do orcamento de custo. */
  subtotalCusto?: number
  /** Custo de transporte, somado como linha propria no final do orcamento. */
  transporte?: number
  impostos: number
  margemLucro: number
  /**
   * Margem por item: os itens usam o preco de venda do cadastro. Desligada,
   * cada item vai ao preco de custo. Ausente (propostas antigas) = ligada.
   */
  usarMargemItem?: boolean
  /** Margem global sobre o subtotal. Ausente (propostas antigas) = ligada. */
  usarMargemGlobal?: boolean
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
  status: StatusOrcamento
  /** Concurso ou obra. Propostas antigas sem o campo contam como concurso. */
  tipoDocumento?: TipoDocumentoProposta
  /** Numero da revisao: 0 = versao base (1.0), 1 = Rev. A, 2 = Rev. B... */
  revisao?: number
  /** Proposta de onde esta revisao saiu. */
  orcamentoOrigemId?: string
  /** Numero base, partilhado por todas as revisoes da mesma proposta. */
  numeroBase?: string
  /** Data em que foi emitida (congela a versao). */
  dataEmissao?: Date
  /** Motivo do cancelamento, para analise posterior. */
  motivoPerda?: string
  /** Percurso da proposta pelas fases. */
  historicoFases?: RegistoDeFase[]
  /**
   * Custos reais lancados na obra, que fecham o ciclo contra o custo orcado:
   * e o que permite comparar a margem prevista com a margem que de facto houve.
   */
  custosObra?: LinhaCustoObra[]
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
