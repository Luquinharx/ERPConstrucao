"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarcaDaEmpresa } from "@/components/marca-da-empresa"
import { useConfiguracao } from "@/hooks/use-configuracao"

interface EcraDeAcessoProps {
  titulo: string
  descricao: string
  children: ReactNode
  /** Ligacao de retorno no topo do cartao. */
  voltar?: { href: string; texto: string }
  /** Linha de ligacoes no fundo do cartao. */
  rodape?: ReactNode
}

/**
 * Casca comum ao login, registo e recuperacao de palavra-passe.
 *
 * Estes ecras tinham ficado de fora da identidade da empresa. Passam a usar a
 * marca configurada, tal como o resto do sistema, e cada um tem sempre como
 * voltar ao anterior.
 */
export function EcraDeAcesso({ titulo, descricao, children, voltar, rodape }: EcraDeAcessoProps) {
  const { configuracao } = useConfiguracao()

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Painel de marca, so em ecras largos */}
      <aside className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-black/10" aria-hidden />

        <div className="relative">
          <MarcaDaEmpresa tamanho="lg" fundo="claro" classeTexto="text-primary-foreground" className="items-start" />
        </div>

        <div className="relative space-y-3">
          <p className="text-3xl font-semibold leading-tight">{configuracao.nome}</p>
          {configuracao.slogan && <p className="text-lg opacity-90">{configuracao.slogan}</p>}
          <p className="max-w-sm text-sm opacity-75">
            Orcamentos, clientes, materiais e mao de obra no mesmo sitio.
          </p>
        </div>

        <p className="relative text-xs opacity-60">
          {configuracao.nif ? `NIF ${configuracao.nif}` : ""}
        </p>
      </aside>

      {/* Formulario */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md border-border/60 shadow-lg">
          <CardHeader className="space-y-3">
            {/* A marca repete-se no topo quando o painel lateral nao cabe */}
            <div className="lg:hidden">
              <MarcaDaEmpresa tamanho="md" comSlogan className="mb-2" />
            </div>

            {voltar && (
              <Link
                href={voltar.href}
                className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 -ml-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                {voltar.texto}
              </Link>
            )}

            <div>
              <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
              <CardDescription className="mt-1">{descricao}</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {children}
            {rodape}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
