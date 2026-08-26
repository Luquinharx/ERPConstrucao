/**
 * Permissoes e cargos.
 *
 * Cada permissao e uma acao concreta. Os cargos sao apenas conjuntos de
 * permissoes: ao atribuir um cargo, as permissoes resolvidas ficam gravadas no
 * documento do utilizador, para as regras do Firestore as poderem verificar sem
 * ter de saber o que cada cargo significa.
 */

export type Permissao =
  // Clientes
  | "clientes.ver"
  | "clientes.gerir"
  // Funcionarios (dados sensiveis: salarios e encargos)
  | "funcionarios.ver"
  | "funcionarios.gerir"
  // Materiais e servicos (precos de custo)
  | "materiais.ver"
  | "materiais.gerir"
  | "servicos.ver"
  | "servicos.gerir"
  // Orcamentos
  | "orcamentos.ver"
  | "orcamentos.criar"
  | "orcamentos.editar"
  | "orcamentos.apagar"
  | "orcamentos.submeter"
  | "orcamentos.aprovar"
  | "orcamentos.cancelar"
  | "orcamentos.verCusto"
  // Sistema
  | "relatorios.ver"
  | "configuracoes.ver"
  | "configuracoes.gerir"
  | "utilizadores.gerir"

interface GrupoPermissoes {
  grupo: string
  itens: Array<{ id: Permissao; nome: string; ajuda?: string }>
}

/** Catalogo usado no ecra de gestao, agrupado por assunto. */
export const CATALOGO_PERMISSOES: GrupoPermissoes[] = [
  {
    grupo: "Orcamentos",
    itens: [
      { id: "orcamentos.ver", nome: "Ver orcamentos" },
      { id: "orcamentos.criar", nome: "Criar orcamentos" },
      { id: "orcamentos.editar", nome: "Editar orcamentos em rascunho" },
      { id: "orcamentos.apagar", nome: "Apagar orcamentos" },
      { id: "orcamentos.submeter", nome: "Enviar para revisao" },
      {
        id: "orcamentos.aprovar",
        nome: "Aprovar e emitir",
        ajuda: "Valida margens e entrega a proposta ao cliente",
      },
      { id: "orcamentos.cancelar", nome: "Cancelar propostas" },
      {
        id: "orcamentos.verCusto",
        nome: "Ver custos e margem",
        ajuda: "Documento de custo interno e o lucro previsto",
      },
    ],
  },
  {
    grupo: "Cadastros",
    itens: [
      { id: "clientes.ver", nome: "Ver clientes" },
      { id: "clientes.gerir", nome: "Criar e editar clientes" },
      { id: "materiais.ver", nome: "Ver materiais" },
      { id: "materiais.gerir", nome: "Criar e editar materiais e precos" },
      { id: "servicos.ver", nome: "Ver servicos" },
      { id: "servicos.gerir", nome: "Criar e editar servicos e composicoes" },
    ],
  },
  {
    grupo: "Pessoal",
    itens: [
      { id: "funcionarios.ver", nome: "Ver funcionarios" },
      {
        id: "funcionarios.gerir",
        nome: "Criar e editar funcionarios",
        ajuda: "Inclui salarios, encargos e custo/hora",
      },
    ],
  },
  {
    grupo: "Sistema",
    itens: [
      { id: "relatorios.ver", nome: "Ver relatorios" },
      { id: "configuracoes.ver", nome: "Ver configuracoes" },
      { id: "configuracoes.gerir", nome: "Alterar identidade, termos e padroes" },
      { id: "utilizadores.gerir", nome: "Gerir utilizadores e cargos" },
    ],
  },
]

export const TODAS_PERMISSOES: Permissao[] = CATALOGO_PERMISSOES.flatMap((g) => g.itens.map((i) => i.id))

export type Cargo = "administrador" | "direcao" | "orcamentista" | "tecnico" | "consulta" | "personalizado"

export interface DefinicaoCargo {
  id: Cargo
  nome: string
  descricao: string
  permissoes: Permissao[]
}

const SO_VER: Permissao[] = [
  "clientes.ver",
  "materiais.ver",
  "servicos.ver",
  "orcamentos.ver",
  "relatorios.ver",
]

export const CARGOS: DefinicaoCargo[] = [
  {
    id: "administrador",
    nome: "Administrador",
    descricao: "Acesso total, incluindo utilizadores e configuracoes.",
    permissoes: TODAS_PERMISSOES,
  },
  {
    id: "direcao",
    nome: "Direcao tecnica / comercial",
    descricao: "Aprova propostas, ve custos e margens. Nao gere utilizadores.",
    permissoes: [
      ...SO_VER,
      "clientes.gerir",
      "materiais.gerir",
      "servicos.gerir",
      "funcionarios.ver",
      "funcionarios.gerir",
      "orcamentos.criar",
      "orcamentos.editar",
      "orcamentos.submeter",
      "orcamentos.aprovar",
      "orcamentos.cancelar",
      "orcamentos.verCusto",
      "configuracoes.ver",
      "configuracoes.gerir",
    ],
  },
  {
    id: "orcamentista",
    nome: "Orcamentista",
    descricao: "Monta propostas e envia para revisao. Nao aprova nem emite.",
    permissoes: [
      ...SO_VER,
      "clientes.gerir",
      "materiais.gerir",
      "servicos.gerir",
      "funcionarios.ver",
      "orcamentos.criar",
      "orcamentos.editar",
      "orcamentos.submeter",
      "orcamentos.verCusto",
      "configuracoes.ver",
    ],
  },
  {
    id: "tecnico",
    nome: "Tecnico de obra",
    descricao: "Consulta propostas e mantem materiais. Sem acesso a custos nem a salarios.",
    permissoes: [...SO_VER, "materiais.gerir"],
  },
  {
    id: "consulta",
    nome: "Consulta",
    descricao: "So visualiza. E o cargo dado a quem se regista, ate ser alterado.",
    permissoes: SO_VER,
  },
  {
    id: "personalizado",
    nome: "Personalizado",
    descricao: "Permissoes escolhidas uma a uma.",
    permissoes: [],
  },
]

export function getCargo(id?: string): DefinicaoCargo {
  return CARGOS.find((cargo) => cargo.id === id) || CARGOS[CARGOS.length - 2]
}

/** Permissoes de um cargo; em "personalizado" valem as que estiverem gravadas. */
export function permissoesDoCargo(cargo?: string, personalizadas: Permissao[] = []): Permissao[] {
  if (cargo === "personalizado") return personalizadas
  return getCargo(cargo).permissoes
}

export function getNomePermissao(id: Permissao): string {
  for (const grupo of CATALOGO_PERMISSOES) {
    const item = grupo.itens.find((i) => i.id === id)
    if (item) return item.nome
  }
  return id
}
