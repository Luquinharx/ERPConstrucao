"use client"

import { useConfiguracao } from "@/hooks/use-configuracao"
import { cn } from "@/lib/utils"

interface MarcaDaEmpresaProps {
  /** Altura maxima do logotipo. */
  tamanho?: "sm" | "md" | "lg"
  /** Mostrar o descritivo por baixo do nome. */
  comSlogan?: boolean
  className?: string
}

const ALTURAS = {
  sm: "max-h-8",
  md: "max-h-12",
  lg: "max-h-16",
}

const TEXTOS = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
}

/**
 * Logotipo da empresa, com o nome como alternativa quando nao ha imagem.
 * Tudo vem da configuracao, entao acompanha a empresa que estiver a usar o sistema.
 */
export function MarcaDaEmpresa({ tamanho = "md", comSlogan = false, className }: MarcaDaEmpresaProps) {
  const { configuracao } = useConfiguracao()

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {configuracao.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={configuracao.logoUrl}
          alt={configuracao.nome}
          className={cn("w-auto object-contain", ALTURAS[tamanho])}
        />
      ) : (
        <span className={cn("font-bold text-primary", TEXTOS[tamanho])}>{configuracao.nome}</span>
      )}

      {comSlogan && configuracao.slogan && (
        <span className="text-sm text-muted-foreground">{configuracao.slogan}</span>
      )}
    </div>
  )
}
