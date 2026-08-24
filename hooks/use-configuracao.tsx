"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { CONFIGURACAO_PADRAO, aplicarIdentidade } from "@/lib/brand"
import { getConfiguracaoEmpresa, saveConfiguracaoEmpresa } from "@/lib/firebase-service"
import type { ConfiguracaoEmpresa } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"

interface ConfiguracaoContextValue {
  configuracao: ConfiguracaoEmpresa
  carregando: boolean
  guardar: (novos: Partial<ConfiguracaoEmpresa>) => Promise<void>
  /** Aplica a identidade sem gravar, para pre-visualizar mudancas. */
  prever: (novos: Partial<ConfiguracaoEmpresa>) => void
}

const ConfiguracaoContext = createContext<ConfiguracaoContextValue | undefined>(undefined)

export function ConfiguracaoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [configuracao, setConfiguracao] = useState<ConfiguracaoEmpresa>(CONFIGURACAO_PADRAO)
  const [carregando, setCarregando] = useState(true)

  // A identidade e aplicada logo com os valores por omissao, para nao haver salto visual
  useEffect(() => {
    aplicarIdentidade(CONFIGURACAO_PADRAO)
  }, [])

  useEffect(() => {
    let ativo = true

    const carregar = async () => {
      if (!user) {
        setCarregando(false)
        return
      }
      const guardada = await getConfiguracaoEmpresa()
      if (!ativo) return
      if (guardada) {
        const completa = { ...CONFIGURACAO_PADRAO, ...guardada }
        setConfiguracao(completa)
        aplicarIdentidade(completa)
      }
      setCarregando(false)
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [user])

  const guardar = useCallback(
    async (novos: Partial<ConfiguracaoEmpresa>) => {
      if (!user) throw new Error("Utilizador nao autenticado")
      const completa = { ...configuracao, ...novos }
      await saveConfiguracaoEmpresa(completa, user.uid)
      setConfiguracao(completa)
      aplicarIdentidade(completa)
    },
    [configuracao, user],
  )

  const prever = useCallback(
    (novos: Partial<ConfiguracaoEmpresa>) => aplicarIdentidade({ ...configuracao, ...novos }),
    [configuracao],
  )

  const valor = useMemo(
    () => ({ configuracao, carregando, guardar, prever }),
    [configuracao, carregando, guardar, prever],
  )

  return <ConfiguracaoContext.Provider value={valor}>{children}</ConfiguracaoContext.Provider>
}

export function useConfiguracao() {
  const contexto = useContext(ConfiguracaoContext)
  if (!contexto) throw new Error("useConfiguracao tem de ser usado dentro de ConfiguracaoProvider")
  return contexto
}
