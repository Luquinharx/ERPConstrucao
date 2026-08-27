import {
  BarChart3,
  Calculator,
  Home,
  Package,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  Wrench,
} from "lucide-react"

import type { Permissao } from "@/lib/permissoes"

export interface EntradaDeNavegacao {
  name: string
  href: string
  icon: typeof Home
  /** Sem esta permissao a entrada nao aparece no menu nem a rota abre. */
  permissao?: Permissao
}

/**
 * Fonte unica do menu e do controlo de acesso por rota.
 *
 * A barra lateral esconde o que a pessoa nao pode ver, mas esconder um botao
 * nao impede ninguem de escrever o endereco. O layout usa esta mesma lista
 * para decidir se a pagina abre.
 */
export const NAVEGACAO: EntradaDeNavegacao[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Orçamentos", href: "/orcamentos", icon: Calculator, permissao: "orcamentos.ver" },
  { name: "Clientes", href: "/clientes", icon: Users, permissao: "clientes.ver" },
  { name: "Funcionários", href: "/funcionarios", icon: Users, permissao: "funcionarios.ver" },
  { name: "Materiais", href: "/materiais", icon: Package, permissao: "materiais.ver" },
  { name: "Categorias", href: "/categorias", icon: Tags, permissao: "materiais.ver" },
  { name: "Serviços", href: "/servicos", icon: Wrench, permissao: "servicos.ver" },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3, permissao: "relatorios.ver" },
  { name: "Utilizadores", href: "/utilizadores", icon: ShieldCheck, permissao: "utilizadores.gerir" },
  { name: "Configurações", href: "/configuracoes", icon: Settings, permissao: "configuracoes.ver" },
]

/** A entrada que corresponde a uma rota, incluindo as suas subpaginas. */
export function entradaDaRota(pathname: string): EntradaDeNavegacao | undefined {
  return NAVEGACAO.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
}
