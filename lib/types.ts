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
  quantidade: number
  unidade: string
  precoUnitario: number
  total: number
}

export interface Servico {
  id?: string
  nome: string
  descricao?: string
  preco: number
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
  descricao: string
  quantidade: number
  unidade: string
  precoUnitario: number
  total: number
  tipo: "servico" | "mao_obra" | "material"
  servicoId?: string
  funcionarioId?: string
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
  impostos: number
  margemLucro: number
  valorTotal: number
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
