"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { getUtilizador, guardarUtilizador } from "@/lib/firebase-service"
import { IMPLICITAS, type Permissao } from "@/lib/permissoes"
import type { UtilizadorSistema } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"

interface PermissoesContextValue {
  perfil: UtilizadorSistema | null
  carregando: boolean
  /** Verifica se o utilizador atual pode executar uma acao. */
  pode: (permissao: Permissao) => boolean
  recarregar: () => Promise<void>
}

const PermissoesContext = createContext<PermissoesContextValue | undefined>(undefined)

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState<UtilizadorSistema | null>(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!user) {
      setPerfil(null)
      setCarregando(false)
      return
    }

    try {
      // Contas só criadas pelo administrador, já com perfil. Uma conta sem
      // perfil (ex.: removida) fica sem acesso: não se cria nada sozinho.
      const existente = await getUtilizador(user.uid)
      if (existente) {
        // Regista a passagem, sem bloquear o arranque se falhar
        void guardarUtilizador(user.uid, { ultimoAcesso: new Date() }).catch(() => {})
      }

      setPerfil(existente)
    } catch (error) {
      console.error("Erro ao carregar o perfil de permissoes:", error)
      setPerfil(null)
    } finally {
      setCarregando(false)
    }
  }, [user])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const pode = useCallback(
    (permissao: Permissao) => {
      if (!perfil || !perfil.ativo) return false
      const tem = perfil.permissoes || []
      return tem.includes(permissao) || (IMPLICITAS[permissao] || []).some((p) => tem.includes(p))
    },
    [perfil],
  )

  const valor = useMemo(
    () => ({ perfil, carregando, pode, recarregar: carregar }),
    [perfil, carregando, pode, carregar],
  )

  return <PermissoesContext.Provider value={valor}>{children}</PermissoesContext.Provider>
}

export function usePermissoes() {
  const contexto = useContext(PermissoesContext)
  if (!contexto) throw new Error("usePermissoes tem de ser usado dentro de PermissoesProvider")
  return contexto
}
