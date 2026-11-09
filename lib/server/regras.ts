/**
 * PERMISSOES DA BASE DE DADOS (verificadas no servidor)
 *
 * Copia fiel do antigo firestore.rules. A base e da empresa, nao de cada conta:
 * o que limita cada pessoa sao as permissoes gravadas em utilizadores/{uid},
 * atribuidas no ecra de Utilizadores e cargos.
 *
 * Esconder botoes na aplicacao nao impede ninguem de chamar a API
 * diretamente; por isso cada leitura e escrita passa por aqui.
 */

export type Operacao = "get" | "list" | "create" | "update" | "delete"
type Dados = Record<string, any>

export interface ContextoRegra {
  op: Operacao
  colecao: string
  id: string
  /** Documento antes da operacao (null se nao existe). */
  antes: Dados | null
  /** Documento como fica depois da escrita (null ao apagar ou ler). */
  depois: Dados | null
  /** Conta com sessao iniciada (null = sem sessao). */
  uid: string | null
  /** utilizadores/{uid} da conta, ou null. */
  perfil: Dados | null
}


const iguais = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function permite(c: ContextoRegra): boolean {
  const { op, colecao, id, antes, depois, uid, perfil } = c
  const autenticado = uid !== null
  const leitura = op === "get" || op === "list"
  const escrita = !leitura

  /** Conta ativa e com a permissao pedida. */
  const pode = (permissao: string) =>
    autenticado && !!perfil && perfil.ativo === true && Array.isArray(perfil.permissoes) && perfil.permissoes.includes(permissao)

  // Quem gere funcionarios gere o ponto (igual a IMPLICITAS em lib/permissoes.ts)
  const gerePonto = () => pode("ponto.gerir") || pode("funcionarios.gerir")
  const picador = () => pode("ponto.picar")
  /** Conta de trabalhador criada pelo gestor: so pode picar. */
  const contaDeTrabalhador = (d: Dados | null) => !!d && d.cargo === "trabalhador" && iguais(d.permissoes, ["ponto.picar"])

  /** Le se tem a permissao de ver; escreve se tem a de gerir. */
  const verGerir = (ver: boolean, gerir: boolean) => (leitura ? ver : gerir)

  switch (colecao) {
    case "utilizadores": {
      if (op === "get") return autenticado && (id === uid || pode("utilizadores.gerir"))
      if (op === "list") return autenticado
      if (op === "create") {
        // Perfis novos só pelo administrador (ou contas de picagem pelo gestor do
        // ponto). Já não há auto-registo como Consulta no primeiro acesso.
        return pode("utilizadores.gerir") || (gerePonto() && contaDeTrabalhador(depois))
      }
      if (op === "update") {
        return (
          pode("utilizadores.gerir") ||
          (gerePonto() && contaDeTrabalhador(antes) && contaDeTrabalhador(depois)) ||
          (autenticado && id === uid && depois?.cargo === antes?.cargo && iguais(depois?.permissoes, antes?.permissoes))
        )
      }
      return pode("utilizadores.gerir")
    }

    case "clientes":
      return verGerir(pode("clientes.ver"), pode("clientes.gerir"))
    case "funcionarios":
      return verGerir(pode("funcionarios.ver"), pode("funcionarios.gerir"))
    case "materiais":
    case "material-categories":
    case "categorias":
    case "cotacoes":
      return verGerir(pode("materiais.ver"), pode("materiais.gerir"))

    // Historico do estoque: nao se edita nem apaga - um erro corrige-se com
    // outro movimento, para o historico explicar sempre o saldo.
    case "movimentosEstoque":
      if (leitura) return pode("materiais.ver")
      return op === "create" && pode("materiais.gerir")

    // O orcamentista precisa do preco/hora; so quem gere pessoal altera
    case "funcoes":
      return verGerir(pode("orcamentos.ver") || pode("funcionarios.ver"), pode("funcionarios.gerir"))

    case "servicos":
      return verGerir(pode("servicos.ver"), pode("servicos.gerir"))

    case "orcamentos":
      if (leitura) return pode("orcamentos.ver")
      if (op === "create") return pode("orcamentos.criar")
      if (op === "delete") return pode("orcamentos.apagar")
      // A fase concreta e validada na aplicacao, que conhece a transicao
      return (
        pode("orcamentos.editar") ||
        pode("orcamentos.submeter") ||
        pode("orcamentos.aprovar") ||
        pode("orcamentos.cancelar") ||
        pode("orcamentos.custosObra")
      )

    // Contas a receber e a pagar: custo e margem sao informacao interna
    case "contas":
      return verGerir(pode("orcamentos.verCusto"), pode("orcamentos.custosObra") || pode("orcamentos.aprovar"))

    case "autosMedicao":
      if (leitura) return pode("orcamentos.ver")
      if (op === "update") return pode("orcamentos.custosObra") || pode("orcamentos.aprovar")
      return pode("orcamentos.custosObra")

    case "registosHoras": {
      if (leitura) return pode("orcamentos.verCusto") || pode("orcamentos.custosObra") || gerePonto()
      const normal =
        op === "update" ? pode("orcamentos.aprovar") : pode("orcamentos.custosObra") || pode("orcamentos.aprovar")
      // Horas vindas das picagens: o gestor do ponto envia-as pendentes
      const daPicagem =
        (op === "create" || op === "update") &&
        gerePonto() &&
        depois?.origem === "picagem" &&
        depois?.estado === "pendente" &&
        (antes === null || antes.estado === "pendente")
      return normal || daPicagem
    }

    case "faturasFornecedor":
      if (leitura) return pode("orcamentos.verCusto") || pode("orcamentos.custosObra")
      if (op === "update") return pode("orcamentos.aprovar") || pode("orcamentos.custosObra")
      return pode("orcamentos.custosObra")

    case "rdos":
      return verGerir(pode("orcamentos.ver"), pode("orcamentos.custosObra"))
    case "garantias":
      return verGerir(pode("orcamentos.ver"), pode("orcamentos.custosObra") || pode("orcamentos.editar"))

    // Portal do cliente: qualquer pessoa com o link le UM documento (o id e um
    // token aleatorio). Listar continua fechado.
    case "portal":
      if (op === "get") return true
      if (op === "list") return pode("orcamentos.ver")
      return pode("orcamentos.editar") || pode("orcamentos.aprovar")

    case "termos_servico":
    case "configuracoes":
      return verGerir(autenticado, pode("configuracoes.gerir"))

    // Numero do funcionario -> conta. Lido antes do login, um de cada vez.
    case "acessosPonto":
      if (op === "get") return true
      return gerePonto()

    case "pontoConfig":
      return verGerir(autenticado, gerePonto())

    // Obras onde se pode picar: so numero, nome e local, sem valores
    case "obrasPonto":
      return verGerir(picador() || gerePonto(), gerePonto())

    // Picagens: nunca se editam; só o administrador as elimina. O trabalhador so cria as suas (a
    // hora e posta pelo servidor); o gestor cria correcoes e anulacoes.
    case "picagens":
      if (leitura) return gerePonto() || (picador() && antes?.uid === uid)
      // Eliminar (ex.: registos de teste): só o administrador
      if (op === "delete") return pode("utilizadores.gerir")
      if (op !== "create") return false
      return (
        (picador() && depois?.uid === uid && depois?.funcionarioId === perfil?.funcionarioId && depois?.origem === "app") ||
        (gerePonto() &&
          ["correcao", "anulacao"].includes(depois?.origem) &&
          typeof depois?.motivo === "string" &&
          depois.motivo.length > 0)
      )

    // Ferias, faltas e correcoes. O trabalhador cria os seus (pendentes) e so
    // os cancela enquanto pendentes; decidir e do gestor.
    case "pedidosPonto": {
      if (leitura) return gerePonto() || (picador() && antes?.uid === uid)
      if (op === "create") {
        return picador() && depois?.uid === uid && depois?.funcionarioId === perfil?.funcionarioId && depois?.estado === "pendente"
      }
      if (op === "update") {
        if (gerePonto()) return true
        const mudados = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})])
        const alterados = [...mudados].filter((k) => !iguais(antes?.[k], depois?.[k]))
        return (
          picador() &&
          antes?.uid === uid &&
          antes?.estado === "pendente" &&
          depois?.estado === "cancelado" &&
          alterados.every((k) => k === "estado" || k === "updatedAt")
        )
      }
      // Eliminar pedidos (limpar o histórico): só o administrador
      return pode("utilizadores.gerir")
    }

    // Tudo o resto continua fechado
    default:
      void escrita
      return false
  }
}
