"use client"

import type React from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { Sidebar } from "./sidebar"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SemAcesso } from "@/components/sem-acesso"
import { entradaDaRota } from "@/lib/navegacao"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, loading } = useAuth()
  const { pode, carregando: carregandoPerfil } = usePermissoes()
  const pathname = usePathname()
  const router = useRouter()

  /**
   * Sem sessao, volta ao login.
   *
   * Antes ficava um ecra branco a espera de um redirecionamento que nao existia
   * em lado nenhum: quem abrisse um endereco protegido sem sessao ficava preso.
   */
  useEffect(() => {
    if (!loading && !user) router.replace("/login")
  }, [loading, user, router])

  if (loading || (user && carregandoPerfil)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const entrada = entradaDaRota(pathname)
  const semPermissao = entrada?.permissao && !pode(entrada.permissao)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto transition-[margin] duration-200 lg:[margin-left:var(--largura-barra)]">
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {semPermissao ? <SemAcesso area={entrada?.name} /> : children}
        </div>
      </main>
    </div>
  )
}
