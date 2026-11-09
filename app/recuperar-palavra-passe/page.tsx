"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { EcraDeAcesso } from "@/components/layout/ecra-de-acesso"
import { pedirAuth, useAuth } from "@/hooks/use-auth"
import { mensagemDeErroAuth } from "@/lib/auth-mensagens"
import { t } from "@/lib/i18n"

export default function RecuperarPalavraPassePage() {
  // Vindo do link do email (?token=...): define a palavra-passe nova
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"))
  }, [])
  if (token) return <DefinirNova token={token} />
  return <PedirLink />
}

function DefinirNova({ token }: { token: string }) {
  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [aGravar, setAGravar] = useState(false)
  const [feito, setFeito] = useState(false)
  const [erro, setErro] = useState("")

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")
    if (senha.length < 6) return setErro(t("Use pelo menos 6 caracteres."))
    if (senha !== confirmar) return setErro(t("As duas palavras-passe não coincidem."))
    setAGravar(true)
    try {
      await pedirAuth("redefinir", { token, senha })
      setFeito(true)
    } catch (error) {
      setErro(mensagemDeErroAuth(error, t("Não foi possível guardar. Tente de novo.")))
    } finally {
      setAGravar(false)
    }
  }

  return (
    <EcraDeAcesso
      titulo={t("Palavra-passe nova")}
      descricao={t("Escolha a palavra-passe com que vai passar a entrar.")}
      voltar={{ href: "/login", texto: t("Voltar ao login") }}
    >
      {feito ? (
        <div className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{t("Palavra-passe guardada. Já pode entrar com ela.")}</AlertDescription>
          </Alert>
          <Button asChild className="w-full rounded-full">
            <Link href="/login">{t("Ir para o login")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submeter} className="space-y-4">
          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="senha-nova">{t("Palavra-passe nova")}</Label>
            <Input
              id="senha-nova"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="rounded-full"
              required
              disabled={aGravar}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha-confirmar">{t("Repita a palavra-passe")}</Label>
            <Input
              id="senha-confirmar"
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="rounded-full"
              required
              disabled={aGravar}
            />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={aGravar}>
            {aGravar ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            {t("Guardar palavra-passe")}
          </Button>
        </form>
      )}
    </EcraDeAcesso>
  )
}

function PedirLink() {
  const [email, setEmail] = useState("")
  const [aEnviar, setAEnviar] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState("")
  const { resetPassword } = useAuth()

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")

    if (!email.trim()) return setErro(t("Indique o email da conta."))

    setAEnviar(true)
    try {
      await resetPassword(email.trim())
      setEnviado(true)
    } catch (error) {
      setErro(mensagemDeErroAuth(error, t("Não foi possível enviar o email. Tente de novo.")))
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <EcraDeAcesso
      titulo={t("Recuperar palavra-passe")}
      descricao={t("Enviamos-lhe um link para definir uma nova palavra-passe.")}
      voltar={{ href: "/login", texto: t("Voltar ao login") }}
    >
      {enviado ? (
        <div className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              {(() => {
                const [antes, depois] = t(
                  "Se existir uma conta com {email}, o email com o link já seguiu. Verifique também a pasta de correio não solicitado.",
                ).split("{email}")
                return (
                  <>
                    {antes}
                    <strong>{email}</strong>
                    {depois}
                  </>
                )
              })()}
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full rounded-full">
            <Link href="/login">{t("Voltar ao login")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submeter} className="space-y-4">
          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t("Email da conta")}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("nome@empresa.pt")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-full pl-11"
                required
                disabled={aEnviar}
              />
            </div>
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={aEnviar}>
            {aEnviar ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {t("A enviar...")}
              </>
            ) : (
              t("Enviar link de recuperação")
            )}
          </Button>
        </form>
      )}
    </EcraDeAcesso>
  )
}
