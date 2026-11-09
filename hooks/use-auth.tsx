"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { t } from "@/lib/i18n"

/**
 * Sessao do utilizador. Os logins sao do proprio sistema (servidor na VM, em
 * /api/auth); a sessao vive num cookie httpOnly que o JavaScript nao le.
 * Os erros mantem os codigos do Firebase ("auth/invalid-credential"...), que
 * lib/auth-mensagens.ts traduz.
 */
export interface User {
  uid: string
  email: string | null
  displayName: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserProfile: (displayName: string) => Promise<void>
  /** Confirma a palavra-passe atual e muda o email de login. */
  updateUserEmail: (novoEmail: string, palavraPasseAtual: string) => Promise<void>
  updateUserPassword: (palavraPasseAtual: string, novaPalavraPasse: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export class ErroAuth extends Error {
  constructor(public code: string) {
    super(code)
  }
}

/** Chama /api/auth/<acao>. Lanca ErroAuth com o codigo que o servidor deu. */
export async function pedirAuth<T = { user?: User }>(acao: string, corpo: Record<string, unknown> = {}): Promise<T> {
  let r: Response
  try {
    r = await fetch(`/api/auth/${acao}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new ErroAuth("auth/network-request-failed")
  }
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new ErroAuth(json?.erro?.code || "auth/internal-error")
  // Avisa o AuthProvider (ex.: o login por n.o + PIN entra fora do hook)
  if (acao === "sair") window.dispatchEvent(new CustomEvent(EVENTO_SESSAO, { detail: null }))
  else if ("user" in json && acao !== "conta-ponto") window.dispatchEvent(new CustomEvent(EVENTO_SESSAO, { detail: json.user }))
  return json as T
}

const EVENTO_SESSAO = "erp-sessao"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    fetch("/api/auth/sessao", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((j) => ativo && setUser(j.user || null))
      .catch((e) => console.error("Erro ao ler a sessao:", e))
      .finally(() => ativo && setLoading(false))
    const aoMudar = (e: Event) => setUser(((e as CustomEvent).detail as User | null) || null)
    window.addEventListener(EVENTO_SESSAO, aoMudar)
    return () => {
      ativo = false
      window.removeEventListener(EVENTO_SESSAO, aoMudar)
    }
  }, [])

  const login = async (email: string, password: string) => {
    // O erro sobe tal como vem: o ecra traduz o codigo e mostra-o no formulario
    const r = await pedirAuth("entrar", { email, senha: password })
    setUser(r.user || null)
    toast({ title: t("Sessão iniciada"), description: t("Bem-vindo de volta.") })
  }

  const logout = async () => {
    try {
      await pedirAuth("sair")
      setUser(null)
      toast({ title: t("Sessão terminada"), description: t("Até logo!") })
    } catch (error) {
      console.error("Erro no logout:", error)
      toast({ title: t("Erro ao terminar sessão"), description: t("Não foi possível terminar a sessão."), variant: "destructive" })
      throw error
    }
  }

  const resetPassword = async (email: string) => {
    await pedirAuth("recuperar", { email })
  }

  const updateUserEmail = async (novoEmail: string, palavraPasseAtual: string) => {
    if (!user) throw new Error(t("Sem sessão iniciada."))
    const r = await pedirAuth("email", { novoEmail, senha: palavraPasseAtual })
    setUser(r.user || null)
  }

  const updateUserProfile = async (displayName: string) => {
    try {
      if (user) {
        const r = await pedirAuth("perfil", { nome: displayName })
        setUser(r.user || null)
        toast({ title: t("Perfil atualizado"), description: t("As suas informações foram atualizadas.") })
      }
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error)
      toast({ title: t("Erro"), description: t("Não foi possível atualizar o perfil."), variant: "destructive" })
      throw error
    }
  }

  const updateUserPassword = async (palavraPasseAtual: string, novaPalavraPasse: string) => {
    if (!user) throw new Error(t("Sem sessão iniciada."))
    await pedirAuth("palavra-passe", { atual: palavraPasseAtual, nova: novaPalavraPasse })
  }

  const value = {
    user,
    loading,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    updateUserEmail,
    updateUserPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
