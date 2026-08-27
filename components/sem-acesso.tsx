"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Home, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { usePermissoes } from "@/hooks/use-permissoes"
import { getCargo } from "@/lib/permissoes"

interface SemAcessoProps {
  /** Nome do ecra, para a mensagem dizer o que ficou por abrir. */
  area?: string
  /** O que seria preciso para entrar, em linguagem corrente. */
  requisito?: string
}

/**
 * Ecra mostrado quando falta permissao.
 *
 * Segue o mesmo desenho das restantes telas e nunca deixa a pessoa presa:
 * ha sempre como voltar atras ou ir para o painel.
 */
export function SemAcesso({ area, requisito }: SemAcessoProps) {
  const router = useRouter()
  const { perfil, carregando } = usePermissoes()

  if (carregando) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">{area || "Área restrita"}</h1>
        <p className="text-muted-foreground mt-2">Esta área depende de permissões que o seu cargo não tem.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </span>

          <div className="max-w-md space-y-2">
            <h2 className="text-lg font-medium">Sem acesso a esta área</h2>
            <p className="text-sm text-muted-foreground">
              {requisito
                ? `Para entrar aqui é preciso ${requisito}.`
                : "O seu cargo não inclui as permissões necessárias."}{" "}
              O seu cargo atual é <strong className="text-foreground">{getCargo(perfil?.cargo).nome}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Peça a quem administra o sistema para rever as suas permissões em Utilizadores e cargos.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => router.back()} className="rounded-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Ir para o Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
