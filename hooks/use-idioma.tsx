"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"

import {
  COOKIE_IDIOMA,
  definirIdiomaGlobal,
  ehIdioma,
  idiomaDoNavegador,
  t as traduzir,
  type Idioma,
} from "@/lib/i18n"

const CHAVE = "erp_idioma"

interface IdiomaContexto {
  idioma: Idioma
  mudarIdioma: (idioma: Idioma) => void
  t: typeof traduzir
}

const Contexto = createContext<IdiomaContexto | undefined>(undefined)

/**
 * Idioma escolhido neste aparelho (cookie + localStorage).
 *
 * O servidor lê o cookie para o primeiro desenho já sair no idioma certo. Ao
 * mudar, a árvore toda volta a desenhar-se (key={idioma}): textos, números,
 * datas e listas passam todos ao idioma novo, sem nada a meio.
 */
export function IdiomaProvider({
  inicial,
  escolhido,
  children,
}: {
  /** Idioma com que o servidor desenhou a página (cookie ou browser). */
  inicial: Idioma
  /** true se veio do cookie (escolha da pessoa); false se foi adivinhado. */
  escolhido: boolean
  children: React.ReactNode
}) {
  const [idioma, setIdioma] = useState<Idioma>(inicial)
  definirIdiomaGlobal(idioma)

  const gravar = (i: Idioma) => {
    try {
      window.localStorage.setItem(CHAVE, i)
    } catch {
      // sem armazenamento local: fica so o cookie
    }
    document.cookie = `${COOKIE_IDIOMA}=${i}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    document.documentElement.lang = i
  }

  // Primeira visita (sem cookie): usa o que ficou guardado ou o idioma do browser
  useEffect(() => {
    if (escolhido) return
    let alvo: Idioma
    try {
      const guardado = window.localStorage.getItem(CHAVE)
      alvo = ehIdioma(guardado) ? guardado : idiomaDoNavegador(navigator.language)
    } catch {
      alvo = idiomaDoNavegador(navigator.language)
    }
    gravar(alvo)
    if (alvo !== idioma) setIdioma(alvo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mudarIdioma = useCallback((novo: Idioma) => {
    definirIdiomaGlobal(novo)
    gravar(novo)
    setIdioma(novo)
  }, [])

  return (
    <Contexto.Provider value={{ idioma, mudarIdioma, t: traduzir }}>
      <div key={idioma} className="contents">
        {children}
      </div>
    </Contexto.Provider>
  )
}

export function useIdioma(): IdiomaContexto {
  const c = useContext(Contexto)
  if (!c) throw new Error("useIdioma tem de estar dentro de IdiomaProvider")
  return c
}
