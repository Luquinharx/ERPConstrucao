"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { ChevronLeft, LogOut, Menu, Monitor, Moon, PanelLeft, Pin, Settings, Sun, User, X } from "lucide-react"

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
import { getCargo } from "@/lib/permissoes"
import { NAVEGACAO } from "@/lib/navegacao"

const CHAVE_ESTADO = "barra-lateral-aberta"

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode, perfil } = usePermissoes()
  const { setTheme } = useTheme()

  /** Aberta por cima do conteudo, no telemovel. */
  const [abertaNoMovel, setAbertaNoMovel] = useState(false)
  /** Escolha do utilizador: barra fixa aberta ou reduzida a icones. */
  const [fixada, setFixada] = useState(true)
  /** Aberta so enquanto o rato esta em cima, quando esta reduzida. */
  const [emHover, setEmHover] = useState(false)
  /** O menu da conta esta aberto: clicar nele nao pode recolher a barra. */
  const [menuAberto, setMenuAberto] = useState(false)
  const referencia = useRef<HTMLDivElement>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout>>()
  /** O rato esta mesmo em cima da barra, nao apenas num menu que ela abriu. */
  const ratoDentro = useRef(false)

  /** O que se ve: fixa aberta, ou reduzida com o rato em cima. */
  const aberta = fixada || emHover

  useEffect(() => {
    if (typeof window === "undefined") return
    const guardado = window.localStorage.getItem(CHAVE_ESTADO)
    if (guardado !== null) setFixada(guardado === "true")
  }, [])

  /**
    * Largura que o conteudo principal reserva.
    *
    * Segue so a escolha fixa: se seguisse o hover, a pagina inteira reajustava
    * cada vez que o rato passasse pela barra. Ao abrir por hover a barra
    * sobrepoe-se ao conteudo, que fica quieto.
    */
  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.style.setProperty("--largura-barra", fixada ? "16rem" : "72px")
  }, [fixada])

  /**
   * Abre com o rato em cima e fecha ao sair, so quando esta reduzida.
   *
   * Ha um atraso curto nos dois sentidos: sem ele, passar o rato de raspao
   * pela margem esquerda abria e fechava a barra sem intencao nenhuma.
   */
  const aoEntrarComORato = () => {
    ratoDentro.current = true
    if (fixada || window.innerWidth < 1024) return
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setEmHover(true), 120)
  }

  const aoSairComORato = () => {
    ratoDentro.current = false
    clearTimeout(temporizador.current)
    // Com o menu da conta aberto nao se fecha: o rato esta no menu, fora da barra
    if (menuAberto) return
    temporizador.current = setTimeout(() => setEmHover(false), 200)
  }

  /**
   * O menu da conta fechou: retoma o fecho da barra.
   *
   * O menu abre num portal fora da barra, entao o rato "sai" e o fecho fica
   * suspenso. Sem isto, a barra ficava aberta depois de fechar o menu.
   */
  useEffect(() => {
    // So fecha se o rato estiver mesmo fora: com ele em cima da barra, fica aberta
    if (menuAberto || fixada || !emHover || ratoDentro.current) return
    temporizador.current = setTimeout(() => setEmHover(false), 300)
    return () => clearTimeout(temporizador.current)
  }, [menuAberto, fixada, emHover])

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const alternarFixada = (valor: boolean) => {
    setFixada(valor)
    setEmHover(false)
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
      if (window.innerWidth >= 1024 && fixada) alternarFixada(false)
    }

    document.addEventListener("mousedown", aoClicarFora)
    return () => document.removeEventListener("mousedown", aoClicarFora)
  }, [fixada, menuAberto])

  // Navegar fecha a barra aberta por hover
  useEffect(() => setEmHover(false), [pathname])

  // Navegar fecha a barra no telemovel
  useEffect(() => setAbertaNoMovel(false), [pathname])

  const entradasVisiveis = NAVEGACAO.filter((item) => !item.permissao || pode(item.permissao))
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
        onMouseEnter={aoEntrarComORato}
        onMouseLeave={aoSairComORato}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-all duration-200 ease-in-out",
          aberta ? "w-64" : "w-[72px]",
          // Aberta por hover sobrepoe-se ao conteudo: a sombra separa as duas camadas
          !fixada && emHover && "shadow-2xl",
          abertaNoMovel ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Marca */}
        <div className="flex h-16 items-center justify-center border-b border-border px-3">
          {aberta ? (
            <MarcaDaEmpresa tamanho="sm" />
          ) : (
            <PanelLeft className="h-5 w-5 text-primary" aria-hidden />
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
                  aberta ? "gap-3 px-3 py-2" : "justify-center px-2 py-2.5",
                  ativo
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {aberta && <span className="truncate">{item.name}</span>}
              </Link>
            )

            if (aberta) return <div key={item.name}>{ligacao}</div>

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
                  aberta ? "gap-3 p-2" : "justify-center p-1.5",
                )}
                aria-label="Conta e definicoes"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {inicial}
                </span>
                {aberta && (
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

          {/*
            Fixar / recolher, so no computador.

            Aberta por hover a accao util e fixar, para a barra deixar de fechar
            ao tirar o rato. Fixa, a accao e recolher.
          */}
          <button
            type="button"
            onClick={() => alternarFixada(!fixada)}
            className={cn(
              "mt-2 hidden w-full items-center rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex",
              aberta ? "gap-2 px-3" : "justify-center px-2",
            )}
            aria-label={fixada ? "Recolher menu" : "Fixar menu aberto"}
          >
            {fixada ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
            {aberta && <span>{fixada ? "Recolher" : "Fixar aberto"}</span>}
          </button>
        </div>
      </div>

      {/* Fundo escurecido no telemovel */}
      {abertaNoMovel && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
    </TooltipProvider>
  )
}
