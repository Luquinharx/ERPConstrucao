"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Termo de busca sincronizado com a URL (?q=...).
 *
 * - Le o valor inicial da URL, entao ao voltar para a tela a busca continua aplicada.
 * - Escreve com history.replaceState (nao usa useSearchParams para nao exigir Suspense no build).
 * - O filtro e sempre aplicado em memoria sobre os dados carregados, entao passa a valer
 *   automaticamente assim que os dados chegam, sem precisar clicar em pesquisar.
 */
export function useSearchQuery(paramName = "q") {
  const [searchTerm, setSearchTermState] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    const initial = new URLSearchParams(window.location.search).get(paramName)
    if (initial) setSearchTermState(initial)
  }, [paramName])

  const setSearchTerm = useCallback(
    (value: string) => {
      setSearchTermState(value)

      if (typeof window === "undefined") return
      const params = new URLSearchParams(window.location.search)
      if (value.trim()) {
        params.set(paramName, value)
      } else {
        params.delete(paramName)
      }
      const query = params.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
    },
    [paramName],
  )

  const clearSearch = useCallback(() => setSearchTerm(""), [setSearchTerm])

  return { searchTerm, setSearchTerm, clearSearch }
}
