"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Eye, EyeOff, Hash, KeyRound, Lock, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { EcraDeAcesso } from "@/components/layout/ecra-de-acesso"
import { useAuth } from "@/hooks/use-auth"
import { mensagemDeErroAuth } from "@/lib/auth-mensagens"
import { entrarComPin } from "@/lib/ponto-service"
import { t } from "@/lib/i18n"

const CHAVE_NUMERO = "ponto-ultimo-numero"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [palavraPasse, setPalavraPasse] = useState("")
  const [visivel, setVisivel] = useState(false)
  const [aEntrar, setAEntrar] = useState(false)
  const [erro, setErro] = useState("")
  const { login, user } = useAuth()
  const router = useRouter()
  /** email = gestao; pin = trabalhador (n.o do funcionario + PIN). */
  const [modo, setModo] = useState<"email" | "pin">("email")
  const [numero, setNumero] = useState("")
  const [pin, setPin] = useState("")

  // ?modo=pin abre logo no acesso do trabalhador: e o link que se lhe envia
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("modo") === "pin") setModo("pin")
    try {
      setNumero(window.localStorage.getItem(CHAVE_NUMERO) || "")
    } catch {
      // sem armazenamento: escreve-se o numero de cada vez
    }
  }, [])

  useEffect(() => {
    if (user) router.push(modo === "pin" ? "/picagem" : "/dashboard")
  }, [user, router, modo])

  const entrarPin = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")
    setAEntrar(true)
    try {
      await entrarComPin(numero, pin)
      try {
        window.localStorage.setItem(CHAVE_NUMERO, numero.trim())
      } catch {
        // ignorado
      }
      router.push("/picagem")
    } catch (error) {
      setErro(error instanceof Error ? error.message : t("Não foi possível entrar."))
      setPin("")
    } finally {
      setAEntrar(false)
    }
  }

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")

    if (!email.trim()) return setErro(t("Indique o email."))
    if (!palavraPasse) return setErro(t("Indique a palavra-passe."))

    setAEntrar(true)
    try {
      await login(email.trim(), palavraPasse)
      router.push("/dashboard")
    } catch (error) {
      // A causa concreta vem do servidor; so cai no texto geral se for desconhecida
      setErro(mensagemDeErroAuth(error, t("Não foi possível entrar. Tente de novo.")))
    } finally {
      setAEntrar(false)
    }
  }

  return (
    <EcraDeAcesso
      titulo={t("Entrar")}
      descricao={t("Use as credenciais da sua conta para aceder ao sistema.")}
      rodape={
        <p className="text-center text-sm text-muted-foreground">
          {t("Ainda não tem conta?")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("Criar conta")}
          </Link>
        </p>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm" role="tablist">
        {(
          [
            ["email", t("Email")],
            ["pin", t("N.º + PIN")],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={modo === id}
            onClick={() => {
              setModo(id)
              setErro("")
            }}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${modo === id ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {nome}
          </button>
        ))}
      </div>

      {modo === "pin" ? (
        <form onSubmit={entrarPin} className="space-y-4">
          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="numero">{t("N.º de funcionário")}</Label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="numero"
                inputMode="numeric"
                autoComplete="username"
                placeholder={t("Ex.: 03")}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="rounded-full pl-11"
                disabled={aEntrar}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">{t("PIN")}</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                placeholder={t("4 a 6 dígitos")}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="rounded-full pl-11 tracking-[0.4em]"
                disabled={aEntrar}
              />
            </div>
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={aEntrar}>
            {aEntrar ? t("A entrar...") : t("Entrar para picar")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("Esqueceu o PIN? Peça um novo ao seu encarregado.")}</p>
        </form>
      ) : (
      <form onSubmit={submeter} className="space-y-4">
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

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
              disabled={aEntrar}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="palavra-passe">{t("Palavra-passe")}</Label>
            <Link href="/recuperar-palavra-passe" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              {t("Esqueceu-se?")}
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="palavra-passe"
              type={visivel ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("A sua palavra-passe")}
              value={palavraPasse}
              onChange={(e) => setPalavraPasse(e.target.value)}
              className="rounded-full pl-11 pr-12"
              required
              disabled={aEntrar}
            />
            <button
              type="button"
              onClick={() => setVisivel(!visivel)}
              disabled={aEntrar}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={visivel ? t("Esconder palavra-passe") : t("Mostrar palavra-passe")}
            >
              {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full rounded-full" disabled={aEntrar}>
          {aEntrar ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              {t("A entrar...")}
            </>
          ) : (
            t("Entrar")
          )}
        </Button>
      </form>
      )}
    </EcraDeAcesso>
  )
}
