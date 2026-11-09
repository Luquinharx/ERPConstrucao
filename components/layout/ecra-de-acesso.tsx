"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarcaDaEmpresa } from "@/components/marca-da-empresa"
import { SeletorIdioma } from "@/components/seletor-idioma"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { t } from "@/lib/i18n"

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
      {/* Painel de marca, so em ecras largos: fotografia de obra (gerada no Gemini) */}
      <aside
        className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-zinc-900 p-10 text-white lg:flex"
        data-testid="painel-login"
      >
        <picture className="absolute inset-0">
          <source srcSet="/login/obra.webp" type="image/webp" />
          <img
            src="/login/obra.jpg"
            alt=""
            aria-hidden
            className="h-full w-full object-cover object-center"
            decoding="async"
          />
        </picture>
        {/* Escurece o fundo onde fica o texto, para ler bem sobre a fotografia */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/35 to-transparent" aria-hidden />

        <div className="relative w-fit rounded-2xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
          <MarcaDaEmpresa tamanho="lg" className="items-start" />
        </div>

        <div className="relative space-y-3">
          <div className="h-1 w-14 rounded-full bg-primary" aria-hidden />
          <p className="text-3xl font-semibold leading-tight drop-shadow">{configuracao.nome}</p>
          {configuracao.slogan && <p className="text-lg text-white/90">{configuracao.slogan}</p>}
          <p className="max-w-sm text-sm text-white/75">
            {t("Orçamentos, clientes, materiais e mão de obra no mesmo sítio.")}
          </p>
          <p className="pt-4 text-xs text-white/55">
            {configuracao.nif ? t("NIF {nif}", { nif: configuracao.nif }) : ""}
          </p>
        </div>
      </aside>

      {/* Formulario */}
      <main className="relative flex flex-1 items-center justify-center p-4 pt-16 sm:p-8 sm:pt-16">
        {/* Escolha do idioma, sempre visivel (telemovel e computador) */}
        <div className="absolute right-4 top-4 sm:right-6 sm:top-5">
          <SeletorIdioma />
        </div>
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
