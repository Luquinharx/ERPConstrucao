"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Calculator,
  Users,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  Wrench,
  Tags,
  BarChart3,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { getCargo, type Permissao } from "@/lib/permissoes"
import { MarcaDaEmpresa } from "@/components/marca-da-empresa"
import { ThemeToggle } from "@/components/theme-toggle"

/** Cada entrada exige uma permissao; sem ela, nao aparece no menu. */
const navigation: Array<{ name: string; href: string; icon: typeof Home; permissao?: Permissao }> = [
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

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode, perfil } = usePermissoes()

  const entradasVisiveis = navigation.filter((item) => !item.permissao || pode(item.permissao))

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background/80 backdrop-blur-sm"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center h-20 px-4 border-b border-border">
            {configuracao.logoUrl ? (
              <MarcaDaEmpresa tamanho="md" />
            ) : (
              <h1 className="text-xl font-bold text-primary">{configuracao.nome || "ERP"}</h1>
            )}
          </div>

          {/* User info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">{perfil ? getCargo(perfil.cargo).nome : configuracao.nome}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {entradasVisiveis.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Theme Toggle */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tema</span>
              <ThemeToggle />
            </div>
          </div>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={logout}
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
