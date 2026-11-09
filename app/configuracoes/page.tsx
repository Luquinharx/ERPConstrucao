"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { mensagemDeErroAuth } from "@/lib/auth-mensagens"
import { toast } from "@/hooks/use-toast"
import { useEffect, useState } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IdentidadeDaEmpresa } from "@/components/configuracoes/identidade-da-empresa"
import { TermosECondicoes } from "@/components/configuracoes/termos-e-condicoes"
import { GruposImpostos } from "@/components/configuracoes/grupos-impostos"
import { PrecosMargens } from "@/components/configuracoes/precos-margens"
import { t } from "@/lib/i18n"

export default function ConfiguracoesPage() {
  // A aba inicial pode vir da URL (?aba=termos), usada pelo redirecionamento antigo
  const [abaInicial, setAbaInicial] = useState("identidade")

  useEffect(() => {
    if (typeof window === "undefined") return
    const aba = new URLSearchParams(window.location.search).get("aba")
    if (aba === "termos" || aba === "conta" || aba === "impostos" || aba === "precos") setAbaInicial(aba)
  }, [])

  const { user, updateUserEmail, updateUserPassword } = useAuth()
  const [newEmail, setNewEmail] = useState(user?.email || "")
  const [currentPassword, setCurrentPassword] = useState("")
  // A troca de email tambem exige reautenticacao, por isso tem campo proprio
  const [passwordParaEmail, setPasswordParaEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newEmail) return

    setLoadingEmail(true)
    try {
      await updateUserEmail(newEmail, passwordParaEmail)
      setPasswordParaEmail("")
      toast({
        title: t("Email alterado"),
        description: t("A partir de agora entra com {email}.", { email: newEmail }),
      })
    } catch (error: any) {
      console.error("Erro ao atualizar email:", error)
      toast({
        title: t("Erro ao atualizar o email"),
        description: mensagemDeErroAuth(error, t("Não foi possível atualizar o email. Tente novamente.")),
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
        title: t("Campos obrigatórios"),
        description: t("Preencha todos os campos da palavra-passe."),
        variant: "destructive",
      })
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast({
        title: t("As palavras-passe não coincidem"),
        description: t("A nova palavra-passe e a confirmação não coincidem."),
        variant: "destructive",
      })
      return
    }

    setLoadingPassword(true)
    try {
      await updateUserPassword(currentPassword, newPassword)
      toast({
        title: t("Palavra-passe atualizada"),
        description: t("A sua palavra-passe foi atualizada com sucesso."),
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
    } catch (error: any) {
      console.error("Erro ao atualizar password:", error)
      toast({
        title: t("Erro ao atualizar a palavra-passe"),
        description: mensagemDeErroAuth(error, t("Não foi possível atualizar a palavra-passe. Tente novamente.")),
        variant: "destructive",
      })
    } finally {
      setLoadingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("Configurações")}</h1>
      <p className="text-muted-foreground">{t("Identidade da empresa, padrões das propostas e dados da sua conta.")}</p>

      {/* Controlado: com defaultValue a aba vinda da URL chegava tarde e era ignorada */}
      <Tabs value={abaInicial} onValueChange={setAbaInicial} className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-2 sm:grid-cols-5 h-auto">
          <TabsTrigger value="identidade">{t("Identidade e propostas")}</TabsTrigger>
          <TabsTrigger value="precos">{t("Preços")}</TabsTrigger>
          <TabsTrigger value="impostos">{t("Impostos")}</TabsTrigger>
          <TabsTrigger value="termos">{t("Termos e condições")}</TabsTrigger>
          <TabsTrigger value="conta">{t("A minha conta")}</TabsTrigger>
        </TabsList>

        <TabsContent value="identidade" className="mt-6">
          <IdentidadeDaEmpresa />
        </TabsContent>

        <TabsContent value="precos" className="mt-6">
          <PrecosMargens />
        </TabsContent>

        <TabsContent value="impostos" className="mt-6">
          <GruposImpostos />
        </TabsContent>

        <TabsContent value="termos" className="mt-6">
          <TermosECondicoes />
        </TabsContent>

        <TabsContent value="conta" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Informações da conta")}</CardTitle>
          <CardDescription>
            {t("Enviamos um pedido de confirmação para o endereço novo. A troca só fica feita depois de o confirmar.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("Email")}</Label>
              <Input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="rounded-full"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password-email">{t("Palavra-passe atual")}</Label>
              <Input
                id="password-email"
                type="password"
                autoComplete="current-password"
                placeholder={t("Para confirmar que é você")}
                value={passwordParaEmail}
                onChange={(e) => setPasswordParaEmail(e.target.value)}
                required
                className="rounded-full"
              />
            </div>
            <Button type="submit" disabled={loadingEmail} className="rounded-full">
              {loadingEmail ? <LoadingSpinner size="sm" className="text-white" /> : t("Atualizar email")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Alterar palavra-passe")}</CardTitle>
          <CardDescription>{t("Atualize a sua palavra-passe para manter a sua conta segura.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">{t("Palavra-passe atual")}</Label>
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
              <Label htmlFor="new-password">{t("Nova palavra-passe")}</Label>
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
              <Label htmlFor="confirm-new-password">{t("Confirmar nova palavra-passe")}</Label>
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
              {loadingPassword ? <LoadingSpinner size="sm" className="text-white" /> : t("Atualizar palavra-passe")}
            </Button>
          </form>
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>
    </div>
  )
}
