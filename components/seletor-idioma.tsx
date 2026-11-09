"use client"

import { Check, Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useIdioma } from "@/hooks/use-idioma"
import { IDIOMAS, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * Escolha do idioma: Português (Portugal), Português (Brasil) ou English.
 * Os nomes dos idiomas aparecem sempre na própria língua, para quem não
 * percebe o idioma atual conseguir encontrar o seu. Sem bandeiras: no Windows
 * os emojis de bandeira aparecem como letras soltas.
 */
export function SeletorIdioma({ compacto = false, className }: { compacto?: boolean; className?: string }) {
  const { idioma, mudarIdioma } = useIdioma()
  const atual = IDIOMAS.find((i) => i.id === idioma) || IDIOMAS[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compacto ? "icon" : "sm"}
          className={cn("gap-1.5 rounded-full", className)}
          aria-label={`${t("Idioma")}: ${atual.nome}`}
          title={atual.nome}
          data-testid="seletor-idioma"
        >
          <Languages className="h-4 w-4" />
          {!compacto && <span className="text-xs font-semibold tracking-wide">{atual.curto}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {IDIOMAS.map((i) => (
          <DropdownMenuItem key={i.id} onClick={() => mudarIdioma(i.id)} data-idioma={i.id} lang={i.id} className="gap-3">
            <span className="w-6 text-xs font-semibold text-muted-foreground">{i.curto}</span>
            <span className="flex-1">{i.nome}</span>
            {i.id === idioma && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
