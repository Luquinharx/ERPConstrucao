"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import { useState } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function ConfiguracoesPage() {
  const { user, updateEmail, updatePassword } = useAuth()
  const [newEmail, setNewEmail] = useState(user?.email || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newEmail) return

    setLoadingEmail(true)
    try {
      await updateEmail(newEmail)
      toast({
        title: "Email atualizado",
        description: "O seu endereço de email foi atualizado com sucesso.",
      })
    } catch (error: any) {
      console.error("Erro ao atualizar email:", error)
      toast({
        title: "Erro ao atualizar email",
        description: error.message || "Ocorreu um erro ao atualizar o email. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoadingEmail(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !currentPassword || !newPassword || !confirmNewPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos de password.",
        variant: "destructive",
      })
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Passwords não coincidem",
        description: "A nova password e a confirmação não coincidem.",
        variant: "destructive",
      })
      return
    }

    setLoadingPassword(true)
    try {
      await updatePassword(currentPassword, newPassword)
      toast({
        title: "Password atualizada",
        description: "A sua password foi atualizada com sucesso.",
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
    } catch (error: any) {
      console.error("Erro ao atualizar password:", error)
      toast({
        title: "Erro ao atualizar password",
        description: error.message || "Ocorreu um erro ao atualizar a password. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoadingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <p className="text-muted-foreground">Gerencie as configurações da sua conta e do sistema.</p>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
          <CardDescription>Atualize o seu endereço de email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="rounded-full"
              />
            </div>
            <Button type="submit" disabled={loadingEmail} className="rounded-full">
              {loadingEmail ? <LoadingSpinner size="sm" className="text-white" /> : "Atualizar Email"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Password</CardTitle>
          <CardDescription>Atualize a sua password para manter a sua conta segura.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Password Atual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="rounded-full"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">Nova Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="rounded-full"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-new-password">Confirmar Nova Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                className="rounded-full"
              />
            </div>
            <Button type="submit" disabled={loadingPassword} className="rounded-full">
              {loadingPassword ? <LoadingSpinner size="sm" className="text-white" /> : "Atualizar Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Adicione outras seções de configuração aqui, se necessário */}
    </div>
  )
}
