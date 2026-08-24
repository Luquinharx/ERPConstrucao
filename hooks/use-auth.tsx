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
  updateUserPassword: (newPassword: string) => Promise<void>
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
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)

      toast({
        title: "Login realizado com sucesso",
        description: "Bem-vindo de volta!",
      })
    } catch (error: any) {
      console.error("Erro no login:", error)
      let message = "Erro ao fazer login"

      switch (error.code) {
        case "auth/user-not-found":
          message = "Usuário não encontrado"
          break
        case "auth/wrong-password":
          message = "Senha incorreta"
          break
        case "auth/invalid-email":
          message = "Email inválido"
          break
        case "auth/user-disabled":
          message = "Conta desativada"
          break
        case "auth/too-many-requests":
          message = "Muitas tentativas. Tente novamente mais tarde"
          break
        case "auth/network-request-failed":
          message = "Erro de conexão. Verifique sua internet"
          break
        case "auth/invalid-credential":
          message = "Credenciais inválidas. Verifique email e senha"
          break
        default:
          message = error.message || "Erro desconhecido"
      }

      toast({
        title: "Erro no login",
        description: message,
        variant: "destructive",
      })
      throw error
    }
  }

  const register = async (email: string, password: string, name?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)

      if (name && userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: name,
        })
      }

      toast({
        title: "Conta criada com sucesso",
        description: "Bem-vindo ao sistema!",
      })
    } catch (error: any) {
      console.error("Erro no registro:", error)
      let message = "Erro ao criar conta"

      switch (error.code) {
        case "auth/email-already-in-use":
          message = "Este email já está em uso"
          break
        case "auth/invalid-email":
          message = "Email inválido"
          break
        case "auth/weak-password":
          message = "Senha muito fraca. Use pelo menos 6 caracteres"
          break
        case "auth/network-request-failed":
          message = "Erro de conexão. Verifique sua internet"
          break
        default:
          message = error.message || "Erro desconhecido"
      }

      toast({
        title: "Erro no registro",
        description: message,
        variant: "destructive",
      })
      throw error
    }
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
    try {
      await sendPasswordResetEmail(auth, email)

      toast({
        title: "Email enviado",
        description: "Verifique sua caixa de entrada para redefinir a senha",
      })
    } catch (error: any) {
      console.error("Erro ao enviar email de recuperação:", error)
      let message = "Erro ao enviar email de recuperação"

      switch (error.code) {
        case "auth/user-not-found":
          message = "Usuário não encontrado"
          break
        case "auth/invalid-email":
          message = "Email inválido"
          break
        default:
          message = error.message || "Erro desconhecido"
      }

      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      })
      throw error
    }
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

  const updateUserPassword = async (newPassword: string) => {
    try {
      if (user) {
        await updatePassword(user, newPassword)
        toast({
          title: "Senha atualizada",
          description: "Sua senha foi alterada com sucesso",
        })
      }
    } catch (error: any) {
      console.error("Erro ao atualizar senha:", error)
      let message = "Erro ao atualizar senha"

      switch (error.code) {
        case "auth/weak-password":
          message = "Senha muito fraca. Use pelo menos 6 caracteres"
          break
        case "auth/requires-recent-login":
          message = "É necessário fazer login novamente para alterar a senha"
          break
        default:
          message = error.message || "Erro desconhecido"
      }

      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      })
      throw error
    }
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    resetPassword,
    updateUserProfile,
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
