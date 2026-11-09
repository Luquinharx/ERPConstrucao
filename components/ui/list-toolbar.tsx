"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { t } from "@/lib/i18n"

interface ListToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  /** Quantidade de registos apos o filtro. */
  resultCount?: number
  /** Quantidade total de registos carregados. */
  totalCount?: number
  /** Rota de retorno; por omissao usa o historico do navegador. */
  backHref?: string
  showBack?: boolean
  /** Filtros extra (selects, etc.) exibidos ao lado da busca. */
  children?: ReactNode
}

/**
 * Barra padrao das listagens: busca automatica (filtra enquanto escreve),
 * botao Limpar e botao Voltar.
 */
export function ListToolbar({
  searchTerm,
  onSearchChange,
  onClear,
  placeholder = t("Pesquisar..."),
  resultCount,
  totalCount,
  backHref,
  showBack = true,
  children,
}: ListToolbarProps) {
  const router = useRouter()
  const hasSearch = searchTerm.trim().length > 0

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
      return
    }
    router.back()
  }

  const handleClear = () => {
    if (onClear) {
      onClear()
      return
    }
    onSearchChange("")
  }

  // Frases inteiras para cada caso (singular/plural, com total, com pesquisa), para traduzir bem
  const resumo = (() => {
    const termo = searchTerm
    if (typeof resultCount !== "number") return t("Resultados para \"{termo}\"", { termo })
    const n = resultCount
    const um = n === 1
    const total = totalCount
    if (typeof total === "number") {
      if (hasSearch) {
        return um
          ? t("{n} resultado de {total} para \"{termo}\"", { n, total, termo })
          : t("{n} resultados de {total} para \"{termo}\"", { n, total, termo })
      }
      return um ? t("{n} resultado de {total}", { n, total }) : t("{n} resultados de {total}", { n, total })
    }
    if (hasSearch) {
      return um ? t("{n} resultado para \"{termo}\"", { n, termo }) : t("{n} resultados para \"{termo}\"", { n, termo })
    }
    return um ? t("{n} resultado", { n }) : t("{n} resultados", { n })
  })()

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {showBack && (
            <Button type="button" variant="outline" onClick={handleBack} className="rounded-full bg-transparent sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("Voltar")}
            </Button>
          )}

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={placeholder}
              className="pl-10 pr-10 rounded-full"
              aria-label={placeholder}
            />
            {hasSearch && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={t("Limpar pesquisa")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {children}
        </div>

        {(hasSearch || typeof resultCount === "number") && (
          <p className="mt-3 text-xs text-muted-foreground">
            {resumo}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
