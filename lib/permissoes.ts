/**
 * Permissoes e cargos.
 *
 * Cada permissao e uma acao concreta. Os cargos sao apenas conjuntos de
 * permissoes: ao atribuir um cargo, as permissoes resolvidas ficam gravadas no
 * documento do utilizador, para as regras do Firestore as poderem verificar sem
 * ter de saber o que cada cargo significa.
 */

import { m } from "@/lib/i18n"

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
  | "orcamentos.custosObra"
  // Sistema
  | "relatorios.ver"
  | "configuracoes.ver"
  | "configuracoes.gerir"
  | "utilizadores.gerir"
  // Picagem de ponto
  | "ponto.picar"
  | "ponto.gerir"

interface GrupoPermissoes {
  grupo: string
  itens: Array<{ id: Permissao; nome: string; ajuda?: string }>
}

/** Catalogo usado no ecra de gestao, agrupado por assunto. */
export const CATALOGO_PERMISSOES: GrupoPermissoes[] = [
  {
    grupo: m("Orçamentos"),
    itens: [
      { id: "orcamentos.ver", nome: m("Ver orçamentos") },
      { id: "orcamentos.criar", nome: m("Criar orçamentos") },
      { id: "orcamentos.editar", nome: m("Editar orçamentos em rascunho") },
      { id: "orcamentos.apagar", nome: m("Eliminar orçamentos") },
      { id: "orcamentos.submeter", nome: m("Enviar para revisão") },
      {
        id: "orcamentos.aprovar",
        nome: m("Aprovar e emitir"),
        ajuda: m("Valida margens e entrega a proposta ao cliente"),
      },
      { id: "orcamentos.cancelar", nome: m("Cancelar propostas") },
      {
        id: "orcamentos.verCusto",
        nome: m("Ver custos e margem"),
        ajuda: m("Documento de custo interno e o lucro previsto"),
      },
      {
        id: "orcamentos.custosObra",
        nome: m("Lançar custos reais da obra"),
        ajuda: m("Faturas e horas gastas na obra, e a comparação com a margem prevista"),
      },
    ],
  },
  {
    grupo: m("Registos"),
    itens: [
      { id: "clientes.ver", nome: m("Ver clientes") },
      { id: "clientes.gerir", nome: m("Criar e editar clientes") },
      { id: "materiais.ver", nome: m("Ver materiais") },
      { id: "materiais.gerir", nome: m("Criar e editar materiais e preços") },
      { id: "servicos.ver", nome: m("Ver serviços") },
      { id: "servicos.gerir", nome: m("Criar e editar serviços e composições") },
    ],
  },
  {
    grupo: m("Pessoal"),
    itens: [
      { id: "funcionarios.ver", nome: m("Ver funcionários") },
      {
        id: "funcionarios.gerir",
        nome: m("Criar e editar funcionários"),
        ajuda: m("Inclui salários, encargos e custo/hora"),
      },
    ],
  },
  {
    grupo: m("Picagem de ponto"),
    itens: [
      { id: "ponto.picar", nome: m("Picar ponto"), ajuda: m("Só para as contas de trabalhador (n.º + PIN)") },
      {
        id: "ponto.gerir",
        nome: m("Gerir o ponto da equipa"),
        ajuda: m("Ver picagens, aprovar férias, faltas e correções, criar acessos. Quem gere funcionários já o tem."),
      },
    ],
  },
  {
    grupo: m("Sistema"),
    itens: [
      { id: "relatorios.ver", nome: m("Ver relatórios") },
      { id: "configuracoes.ver", nome: m("Ver configurações") },
      { id: "configuracoes.gerir", nome: m("Alterar identidade, termos e predefinições") },
      { id: "utilizadores.gerir", nome: m("Gerir utilizadores e cargos") },
    ],
  },
]

export const TODAS_PERMISSOES: Permissao[] = CATALOGO_PERMISSOES.flatMap((g) => g.itens.map((i) => i.id))

export type Cargo = "administrador" | "direcao" | "orcamentista" | "tecnico" | "consulta" | "trabalhador" | "personalizado"

/** Cargo das contas de picagem (n.o do funcionario + PIN): so ve o seu ponto. */
export const CARGO_TRABALHADOR = "trabalhador"
export const PERMISSOES_TRABALHADOR: Permissao[] = ["ponto.picar"]

/**
 * Permissoes que vem com outra. Quem gere funcionarios gere o ponto, sem ter
 * de regravar as permissoes de quem ja existe. As regras do Firestore fazem o
 * mesmo (gerePonto).
 */
export const IMPLICITAS: Partial<Record<Permissao, Permissao[]>> = {
  "ponto.gerir": ["funcionarios.gerir"],
}

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
    nome: m("Administrador"),
    descricao: m("Acesso total, incluindo utilizadores e configurações."),
    permissoes: TODAS_PERMISSOES,
  },
  {
    id: "direcao",
    nome: m("Direção técnica / comercial"),
    descricao: m("Aprova propostas, vê custos e margens. Não gere utilizadores."),
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
      "orcamentos.custosObra",
      "configuracoes.ver",
      "configuracoes.gerir",
    ],
  },
  {
    id: "orcamentista",
    nome: m("Orçamentista"),
    descricao: m("Monta propostas e envia para revisão. Não aprova nem emite."),
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
      "orcamentos.custosObra",
      "configuracoes.ver",
    ],
  },
  {
    id: "tecnico",
    nome: m("Técnico de obra"),
    descricao: m("Consulta propostas e mantém materiais. Sem acesso a custos nem a salários."),
    permissoes: [...SO_VER, "materiais.gerir"],
  },
  {
    id: "consulta",
    nome: m("Consulta"),
    descricao: m("Só visualiza. É o cargo dado a quem se regista, até ser alterado."),
    permissoes: SO_VER,
  },
  {
    id: "trabalhador",
    nome: m("Trabalhador (picagem)"),
    descricao: m("Só pica o ponto e pede férias e faltas. Entra com o n.º de funcionário e PIN."),
    permissoes: PERMISSOES_TRABALHADOR,
  },
  {
    id: "personalizado",
    nome: m("Personalizado"),
    descricao: m("Permissões escolhidas uma a uma."),
    permissoes: [],
  },
]

export function getCargo(id?: string): DefinicaoCargo {
  return CARGOS.find((cargo) => cargo.id === id) || CARGOS.find((cargo) => cargo.id === "consulta")!
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
