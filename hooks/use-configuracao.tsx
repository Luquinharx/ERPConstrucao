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


/** A identidade fica em cache para o ecra de login, que nao tem sessao. */
const CHAVE_CACHE = "identidade-da-empresa"

function lerCache(): ConfiguracaoEmpresa | null {
  if (typeof window === "undefined") return null
  try {
    const guardado = window.localStorage.getItem(CHAVE_CACHE)
    return guardado ? (JSON.parse(guardado) as ConfiguracaoEmpresa) : null
  } catch {
    return null
  }
}

function gravarCache(config: ConfiguracaoEmpresa) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CHAVE_CACHE, JSON.stringify(config))
  } catch {
    // Sem espaco ou em navegacao privada: a identidade continua a vir do Firestore
  }
}

const ConfiguracaoContext = createContext<ConfiguracaoContextValue | undefined>(undefined)

export function ConfiguracaoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [configuracao, setConfiguracao] = useState<ConfiguracaoEmpresa>(CONFIGURACAO_PADRAO)
  const [carregando, setCarregando] = useState(true)

  // Aplica de imediato a ultima identidade conhecida, para nao haver salto visual
  // nem o ecra de login aparecer com a marca errada
  useEffect(() => {
    const emCache = lerCache()
    const inicial = emCache ? { ...CONFIGURACAO_PADRAO, ...emCache } : CONFIGURACAO_PADRAO
    if (emCache) setConfiguracao(inicial)
    aplicarIdentidade(inicial)
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
        gravarCache(completa)
      }
      setCarregando(false)
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [user])

  /**
   * Os tokens de apoio dependem do tema (claro/escuro), entao a identidade tem
   * de ser reaplicada quando o utilizador troca de tema. O next-themes muda a
   * classe do <html>, e e isso que se observa aqui.
   */
  useEffect(() => {
    if (typeof document === "undefined") return

    const observador = new MutationObserver(() => aplicarIdentidade(configuracao))
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observador.disconnect()
  }, [configuracao])

  const guardar = useCallback(
    async (novos: Partial<ConfiguracaoEmpresa>) => {
      if (!user) throw new Error("Utilizador nao autenticado")
      const completa = { ...configuracao, ...novos }
      await saveConfiguracaoEmpresa(completa, user.uid)
      setConfiguracao(completa)
      aplicarIdentidade(completa)
      gravarCache(completa)
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
