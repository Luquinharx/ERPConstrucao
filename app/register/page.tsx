"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Eye, EyeOff, Info, Lock, Mail, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { EcraDeAcesso } from "@/components/layout/ecra-de-acesso"
import { useAuth } from "@/hooks/use-auth"
import { mensagemDeErroAuth } from "@/lib/auth-mensagens"
import { t } from "@/lib/i18n"

export default function RegisterPage() {
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [palavraPasse, setPalavraPasse] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [visivel, setVisivel] = useState(false)
  const [aCriar, setACriar] = useState(false)
  const [erro, setErro] = useState("")
  const { register, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) router.push("/dashboard")
  }, [user, router])

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")

    if (!nome.trim()) return setErro(t("Indique o seu nome."))
    if (!email.trim()) return setErro(t("Indique o email."))
    if (palavraPasse.length < 6) return setErro(t("A palavra-passe tem de ter pelo menos 6 caracteres."))
    if (palavraPasse !== confirmacao) return setErro(t("As palavras-passe não coincidem."))

    setACriar(true)
    try {
      await register(email.trim(), palavraPasse, nome.trim())
      router.push("/dashboard")
    } catch (error) {
      setErro(mensagemDeErroAuth(error, t("Não foi possível criar a conta. Tente de novo.")))
    } finally {
      setACriar(false)
    }
  }

  return (
    <EcraDeAcesso
      titulo={t("Criar conta")}
      descricao={t("Crie o seu acesso ao sistema.")}
      voltar={{ href: "/login", texto: t("Voltar ao login") }}
      rodape={
        <p className="text-center text-sm text-muted-foreground">
          {t("Já tem conta?")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("Entrar")}
          </Link>
        </p>
      }
    >
      <form onSubmit={submeter} className="space-y-4">
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {/* Sem isto, quem se regista entra e ve um sistema vazio sem perceber porque */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {(() => {
              const [antes, depois] = t(
                "As contas novas entram em modo de {consulta}. Quem administra o sistema atribui depois o cargo e as permissões em Utilizadores e cargos.",
              ).split("{consulta}")
              return (
                <>
                  {antes}
                  <strong>{t("consulta")}</strong>
                  {depois}
                </>
              )
            })()}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="nome">{t("Nome")}</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="nome"
              autoComplete="name"
              placeholder={t("Nome completo")}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-full pl-11"
              required
              disabled={aCriar}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("Email")}</Label>
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
              disabled={aCriar}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="palavra-passe">{t("Palavra-passe")}</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="palavra-passe"
                type={visivel ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("Mín. 6 caracteres")}
                value={palavraPasse}
                onChange={(e) => setPalavraPasse(e.target.value)}
                className="rounded-full pl-11 pr-12"
                required
                disabled={aCriar}
              />
              <button
                type="button"
                onClick={() => setVisivel(!visivel)}
                disabled={aCriar}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={visivel ? t("Esconder palavra-passe") : t("Mostrar palavra-passe")}
              >
                {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmacao">{t("Confirmar")}</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmacao"
                type={visivel ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("Repita a palavra-passe")}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                className="rounded-full pl-11"
                required
                disabled={aCriar}
              />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full rounded-full" disabled={aCriar}>
          {aCriar ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              {t("A criar conta...")}
            </>
          ) : (
            t("Criar conta")
          )}
        </Button>
      </form>
    </EcraDeAcesso>
  )
}
