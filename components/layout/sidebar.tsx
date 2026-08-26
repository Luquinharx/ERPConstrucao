"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  BarChart3,
  Calculator,
  ChevronLeft,
  Home,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package,
  PanelLeft,
  Settings,
  ShieldCheck,
  Sun,
  Tags,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { MarcaDaEmpresa } from "@/components/marca-da-empresa"
import { getCargo, type Permissao } from "@/lib/permissoes"

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

const CHAVE_ESTADO = "barra-lateral-expandida"

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode, perfil } = usePermissoes()
  const { setTheme } = useTheme()

  /** Aberta por cima do conteudo, no telemovel. */
  const [abertaNoMovel, setAbertaNoMovel] = useState(false)
  /** Expandida (com rotulos) ou reduzida a barra de icones. */
  const [expandida, setExpandida] = useState(true)
  /** O menu da conta esta aberto: clicar nele nao pode recolher a barra. */
  const [menuAberto, setMenuAberto] = useState(false)
  const referencia = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const guardado = window.localStorage.getItem(CHAVE_ESTADO)
    if (guardado !== null) setExpandida(guardado === "true")
  }, [])

  /** O conteudo principal acompanha a largura da barra por esta variavel. */
  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.style.setProperty("--largura-barra", expandida ? "16rem" : "72px")
  }, [expandida])

  const alternarExpandida = (valor: boolean) => {
    setExpandida(valor)
    try {
      window.localStorage.setItem(CHAVE_ESTADO, String(valor))
    } catch {
      // Navegacao privada: fica so nesta sessao
    }
  }

  /**
   * Clicar fora recolhe a barra.
   *
   * No telemovel fecha-a; no computador reduz a barra de icones, que continua
   * navegavel. O conteudo ganha espaco sem a navegacao desaparecer.
   */
  useEffect(() => {
    const aoClicarFora = (evento: MouseEvent) => {
      if (menuAberto) return
      if (!referencia.current || referencia.current.contains(evento.target as Node)) return

      setAbertaNoMovel(false)
      if (window.innerWidth >= 1024 && expandida) alternarExpandida(false)
    }

    document.addEventListener("mousedown", aoClicarFora)
    return () => document.removeEventListener("mousedown", aoClicarFora)
  }, [expandida, menuAberto])

  // Navegar fecha a barra no telemovel
  useEffect(() => setAbertaNoMovel(false), [pathname])

  const entradasVisiveis = navigation.filter((item) => !item.permissao || pode(item.permissao))
  const inicial = (perfil?.nome || user?.email || "?").charAt(0).toUpperCase()
  const nomeVisivel = perfil?.nome?.trim() || user?.email?.split("@")[0] || "Utilizador"

  return (
    <TooltipProvider delayDuration={200}>
      {/* Botao do telemovel */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAbertaNoMovel(!abertaNoMovel)}
          className="bg-background/80 shadow-sm backdrop-blur-sm"
          aria-label={abertaNoMovel ? "Fechar menu" : "Abrir menu"}
        >
          {abertaNoMovel ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <div
        ref={referencia}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-all duration-200 ease-in-out",
          expandida ? "w-64" : "w-[72px]",
          abertaNoMovel ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Marca */}
        <div className="flex h-16 items-center justify-center border-b border-border px-3">
          {expandida ? (
            <MarcaDaEmpresa tamanho="sm" />
          ) : (
            <button
              type="button"
              onClick={() => alternarExpandida(true)}
              className="rounded-md p-1 text-primary hover:bg-accent"
              aria-label="Expandir menu"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navegacao */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {entradasVisiveis.map((item) => {
            const ativo = pathname === item.href
            const ligacao = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  expandida ? "gap-3 px-3 py-2" : "justify-center px-2 py-2.5",
                  ativo
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {expandida && <span className="truncate">{item.name}</span>}
              </Link>
            )

            if (expandida) return <div key={item.name}>{ligacao}</div>

            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>{ligacao}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Conta */}
        <div className="border-t border-border p-3">
          <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center rounded-lg transition-colors hover:bg-accent",
                  expandida ? "gap-3 p-2" : "justify-center p-1.5",
                )}
                aria-label="Conta e definicoes"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {inicial}
                </span>
                {expandida && (
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{nomeVisivel}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {perfil ? getCargo(perfil.cargo).nome : configuracao.nome}
                    </span>
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" side="top" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium">{nomeVisivel}</span>
                <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
                {perfil && <span className="mt-1 block text-xs text-primary">{getCargo(perfil.cargo).nome}</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/configuracoes?aba=conta">
                  <User className="mr-2 h-4 w-4" />
                  Os meus dados
                </Link>
              </DropdownMenuItem>
              {pode("configuracoes.ver") && (
                <DropdownMenuItem asChild>
                  <Link href="/configuracoes">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Tema</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Claro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Escuro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                Sistema
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Recolher / expandir, so no computador */}
          <button
            type="button"
            onClick={() => alternarExpandida(!expandida)}
            className={cn(
              "mt-2 hidden w-full items-center rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex",
              expandida ? "gap-2 px-3" : "justify-center px-2",
            )}
            aria-label={expandida ? "Recolher menu" : "Expandir menu"}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", !expandida && "rotate-180")} />
            {expandida && <span>Recolher</span>}
          </button>
        </div>
      </div>

      {/* Fundo escurecido no telemovel */}
      {abertaNoMovel && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
    </TooltipProvider>
  )
}
