import {
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  Clock,
  FileText,
  Scale,
  Wallet,
  Calculator,
  CalendarClock,
  Fingerprint,
  HardHat,
  Home,
  Package,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  Wrench,
} from "lucide-react"

import type { Permissao } from "@/lib/permissoes"
import { m } from "@/lib/i18n"

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
  { name: m("Painel"), href: "/dashboard", icon: Home },
  { name: m("Orçamentos"), href: "/orcamentos", icon: Calculator, permissao: "orcamentos.ver" },
  { name: m("Obras"), href: "/obras", icon: Building2, permissao: "orcamentos.ver" },
  { name: m("Picagem"), href: "/picagem", icon: Fingerprint, permissao: "ponto.picar" },
  { name: m("Ponto da equipa"), href: "/ponto", icon: CalendarClock, permissao: "ponto.gerir" },
  { name: m("Livro de ponto"), href: "/horas", icon: Clock, permissao: "orcamentos.custosObra" },
  { name: m("Faturas"), href: "/faturas", icon: FileText, permissao: "orcamentos.custosObra" },
  { name: m("Financeiro"), href: "/financeiro", icon: Wallet, permissao: "orcamentos.verCusto" },
  { name: m("Garantias"), href: "/garantias", icon: BadgeCheck, permissao: "orcamentos.ver" },
  { name: m("Clientes"), href: "/clientes", icon: Users, permissao: "clientes.ver" },
  { name: m("Funcionários"), href: "/funcionarios", icon: Users, permissao: "funcionarios.ver" },
  { name: m("Funções"), href: "/funcoes", icon: HardHat, permissao: "funcionarios.ver" },
  { name: m("Produtos"), href: "/materiais", icon: Package, permissao: "materiais.ver" },
  { name: m("Stock"), href: "/estoque", icon: Boxes, permissao: "materiais.ver" },
  { name: m("Cotações"), href: "/cotacoes", icon: Scale, permissao: "materiais.ver" },
  { name: m("Categorias"), href: "/categorias", icon: Tags, permissao: "materiais.ver" },
  { name: m("Serviços"), href: "/servicos", icon: Wrench, permissao: "servicos.ver" },
  { name: m("Relatórios"), href: "/relatorios", icon: BarChart3, permissao: "relatorios.ver" },
  { name: m("Utilizadores"), href: "/utilizadores", icon: ShieldCheck, permissao: "utilizadores.gerir" },
  { name: m("Configurações"), href: "/configuracoes", icon: Settings, permissao: "configuracoes.ver" },
]

/** A entrada que corresponde a uma rota, incluindo as suas subpaginas. */
export function entradaDaRota(pathname: string): EntradaDeNavegacao | undefined {
  return NAVEGACAO.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
}
