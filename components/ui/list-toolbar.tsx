"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

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
  placeholder = "Pesquisar...",
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

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {showBack && (
            <Button type="button" variant="outline" onClick={handleBack} className="rounded-full bg-transparent sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
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
                aria-label="Limpar pesquisa"
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
            {typeof resultCount === "number" && (
              <>
                {resultCount} resultado{resultCount === 1 ? "" : "s"}
                {typeof totalCount === "number" ? ` de ${totalCount}` : ""}
              </>
            )}
            {hasSearch && <> para &quot;{searchTerm}&quot;</>}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
