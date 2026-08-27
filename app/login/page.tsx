"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { EcraDeAcesso } from "@/components/layout/ecra-de-acesso"
import { useAuth } from "@/hooks/use-auth"
import { mensagemDeErroAuth } from "@/lib/auth-mensagens"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [palavraPasse, setPalavraPasse] = useState("")
  const [visivel, setVisivel] = useState(false)
  const [aEntrar, setAEntrar] = useState(false)
  const [erro, setErro] = useState("")
  const { login, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) router.push("/dashboard")
  }, [user, router])

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErro("")

    if (!email.trim()) return setErro("Indique o email.")
    if (!palavraPasse) return setErro("Indique a palavra-passe.")

    setAEntrar(true)
    try {
      await login(email.trim(), palavraPasse)
      router.push("/dashboard")
    } catch (error) {
      // A causa concreta vem do Firebase; so cai no texto geral se for desconhecida
      setErro(mensagemDeErroAuth(error, "Nao foi possivel entrar. Tente de novo."))
    } finally {
      setAEntrar(false)
    }
  }

  return (
    <EcraDeAcesso
      titulo="Entrar"
      descricao="Use as credenciais da sua conta para aceder ao sistema."
      rodape={
        <p className="text-center text-sm text-muted-foreground">
          Ainda nao tem conta?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Criar conta
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

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nome@empresa.pt"
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
            <Label htmlFor="palavra-passe">Palavra-passe</Label>
            <Link href="/recuperar-palavra-passe" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Esqueceu-se?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="palavra-passe"
              type={visivel ? "text" : "password"}
              autoComplete="current-password"
              placeholder="A sua palavra-passe"
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
              aria-label={visivel ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
            >
              {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full rounded-full" disabled={aEntrar}>
          {aEntrar ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              A entrar...
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </EcraDeAcesso>
  )
}
