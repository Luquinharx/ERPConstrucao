"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import {
  type User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  EmailAuthProvider,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { toast } from "@/hooks/use-toast"

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserProfile: (displayName: string) => Promise<void>
  /** Pede confirmacao no email novo; so muda depois de a pessoa clicar. */
  updateUserEmail: (novoEmail: string, palavraPasseAtual: string) => Promise<void>
  updateUserPassword: (palavraPasseAtual: string, novaPalavraPasse: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    
    // Timeout de segurança para evitar loading infinito
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false)
      }
    }, 5000) // 5 segundos de timeout

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeoutId)
      setUser(user)
      setLoading(false)
    }, (error) => {
      console.error("Erro no listener de autenticação:", error)
      clearTimeout(timeoutId)
      setLoading(false)
    })

    return () => {
      clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    // O erro sobe tal como vem: o ecra traduz o codigo e mostra-o no formulario
    await signInWithEmailAndPassword(auth, email, password)
    toast({ title: "Sessao iniciada", description: "Bem-vindo de volta." })
  }

  const register = async (email: string, password: string, name?: string) => {
    const credenciais = await createUserWithEmailAndPassword(auth, email, password)
    if (name && credenciais.user) await updateProfile(credenciais.user, { displayName: name })
    toast({ title: "Conta criada", description: "Bem-vindo ao sistema." })
  }

  const logout = async () => {
    try {
      await signOut(auth)

      toast({
        title: "Logout realizado",
        description: "Até logo!",
      })
    } catch (error: any) {
      console.error("Erro no logout:", error)
      toast({
        title: "Erro no logout",
        description: "Não foi possível fazer logout",
        variant: "destructive",
      })
      throw error
    }
  }

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  /**
   * Confirma que e mesmo a pessoa antes de mexer nas credenciais.
   *
   * Sem isto, quem entrou ha mais de uns minutos recebia
   * "auth/requires-recent-login" e o formulario falhava sem explicacao.
   */
  const reautenticar = async (palavraPasseAtual: string) => {
    if (!user?.email) throw new Error("Sem sessao iniciada.")
    const credencial = EmailAuthProvider.credential(user.email, palavraPasseAtual)
    await reauthenticateWithCredential(user, credencial)
  }

  const updateUserEmail = async (novoEmail: string, palavraPasseAtual: string) => {
    if (!user) throw new Error("Sem sessao iniciada.")
    await reautenticar(palavraPasseAtual)
    await verifyBeforeUpdateEmail(user, novoEmail)
  }

  const updateUserProfile = async (displayName: string) => {
    try {
      if (user) {
        await updateProfile(user, { displayName })
        toast({
          title: "Perfil atualizado",
          description: "Suas informações foram atualizadas com sucesso",
        })
      }
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil",
        variant: "destructive",
      })
      throw error
    }
  }

  const updateUserPassword = async (palavraPasseAtual: string, novaPalavraPasse: string) => {
    if (!user) throw new Error("Sem sessao iniciada.")
    await reautenticar(palavraPasseAtual)
    await updatePassword(user, novaPalavraPasse)
  }

  const value = {
    user,
    loading,
    login,
    register,
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
